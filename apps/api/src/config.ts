export interface Config {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  origines: { www: string; backoffice: string };
  uploadsDir: string;
}

type Env = Record<string, string | undefined>;

function requise(env: Env, nom: string): string {
  const valeur = env[nom]?.trim();
  if (!valeur) throw new Error(`${nom} est requis.`);
  return valeur;
}

function origine(env: Env, nom: string, production: boolean): string {
  const valeur = requise(env, nom);
  let url: URL;
  try {
    url = new URL(valeur);
  } catch {
    throw new Error(`${nom} n'est pas une URL : « ${valeur} ».`);
  }
  // Comparée telle quelle à l'en-tête Origin : schéma https et hôte, rien d'autre.
  // Seule exception, hors production : http://localhost, pour le développement
  // et les tests de bout en bout (Chromium y accepte les cookies Secure).
  // L'image de production (NODE_ENV=production) la refuse.
  const local = !production && url.protocol === "http:" && url.hostname === "localhost";
  if ((url.protocol !== "https:" && !local) || url.origin !== valeur) {
    throw new Error(`${nom} doit être une origine https sans chemin (ex. https://www.exemple.org) : « ${valeur} ».`);
  }
  return valeur;
}

// Mêmes règles que verifierSecret (lib/session.ts) : un secret absent, court ou
// recopié de l'exemple rendrait les sessions falsifiables.
function secret(env: Env): string {
  const valeur = requise(env, "API_JWT_SECRET");
  if (valeur === "change-me-super-secret-please") {
    throw new Error("API_JWT_SECRET ne doit pas reprendre la valeur d'exemple.");
  }
  if (valeur.length < 32) {
    throw new Error("API_JWT_SECRET est trop court (32 caractères minimum ; openssl rand -hex 32).");
  }
  return valeur;
}

function port(env: Env): number {
  const brut = env.PORT?.trim();
  if (!brut) return 4000;
  const valeur = Number(brut);
  if (!Number.isInteger(valeur) || valeur < 1 || valeur > 65535) {
    throw new Error(`PORT invalide : « ${brut} ».`);
  }
  return valeur;
}

/** Lit et valide l'environnement ; la première variable invalide arrête le démarrage. */
export function lireConfig(env: Env = process.env): Config {
  return {
    port: port(env),
    databaseUrl: requise(env, "DATABASE_URL"),
    jwtSecret: secret(env),
    origines: {
      www: origine(env, "ORIGINE_WWW", env.NODE_ENV === "production"),
      backoffice: origine(env, "ORIGINE_BACKOFFICE", env.NODE_ENV === "production"),
    },
    uploadsDir: requise(env, "UPLOADS_DIR"),
  };
}
