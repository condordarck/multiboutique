import { ErreurMetier } from "@multiboutique/metier";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

/**
 * Traduit toute erreur en réponse { erreur, champs? }. Seuls les messages écrits
 * pour l'utilisateur sortent ; le reste est journalisé et remplacé par un message
 * générique.
 */
export function gestionnaireErreurs(erreur: FastifyError | Error, requete: FastifyRequest, reponse: FastifyReply) {
  if (erreur instanceof ErreurMetier) {
    return reponse.code(erreur.statut).send({ erreur: erreur.message });
  }

  if (erreur instanceof ZodError) {
    return reponse.code(400).send({
      erreur: "Données invalides",
      champs: erreur.issues.map((i) => ({ chemin: i.path.join("."), message: i.message })),
    });
  }

  const code = (erreur as { code?: unknown }).code;
  // RAISE EXCEPTION des fonctions PL/pgSQL (deduire_stock…) : messages écrits
  // pour l'utilisateur, conflit avec l'état des données.
  if (code === "P0001") {
    return reponse.code(409).send({ erreur: erreur.message });
  }
  // Violation d'unicité : le nom de la contrainte ne regarde pas le client.
  if (code === "23505") {
    return reponse.code(409).send({ erreur: "Cet élément existe déjà" });
  }

  // Erreurs de Fastify et de ses plugins (JSON invalide, 415, 429…).
  const statut = (erreur as FastifyError).statusCode;
  if (typeof statut === "number" && statut >= 400 && statut < 500) {
    return reponse.code(statut).send({ erreur: erreur.message });
  }

  requete.log.error({ err: erreur }, "erreur inattendue");
  return reponse.code(500).send({ erreur: "Erreur serveur, réessayez" });
}
