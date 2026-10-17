import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

// Icônes de la PWA à partir de l'icône du logotype (outils/logotype.py).
// Masquable et Apple : le système découpe l'icône lui-même et n'accepte pas la
// transparence. Le fond reprend le bleu primaire, si bien que les coins arrondis
// de la source se fondent dans le carré au lieu de laisser un liseré blanc.
const fondPlein = { background: "#2B50D9", fit: "contain" as const };

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: fondPlein },
    // iOS arrondit les coins sans découper de cercle : une marge réduite suffit,
    // la marge de 30 % par défaut laisserait le monogramme flotter dans le vide.
    apple: { ...minimal2023Preset.apple, padding: 0.12, resizeOptions: fondPlein },
  },
  images: ["assets/icone.svg"],
});
