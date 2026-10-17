import { randomBytes } from "node:crypto";
import pg from "pg";
import { BASE_MODELE, PREFIXE_BASES, urlBase, urlServeurDeTest } from "./connexion";

export interface BaseDeTest {
  pool: pg.Pool;
  url: string;
  detruire: () => Promise<void>;
}

async function avecAdmin<T>(action: (admin: pg.Client) => Promise<T>): Promise<T> {
  const admin = new pg.Client({ connectionString: urlServeurDeTest() });
  await admin.connect();
  try {
    return await action(admin);
  } finally {
    await admin.end();
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Une base neuve, clonée de la base modèle (≈ 60 ms). Chaque fichier de test a la
 * sienne : les tests ne se polluent pas et les services gardent leurs transactions.
 */
export async function creerBaseDeTest(): Promise<BaseDeTest> {
  const nom = `${PREFIXE_BASES}${randomBytes(6).toString("hex")}`;
  await avecAdmin(async (admin) => {
    // Deux clones simultanés du même modèle peuvent se gêner (« source database is
    // being accessed by other users ») : on réessaie brièvement.
    for (let tentative = 1; ; tentative++) {
      try {
        await admin.query(`CREATE DATABASE "${nom}" TEMPLATE "${BASE_MODELE}"`);
        return;
      } catch (erreur) {
        if ((erreur as { code?: string }).code !== "55006" || tentative >= 20) throw erreur;
        await attendre(50 * tentative);
      }
    }
  });

  const url = urlBase(urlServeurDeTest(), nom);
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return {
    pool,
    url,
    async detruire() {
      await pool.end();
      await avecAdmin((admin) => admin.query(`DROP DATABASE IF EXISTS "${nom}" WITH (FORCE)`));
    },
  };
}
