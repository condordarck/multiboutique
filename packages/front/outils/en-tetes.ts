import type { Plugin } from "vite";
import { loadEnv } from "vite";

/** Origine de l'API exigée au build : https, ou http://localhost pour le développement et les parcours. */
export function origineApi(valeur: string | undefined): string {
  if (!valeur) throw new Error("VITE_API_URL est requis pour construire le backoffice (ex. https://api.morpion.cloud).");
  let url: URL;
  try {
    url = new URL(valeur);
  } catch {
    throw new Error(`VITE_API_URL n'est pas une URL : « ${valeur} ».`);
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) {
    throw new Error(`VITE_API_URL doit être en https (http seulement pour localhost) : « ${valeur} ».`);
  }
  return url.origin;
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

/** Écrit dist/_headers à partir de VITE_API_URL ; refuse de construire sans. */
export function pluginEnTetes(): Plugin {
  let api = "";
  return {
    name: "mb-en-tetes",
    apply: "build",
    configResolved(config) {
      api = origineApi(loadEnv(config.mode, config.envDir || config.root, "VITE_").VITE_API_URL);
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "_headers", source: enTetes(api) });
    },
  };
}
