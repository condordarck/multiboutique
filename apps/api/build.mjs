// Construit l'image de production de l'API : un seul fichier, dépendances et
// paquets du monorepo compris, pour une image sans node_modules.
import { build } from "esbuild";

await build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  // Pilote natif optionnel de pg, absent de l'image.
  external: ["pg-native"],
  // Des dépendances CommonJS appellent require() : on le fournit au bundle ESM.
  banner: {
    js: "import { createRequire as __creerRequire } from 'node:module'; const require = __creerRequire(import.meta.url);",
  },
  logLevel: "warning",
});
