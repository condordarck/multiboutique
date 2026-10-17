import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";
import { BASE_MODELE, PREFIXE_BASES, urlBase, urlServeurDeTest } from "./connexion";

const DOSSIER_DB = new URL("../../../db/", import.meta.url);

/**
 * Construit une fois la base modèle (schéma, seed et migrations, comme un premier
 * démarrage suivi de db/migrate.sh), que chaque fichier de test clone ensuite.
 */
export default async function preparer() {
  const urlServeur = urlServeurDeTest();
  const admin = new pg.Client({ connectionString: urlServeur });
  await admin.connect();
  try {
    // Restes d'une exécution interrompue.
    const { rows } = await admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname LIKE $1 OR datname = $2",
      [`${PREFIXE_BASES}%`, BASE_MODELE]
    );
    for (const { datname } of rows) {
      await admin.query(`DROP DATABASE "${datname}" WITH (FORCE)`);
    }
    await admin.query(`CREATE DATABASE "${BASE_MODELE}"`);
  } finally {
    await admin.end();
  }

  const modele = new pg.Client({ connectionString: urlBase(urlServeur, BASE_MODELE) });
  await modele.connect();
  try {
    await modele.query(readFileSync(new URL("init.sql", DOSSIER_DB), "utf8"));
    const migrations = readdirSync(new URL("migrations/", DOSSIER_DB))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const fichier of migrations) {
      await modele.query(readFileSync(new URL(`migrations/${fichier}`, DOSSIER_DB), "utf8"));
    }
  } finally {
    await modele.end();
  }
}
