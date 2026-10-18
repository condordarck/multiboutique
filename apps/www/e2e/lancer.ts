// Serveurs des parcours de la vitrine : l'API, la vitrine et le backoffice
// (parcours croisés), chacun sous ses vrais en-têtes.
import { fileURLToPath } from "node:url";
import { demarrerParcours } from "@multiboutique/front/e2e/serveurs";
import { PORT_API, PORT_BACKOFFICE, PORT_FRONT, URL_BACKOFFICE } from "./ports";

await demarrerParcours({
  portApi: PORT_API,
  fronts: [
    {
      audience: "www",
      racine: fileURLToPath(new URL("..", import.meta.url)),
      port: PORT_FRONT,
      env: { VITE_BACKOFFICE_URL: URL_BACKOFFICE },
    },
    { audience: "backoffice", racine: fileURLToPath(new URL("../../backoffice", import.meta.url)), port: PORT_BACKOFFICE },
  ],
});
