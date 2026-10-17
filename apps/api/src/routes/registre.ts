import type { Utilisateur } from "@multiboutique/metier";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { accesBoutique, administrateur, connecte } from "../session/gardes";

/**
 * Garde appliquée avant le traitement. Les services refont leurs propres
 * contrôles fins (permissions, boutique de l'objet visé) ; la garde refuse tôt.
 * - public : visiteur anonyme accepté (réservation, vitrine) ;
 * - connexion : session exigée ;
 * - boutique : session et accès à la boutique :boutiqueId de l'URL ;
 * - administrateur : rôle administrateur.
 */
export type Garde = "public" | "connexion" | "boutique" | "administrateur";

export interface EntreeRegistre {
  methode: "GET" | "POST" | "PUT" | "DELETE";
  chemin: string;
  garde: Garde;
  /** Fonction de @multiboutique/metier appelée, pour la garde de complétude. */
  service?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    registre: EntreeRegistre[];
  }
}

type UtilisateurSelon<G extends Garde> = G extends "public" ? Utilisateur | null : Utilisateur;

/** Déclare une route : garde appliquée, entrée inscrite au registre. */
export function route<G extends Garde>(
  app: FastifyInstance,
  definition: EntreeRegistre & {
    garde: G;
    statut?: number;
    gerer: (requete: FastifyRequest, utilisateur: UtilisateurSelon<G>) => Promise<unknown>;
  }
) {
  const { gerer, statut = 200, ...entree } = definition;
  app.registre.push(entree);
  app.route({
    method: entree.methode,
    url: entree.chemin,
    handler: async (requete, reponse) => {
      const utilisateur = garder(requete, entree.garde) as UtilisateurSelon<G>;
      const resultat = await gerer(requete, utilisateur);
      return reponse.code(statut).send(resultat);
    },
  });
}

function garder(requete: FastifyRequest, garde: Garde): Utilisateur | null {
  switch (garde) {
    case "public":
      return requete.utilisateur;
    case "connexion":
      return connecte(requete);
    case "boutique":
      return accesBoutique(requete);
    case "administrateur":
      return administrateur(requete);
  }
}

/** Paramètre d'URL, typé. */
export function parametre(requete: FastifyRequest, nom: string): string {
  return (requete.params as Record<string, string>)[nom]!;
}
