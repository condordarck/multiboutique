import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { Pool } from "pg";
import type { Config } from "./config";
import { gestionnaireErreurs } from "./erreurs";
import { routesAchats } from "./routes/achats";
import { routesAuth } from "./routes/auth";
import { routesCatalogue } from "./routes/catalogue";
import { routesClients, routesPromotions } from "./routes/clients";
import { routesCommandes } from "./routes/commandes";
import { routesSante } from "./routes/health";
import { routesReservations, routesVentes } from "./routes/ventes";
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
  // Une action sans données (validation, confirmation…) peut arriver avec un
  // corps vide et l'en-tête JSON : c'est un corps absent, pas une erreur. Le
  // reste passe par l'analyseur de Fastify (protégé contre __proto__).
  const analyseurJson = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (requete, corps, fini) => {
    if (corps === "") return fini(null, undefined);
    analyseurJson(requete, corps as string, fini);
  });
  // Registre des routes métier, partagé par tous les plugins (garde de complétude).
  app.decorate("registre", []);
  await app.register(securite, { config });
  await app.register(cookie);
  // Limites posées route par route (connexion, inscription), pas globalement.
  await app.register(rateLimit, { global: false });
  await app.register(sessions, { db: pool, config });
  await app.register(routesSante, { pool });
  await app.register(routesAuth, { db: pool, config });
  await app.register(routesVentes, { db: pool });
  await app.register(routesReservations, { db: pool });
  await app.register(routesCatalogue, { db: pool });
  await app.register(routesClients, { db: pool });
  await app.register(routesPromotions, { db: pool });
  await app.register(routesCommandes, { db: pool });
  await app.register(routesAchats, { db: pool });
  return app;
}
