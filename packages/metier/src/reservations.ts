import { aPermission, type ModePaiement, type ReservationFormData } from "@multiboutique/shared";
import { exigerAccesBoutique, peutAccederBoutique } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";
import { genererReference, insererMouvementWithClient } from "./interne";

// Réservations : repris de lib/actions/index.ts (section RÉSERVATIONS), SQL inchangé.

// session : null pour un visiteur anonyme de la vitrine.
export async function creerReservation(db: Db, session: Utilisateur | null, data: ReservationFormData) {
  if (!data.lignes?.length)
    throw new ErreurMetier("La réservation doit contenir au moins un article");

  // Le flux public (visiteur anonyme) et l'espace client restent ouverts :
  // on réserve dans la boutique dont on consulte le catalogue.
  // En revanche, un membre du personnel ne peut créer de réservation que dans
  // une boutique de son périmètre, avec la permission dédiée (anti-IDOR).
  if (session && session.role !== "client") {
    exigerAccesBoutique(session, data.boutique_id, ["reservations:gerer"]);
  }

  // Si un client est connecté, lier sa réservation à son compte
  const utilisateurId =
    session && session.role === "client" ? session.id : null;

  const reference = genererReference("RES");
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: resRows } = await client.query(
      `INSERT INTO reservations
         (reference_reservation, utilisateur_id, client_nom, client_telephone, client_email, boutique_id, statut, montant_total, date_retrait_prevue)
       VALUES ($1, $2, $3, $4, $5, $6, 'en_attente', 0, $7)
       RETURNING id`,
      [
        reference,
        utilisateurId,
        data.client_nom,
        data.client_telephone,
        data.client_email || null,
        data.boutique_id,
        data.date_retrait_prevue || null,
      ]
    );
    const reservationId = resRows[0].id;

    let montantTotal = 0;

    for (const ligne of data.lignes) {
      const { rows: prixRows } = await client.query(
        `SELECT prix_vente FROM prix_boutique
         WHERE produit_id = $1 AND boutique_id = $2 AND actif = true`,
        [ligne.produit_id, data.boutique_id]
      );
      if (prixRows.length === 0) {
        throw new ErreurMetier("Produit non disponible dans cette boutique");
      }
      const prix = Number(prixRows[0].prix_vente);

      await client.query(
        `INSERT INTO lignes_reservation (reservation_id, produit_id, quantite, prix_unitaire)
         VALUES ($1, $2, $3, $4)`,
        [reservationId, ligne.produit_id, ligne.quantite, prix]
      );

      // Réserver le stock (atomique, avec contrôle de dispo)
      await client.query(
        `SELECT reserver_stock($1::uuid, $2::uuid, $3::integer)`,
        [ligne.produit_id, data.boutique_id, ligne.quantite]
      );

      montantTotal += ligne.quantite * prix;
    }

    await client.query(
      `UPDATE reservations SET montant_total = $1 WHERE id = $2`,
      [montantTotal, reservationId]
    );

    await client.query("COMMIT");

    return { success: true, reference, reservationId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function validerReservation(db: Db, user: Utilisateur, reservationId: string) {
  if (!aPermission(user, "reservations:gerer")) {
    throw new ErreurMetier(
      "Votre profil n'a pas les droits pour valider une réservation", 403);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT boutique_id FROM reservations WHERE id = $1`,
      [reservationId]
    );
    if (rows.length === 0) throw new ErreurMetier("Réservation non trouvée", 404);
    const boutiqueId = rows[0].boutique_id;
    if (!peutAccederBoutique(user, boutiqueId)) {
      throw new ErreurMetier("Accès refusé à cette boutique", 403);
    }

    // Déduction du stock définitive + statut "payee" (fonction atomique en base)
    await client.query(
      `SELECT valider_reservation($1::uuid, $2::uuid)`,
      [reservationId, user.id]
    );

    await client.query("COMMIT");

    return { success: true, boutique_id: boutiqueId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function annulerReservation(db: Db, user: Utilisateur, reservationId: string, motif: string) {
  if (!motif.trim()) throw new ErreurMetier("Un motif d'annulation est requis");
  if (!aPermission(user, "reservations:gerer")) {
    throw new ErreurMetier(
      "Votre profil n'a pas les droits pour annuler une réservation", 403);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: resRows } = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND statut IN ('en_attente', 'prete') FOR UPDATE`,
      [reservationId]
    );
    if (resRows.length === 0) {
      throw new ErreurMetier("Réservation non trouvée ou non annulable", 404);
    }
    const reservation = resRows[0];
    if (!peutAccederBoutique(user, reservation.boutique_id)) {
      throw new ErreurMetier("Accès refusé à cette boutique", 403);
    }

    const { rows: lignes } = await client.query(
      `SELECT * FROM lignes_reservation WHERE reservation_id = $1`,
      [reservationId]
    );

    // Libérer le stock réservé
    for (const ligne of lignes) {
      await client.query(
        `UPDATE stocks
         SET quantite_reservee = GREATEST(0, quantite_reservee - $1), updated_at = NOW()
         WHERE produit_id = $2 AND boutique_id = $3`,
        [ligne.quantite, ligne.produit_id, reservation.boutique_id]
      );
    }

    await client.query(
      `UPDATE reservations SET statut = 'annulee', motif_annulation = $1, updated_at = NOW() WHERE id = $2`,
      [motif, reservationId]
    );

    await client.query("COMMIT");

    return { success: true, boutique_id: reservation.boutique_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmerReservation(db: Db, user: Utilisateur, reservationId: string) {
  if (!aPermission(user, "reservations:gerer")) {
    throw new ErreurMetier(
      "Votre profil n'a pas les droits pour confirmer une réservation", 403);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: resRows } = await client.query(
      `SELECT id, boutique_id, statut FROM reservations WHERE id = $1 FOR UPDATE`,
      [reservationId]
    );
    if (resRows.length === 0) throw new ErreurMetier("Réservation non trouvée", 404);
    const reservation = resRows[0];
    if (!peutAccederBoutique(user, reservation.boutique_id)) {
      throw new ErreurMetier("Accès refusé à cette boutique", 403);
    }
    if (reservation.statut !== "en_attente") {
      throw new ErreurMetier("Seule une réservation en attente peut être confirmée");
    }

    await client.query(
      `UPDATE reservations SET statut = 'prete', updated_at = NOW() WHERE id = $1`,
      [reservationId]
    );

    await client.query("COMMIT");

    return { success: true, boutique_id: reservation.boutique_id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function encaisserReservation(db: Db, user: Utilisateur, 
  reservationId: string,
  modePaiement: ModePaiement
) {
  if (!aPermission(user, "reservations:gerer")) {
    throw new ErreurMetier(
      "Votre profil n'a pas les droits pour encaisser une réservation", 403);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { rows: resRows } = await client.query(
      `SELECT * FROM reservations WHERE id = $1 FOR UPDATE`,
      [reservationId]
    );
    if (resRows.length === 0) throw new ErreurMetier("Réservation non trouvée", 404);
    const reservation = resRows[0];
    if (!peutAccederBoutique(user, reservation.boutique_id)) {
      throw new ErreurMetier("Accès refusé à cette boutique", 403);
    }
    if (reservation.statut === "payee" || reservation.statut === "retiree") {
      throw new ErreurMetier("Cette réservation a déjà été encaissée");
    }
    if (reservation.statut === "annulee") {
      throw new ErreurMetier("Cette réservation a été annulée");
    }

    const { rows: lignes } = await client.query(
      `SELECT * FROM lignes_reservation WHERE reservation_id = $1 ORDER BY created_at`,
      [reservationId]
    );
    if (lignes.length === 0) throw new ErreurMetier("Aucun article dans cette réservation");

    // Créer la vente (prix officiels en base)
    const reference = genererReference("VTE");
    const { rows: venteRows } = await client.query(
      `INSERT INTO ventes (reference_vente, boutique_id, vendeur_id, mode_paiement, montant_total, statut)
       VALUES ($1, $2, $3, $4, $5, 'validee')
       RETURNING id`,
      [
        reference,
        reservation.boutique_id,
        user.id,
        modePaiement,
        Number(reservation.montant_total),
      ]
    );
    const venteId = venteRows[0].id;

    for (const ligne of lignes) {
      const { rows: prixRows } = await client.query(
        `SELECT prix_vente, cout_revient FROM prix_boutique
         WHERE produit_id = $1 AND boutique_id = $2 AND actif = true`,
        [ligne.produit_id, reservation.boutique_id]
      );
      const prixVente =
        prixRows.length > 0 ? Number(prixRows[0].prix_vente) : Number(ligne.prix_unitaire);
      const coutUnitaire =
        prixRows.length > 0 && prixRows[0].cout_revient
          ? Number(prixRows[0].cout_revient)
          : null;

      await client.query(
        `INSERT INTO lignes_vente (vente_id, produit_id, quantite, prix_unitaire, cout_unitaire)
         VALUES ($1, $2, $3, $4, $5)`,
        [venteId, ligne.produit_id, ligne.quantite, prixVente, coutUnitaire]
      );

      const { rows: stockRows } = await client.query(
        `SELECT quantite FROM stocks WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
        [ligne.produit_id, reservation.boutique_id]
      );
      const quantiteAvant = stockRows.length ? Number(stockRows[0].quantite) : 0;

      await client.query(
        `SELECT deduire_stock($1::uuid, $2::uuid, $3::integer)`,
        [ligne.produit_id, reservation.boutique_id, ligne.quantite]
      );

      await insererMouvementWithClient(client, {
        produit_id: ligne.produit_id,
        boutique_id: reservation.boutique_id,
        type: "sortie",
        quantite: ligne.quantite,
        quantite_avant: quantiteAvant,
        quantite_apres: quantiteAvant - ligne.quantite,
        motif: `Vente ${reference} (réservation)`,
        auteur_id: user.id,
      });
    }

    // Libérer le stock réservé + finaliser la réservation
    await client.query(
      `UPDATE stocks s
       SET quantite_reservee = GREATEST(0, s.quantite_reservee - l.quantite), updated_at = NOW()
       FROM lignes_reservation l
       WHERE l.reservation_id = $1 AND l.produit_id = s.produit_id AND s.boutique_id = $2`,
      [reservationId, reservation.boutique_id]
    );

    await client.query(
      `UPDATE reservations
       SET statut = 'retiree', date_retrait_reelle = NOW(), validee_par = $1, updated_at = NOW()
       WHERE id = $2`,
      [user.id, reservationId]
    );

    await client.query("COMMIT");

    return {
      success: true,
      reference,
      montantTotal: Number(reservation.montant_total),
      boutique_id: reservation.boutique_id,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
