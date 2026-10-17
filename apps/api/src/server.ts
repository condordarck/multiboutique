import { Pool } from "pg";
import { construireApp } from "./app";
import { lireConfig } from "./config";

// Une configuration invalide arrête le démarrage, en nommant la variable fautive.
const config = lireConfig();

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const app = await construireApp({ pool, config });

await app.listen({ host: "0.0.0.0", port: config.port });
