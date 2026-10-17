import type { CodePromoFormData } from "@multiboutique/shared";
import { exigerAccesBoutique } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";

// Codes promo : repris de lib/actions/index.ts, SQL inchangé.

export async function creerCodePromo(db: Db, user: Utilisateur, 
  boutiqueId: string,
  data: CodePromoFormData
) {
  exigerAccesBoutique(user, boutiqueId, ["promos:gerer"]);

  const code = data.code.trim().toUpperCase();
  if (!code) throw new ErreurMetier("Le code est requis");

  const valeur = Number(data.valeur_reduction);
  if (!valeur || valeur <= 0) {
    throw new ErreurMetier("La valeur de réduction doit être positive");
  }

  await db.query(
    `INSERT INTO codes_promo
       (code, description, type_reduction, valeur_reduction, boutique_id, max_utilisations, date_debut, date_fin, actif, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      code,
      data.description?.trim() || null,
      data.type_reduction,
      valeur,
      boutiqueId,
      data.max_utilisations ? Number(data.max_utilisations) : null,
      data.date_debut || null,
      data.date_fin || null,
      false,
      user.id,
    ]
  );

  return { success: true };
}

export async function modifierCodePromo(db: Db, user: Utilisateur, 
  codeId: string,
  data: CodePromoFormData
) {
  const { rows } = await db.query<{ boutique_id: string }>(
    `SELECT boutique_id FROM codes_promo WHERE id = $1`,
    [codeId]
  );
  if (rows.length === 0) throw new ErreurMetier("Code promo non trouvé", 404);
  exigerAccesBoutique(user, rows[0]!.boutique_id, ["promos:gerer"]);

  const code = data.code.trim().toUpperCase();
  if (!code) throw new ErreurMetier("Le code est requis");
  const valeur = Number(data.valeur_reduction);
  if (!valeur || valeur <= 0) {
    throw new ErreurMetier("La valeur de réduction doit être positive");
  }

  await db.query(
    `UPDATE codes_promo
     SET code = $2, description = $3, type_reduction = $4, valeur_reduction = $5,
         max_utilisations = $6, date_debut = $7, date_fin = $8, updated_at = NOW()
     WHERE id = $1`,
    [
      codeId,
      code,
      data.description?.trim() || null,
      data.type_reduction,
      valeur,
      data.max_utilisations ? Number(data.max_utilisations) : null,
      data.date_debut || null,
      data.date_fin || null,
    ]
  );

  return { success: true, boutique_id: rows[0]!.boutique_id };
}

export async function toggleActifCodePromo(db: Db, user: Utilisateur, codeId: string) {
  const { rows } = await db.query<{ boutique_id: string }>(
    `SELECT boutique_id FROM codes_promo WHERE id = $1`,
    [codeId]
  );
  if (rows.length === 0) throw new ErreurMetier("Code promo non trouvé", 404);
  exigerAccesBoutique(user, rows[0]!.boutique_id, ["promos:gerer"]);

  await db.query(
    `UPDATE codes_promo SET actif = NOT actif, updated_at = NOW() WHERE id = $1`,
    [codeId]
  );

  return { success: true, boutique_id: rows[0]!.boutique_id };
}

export async function supprimerCodePromo(db: Db, user: Utilisateur, codeId: string) {
  const { rows } = await db.query<{ boutique_id: string }>(
    `SELECT boutique_id FROM codes_promo WHERE id = $1`,
    [codeId]
  );
  if (rows.length === 0) throw new ErreurMetier("Code promo non trouvé", 404);
  exigerAccesBoutique(user, rows[0]!.boutique_id, ["promos:gerer"]);

  await db.query(`DELETE FROM codes_promo WHERE id = $1`, [codeId]);

  return { success: true, boutique_id: rows[0]!.boutique_id };
}
