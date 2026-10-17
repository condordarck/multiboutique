import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/preparation-globale.ts"],
    // Les tests d'intégration ouvrent de vraies connexions et transactions.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
