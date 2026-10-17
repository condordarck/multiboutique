import Fastify from "fastify";
import type { Pool } from "pg";
import { routesSante } from "./routes/health";

export interface Dependances {
  pool: Pick<Pool, "query">;
}

// Fabrique : les dépendances sont injectées pour que les tests remplacent la
// base par un double, sans réseau.
export function construireApp({ pool }: Dependances) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  app.register(routesSante, { pool });
  return app;
}
