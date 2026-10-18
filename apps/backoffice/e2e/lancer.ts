// Serveurs des parcours du backoffice (webServer de playwright.config.ts).
import { fileURLToPath } from "node:url";
import { demarrerParcours } from "@multiboutique/front/e2e/serveurs";
import { PORT_API, PORT_FRONT } from "./ports";

await demarrerParcours({
  portApi: PORT_API,
  fronts: [{ audience: "backoffice", racine: fileURLToPath(new URL("..", import.meta.url)), port: PORT_FRONT }],
});
