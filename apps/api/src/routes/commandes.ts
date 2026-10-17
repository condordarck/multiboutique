import * as metier from "@multiboutique/metier";
import { schemaCommande } from "@multiboutique/shared";
import type { FastifyPluginAsync } from "fastify";
import { parametre, route } from "./registre";

export const routesCommandes: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/commandes",
    garde: "boutique",
    service: "creerCommande",
    statut: 201,
    gerer: (r, u) => metier.creerCommande(db, u, parametre(r, "boutiqueId"), schemaCommande.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/commandes/:id/confirmation",
    garde: "connexion",
    service: "confirmerCommande",
    gerer: (r, u) => metier.confirmerCommande(db, u, parametre(r, "id")),
  });

  route(app, {
    methode: "POST",
    chemin: "/commandes/:id/livraison",
    garde: "connexion",
    service: "livrerCommande",
    gerer: (r, u) => metier.livrerCommande(db, u, parametre(r, "id")),
  });

  route(app, {
    methode: "POST",
    chemin: "/commandes/:id/annulation",
    garde: "connexion",
    service: "annulerCommande",
    gerer: (r, u) => metier.annulerCommande(db, u, parametre(r, "id")),
  });
};
