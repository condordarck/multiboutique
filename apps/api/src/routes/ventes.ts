import * as metier from "@multiboutique/metier";
import { schemaEncaissement, schemaMotif, schemaReservation, schemaVente } from "@multiboutique/shared";
import type { FastifyPluginAsync } from "fastify";
import { cleClient } from "./auth";
import { parametre, route } from "./registre";

export const routesVentes: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/ventes",
    garde: "boutique",
    service: "creerVente",
    statut: 201,
    gerer: (r, u) => metier.creerVente(db, u, { ...schemaVente.parse(r.body), boutique_id: parametre(r, "boutiqueId") }),
  });

  route(app, {
    methode: "POST",
    chemin: "/ventes/:id/annulation",
    garde: "connexion",
    service: "annulerVente",
    gerer: (r, u) => metier.annulerVente(db, u, parametre(r, "id"), schemaMotif.parse(r.body).motif),
  });
};

export const routesReservations: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  // Ouverte aux visiteurs anonymes de la vitrine ; le service limite le personnel
  // à son périmètre.
  route(app, {
    methode: "POST",
    chemin: "/reservations",
    garde: "public",
    service: "creerReservation",
    statut: 201,
    // Ouverte à tous et bloquant du stock : une limite par adresse évite qu'un
    // script réserve tout le stock de toutes les boutiques.
    config: {
      rateLimit: {
        max: 20,
        timeWindow: 60 * 60 * 1000,
        keyGenerator: cleClient,
        errorResponseBuilder: () =>
          Object.assign(new Error("Trop de réservations depuis cette adresse. Réessayez plus tard."), { statusCode: 429 }),
      },
    },
    gerer: (r, u) => metier.creerReservation(db, u, schemaReservation.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/reservations/:id/validation",
    garde: "connexion",
    service: "validerReservation",
    gerer: (r, u) => metier.validerReservation(db, u, parametre(r, "id")),
  });

  route(app, {
    methode: "POST",
    chemin: "/reservations/:id/annulation",
    garde: "connexion",
    service: "annulerReservation",
    gerer: (r, u) => metier.annulerReservation(db, u, parametre(r, "id"), schemaMotif.parse(r.body).motif),
  });

  route(app, {
    methode: "POST",
    chemin: "/reservations/:id/confirmation",
    garde: "connexion",
    service: "confirmerReservation",
    gerer: (r, u) => metier.confirmerReservation(db, u, parametre(r, "id")),
  });

  route(app, {
    methode: "POST",
    chemin: "/reservations/:id/encaissement",
    garde: "connexion",
    service: "encaisserReservation",
    gerer: (r, u) => metier.encaisserReservation(db, u, parametre(r, "id"), schemaEncaissement.parse(r.body).mode_paiement),
  });
};
