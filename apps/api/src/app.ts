import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { Pool } from "pg";
import type { Config } from "./config";
import { gestionnaireErreurs } from "./erreurs";
import { routesAuth } from "./routes/auth";
import { routesSante } from "./routes/health";
import { securite } from "./securite";
import { sessions } from "./session/utilisateur";

export interface Dependances {
  pool: Pick<Pool, "query" | "connect">;
  config: Config;
}

// Fabrique : les dépendances sont injectées pour que les tests remplacent la
// base par une base de test, sans réseau.
export async function construireApp({ pool, config }: Dependances) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  app.setErrorHandler(gestionnaireErreurs);
  await app.register(securite, { config });
  await app.register(cookie);
  // Limites posées route par route (connexion, inscription), pas globalement.
  await app.register(rateLimit, { global: false });
  await app.register(sessions, { db: pool, config });
  await app.register(routesSante, { pool });
  await app.register(routesAuth, { db: pool, config });
  return app;
}
