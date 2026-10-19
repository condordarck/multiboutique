import { aPermission, type VenteFormData } from "@multiboutique/shared";
import { exigerAccesBoutique, peutAccederBoutique } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";
import { appliquerCodePromo, genererReference, insererMouvementWithClient } from "./interne";

// Ventes : repris de lib/actions/index.ts (section VENTES), SQL inchangé.

export async function creerVente(db: Db, user: Utilisateur, data: VenteFormData) {
  exigerAccesBoutique(user, data.boutique_id, ["ventes:creer"]);
  if (!data.lignes?.length) throw new ErreurMetier("La vente doit contenir au moins un article");

  const reference = genererReference("VTE");
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Création de la vente
    const { rows: venteRows } = await client.query(
      `INSERT INTO ventes (reference_vente, boutique_id, vendeur_id, mode_paiement, montant_total, statut)
       VALUES ($1, $2, $3, $4, 0, 'validee')
       RETURNING id`,
      [reference, data.boutique_id, user.id, data.mode_paiement]
    );
    const venteId = venteRows[0].id;

    let montantTotal = 0;

    for (const ligne of data.lignes) {
      // Prix officiel depuis la base (pas de prix client modifiable)
      const { rows: prixRows } = await client.query(
        `SELECT prix_vente, cout_revient FROM prix_boutique
         WHERE produit_id = $1 AND boutique_id = $2 AND actif = true`,
        [ligne.produit_id, data.boutique_id]
      );
      if (prixRows.length === 0) {
        throw new ErreurMetier("Produit non configuré dans cette boutique");
      }
      const prixVente = Number(prixRows[0].prix_vente);
      const coutUnitaire = prixRows[0].cout_revient
        ? Number(prixRows[0].cout_revient)
        : null;

      // Insertion ligne
      await client.query(
        `INSERT INTO lignes_vente (vente_id, produit_id, quantite, prix_unitaire, cout_unitaire, produit_nom, produit_code)
         VALUES ($1, $2, $3, $4, $5, (SELECT nom FROM produits WHERE id = $2), (SELECT code FROM produits WHERE id = $2))`,
        [venteId, ligne.produit_id, ligne.quantite, prixVente, coutUnitaire]
      );

      // Récupération stock avant
      const { rows: stockRows } = await client.query(
        `SELECT quantite FROM stocks WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
        [ligne.produit_id, data.boutique_id]
      );
      const quantiteAvant = stockRows.length ? Number(stockRows[0].quantite) : 0;

      // Déduction atomique
      await client.query(
        `SELECT deduire_stock($1::uuid, $2::uuid, $3::integer)`,
        [ligne.produit_id, data.boutique_id, ligne.quantite]
      );

      // Mouvement
      await insererMouvementWithClient(client, {
        produit_id: ligne.produit_id,
        boutique_id: data.boutique_id,
        type: "sortie",
        quantite: ligne.quantite,
        quantite_avant: quantiteAvant,
        quantite_apres: quantiteAvant - ligne.quantite,
        motif: `Vente ${reference}`,
        auteur_id: user.id,
      });

      montantTotal += ligne.quantite * prixVente;
    }

    // Mise à jour du total (avec remise si code promo valide)
    const { remise, montantFinal, codePromoId } = await appliquerCodePromo(
      client,
      data.code_promo,
      data.boutique_id,
      montantTotal
    );

    // Paiement partiel : seul un client rattaché peut faire crédit
    let reste = 0;
    if (data.client_id) {
      const { rows: clientRows } = await client.query(
        `SELECT * FROM clients WHERE id = $1 AND boutique_id = $2 AND actif = true FOR UPDATE`,
        [data.client_id, data.boutique_id]
      );
      if (clientRows.length === 0) {
        throw new ErreurMetier("Client introuvable ou inactif dans cette boutique", 404);
      }
      const clientRow = clientRows[0];
      const paie = Math.min(Number(data.montant_paye) || 0, montantFinal);
      if (paie <= 0) {
        throw new ErreurMetier("Le montant payé est invalide pour une vente au client");
      }
      reste = montantFinal - paie;
      const encoursAvant = Number(clientRow.encours) || 0;
      const plafond = Number(clientRow.plafond_credit) || 0;
      if (reste > 0 && plafond > 0 && encoursAvant + reste > plafond) {
        throw new ErreurMetier(
          `Le crédit (${reste.toFixed(
            2
          )}) dépasserait le plafond de ${plafond.toFixed(2)}`);
      }

      if (codePromoId) {
        await client.query(
          `UPDATE ventes
           SET montant_total = $1, remise = $2, code_promo_id = $3,
               client_id = $4, montant_paye = $5, updated_at = NOW()
           WHERE id = $6`,
          [montantFinal, remise, codePromoId, data.client_id, paie, venteId]
        );
      } else {
        await client.query(
          `UPDATE ventes
           SET montant_total = $1, client_id = $2, montant_paye = $3, updated_at = NOW()
           WHERE id = $4`,
          [montantFinal, data.client_id, paie, venteId]
        );
      }

      if (reste > 0) {
        // Registre de créance : dette contractée
        const { rows: majClient } = await client.query(
          `UPDATE clients
           SET encours = encours + $2, updated_at = NOW()
           WHERE id = $1
           RETURNING encours`,
          [data.client_id, reste]
        );
        const nouvelEncours = Number(majClient[0].encours);
        await client.query(
          `INSERT INTO registre_credits
             (client_id, boutique_id, vente_id, type, libelle, montant, solde_apres, auteur_id)
           VALUES ($1, $2, $3, 'vente', $4, $5, $6, $7)`,
          [
            data.client_id,
            data.boutique_id,
            venteId,
            `Vente ${reference} — reste à payer`,
            reste,
            nouvelEncours,
            user.id,
          ]
        );
      }
    } else {
      if (codePromoId) {
        await client.query(
          `UPDATE ventes SET montant_total = $1, remise = $2, code_promo_id = $3 WHERE id = $4`,
          [montantFinal, remise, codePromoId, venteId]
        );
      } else {
        await client.query(
          `UPDATE ventes SET montant_total = $1, montant_paye = $1 WHERE id = $2`,
          [montantFinal, venteId]
        );
      }
    }

    await client.query("COMMIT");

    return { success: true, reference, montantTotal: montantFinal, remise, reste };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function annulerVente(db: Db, user: Utilisateur, venteId: string, motif: string) {
  if (!aPermission(user, "ventes:annuler")) {
    throw new ErreurMetier("Votre profil n'a pas les droits pour annuler une vente", 403);
  }
  if (!motif.trim()) throw new ErreurMetier("Un motif d'annulation est requis");

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Récupérer la vente + lignes
    const { rows: venteRows } = await client.query(
      `SELECT * FROM ventes WHERE id = $1 AND statut = 'validee' FOR UPDATE`,
      [venteId]
    );
    if (venteRows.length === 0) {
      throw new ErreurMetier("Vente non trouvée ou déjà annulée", 404);
    }
    const vente = venteRows[0];
    if (!peutAccederBoutique(user, vente.boutique_id)) {
      throw new ErreurMetier("Accès refusé à cette boutique", 403);
    }

    const { rows: lignes } = await client.query(
      `SELECT * FROM lignes_vente WHERE vente_id = $1`,
      [venteId]
    );

    // Rétablir le stock
    for (const ligne of lignes) {
      const { rows: stockRows } = await client.query(
        `SELECT quantite FROM stocks WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
        [ligne.produit_id, vente.boutique_id]
      );
      const quantiteAvant = stockRows.length ? Number(stockRows[0].quantite) : 0;

      await client.query(
        `UPDATE stocks SET quantite = quantite + $1, updated_at = NOW()
         WHERE produit_id = $2 AND boutique_id = $3`,
        [ligne.quantite, ligne.produit_id, vente.boutique_id]
      );

      await insererMouvementWithClient(client, {
        produit_id: ligne.produit_id,
        boutique_id: vente.boutique_id,
        type: "entree",
        quantite: ligne.quantite,
        quantite_avant: quantiteAvant,
        quantite_apres: quantiteAvant + ligne.quantite,
        motif: `Annulation vente ${vente.reference_vente} — ${motif}`,
        auteur_id: user.id,
      });
    }

    // Annulation de la créance si la vente était à crédit
    if (vente.client_id) {
      const montantFinal = Number(vente.montant_total) || 0;
      const paie = Number(vente.montant_paye) || 0;
      const reste = Math.max(0, montantFinal - paie);
      if (reste > 0) {
        const { rows: majClient } = await client.query(
          `UPDATE clients
           SET encours = GREATEST(0, encours - $2), updated_at = NOW()
           WHERE id = $1
           RETURNING encours`,
          [vente.client_id, reste]
        );
        const nouvelEncours = Number(majClient[0].encours);
        await client.query(
          `INSERT INTO registre_credits
             (client_id, boutique_id, vente_id, type, libelle, montant, solde_apres, auteur_id)
           VALUES ($1, $2, $3, 'annulation', $4, $5, $6, $7)`,
          [
            vente.client_id,
            vente.boutique_id,
            venteId,
            `Annulation vente ${vente.reference_vente} — ${motif}`,
            -reste,
            nouvelEncours,
            user.id,
          ]
        );
      }
    }

    await client.query(
      `UPDATE ventes SET statut = 'annulee', motif_annulation = $1, updated_at = NOW() WHERE id = $2`,
      [motif, venteId]
    );

    await client.query("COMMIT");

    return { success: true, boutique_id: vente.boutique_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
