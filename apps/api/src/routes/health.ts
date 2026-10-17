import type { FastifyPluginAsync } from "fastify";
import type { Pool } from "pg";

// La route est publique et interroge la base : sans ce cache, une requête
// répétée épuiserait le pool et mettrait l'API à terre. Trois secondes
// suffisent pour une sonde qui tourne toutes les 30 secondes.
const DUREE_CACHE_MS = 3000;

export const routesSante: FastifyPluginAsync<{ pool: Pick<Pool, "query"> }> = async (
  app,
  { pool }
) => {
  // Le cache vit dans la fermeture, pas au niveau du module : chaque instance
  // de l'application (une par test) part d'un cache vide.
  let dernierResultat: { ok: boolean; instant: number } | null = null;

  app.get("/health", async (_requete, reponse) => {
    const maintenant = Date.now();

    if (!dernierResultat || maintenant - dernierResultat.instant >= DUREE_CACHE_MS) {
      let ok = false;
      try {
        await pool.query("SELECT 1");
        ok = true;
      } catch (erreur) {
        // Le détail reste hors de la réponse — publique — mais doit apparaître
        // dans les journaux : sans lui, une erreur de configuration ressemble
        // à une base en panne et envoie l'exploitant chercher au mauvais endroit.
        app.log.error({ err: erreur }, "sonde de santé en échec");
      }
      dernierResultat = { ok, instant: maintenant };
    }

    return dernierResultat.ok
      ? reponse.code(200).send({ status: "ok" })
      : reponse.code(503).send({ status: "degraded" });
  });
};
