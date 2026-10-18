// Démarre, pour les parcours Playwright : une base PostgreSQL neuve (schéma,
// seed, migrations, données e2e), l'API de la phase 2 et le backoffice construit.
// Lancé par playwright.config.ts (webServer) ; s'arrête avec lui.
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { build, preview } from "vite";
import { construireApp } from "../../api/src/app";
import { lireConfig } from "../../api/src/config";
import { PORT_API, PORT_FRONT } from "./ports";

const RACINE = fileURLToPath(new URL("../../../", import.meta.url));
const BASE = "mb_e2e";

async function preparerBase(urlServeur: string): Promise<string> {
  const admin = new pg.Client({ connectionString: urlServeur });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${BASE}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${BASE}"`);
  await admin.end();

  const url = new URL(urlServeur);
  url.pathname = `/${BASE}`;
  const base = new pg.Client({ connectionString: url.toString() });
  await base.connect();
  const sql = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");
  await base.query(sql("db/init.sql"));
  for (const f of readdirSync(join(RACINE, "db/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await base.query(sql(`db/migrations/${f}`));
  }
  await base.query(readFileSync(new URL("donnees.sql", import.meta.url), "utf8"));
  await base.end();
  return url.toString();
}

const urlServeur = process.env.DATABASE_URL_TEST;
if (!urlServeur) throw new Error("DATABASE_URL_TEST est requis pour les parcours de bout en bout.");

const origineFront = `http://localhost:${PORT_FRONT}`;
const config = lireConfig({
  PORT: String(PORT_API + 1),
  DATABASE_URL: await preparerBase(urlServeur),
  API_JWT_SECRET: "e2e-".repeat(16),
  ORIGINE_WWW: "http://localhost:5199",
  ORIGINE_BACKOFFICE: origineFront,
  UPLOADS_DIR: mkdtempSync(join(tmpdir(), "mb-e2e-uploads-")),
});
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
const api = await construireApp({ pool, config });
await api.listen({ host: "127.0.0.1", port: config.port });

// Devant l'API, le rôle de Cloudflare : chaque requête arrive avec sa propre
// adresse cliente (cf-connecting-ip), sinon toutes partageraient la limite de
// 5 connexions par quart d'heure.
let compteur = 0;
createServer((entree, sortie) => {
  compteur++;
  const vers = request(
    {
      host: "127.0.0.1",
      port: config.port,
      method: entree.method,
      path: entree.url,
      headers: { ...entree.headers, "cf-connecting-ip": `10.0.${(compteur >> 8) & 255}.${compteur & 255}` },
    },
    (reponse) => {
      sortie.writeHead(reponse.statusCode ?? 502, reponse.headers);
      reponse.pipe(sortie);
    }
  );
  vers.on("error", () => sortie.writeHead(502).end());
  entree.pipe(vers);
}).listen(PORT_API, "127.0.0.1");

const racineFront = fileURLToPath(new URL("..", import.meta.url));
process.env.VITE_API_URL = `http://localhost:${PORT_API}`;
await build({ root: racineFront, logLevel: "warn" });
const serveur = await preview({ root: racineFront, preview: { port: PORT_FRONT, strictPort: true, host: "localhost" } });
serveur.printUrls();
