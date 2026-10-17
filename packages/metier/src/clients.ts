import type { ClientFormData } from "@multiboutique/shared";
import { exigerAccesBoutique } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";
import { exigerClientDeLaBoutique } from "./interne";

// Clients et registre de crédit : repris de lib/actions/index.ts, SQL inchangé.

export async function creerClient(db: Db, user: Utilisateur, 
  boutiqueId: string,
  data: ClientFormData
) {
  exigerAccesBoutique(user, boutiqueId, ["clients:gerer"]);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom du client est requis");

  await db.query(
    `INSERT INTO clients (nom, telephone, email, adresse, boutique_id, type_client, plafond_credit, est_vip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
      boutiqueId,
      data.type_client,
      data.plafond_credit != null ? Number(data.plafond_credit) : 0,
      data.est_vip ?? false,
    ]
  );

  return { success: true };
}

export async function modifierClient(db: Db, user: Utilisateur, 
  clientId: string,
  boutiqueId: string,
  data: ClientFormData
) {
  exigerAccesBoutique(user, boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(db, clientId, boutiqueId);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom du client est requis");

  await db.query(
    `UPDATE clients
     SET nom = $2, telephone = $3, email = $4, adresse = $5,
         type_client = $6, plafond_credit = $7, est_vip = $8, updated_at = NOW()
     WHERE id = $1`,
    [
      clientId,
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
      data.type_client,
      data.plafond_credit != null ? Number(data.plafond_credit) : 0,
      data.est_vip ?? false,
    ]
  );

  return { success: true };
}

export async function toggleActifClient(db: Db, user: Utilisateur, 
  clientId: string,
  boutiqueId: string
) {
  exigerAccesBoutique(user, boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(db, clientId, boutiqueId);

  await db.query(
    `UPDATE clients SET actif = NOT actif, updated_at = NOW() WHERE id = $1`,
    [clientId]
  );

  return { success: true };
}

export async function basculerVip(db: Db, user: Utilisateur, clientId: string, boutiqueId: string) {
  exigerAccesBoutique(user, boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(db, clientId, boutiqueId);

  await db.query(
    `UPDATE clients SET est_vip = NOT est_vip, updated_at = NOW() WHERE id = $1`,
    [clientId]
  );

  return { success: true };
}

export async function listerRegistre(db: Db, user: Utilisateur, clientId: string, boutiqueId: string) {
  exigerAccesBoutique(user, boutiqueId, ["clients:voir"]);
  await exigerClientDeLaBoutique(db, clientId, boutiqueId);

  const { rows } = await db.query(
    `SELECT rc.id, rc.type, rc.libelle, rc.montant, rc.solde_apres,
            rc.auteur_id, rc.created_at,
            u.nom_complet AS auteur_nom
     FROM registre_credits rc
     LEFT JOIN utilisateurs u ON u.id = rc.auteur_id
     WHERE rc.client_id = $1 AND rc.boutique_id = $2
     ORDER BY rc.created_at DESC`,
    [clientId, boutiqueId]
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    libelle: r.libelle,
    montant: Number(r.montant),
    soldeApres: Number(r.solde_apres),
    auteurNom: r.auteur_nom,
    createdAt: r.created_at,
  }));
}

export async function reglerEncours(db: Db, user: Utilisateur, 
  clientId: string,
  boutiqueId: string,
  montant: number
) {
  exigerAccesBoutique(user, boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(db, clientId, boutiqueId);
  const montantRegle = Number(montant);
  if (!montantRegle || montantRegle <= 0) {
    throw new ErreurMetier("Le montant à régler doit être positif");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, encours, nom FROM clients WHERE id = $1 AND boutique_id = $2 FOR UPDATE`,
      [clientId, boutiqueId]
    );
    if (rows.length === 0) {
      throw new ErreurMetier("Client non trouvé dans cette boutique", 404);
    }
    const encoursAvant = Number(rows[0].encours) || 0;
    const difference = Math.min(montantRegle, encoursAvant);

    const { rows: maj } = await client.query(
      `UPDATE clients SET encours = GREATEST(0, encours - $2), updated_at = NOW()
       WHERE id = $1 RETURNING encours`,
      [clientId, difference]
    );
    const nouvelEncours = Number(maj[0].encours);

    await client.query(
      `INSERT INTO registre_credits
         (client_id, boutique_id, type, libelle, montant, solde_apres, auteur_id)
       VALUES ($1, $2, 'versement', $3, $4, $5, $6)`,
      [
        clientId,
        boutiqueId,
        `Versement de ${difference.toFixed(2)}`,
        -difference,
        nouvelEncours,
        user.id,
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { success: true };
}
