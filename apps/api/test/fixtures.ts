import { tmpdir } from "node:os";
import type { Config } from "../src/config";

export const ORIGINES = {
  www: "https://www.exemple.test",
  backoffice: "https://backoffice.exemple.test",
} as const;

export const CONFIG_TEST: Config = {
  port: 0,
  databaseUrl: "inutilisee-par-les-tests",
  jwtSecret: "s".repeat(64),
  origines: { ...ORIGINES },
  uploadsDir: tmpdir(),
};

/** En-têtes d'une requête venant d'un front : Origin et, pour une écriture, JSON. */
export function depuis(audience: keyof typeof ORIGINES, cookie?: string) {
  return {
    origin: ORIGINES[audience],
    ...(cookie ? { cookie } : {}),
  };
}

import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { RoleUtilisateur } from "@multiboutique/shared";

export const BOUTIQUES = {
  b1: "11111111-1111-1111-1111-111111111111",
  b2: "22222222-2222-2222-2222-222222222222",
  b3: "33333333-3333-3333-3333-333333333333",
} as const;

export interface Compte {
  id: string;
  email: string;
  motDePasse: string;
  role: RoleUtilisateur;
}

/** Crée un compte au mot de passe connu, haché comme en production (pgcrypto). */
export async function creerCompte(
  pool: pg.Pool,
  role: RoleUtilisateur,
  options: { boutique_ids?: string[]; region_id?: string | null; groupe_id?: string | null; actif?: boolean } = {}
): Promise<Compte> {
  const email = `${role}.${randomBytes(4).toString("hex")}@test.local`;
  const motDePasse = `mdp-${randomBytes(6).toString("hex")}`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, region_id, groupe_id, actif)
     VALUES ($1, crypt($2, gen_salt('bf', 4)), $3, $4::role_utilisateur, $5, $6, $7, $8)
     RETURNING id`,
    [email, motDePasse, `Test ${role}`, role, options.boutique_ids ?? [], options.region_id ?? null, options.groupe_id ?? null, options.actif ?? true]
  );
  return { id: rows[0]!.id, email, motDePasse, role };
}

/** Se connecte depuis un front et renvoie l'en-tête cookie à rejouer. */
export async function seConnecter(app: FastifyInstance, compte: Compte, audience: keyof typeof ORIGINES): Promise<string> {
  const r = await app.inject({
    method: "POST",
    url: "/auth/connexion",
    headers: { origin: ORIGINES[audience], "content-type": "application/json" },
    payload: { email: compte.email, mot_de_passe: compte.motDePasse },
  });
  if (r.statusCode !== 200) throw new Error(`Connexion impossible (${r.statusCode}) : ${r.body}`);
  const cookie = r.cookies[0];
  if (!cookie) throw new Error("Connexion sans cookie");
  return `${cookie.name}=${cookie.value}`;
}

/** Un groupe et une région, à laquelle on rattache les boutiques données. */
export async function creerRegion(pool: pg.Pool, boutiques: string[] = []): Promise<{ groupe: string; region: string }> {
  const { rows: g } = await pool.query<{ id: string }>(`INSERT INTO groupes (nom) VALUES ('Groupe test') RETURNING id`);
  const groupe = g[0]!.id;
  const { rows: r } = await pool.query<{ id: string }>(
    `INSERT INTO regions (nom, groupe_id) VALUES ('Région test', $1) RETURNING id`,
    [groupe]
  );
  const region = r[0]!.id;
  if (boutiques.length) await pool.query(`UPDATE boutiques SET region_id = $1 WHERE id = ANY($2)`, [region, boutiques]);
  return { groupe, region };
}
