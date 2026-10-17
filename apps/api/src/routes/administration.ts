import * as metier from "@multiboutique/metier";
import {
  schemaActivationPermission,
  schemaBoutique,
  schemaCategorie,
  schemaGroupe,
  schemaMotDePasse,
  schemaNouvelUtilisateur,
  schemaParametres,
  schemaRegion,
} from "@multiboutique/shared";
import type { FastifyPluginAsync } from "fastify";
import { parametre, route } from "./registre";

export const routesAdministration: FastifyPluginAsync<{ db: metier.Db }> = async (app, { db }) => {
  const id = (r: Parameters<typeof parametre>[0]) => parametre(r, "id");

  route(app, {
    methode: "POST",
    chemin: "/admin/utilisateurs",
    garde: "administrateur",
    service: "creerUtilisateur",
    statut: 201,
    gerer: (r, u) => metier.creerUtilisateur(db, u, schemaNouvelUtilisateur.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/admin/utilisateurs/:id/activation",
    garde: "administrateur",
    service: "toggleActifUtilisateur",
    gerer: (r, u) => metier.toggleActifUtilisateur(db, u, id(r)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/admin/utilisateurs/:id/mot-de-passe",
    garde: "administrateur",
    service: "reinitialiserMotDePasse",
    gerer: (r, u) => metier.reinitialiserMotDePasse(db, u, id(r), schemaMotDePasse.parse(r.body).mot_de_passe),
  });

  route(app, {
    methode: "POST",
    chemin: "/admin/boutiques",
    garde: "administrateur",
    service: "creerBoutique",
    statut: 201,
    gerer: (r, u) => metier.creerBoutique(db, u, schemaBoutique.parse(r.body)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/admin/boutiques/:id",
    garde: "administrateur",
    service: "modifierBoutique",
    gerer: (r, u) => metier.modifierBoutique(db, u, id(r), schemaBoutique.parse(r.body)),
  });

  route(app, {
    methode: "GET",
    chemin: "/admin/boutiques/:id/comptes",
    garde: "administrateur",
    service: "listerComptesBoutique",
    gerer: (r, u) => metier.listerComptesBoutique(db, u, id(r)),
  });

  route(app, {
    methode: "POST",
    chemin: "/admin/boutiques/:id/comptes-par-defaut",
    garde: "administrateur",
    service: "creerUtilisateursDefaut",
    gerer: (r, u) => metier.creerUtilisateursDefaut(db, u, id(r)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/admin/parametres",
    garde: "administrateur",
    service: "mettreAJourParametres",
    gerer: (r, u) => metier.mettreAJourParametres(db, u, schemaParametres.parse(r.body).parametres),
  });

  route(app, {
    methode: "POST",
    chemin: "/admin/groupes",
    garde: "administrateur",
    service: "creerGroupe",
    statut: 201,
    gerer: (r, u) => metier.creerGroupe(db, u, schemaGroupe.parse(r.body)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/admin/groupes/:id",
    garde: "administrateur",
    service: "modifierGroupe",
    gerer: (r, u) => metier.modifierGroupe(db, u, id(r), schemaGroupe.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/admin/regions",
    garde: "administrateur",
    service: "creerRegion",
    statut: 201,
    gerer: (r, u) => metier.creerRegion(db, u, schemaRegion.parse(r.body)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/admin/regions/:id",
    garde: "administrateur",
    service: "modifierRegion",
    gerer: (r, u) => metier.modifierRegion(db, u, id(r), schemaRegion.parse(r.body)),
  });

  route(app, {
    methode: "POST",
    chemin: "/admin/categories",
    garde: "administrateur",
    service: "creerCategorie",
    statut: 201,
    gerer: (r, u) => {
      const { nom, description } = schemaCategorie.parse(r.body);
      return metier.creerCategorie(db, u, nom, description);
    },
  });

  route(app, {
    methode: "PUT",
    chemin: "/admin/categories/:id",
    garde: "administrateur",
    service: "modifierCategorie",
    gerer: (r, u) => {
      const { nom, description } = schemaCategorie.parse(r.body);
      return metier.modifierCategorie(db, u, id(r), nom, description);
    },
  });

  route(app, {
    methode: "DELETE",
    chemin: "/admin/categories/:id",
    garde: "administrateur",
    service: "supprimerCategorie",
    gerer: (r, u) => metier.supprimerCategorie(db, u, id(r)),
  });

  route(app, {
    methode: "PUT",
    chemin: "/admin/permissions/:role/:permission",
    garde: "administrateur",
    service: "togglePermissionRole",
    gerer: (r, u) =>
      metier.togglePermissionRole(
        db,
        u,
        parametre(r, "role"),
        parametre(r, "permission"),
        schemaActivationPermission.parse(r.body).active
      ),
  });
};
