import { Pool } from "pg";

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
};

function creerPool(): Pool {
  const chaineConnexion = process.env.DATABASE_URL;

  if (!chaineConnexion) {
    // Échec bruyant : se rabattre silencieusement sur une base locale masque
    // une erreur de configuration jusqu'à ce qu'elle devienne une panne.
    throw new Error(
      "DATABASE_URL est requis. Voir .env.local.example (développement) ou deploy/.env.example (serveur)."
    );
  }

  return new Pool({
    connectionString: chaineConnexion,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}

function obtenirPool(): Pool {
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = creerPool();
  }
  return globalForDb.pgPool;
}

// Le pool est créé à la PREMIÈRE utilisation, jamais à l'import : `next build`
// importe chaque route pour en collecter les métadonnées, et une création
// immédiate ferait échouer le build faute de DATABASE_URL. Ce proxy préserve
// l'interface `pool.query(...)` / `pool.connect()` des appels existants.
export const pool = new Proxy({} as Pool, {
  get(_cible, propriete) {
    const reel = obtenirPool() as unknown as Record<string | symbol, unknown>;
    const valeur = reel[propriete];
    return typeof valeur === "function" ? valeur.bind(reel) : valeur;
  },
});

export async function query<T = any>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await obtenirPool().query(text, params);
  return result.rows as T[];
}
