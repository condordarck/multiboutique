import { Pool } from "pg";
import { construireApp } from "./app";

const chaineConnexion = process.env.DATABASE_URL;
if (!chaineConnexion) {
  // Échec bruyant : se rabattre silencieusement sur une base locale masque
  // une erreur de configuration jusqu'à ce qu'elle devienne une panne.
  throw new Error("DATABASE_URL est requis.");
}

const pool = new Pool({
  connectionString: chaineConnexion,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const app = construireApp({ pool });

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 4000) });
