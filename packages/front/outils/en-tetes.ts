import type { Plugin } from "vite";
import { loadEnv } from "vite";

/** Une origine exigée au build : https, ou http://localhost pour le développement et les parcours. */
export function origineExigee(nom: string, valeur: string | undefined): string {
  if (!valeur) throw new Error(`${nom} est requis pour construire ce front (ex. https://api.morpion.cloud).`);
  let url: URL;
  try {
    url = new URL(valeur);
  } catch {
    throw new Error(`${nom} n'est pas une URL : « ${valeur} ».`);
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error(`${nom} doit être en https (http seulement pour localhost) : « ${valeur} ».`);
  }
  return url.origin;
}

/** Origine de l'API exigée au build. */
export function origineApi(valeur: string | undefined): string {
  return origineExigee("VITE_API_URL", valeur);
}

/**
 * Le fichier _headers de Cloudflare. La CSP dépend de l'hôte de l'API : elle
 * est écrite au build, en un seul exemplaire (deux CSP se cumuleraient par
 * intersection). Le CI ajoute X-Robots-Tag en recette.
 */
export function enTetes(api: string): string {
  const csp = [
    "default-src 'self'",
    `img-src 'self' data: ${api}`,
    "style-src 'self'",
    "script-src 'self'",
    `connect-src 'self' ${api}`,
    "font-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  Content-Security-Policy: ${csp}

/index.html
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`;
}

/**
 * Écrit dist/_headers à partir de VITE_API_URL ; refuse de construire sans.
 * `exigees` : autres adresses VITE_* sans lesquelles le front ne doit pas partir.
 */
export function pluginEnTetes({ exigees = [] }: { exigees?: string[] } = {}): Plugin {
  let api = "";
  return {
    name: "mb-en-tetes",
    apply: "build",
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir || config.root, "VITE_");
      api = origineApi(env.VITE_API_URL);
      for (const nom of exigees) origineExigee(nom, env[nom]);
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: enTetes(api) });
    },
  };
}
