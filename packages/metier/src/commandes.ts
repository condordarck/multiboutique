import type { CommandeFormData } from "@multiboutique/shared";
import { exigerAccesBoutique } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";
import { appliquerCodePromo, exigerClientDeLaBoutique, genererReference, insererMouvementWithClient } from "./interne";

// Commandes grossistes (B2B) : repris de lib/actions/index.ts, SQL inchangé.

export async function creerCommande(db: Db, user: Utilisateur, 
  boutiqueId: string,
  data: CommandeFormData
) {
  exigerAccesBoutique(user, boutiqueId, ["commandes:gerer"]);
  if (!data.client_id) throw new ErreurMetier("Le client est requis");
  if (!data.lignes?.length) {
    throw new ErreurMetier("La commande doit contenir au moins un article");
  }

  await exigerClientDeLaBoutique(db, data.client_id, boutiqueId);
  const reference = genererReference("CMD");
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Priorité : une commande en attente ne déduit pas le stock,
    // le prix officiel garantit une facturation fiable à la livraison.
    let montantBrut = 0;
    const lignesCalculees: {
      produit_id: string;
      quantite: number;
      prixUnitaire: number;
    }[] = [];

    for (const ligne of data.lignes) {
      const { rows: prixRows } = await client.query(
        `SELECT prix_vente FROM prix_boutique
         WHERE produit_id = $1 AND boutique_id = $2 AND actif = true`,
        [ligne.produit_id, boutiqueId]
      );
      if (prixRows.length === 0) {
        throw new ErreurMetier("Produit non configuré dans cette boutique");
      }
      if (!ligne.quantite || ligne.quantite <= 0) {
        throw new ErreurMetier("Quantité invalide");
      }
      const prixUnitaire = Number(ligne.prix_unitaire);
      if (!prixUnitaire || prixUnitaire <= 0) {
        throw new ErreurMetier("Prix unitaire invalide");
      }
      lignesCalculees.push({
        produit_id: ligne.produit_id,
        quantite: ligne.quantite,
        prixUnitaire,
      });
      montantBrut += ligne.quantite * prixUnitaire;
    }

    // Remise éventuelle via code promo
    const { remise, montantFinal, codePromoId } = await appliquerCodePromo(
      client,
      data.code_promo,
      boutiqueId,
      montantBrut
    );

    const { rows: cmdRows } = await client.query<{ id: string }>(
      `INSERT INTO commandes
         (reference_commande, boutique_id, client_id, statut, montant_brut, remise,
          montant_total, code_promo_id, terme_paiement, note, validee_par)
       VALUES ($1, $2, $3, 'en_attente', $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        reference,
        boutiqueId,
        data.client_id,
        montantBrut,
        remise,
        montantFinal,
        codePromoId,
        data.terme_paiement,
        data.note?.trim() || null,
        user.id,
      ]
    );
    const commandeId = cmdRows[0]!.id;

    for (const ligne of lignesCalculees) {
      await client.query(
        `INSERT INTO lignes_commandes (commande_id, produit_id, quantite, prix_unitaire)
         VALUES ($1, $2, $3, $4)`,
        [commandeId, ligne.produit_id, ligne.quantite, ligne.prixUnitaire]
      );
    }

    await client.query("COMMIT");

    return {
      success: true,
      reference,
      montantTotal: montantFinal,
      remise,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmerCommande(db: Db, user: Utilisateur, commandeId: string) {
  const { rows } = await db.query<{
    boutique_id: string;
    statut: string;
  }>(
    `SELECT boutique_id, statut FROM commandes WHERE id = $1`,
    [commandeId]
  );
  if (rows.length === 0) throw new ErreurMetier("Commande non trouvée", 404);
  if (rows[0]!.statut !== "en_attente") {
    throw new ErreurMetier("Seule une commande en attente peut être confirmée");
  }
  exigerAccesBoutique(user, rows[0]!.boutique_id, [
    "commandes:gerer",
  ]);

  await db.query(
    `UPDATE commandes SET statut = 'confirmee', validee_par = $2, updated_at = NOW()
     WHERE id = $1`,
    [commandeId, user.id]
  );

  return { success: true, boutique_id: rows[0]!.boutique_id };
}

export async function livrerCommande(db: Db, user: Utilisateur, commandeId: string) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: cmdRows } = await client.query<{
      id: string;
      boutique_id: string;
      reference_commande: string;
      statut: string;
      client_id: string;
      montant_total: string;
      terme_paiement: string;
    }>(
      `SELECT id, boutique_id, reference_commande, statut, client_id, montant_total, terme_paiement
       FROM commandes WHERE id = $1 FOR UPDATE`,
      [commandeId]
    );
    if (cmdRows.length === 0) throw new ErreurMetier("Commande non trouvée", 404);
    const cmd = cmdRows[0]!;
    if (cmd.statut !== "confirmee") {
      throw new ErreurMetier("Seule une commande confirmée peut être livrée");
    }

    exigerAccesBoutique(user, cmd.boutique_id, [
      "commandes:gerer",
    ]);

    // Client (respect du plafond d'encours si paiement non comptant)
    const { rows: clientRows } = await client.query<{
      id: string;
      encours: string;
      plafond_credit: string;
      actif: boolean;
    }>(`SELECT id, encours, plafond_credit, actif FROM clients WHERE id = $1 FOR UPDATE`, [
      cmd.client_id,
    ]);
    if (clientRows.length === 0) throw new ErreurMetier("Client non trouvé", 404);
    if (!clientRows[0]!.actif) throw new ErreurMetier("Client inactif");

    const montantTotal = Number(cmd.montant_total);
    if (cmd.terme_paiement === "credit") {
      const encours = Number(clientRows[0]!.encours);
      const plafond = Number(clientRows[0]!.plafond_credit);
      if (plafond > 0 && encours + montantTotal > plafond) {
        throw new ErreurMetier(
          `Plafond de crédit dépassé (encours ${encours} + commande ${montantTotal} > plafond ${plafond})`);
      }
    }

    const { rows: lignes } = await client.query<{
      produit_id: string;
      quantite: number;
    }>(
      `SELECT produit_id, quantite FROM lignes_commandes WHERE commande_id = $1`,
      [commandeId]
    );

    for (const ligne of lignes) {
      const { rows: stockRows } = await client.query<{ quantite: string }>(
        `SELECT quantite FROM stocks
         WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
        [ligne.produit_id, cmd.boutique_id]
      );
      const quantiteAvant = stockRows.length
        ? Number(stockRows[0]!.quantite)
        : 0;

      await client.query(
        `SELECT deduire_stock($1::uuid, $2::uuid, $3::integer)`,
        [ligne.produit_id, cmd.boutique_id, ligne.quantite]
      );

      await insererMouvementWithClient(client, {
        produit_id: ligne.produit_id,
        boutique_id: cmd.boutique_id,
        type: "sortie",
        quantite: ligne.quantite,
        quantite_avant: quantiteAvant,
        quantite_apres: quantiteAvant - ligne.quantite,
        motif: `Commande ${cmd.reference_commande}`,
        auteur_id: user.id,
      });
    }

    if (cmd.terme_paiement === "credit") {
      await client.query(
        `UPDATE clients SET encours = encours + $2, updated_at = NOW() WHERE id = $1`,
        [cmd.client_id, montantTotal]
      );
    }

    await client.query(
      `UPDATE commandes SET statut = 'livree', date_livraison = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [commandeId]
    );

    await client.query("COMMIT");

    return { success: true, reference: cmd.reference_commande, boutique_id: cmd.boutique_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function annulerCommande(db: Db, user: Utilisateur, commandeId: string) {
  const { rows } = await db.query<{
    id: string;
    boutique_id: string;
    statut: string;
  }>(`SELECT id, boutique_id, statut FROM commandes WHERE id = $1`, [
    commandeId,
  ]);
  if (rows.length === 0) throw new ErreurMetier("Commande non trouvée", 404);
  if (rows[0]!.statut === "livree") {
    throw new ErreurMetier("Une commande livrée ne peut pas être annulée");
  }
  exigerAccesBoutique(user, rows[0]!.boutique_id, ["commandes:gerer"]);

  await db.query(
    `UPDATE commandes SET statut = 'annulee', updated_at = NOW() WHERE id = $1`,
    [commandeId]
  );

  return { success: true, boutique_id: rows[0]!.boutique_id };
}
