import type { CommandeFournisseurFormData, FournisseurFormData } from "@multiboutique/shared";
import { exigerAccesBoutique } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";
import { exigerFournisseurDeLaBoutique, genererReference, insererMouvementWithClient, type Requeteur } from "./interne";

// Fournisseurs et commandes d'achat : repris de lib/actions/index.ts, SQL inchangé.

export async function creerFournisseur(db: Db, user: Utilisateur, 
  boutiqueId: string,
  data: FournisseurFormData
) {
  exigerAccesBoutique(user, boutiqueId, ["achats:gerer"]);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom du fournisseur est requis");

  await db.query(
    `INSERT INTO fournisseurs (nom, telephone, email, adresse, boutique_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
      boutiqueId,
    ]
  );

  return { success: true };
}

export async function modifierFournisseur(db: Db, user: Utilisateur, 
  fournisseurId: string,
  boutiqueId: string,
  data: FournisseurFormData
) {
  exigerAccesBoutique(user, boutiqueId, ["achats:gerer"]);
  await exigerFournisseurDeLaBoutique(db, fournisseurId, boutiqueId);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom du fournisseur est requis");

  await db.query(
    `UPDATE fournisseurs
     SET nom = $2, telephone = $3, email = $4, adresse = $5, updated_at = NOW()
     WHERE id = $1`,
    [
      fournisseurId,
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
    ]
  );

  return { success: true };
}

export async function toggleActifFournisseur(db: Db, user: Utilisateur, 
  fournisseurId: string,
  boutiqueId: string
) {
  exigerAccesBoutique(user, boutiqueId, ["achats:gerer"]);
  await exigerFournisseurDeLaBoutique(db, fournisseurId, boutiqueId);

  await db.query(
    `UPDATE fournisseurs SET actif = NOT actif, updated_at = NOW() WHERE id = $1`,
    [fournisseurId]
  );

  return { success: true };
}

/** Lignes d'achat vérifiées (produit connu, quantité entière, prix positif) et total attendu. */
async function validerLignesAchat(client: Requeteur, lignes: { produit_id: string; quantite: number; prix_unitaire: number }[]) {
  let totalAttendu = 0;
  for (const ligne of lignes) {
    const prix = Number(ligne.prix_unitaire);
    if (!prix || prix <= 0) throw new ErreurMetier("Prix unitaire invalide");
    if (!Number.isInteger(ligne.quantite) || ligne.quantite <= 0) {
      throw new ErreurMetier("Quantité invalide");
    }
    totalAttendu += ligne.quantite * prix;
  }
  const ids = [...new Set(lignes.map((l) => l.produit_id))];
  const { rows } = await client.query(`SELECT id FROM produits WHERE id = ANY($1::uuid[])`, [ids]);
  if (rows.length !== ids.length) throw new ErreurMetier("Produit inconnu");
  return totalAttendu;
}

export async function creerCommandeFournisseur(db: Db, user: Utilisateur, 
  boutiqueId: string,
  data: CommandeFournisseurFormData
) {
  exigerAccesBoutique(user, boutiqueId, ["achats:gerer"]);
  if (!data.fournisseur_id) throw new ErreurMetier("Le fournisseur est requis");
  if (!data.lignes?.length) {
    throw new ErreurMetier("La commande fournisseur doit contenir au moins un article");
  }
  await exigerFournisseurDeLaBoutique(db, data.fournisseur_id, boutiqueId);

  const reference = genererReference("ACH");
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const totalAttendu = await validerLignesAchat(client, data.lignes);

    const { rows: cmdRows } = await client.query<{ id: string }>(
      `INSERT INTO commandes_fournisseur
         (reference_cmd, boutique_id, fournisseur_id, total_attendu, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [reference, boutiqueId, data.fournisseur_id, totalAttendu, data.note?.trim() || null]
    );
    const commandeId = cmdRows[0]!.id;

    for (const ligne of data.lignes) {
      await client.query(
        `INSERT INTO lignes_cmd_fournisseur
           (commande_id, produit_id, quantite_commandee, prix_unitaire)
         VALUES ($1, $2, $3, $4)`,
        [commandeId, ligne.produit_id, ligne.quantite, Number(ligne.prix_unitaire)]
      );
    }

    await client.query("COMMIT");

    return { success: true, reference };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Modifie une commande d'achat tant que rien n'est reçu : lignes et note.
 * Le fournisseur reste le même ; le total attendu est recalculé.
 */
export async function modifierCommandeFournisseur(db: Db, user: Utilisateur, 
  commandeId: string,
  data: { note: string; lignes: { produit_id: string; quantite: number; prix_unitaire: number }[] }
) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ boutique_id: string; statut: string; note: string | null; total_attendu: string }>(
      `SELECT boutique_id, statut, note, total_attendu FROM commandes_fournisseur WHERE id = $1 FOR UPDATE`,
      [commandeId]
    );
    if (rows.length === 0) throw new ErreurMetier("Commande fournisseur non trouvée", 404);
    const cmd = rows[0]!;
    exigerAccesBoutique(user, cmd.boutique_id, ["achats:modifier"]);
    // « en_attente » : aucune réception encore (la première la fait passer en « partielle »).
    if (cmd.statut !== "en_attente") {
      throw new ErreurMetier("Seule une commande fournisseur sans aucune réception peut être modifiée");
    }
    if (!data.lignes?.length) {
      throw new ErreurMetier("La commande fournisseur doit contenir au moins un article");
    }

    const totalAttendu = await validerLignesAchat(client, data.lignes);

    const { rows: avant } = await client.query(
      `SELECT produit_id, quantite_commandee AS quantite, prix_unitaire::float AS prix_unitaire
       FROM lignes_cmd_fournisseur WHERE commande_id = $1 ORDER BY created_at, produit_id`,
      [commandeId]
    );
    await client.query(`DELETE FROM lignes_cmd_fournisseur WHERE commande_id = $1`, [commandeId]);
    for (const ligne of data.lignes) {
      await client.query(
        `INSERT INTO lignes_cmd_fournisseur (commande_id, produit_id, quantite_commandee, prix_unitaire)
         VALUES ($1, $2, $3, $4)`,
        [commandeId, ligne.produit_id, ligne.quantite, Number(ligne.prix_unitaire)]
      );
    }
    const note = data.note.trim() || null;
    await client.query(
      `UPDATE commandes_fournisseur SET total_attendu = $2, note = $3, updated_at = NOW() WHERE id = $1`,
      [commandeId, totalAttendu, note]
    );
    await client.query(
      `INSERT INTO journal_audit (auteur_id, boutique_id, action, entite, entite_id, valeur_avant, valeur_apres)
       VALUES ($1, $2, 'modification', 'commande_fournisseur', $3, $4, $5)`,
      [
        user.id,
        cmd.boutique_id,
        commandeId,
        JSON.stringify({ note: cmd.note, total_attendu: Number(cmd.total_attendu), lignes: avant }),
        JSON.stringify({ note, total_attendu: totalAttendu, lignes: data.lignes }),
      ]
    );
    await client.query("COMMIT");
    return { success: true, totalAttendu, boutique_id: cmd.boutique_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recevoirCommandeFournisseur(db: Db, user: Utilisateur, 
  commandeId: string,
  receptions: { ligne_id: string; quantite_recue: number }[]
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: cmdRows } = await client.query<{
      id: string;
      boutique_id: string;
      reference_cmd: string;
      statut: string;
    }>(
      `SELECT id, boutique_id, reference_cmd, statut
       FROM commandes_fournisseur WHERE id = $1 FOR UPDATE`,
      [commandeId]
    );
    if (cmdRows.length === 0) throw new ErreurMetier("Commande fournisseur non trouvée", 404);
    const cmd = cmdRows[0]!;

    exigerAccesBoutique(user, cmd.boutique_id, ["achats:gerer"]);

    const { rows: lignes } = await client.query<{
      id: string;
      produit_id: string;
      quantite_commandee: number;
      quantite_recue: number;
    }>(
      `SELECT id, produit_id, quantite_commandee, quantite_recue
       FROM lignes_cmd_fournisseur WHERE commande_id = $1 FOR UPDATE`,
      [commandeId]
    );

    const recuesParLigne = new Map<string, number>();

    for (const recept of receptions) {
      const ligne = lignes.find((l) => l.id === recept.ligne_id);
      if (!ligne) {
        throw new ErreurMetier("Ligne de commande fournisseur inconnue");
      }
      const q = Number(recept.quantite_recue);
      if (!q || q <= 0) throw new ErreurMetier("Quantité reçue invalide");
      if (ligne.quantite_recue + q > ligne.quantite_commandee) {
        throw new ErreurMetier("Quantité reçue supérieure à la quantité commandée");
      }

      await client.query(
        `UPDATE lignes_cmd_fournisseur SET quantite_recue = quantite_recue + $2, updated_at = NOW()
         WHERE id = $1`,
        [ligne.id, q]
      );

      // Entrée de stock atomique
      const { rows: stockRows } = await client.query<{ quantite: string }>(
        `SELECT quantite FROM stocks
         WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
        [ligne.produit_id, cmd.boutique_id]
      );
      const quantiteAvant = stockRows.length
        ? Number(stockRows[0]!.quantite)
        : 0;

      await client.query(
        `SELECT ajouter_stock($1::uuid, $2::uuid, $3::integer)`,
        [ligne.produit_id, cmd.boutique_id, q]
      );

      await insererMouvementWithClient(client, {
        produit_id: ligne.produit_id,
        boutique_id: cmd.boutique_id,
        type: "entree",
        quantite: q,
        quantite_avant: quantiteAvant,
        quantite_apres: quantiteAvant + q,
        motif: `Réception ${cmd.reference_cmd}`,
        auteur_id: user.id,
      });

      recuesParLigne.set(ligne.id, (recuesParLigne.get(ligne.id) || 0) + q);
    }

    // Statut selon complétude : tout reçu -> "recue", sinon "partielle"
    let complet = true;
    for (const ligne of lignes) {
      const totalRecu = ligne.quantite_recue + (recuesParLigne.get(ligne.id) || 0);
      if (totalRecu < ligne.quantite_commandee) {
        complet = false;
        break;
      }
    }

    await client.query(
      `UPDATE commandes_fournisseur SET statut = $2, updated_at = NOW() WHERE id = $1`,
      [commandeId, complet ? "recue" : "partielle"]
    );

    await client.query("COMMIT");

    return { success: true, reference: cmd.reference_cmd, boutique_id: cmd.boutique_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function annulerCommandeFournisseur(db: Db, user: Utilisateur, commandeId: string) {
  const { rows } = await db.query<{ boutique_id: string; statut: string }>(
    `SELECT boutique_id, statut FROM commandes_fournisseur WHERE id = $1`,
    [commandeId]
  );
  if (rows.length === 0) throw new ErreurMetier("Commande fournisseur non trouvée", 404);
  if (rows[0]!.statut === "recue" || rows[0]!.statut === "partielle") {
    throw new ErreurMetier("Une commande déjà réceptionnée ne peut pas être annulée");
  }
  exigerAccesBoutique(user, rows[0]!.boutique_id, ["achats:gerer"]);

  await db.query(
    `UPDATE commandes_fournisseur SET statut = 'annulee', updated_at = NOW() WHERE id = $1`,
    [commandeId]
  );

  return { success: true, boutique_id: rows[0]!.boutique_id };
}
