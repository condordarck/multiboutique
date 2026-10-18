// Morceaux de configuration Vite communs aux deux PWA.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

const ASSETS_UI = new URL("../../ui/assets/", import.meta.url);
const ICONES = [
  "favicon.ico",
  "pwa-64x64.png",
  "pwa-192x192.png",
  "pwa-512x512.png",
  "maskable-icon-512x512.png",
  "apple-touch-icon-180x180.png",
];

/** Les icônes vivent dans packages/ui : on les sert telles quelles à la racine du site. */
export function iconesPartagees(): Plugin {
  return {
    name: "mb-icones",
    configureServer(serveur) {
      serveur.middlewares.use((requete, reponse, suite) => {
        const nom = requete.url?.slice(1);
        if (!nom || !ICONES.includes(nom)) return suite();
        reponse.end(readFileSync(new URL(nom, ASSETS_UI)));
      });
    },
    generateBundle() {
      for (const nom of ICONES) {
        this.emitFile({ type: "asset", fileName: nom, source: readFileSync(new URL(nom, ASSETS_UI)) });
      }
    },
  };
}

export function version(): string {
  let commit = "local";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    // Hors dépôt git (image, archive) : la date suffit à distinguer les builds.
  }
  return `${new Date().toISOString()}-${commit}`;
}

