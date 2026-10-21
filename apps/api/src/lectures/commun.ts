import { ErreurMetier, exigerAccesBoutique, type Db, type Utilisateur } from "@multiboutique/metier";
import type { Permission } from "@multiboutique/shared";

/** La boutique active, comme la relisent les pages ; 404 sinon. */
export async function boutiqueActive(db: Db, boutiqueId: string) {
  const { rows } = await db.query(`SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`, [boutiqueId]);
  if (!rows[0]) throw new ErreurMetier("Boutique introuvable", 404);
  return rows[0];
}

/** Permission de lecture d'une page qui en exige une (accès boutique déjà vérifié). */
export function exigerLecture(utilisateur: Utilisateur, boutiqueId: string, permission: Permission) {
  exigerAccesBoutique(utilisateur, boutiqueId, [permission]);
}

export type Periode = "jour" | "semaine" | "mois" | "annee";

/** Début et fin d'une période contenant `reference` (AAAA-MM-JJ, aujourd'hui par défaut), calculés par la base, dans son fuseau. */
export async function bornesPeriode(db: Db, periode: Periode, reference?: string): Promise<{ debut: Date; fin: Date }> {
  const unite = { jour: "day", semaine: "week", mois: "month", annee: "year" }[periode];
  const { rows } = await db.query(
    `SELECT date_trunc($1, r) AS debut, date_trunc($1, r) + ('1 ' || $1)::interval AS fin
     FROM (SELECT COALESCE($2::date::timestamptz, now()) AS r) AS ref`,
    [unite, reference ?? null]
  );
  return rows[0];
}

export function estPeriode(valeur: unknown): valeur is Periode {
  return valeur === "jour" || valeur === "semaine" || valeur === "mois" || valeur === "annee";
}
