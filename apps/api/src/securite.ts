import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { Config } from "./config";
import type { Audience } from "./session/jeton";

declare module "fastify" {
  interface FastifyRequest {
    /** Front d'où vient la requête, d'après Origin ; null sans Origin connu. */
    audience: Audience | null;
  }
  interface FastifyContextConfig {
    /** Route qui reçoit du multipart (envoi d'image) au lieu de JSON. */
    televersement?: boolean;
  }
}

const METHODES_SURES = new Set(["GET", "HEAD", "OPTIONS"]);

export function audienceDe(config: Config, origine: string | undefined): Audience | null {
  if (origine === config.origines.www) return "www";
  if (origine === config.origines.backoffice) return "backoffice";
  return null;
}

/**
 * CORS limité aux deux fronts, et défense CSRF. Les trois sous-domaines sont du
 * même site : SameSite ne protège donc pas d'une page d'un autre sous-domaine.
 * Toute écriture exige un Origin connu (les navigateurs l'envoient toujours sur
 * une requête cross-origin) et du JSON, qui impose un preflight CORS.
 */
const plugin: FastifyPluginAsync<{ config: Config }> = async (app, { config }) => {
  await app.register(cors, {
    origin: [config.origines.www, config.origines.backoffice],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  });

  app.decorateRequest("audience", null);

  app.addHook("onRequest", async (requete, reponse) => {
    requete.audience = audienceDe(config, requete.headers.origin);
    if (METHODES_SURES.has(requete.method)) return;

    if (!requete.audience) {
      return reponse.code(403).send({ erreur: "Origine refusée" });
    }

    const type = requete.headers["content-type"];
    if (!type) return; // écriture sans corps (validation, annulation…)
    const attendu = requete.routeOptions.config?.televersement ? "multipart/form-data" : "application/json";
    if (type.split(";")[0]!.trim().toLowerCase() !== attendu) {
      return reponse.code(415).send({ erreur: `Contenu attendu : ${attendu}` });
    }
  });
};

export const securite = fp(plugin, { name: "securite" });
