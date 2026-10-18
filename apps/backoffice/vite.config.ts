import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Configuration PostCSS vide : sans elle, Vite remonte jusqu'au
  // postcss.config.js du monolithe, à la racine, qui applique Tailwind 3 à ce
  // CSS Tailwind 4. Tailwind 4 passe ici par son plugin Vite.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-preparation.ts"],
    env: { VITE_API_URL: "https://api.test" },
  },
});
