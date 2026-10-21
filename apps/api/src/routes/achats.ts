import * as metier from "@multiboutique/metier";
import {
  schemaCommandeFournisseur,
  schemaFournisseur,
  schemaModificationCommandeFournisseur,
  schemaReception,
} from "@multiboutique/shared";
import type { FastifyPluginAsync } from "fastify";
import { parametre, route } from "./registre";

export const routesAchats: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/fournisseurs",
    garde: "boutique",
    service: "creerFournisseur",
    statut: 201,
    gerer: (r, u) => metier.creerFournisseur(db, u, parametre(r, "boutiqueId"), schemaFournisseur.parse(r.body)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/boutiques/:boutiqueId/fournisseurs/:id",
    garde: "boutique",
    service: "modifierFournisseur",
    gerer: (r, u) =>
      metier.modifierFournisseur(db, u, parametre(r, "id"), parametre(r, "boutiqueId"), schemaFournisseur.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/fournisseurs/:id/activation",
    garde: "boutique",
    service: "toggleActifFournisseur",
    gerer: (r, u) => metier.toggleActifFournisseur(db, u, parametre(r, "id"), parametre(r, "boutiqueId")),
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/commandes-fournisseurs",
    garde: "boutique",
    service: "creerCommandeFournisseur",
    statut: 201,
    gerer: (r, u) =>
      metier.creerCommandeFournisseur(db, u, parametre(r, "boutiqueId"), schemaCommandeFournisseur.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/commandes-fournisseurs/:id/reception",
    garde: "connexion",
    service: "recevoirCommandeFournisseur",
    gerer: (r, u) => metier.recevoirCommandeFournisseur(db, u, parametre(r, "id"), schemaReception.parse(r.body).receptions),
  });

  route(app, {
    methode: "PUT",
    chemin: "/commandes-fournisseurs/:id",
    garde: "connexion",
    service: "modifierCommandeFournisseur",
    gerer: (r, u) => metier.modifierCommandeFournisseur(db, u, parametre(r, "id"), schemaModificationCommandeFournisseur.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/commandes-fournisseurs/:id/annulation",
    garde: "connexion",
    service: "annulerCommandeFournisseur",
    gerer: (r, u) => metier.annulerCommandeFournisseur(db, u, parametre(r, "id")),
  });
};
