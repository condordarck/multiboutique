import * as metier from "@multiboutique/metier";
import { schemaClient, schemaCodePromo, schemaReglement } from "@multiboutique/shared";
import type { FastifyPluginAsync } from "fastify";
import { parametre, route } from "./registre";

export const routesClients: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  const b = (r: Parameters<typeof parametre>[0]) => parametre(r, "boutiqueId");
  const id = (r: Parameters<typeof parametre>[0]) => parametre(r, "id");

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/clients",
    garde: "boutique",
    service: "creerClient",
    statut: 201,
    gerer: (r, u) => metier.creerClient(db, u, b(r), schemaClient.parse(r.body)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/boutiques/:boutiqueId/clients/:id",
    garde: "boutique",
    service: "modifierClient",
    gerer: (r, u) => metier.modifierClient(db, u, id(r), b(r), schemaClient.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/clients/:id/activation",
    garde: "boutique",
    service: "toggleActifClient",
    gerer: (r, u) => metier.toggleActifClient(db, u, id(r), b(r)),
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/clients/:id/vip",
    garde: "boutique",
    service: "basculerVip",
    gerer: (r, u) => metier.basculerVip(db, u, id(r), b(r)),
  });

  route(app, {
    methode: "GET",
    chemin: "/boutiques/:boutiqueId/clients/:id/registre",
    garde: "boutique",
    service: "listerRegistre",
    gerer: (r, u) => metier.listerRegistre(db, u, id(r), b(r)),
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/clients/:id/reglements",
    garde: "boutique",
    service: "reglerEncours",
    gerer: (r, u) => metier.reglerEncours(db, u, id(r), b(r), schemaReglement.parse(r.body).montant),
  });
};

export const routesPromotions: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/codes-promo",
    garde: "boutique",
    service: "creerCodePromo",
    statut: 201,
    gerer: (r, u) => metier.creerCodePromo(db, u, parametre(r, "boutiqueId"), schemaCodePromo.parse(r.body)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/codes-promo/:id",
    garde: "connexion",
    service: "modifierCodePromo",
    gerer: (r, u) => metier.modifierCodePromo(db, u, parametre(r, "id"), schemaCodePromo.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/codes-promo/:id/activation",
    garde: "connexion",
    service: "toggleActifCodePromo",
    gerer: (r, u) => metier.toggleActifCodePromo(db, u, parametre(r, "id")),
  });

  route(app, {
    methode: "DELETE",
    chemin: "/codes-promo/:id",
    garde: "connexion",
    service: "supprimerCodePromo",
    gerer: (r, u) => metier.supprimerCodePromo(db, u, parametre(r, "id")),
  });
};
