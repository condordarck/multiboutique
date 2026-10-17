import { aPermission, type ProduitFormData } from "@multiboutique/shared";
import { exigerAccesBoutique, peutAccederBoutique } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";
import { insererMouvementWithClient } from "./interne";

// Produits, stock et prix : repris de lib/actions/index.ts, SQL inchangé.

export async function creerProduit(db: Db, user: Utilisateur, 
  boutiqueId: string,
  data: ProduitFormData,
  prixVente: number,
  coutRevient?: number
) {
  exigerAccesBoutique(user, boutiqueId, ["produits:gerer"]);

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Le produit existe-t-il déjà par référence ?
    const { rows: existRows } = await client.query(
      `SELECT id FROM produits WHERE reference = $1`,
      [data.reference]
    );

    // Code produit (nomenclature) : fourni par l'utilisateur ou généré
    let code: string;
    if (data.code && data.code.trim()) {
      code = data.code.trim().toUpperCase();
      if (!/^[A-Z0-9-]{2,20}$/.test(code)) {
        throw new ErreurMetier("Code produit invalide (lettres, chiffres, tirets uniquement)");
      }
      const { rows: dupe } = await client.query(
        `SELECT 1 FROM produits WHERE code = $1`,
        [code]
      );
      if (dupe.length > 0) throw new ErreurMetier("Ce code produit existe déjà");
    } else {
      const { rows: prefixRows } = await client.query(
        `SELECT COALESCE((SELECT code FROM categories WHERE id = $1), 'PRD') AS prefix`,
        [data.categorie_id || null]
      );
      const prefix = prefixRows[0].prefix;
      const { rows: last } = await client.query(
        `SELECT code FROM produits WHERE code LIKE $1 ORDER BY code DESC LIMIT 1`,
        [`${prefix}-%`]
      );
      const seq = last.length ? parseInt(last[0].code.split("-").pop(), 10) + 1 : 1;
      code = `${prefix}-${String(seq).padStart(4, "0")}`;
    }

    let produitId: string;
    if (existRows.length > 0) {
      produitId = existRows[0].id;
      await client.query(
        `UPDATE produits SET code = $1, updated_at = NOW() WHERE id = $2`,
        [code, produitId]
      );
    } else {
      const { rows: newRows } = await client.query(
        `INSERT INTO produits (reference, nom, description, categorie_id, image_url, code)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          data.reference,
          data.nom,
          data.description || null,
          data.categorie_id || null,
          data.image_url || null,
          code,
        ]
      );
      produitId = newRows[0].id;
    }

    // Prix pour cette boutique (upsert)
    await client.query(
      `INSERT INTO prix_boutique (produit_id, boutique_id, prix_vente, cout_revient, actif)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (produit_id, boutique_id)
       DO UPDATE SET prix_vente = $3, cout_revient = $4, actif = true, updated_at = NOW()`,
      [produitId, boutiqueId, prixVente, coutRevient ?? null]
    );

    // Ligne de stock (upsert) — seuil d'alerte depuis les paramètres généraux
    await client.query(
      `INSERT INTO stocks (produit_id, boutique_id, quantite, quantite_reservee, seuil_alerte)
       VALUES ($1, $2, 0, 0, COALESCE((SELECT valeur::integer FROM parametres WHERE cle = 'seuil_alerte_defaut'), 10))
       ON CONFLICT (produit_id, boutique_id) DO NOTHING`,
      [produitId, boutiqueId]
    );

    await client.query("COMMIT");

    return { success: true, produitId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function entrerStock(db: Db, user: Utilisateur, 
  boutiqueId: string,
  produitId: string,
  quantite: number,
  motif: string
) {
  exigerAccesBoutique(user, boutiqueId, ["stock:gerer"]);
  if (quantite <= 0) throw new ErreurMetier("La quantité doit être positive");

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: stockRows } = await client.query(
      `SELECT quantite FROM stocks WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
      [produitId, boutiqueId]
    );
    if (stockRows.length === 0) throw new ErreurMetier("Stock introuvable", 404);
    const quantiteAvant = Number(stockRows[0].quantite);

    await client.query(
      `UPDATE stocks SET quantite = quantite + $1, updated_at = NOW()
       WHERE produit_id = $2 AND boutique_id = $3`,
      [quantite, produitId, boutiqueId]
    );

    await insererMouvementWithClient(client, {
      produit_id: produitId,
      boutique_id: boutiqueId,
      type: "entree",
      quantite,
      quantite_avant: quantiteAvant,
      quantite_apres: quantiteAvant + quantite,
      motif: motif || "Réception marchandise",
      auteur_id: user.id,
    });

    await client.query("COMMIT");

    return { success: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ajusterStock(db: Db, user: Utilisateur, 
  boutiqueId: string,
  produitId: string,
  nouvelleQuantite: number,
  motif: string
) {
  exigerAccesBoutique(user, boutiqueId, ["stock:gerer"]);
  if (nouvelleQuantite < 0) throw new ErreurMetier("La quantité ne peut pas être négative");

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: stockRows } = await client.query(
      `SELECT quantite, quantite_reservee FROM stocks WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
      [produitId, boutiqueId]
    );
    if (stockRows.length === 0) throw new ErreurMetier("Stock introuvable", 404);
    const quantiteAvant = Number(stockRows[0].quantite);

    if (nouvelleQuantite < Number(stockRows[0].quantite_reservee)) {
      throw new ErreurMetier(
        "Ajustement impossible : la quantité serait inférieure au stock réservé");
    }

    await client.query(
      `UPDATE stocks SET quantite = $1, updated_at = NOW()
       WHERE produit_id = $2 AND boutique_id = $3`,
      [nouvelleQuantite, produitId, boutiqueId]
    );

    await insererMouvementWithClient(client, {
      produit_id: produitId,
      boutique_id: boutiqueId,
      type: "ajustement",
      quantite: Math.abs(nouvelleQuantite - quantiteAvant),
      quantite_avant: quantiteAvant,
      quantite_apres: nouvelleQuantite,
      motif: motif || "Ajustement manuel",
      auteur_id: user.id,
    });

    await client.query("COMMIT");

    return { success: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function transfertStock(db: Db, user: Utilisateur, 
  boutiqueSourceId: string,
  boutiqueDestId: string,
  produitId: string,
  quantite: number,
  motif: string
) {
  exigerAccesBoutique(user, boutiqueSourceId, ["stock:gerer"]);
  if (!peutAccederBoutique(user, boutiqueDestId)) {
    throw new ErreurMetier("Accès refusé à la boutique de destination", 403);
  }
  if (quantite <= 0) throw new ErreurMetier("La quantité doit être positive");
  if (boutiqueSourceId === boutiqueDestId)
    throw new ErreurMetier("Les boutiques doivent être différentes");

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Déduire de la source
    const { rows: srcRows } = await client.query(
      `SELECT quantite FROM stocks WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
      [produitId, boutiqueSourceId]
    );
    const srcAvant = srcRows.length ? Number(srcRows[0].quantite) : 0;

    await client.query(
      `SELECT deduire_stock($1::uuid, $2::uuid, $3::integer)`,
      [produitId, boutiqueSourceId, quantite]
    );

    // Ajouter à la destination
    const { rows: dstRows } = await client.query(
      `SELECT quantite FROM stocks WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
      [produitId, boutiqueDestId]
    );
    const dstAvant = dstRows.length ? Number(dstRows[0].quantite) : 0;

    await client.query(
      `UPDATE stocks SET quantite = quantite + $1, updated_at = NOW()
       WHERE produit_id = $2 AND boutique_id = $3`,
      [quantite, produitId, boutiqueDestId]
    );

    // Mouvements (2 lignes : sortie source + entrée destination)
    await insererMouvementWithClient(client, {
      produit_id: produitId,
      boutique_id: boutiqueSourceId,
      type: "transfert",
      quantite,
      quantite_avant: srcAvant,
      quantite_apres: srcAvant - quantite,
      motif: motif || "Transfert inter-boutiques",
      boutique_destination_id: boutiqueDestId,
      auteur_id: user.id,
    });
    await insererMouvementWithClient(client, {
      produit_id: produitId,
      boutique_id: boutiqueDestId,
      type: "transfert",
      quantite,
      quantite_avant: dstAvant,
      quantite_apres: dstAvant + quantite,
      motif: motif || "Transfert inter-boutiques",
      boutique_destination_id: boutiqueSourceId,
      auteur_id: user.id,
    });

    await client.query("COMMIT");

    return { success: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function modifierPrix(db: Db, user: Utilisateur, 
  boutiqueId: string,
  produitId: string,
  prixVente: number,
  coutRevient?: number
) {
  exigerAccesBoutique(user, boutiqueId, ["prix:gerer"]);
  if (prixVente <= 0) throw new ErreurMetier("Le prix de vente doit être positif");

  await db.query(
    `UPDATE prix_boutique
     SET prix_vente = $3, cout_revient = $4, actif = true, updated_at = NOW()
     WHERE produit_id = $1 AND boutique_id = $2`,
    [produitId, boutiqueId, prixVente, coutRevient ?? null]
  );

  return { success: true };
}

export async function publierPrixReference(db: Db, user: Utilisateur, 
  data: {
    produit_id: string;
    prix_vente: number;
    cout_revient?: number | null;
    actif?: boolean;
  }
) {
  if (!aPermission(user, "prix_conseilles:gerer")) {
    throw new ErreurMetier("Réservé au siège (propriétaire)", 403);
  }

  const prixVente = Number(data.prix_vente);
  if (!prixVente || prixVente <= 0) throw new ErreurMetier("Prix de vente invalide");

  await db.query(
    `INSERT INTO prix_reference (produit_id, prix_vente, cout_revient, actif, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (produit_id) DO UPDATE
       SET prix_vente = EXCLUDED.prix_vente,
           cout_revient = EXCLUDED.cout_revient,
           actif = EXCLUDED.actif,
           created_by = EXCLUDED.created_by,
           updated_at = NOW()`,
    [
      data.produit_id,
      prixVente,
      data.cout_revient != null ? Number(data.cout_revient) : null,
      data.actif !== false,
      user.id,
    ]
  );

  return { success: true };
}

export async function appliquerPrixConseilles(db: Db, user: Utilisateur, 
  boutiqueId: string,
  produitIds?: string[]
) {
  exigerAccesBoutique(user, boutiqueId, ["prix:gerer"]);

  const params: unknown[] = [];
  let filtreProduits = "";
  if (produitIds && produitIds.length > 0) {
    filtreProduits = `AND pr.produit_id = ANY($1::uuid[])`;
    params.push(produitIds);
  }

  const { rows } = await db.query<{
    produit_id: string;
    prix_vente: string;
    cout_revient: string | null;
  }>(
    `SELECT pr.produit_id, pr.prix_vente, pr.cout_revient
     FROM prix_reference pr
     INNER JOIN produits p ON p.id = pr.produit_id
     WHERE pr.actif = true ${filtreProduits}`,
    params
  );
  if (rows.length === 0) {
    throw new ErreurMetier("Aucun prix conseillé actif à appliquer");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `INSERT INTO prix_boutique (produit_id, boutique_id, prix_vente, cout_revient, actif)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (produit_id, boutique_id) DO UPDATE
           SET prix_vente = EXCLUDED.prix_vente,
               cout_revient = EXCLUDED.cout_revient,
               actif = true,
               updated_at = NOW()`,
        [row.produit_id, boutiqueId, Number(row.prix_vente), row.cout_revient ? Number(row.cout_revient) : null]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { success: true, appliques: rows.length };
}
