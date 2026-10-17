import * as metier from "@multiboutique/metier";
import {
  schemaApplicationPrixConseilles,
  schemaCreationProduit,
  schemaMouvementStock,
  schemaPrix,
  schemaPrixReference,
  schemaTransfert,
} from "@multiboutique/shared";
import type { FastifyPluginAsync } from "fastify";
import { parametre, route } from "./registre";

export const routesCatalogue: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/produits",
    garde: "boutique",
    service: "creerProduit",
    statut: 201,
    gerer: (r, u) => {
      const { produit, prix_vente, cout_revient } = schemaCreationProduit.parse(r.body);
      return metier.creerProduit(db, u, parametre(r, "boutiqueId"), produit, prix_vente, cout_revient);
    },
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/stock/:produitId/entrees",
    garde: "boutique",
    service: "entrerStock",
    gerer: (r, u) => {
      const { quantite, motif } = schemaMouvementStock.parse(r.body);
      return metier.entrerStock(db, u, parametre(r, "boutiqueId"), parametre(r, "produitId"), quantite, motif);
    },
  });

  route(app, {
    methode: "PUT",
    chemin: "/boutiques/:boutiqueId/stock/:produitId",
    garde: "boutique",
    service: "ajusterStock",
    gerer: (r, u) => {
      const { quantite, motif } = schemaMouvementStock.parse(r.body);
      return metier.ajusterStock(db, u, parametre(r, "boutiqueId"), parametre(r, "produitId"), quantite, motif);
    },
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/transferts",
    garde: "boutique",
    service: "transfertStock",
    gerer: (r, u) => {
      const t = schemaTransfert.parse(r.body);
      return metier.transfertStock(db, u, parametre(r, "boutiqueId"), t.boutique_destination_id, t.produit_id, t.quantite, t.motif);
    },
  });

  route(app, {
    methode: "PUT",
    chemin: "/boutiques/:boutiqueId/prix/:produitId",
    garde: "boutique",
    service: "modifierPrix",
    gerer: (r, u) => {
      const { prix_vente, cout_revient } = schemaPrix.parse(r.body);
      return metier.modifierPrix(db, u, parametre(r, "boutiqueId"), parametre(r, "produitId"), prix_vente, cout_revient);
    },
  });

  route(app, {
    methode: "POST",
    chemin: "/prix-reference",
    garde: "connexion",
    service: "publierPrixReference",
    gerer: (r, u) => metier.publierPrixReference(db, u, schemaPrixReference.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/boutiques/:boutiqueId/prix-conseilles/application",
    garde: "boutique",
    service: "appliquerPrixConseilles",
    gerer: (r, u) =>
      metier.appliquerPrixConseilles(db, u, parametre(r, "boutiqueId"), schemaApplicationPrixConseilles.parse(r.body ?? {}).produit_ids),
  });
};
