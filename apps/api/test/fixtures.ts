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
    // Une adresse par connexion : la limite anti force brute (5 par IP) ne doit
    // pas bloquer la préparation d'un fichier de test qui connecte beaucoup de comptes.
    headers: {
      origin: ORIGINES[audience],
      "content-type": "application/json",
      "cf-connecting-ip": `198.51.100.${randomBytes(1)[0]}`,
    },
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

/** Un produit vendu dans une boutique : prix, coût et stock. */
export async function creerProduit(
  pool: pg.Pool,
  boutique: string,
  options: { prix?: number; cout?: number | null; stock?: number; seuil?: number; nom?: string } = {}
): Promise<string> {
  const ref = `P-${randomBytes(4).toString("hex")}`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO produits (reference, nom) VALUES ($1, $2) RETURNING id`,
    [ref, options.nom ?? `Produit ${ref}`]
  );
  const id = rows[0]!.id;
  await pool.query(
    `INSERT INTO prix_boutique (produit_id, boutique_id, prix_vente, cout_revient) VALUES ($1, $2, $3, $4)`,
    [id, boutique, options.prix ?? 10, options.cout ?? null]
  );
  await pool.query(
    `INSERT INTO stocks (produit_id, boutique_id, quantite, seuil_alerte) VALUES ($1, $2, $3, $4)`,
    [id, boutique, options.stock ?? 10, options.seuil ?? 2]
  );
  return id;
}

export async function stock(pool: pg.Pool, produit: string, boutique: string): Promise<{ quantite: number; reservee: number }> {
  const { rows } = await pool.query(
    `SELECT quantite, quantite_reservee FROM stocks WHERE produit_id = $1 AND boutique_id = $2`,
    [produit, boutique]
  );
  return { quantite: rows[0].quantite, reservee: rows[0].quantite_reservee };
}

export async function creerClient(
  pool: pg.Pool,
  boutique: string,
  options: { plafond?: number; encours?: number } = {}
): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO clients (nom, boutique_id, plafond_credit, encours) VALUES ('Client test', $1, $2, $3) RETURNING id`,
    [boutique, options.plafond ?? 0, options.encours ?? 0]
  );
  return rows[0]!.id;
}

export async function creerCodePromo(
  pool: pg.Pool,
  boutique: string,
  options: { code?: string; pourcentage?: number; actif?: boolean; dateFin?: string | null; max?: number | null; utilisations?: number } = {}
): Promise<string> {
  const code = options.code ?? `PROMO${randomBytes(3).toString("hex").toUpperCase()}`;
  await pool.query(
    `INSERT INTO codes_promo (code, type_reduction, valeur_reduction, boutique_id, actif, date_fin, max_utilisations, nombre_utilisations)
     VALUES ($1, 'pourcentage', $2, $3, $4, $5, $6, $7)`,
    [code, options.pourcentage ?? 10, boutique, options.actif ?? true, options.dateFin ?? null, options.max ?? null, options.utilisations ?? 0]
  );
  return code;
}

/** Nombre de lignes d'une table : pour vérifier qu'un échec n'a rien écrit. */
export async function compter(pool: pg.Pool, table: string): Promise<number> {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

/** Écriture JSON depuis un front, avec la session donnée. */
export function ecriture(audience: keyof typeof ORIGINES, cookie?: string) {
  return { origin: ORIGINES[audience], "content-type": "application/json", ...(cookie ? { cookie } : {}) };
}
