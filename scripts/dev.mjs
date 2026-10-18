// Lance l'API (4000), le backoffice (5174) et la vitrine (5175) en parallèle,
// chacun avec la configuration qui le relie aux autres. Ctrl+C arrête les trois.
//
//   npm run dev                 # les trois
//   npm run dev -- api www      # une partie seulement
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const RACINE = fileURLToPath(new URL("../", import.meta.url));
const API = "http://localhost:4000";
const BACKOFFICE = "http://localhost:5174";

// Première exécution : la configuration de l'API vient de l'exemple, avec un
// secret propre à cette machine.
const envApi = `${RACINE}apps/api/.env`;
if (!existsSync(envApi)) {
  const exemple = readFileSync(`${RACINE}apps/api/.env.exemple`, "utf8");
  writeFileSync(envApi, exemple.replace(/^API_JWT_SECRET=$/m, `API_JWT_SECRET=${randomBytes(32).toString("hex")}`), { mode: 0o600 });
  console.log("[dev] apps/api/.env créé à partir de apps/api/.env.exemple.");
}
mkdirSync(`${RACINE}donnees/uploads`, { recursive: true });

// [dossier, commande, arguments, variables]
const PROCESSUS = {
  // --env-file est une option de Node, que tsx transmet : elle doit précéder le
  // script (le « dev » du workspace la passerait au serveur comme argument).
  api: ["apps/api", "npx", ["tsx", "watch", "--env-file=.env", "src/server.ts"], {}],
  backoffice: ["apps/backoffice", "npx", ["vite", "--port", "5174", "--strictPort"], { VITE_API_URL: API }],
  www: ["apps/www", "npx", ["vite", "--port", "5175", "--strictPort"], { VITE_API_URL: API, VITE_BACKOFFICE_URL: BACKOFFICE }],
};

const demandes = process.argv.slice(2);
const inconnus = demandes.filter((nom) => !(nom in PROCESSUS));
if (inconnus.length) {
  console.error(`[dev] Inconnu : ${inconnus.join(", ")} (attendu : ${Object.keys(PROCESSUS).join(", ")}).`);
  process.exit(1);
}

const enfants = (demandes.length ? demandes : Object.keys(PROCESSUS)).map((nom) => {
  const [dossier, commande, args, env] = PROCESSUS[nom];
  const enfant = spawn(commande, args, { cwd: `${RACINE}${dossier}`, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"],
    // Groupe de processus propre : npx, tsx et vite lancent leurs propres
    // enfants, qu'un signal au seul processus direct laisserait tourner.
    detached: true,
  });
  const prefixer = (flux, sortie) =>
    flux.on("data", (morceau) => {
      for (const ligne of morceau.toString().split("\n").filter(Boolean)) sortie.write(`[${nom}] ${ligne}\n`);
    });
  prefixer(enfant.stdout, process.stdout);
  prefixer(enfant.stderr, process.stderr);
  // Un service qui s'arrête emporte les autres : un environnement à moitié
  // lancé se remarque moins qu'un arrêt franc.
  enfant.on("exit", (code) => {
    console.error(`[dev] ${nom} s'est arrêté (code ${code}).`);
    arreter(code ?? 1);
  });
  return enfant;
});

let arret = false;
function arreter(code) {
  if (arret) return;
  arret = true;
  for (const enfant of enfants) {
    try {
      process.kill(-enfant.pid, "SIGTERM");
    } catch {
      // Groupe déjà terminé.
    }
  }
  process.exitCode = code;
}
process.on("SIGINT", () => arreter(0));
process.on("SIGTERM", () => arreter(0));
