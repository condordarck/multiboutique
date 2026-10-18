import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "outils/**/*.test.ts"],
    alias: { "virtual:pwa-register/react": new URL("./test/pwa-register.ts", import.meta.url).pathname },
    setupFiles: ["./test/preparation.ts"],
    env: { VITE_API_URL: "https://api.test" },
  },
});
