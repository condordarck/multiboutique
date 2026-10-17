import { ErreurMetier, exigerAccesBoutique, exigerAdministrateur, type Utilisateur } from "@multiboutique/metier";
import type { Permission } from "@multiboutique/shared";
import type { FastifyRequest } from "fastify";

// Gardes des routes. Les services métier refont leurs propres contrôles, comme
// les actions du monolithe : ces gardes servent les lectures et refusent tôt.

export function connecte(requete: FastifyRequest): Utilisateur {
  if (!requete.utilisateur) throw new ErreurMetier("Non authentifié", 401);
  return requete.utilisateur;
}

/** Accès à la boutique :boutiqueId de l'URL, avec les permissions demandées. */
export function accesBoutique(requete: FastifyRequest, permissions: Permission[] = []): Utilisateur {
  const utilisateur = connecte(requete);
  const { boutiqueId } = requete.params as { boutiqueId?: string };
  if (!boutiqueId) throw new Error("accesBoutique sur une route sans :boutiqueId");
  return exigerAccesBoutique(utilisateur, boutiqueId, permissions);
}

export function administrateur(requete: FastifyRequest): Utilisateur {
  return exigerAdministrateur(connecte(requete));
}
