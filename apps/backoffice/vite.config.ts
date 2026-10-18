import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { pluginEnTetes } from "@multiboutique/front/en-tetes";
import { iconesPartagees, version } from "@multiboutique/front/vite";

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version()) },
  plugins: [
    react(),
    tailwindcss(),
    iconesPartagees(),
    pluginEnTetes(),
    VitePWA({
      // La mise à jour est proposée (bandeau), jamais imposée au milieu d'une vente.
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "MultiBoutique Backoffice",
        short_name: "Backoffice",
        description: "Ventes, stock et gestion des boutiques MultiBoutique",
        lang: "fr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F4F0E8",
        theme_color: "#2B50D9",
        icons: [
          { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Le shell seulement. Aucune réponse de l'API n'est mise en cache par le
        // service worker : le cache de données est celui de TanStack Query.
        globPatterns: ["**/*.{js,css,html,woff2,svg,png,ico}"],
        navigateFallback: "/index.html",
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // Configuration PostCSS vide : sans elle, Vite remonte jusqu'au
  // postcss.config.js du monolithe, à la racine, qui applique Tailwind 3 à ce
  // CSS Tailwind 4. Tailwind 4 passe ici par son plugin Vite.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    // Les parcours de e2e/ sont pour Playwright.
    include: ["src/**/*.test.{ts,tsx}", "outils/**/*.test.ts"],
    // Le module virtuel du service worker n'existe qu'au build.
    alias: { "virtual:pwa-register/react": new URL("../../packages/front/test/pwa-register.ts", import.meta.url).pathname },
    setupFiles: ["./src/test-preparation.ts"],
    env: { VITE_API_URL: "https://api.test" },
  },
});
