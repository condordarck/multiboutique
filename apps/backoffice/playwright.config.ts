import { defineConfig, devices } from "@playwright/test";
import { PORT_FRONT } from "./e2e/ports";

// Les parcours partagent une base : ils s'exécutent un par un, et chacun crée
// ses propres données plutôt que de compter sur celles d'un autre.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT_FRONT}`,
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Africa/Kinshasa",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx tsx e2e/lancer.ts",
    url: `http://localhost:${PORT_FRONT}`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
  },
});
