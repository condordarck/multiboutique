// Démarre, pour les parcours Playwright : une base PostgreSQL neuve (schéma,
// seed, migrations, données e2e), l'API de la phase 2 et un ou deux fronts
// construits, servis avec leurs vrais en-têtes (CSP comprise). Appelé par le
// e2e/lancer.ts de chaque front (webServer de Playwright) ; s'arrête avec lui.
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { build, preview } from "vite";
import { construireApp } from "../../../apps/api/src/app";
import { lireConfig } from "../../../apps/api/src/config";

const RACINE = fileURLToPath(new URL("../../../", import.meta.url));
const BASE = "mb_e2e";

export type Audience = "www" | "backoffice";

export interface FrontParcours {
  audience: Audience;
  /** Dossier de l'application (apps/www, apps/backoffice). */
  racine: string;
  port: number;
  /** Variables VITE_* du build, en plus de VITE_API_URL. */
  env?: Record<string, string>;
}

export interface OptionsParcours {
  portApi: number;
  fronts: FrontParcours[];
}

/** Origine d'un front des parcours ; une origine sans serveur si le front n'est pas lancé. */
export const origineLocale = (port: number) => `http://localhost:${port}`;

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

/** En-têtes du bloc « /* » de dist/_headers, comme les applique Cloudflare. */
function enTetesDe(dist: string): Record<string, string> {
  return Object.fromEntries(
    readFileSync(join(dist, "_headers"), "utf8")
      .split("\n\n")[0]!
      .split("\n")
      .slice(1)
      .map((ligne) => ligne.trim().split(/: (.*)/s).slice(0, 2) as [string, string])
  );
}

export async function demarrerParcours({ portApi, fronts }: OptionsParcours) {
  const urlServeur = process.env.DATABASE_URL_TEST;
  if (!urlServeur) throw new Error("DATABASE_URL_TEST est requis pour les parcours de bout en bout.");

  const port = (audience: Audience, defaut: number) => fronts.find((f) => f.audience === audience)?.port ?? defaut;
  const config = lireConfig({
    PORT: String(portApi + 1),
    DATABASE_URL: await preparerBase(urlServeur),
    API_JWT_SECRET: "e2e-".repeat(16),
    ORIGINE_WWW: origineLocale(port("www", 5199)),
    ORIGINE_BACKOFFICE: origineLocale(port("backoffice", 5198)),
    UPLOADS_DIR: mkdtempSync(join(tmpdir(), "mb-e2e-uploads-")),
  });
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });
  // Journal de l'API coupé (comme dans ses tests) : il noierait la sortie de Playwright.
  const environnement = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  const api = await construireApp({ pool, config });
  process.env.NODE_ENV = environnement;
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
  }).listen(portApi, "127.0.0.1");

  for (const front of fronts) {
    // Vite lit les VITE_* de l'environnement du processus au moment du build.
    process.env.VITE_API_URL = `http://localhost:${portApi}`;
    for (const [cle, valeur] of Object.entries(front.env ?? {})) process.env[cle] = valeur;
    await build({ root: front.racine, logLevel: "warn" });
    const serveur = await preview({
      root: front.racine,
      preview: { port: front.port, strictPort: true, host: "localhost", headers: enTetesDe(join(front.racine, "dist")) },
    });
    serveur.printUrls();
  }
}
