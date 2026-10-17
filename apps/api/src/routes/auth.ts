import { ErreurMetier, type Db } from "@multiboutique/metier";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Config } from "../config";
import { DUREE_SESSION_S, signerJeton } from "../session/jeton";
import { audienceDuRole, completer, poserCookie } from "../session/utilisateur";

const schemaConnexion = z.object({
  email: z.string().min(1, "Email requis"),
  mot_de_passe: z.string().min(1, "Mot de passe requis"),
});

// Mêmes règles que app/api/auth/register : 72 caractères au plus, c'est la limite de bcrypt.
const schemaInscription = z.object({
  nom_complet: z.string().trim().min(1, "Nom requis"),
  email: z.string().trim().min(1, "Email requis"),
  mot_de_passe: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères")
    .max(72, "Le mot de passe ne doit pas dépasser 72 caractères"),
  telephone: z.string().trim().optional(),
});

/** IP du client : seul Cloudflare atteint l'API, et il la transmet dans cet en-tête. */
export function cleClient(requete: FastifyRequest): string {
  const ip = requete.headers["cf-connecting-ip"];
  return (typeof ip === "string" && ip) || requete.ip;
}

function limite(max: number, fenetreMs: number, message: string) {
  return {
    rateLimit: {
      max,
      timeWindow: fenetreMs,
      keyGenerator: cleClient,
      errorResponseBuilder: () => Object.assign(new Error(message), { statusCode: 429 }),
    },
  };
}

export const routesAuth: FastifyPluginAsync<{ db: Db; config: Config }> = async (app, { db, config }) => {
  app.post(
    "/auth/connexion",
    { config: limite(5, 15 * 60 * 1000, "Trop de tentatives. Réessayez dans quelques minutes.") },
    async (requete, reponse) => {
      const audience = requete.audience!; // garanti par le contrôle d'origine des écritures
      const { email, mot_de_passe } = schemaConnexion.parse(requete.body);

      // Vérification du mot de passe dans PostgreSQL (pgcrypto / bcrypt), comme le monolithe.
      const { rows } = await db.query(
        `SELECT id, email, nom_complet, role, boutique_ids, region_id, groupe_id
         FROM utilisateurs
         WHERE email = $1 AND actif = true AND crypt($2, password_hash) = password_hash`,
        [email, mot_de_passe]
      );
      if (!rows[0]) throw new ErreurMetier("Email ou mot de passe incorrect", 401);

      const utilisateur = await completer(db, rows[0]);
      if (audienceDuRole(utilisateur.role) !== audience) {
        throw new ErreurMetier("Ce compte ne se connecte pas ici", 403);
      }

      poserCookie(reponse, audience, signerJeton(config.jwtSecret, { id: utilisateur.id, audience }), DUREE_SESSION_S);
      return { utilisateur };
    }
  );

  app.post(
    "/auth/inscription",
    { config: limite(3, 60 * 60 * 1000, "Trop d'inscriptions depuis cette adresse. Réessayez plus tard.") },
    async (requete, reponse) => {
      if (requete.audience !== "www") {
        throw new ErreurMetier("L'inscription se fait depuis la vitrine", 403);
      }
      const donnees = schemaInscription.parse(requete.body);
      // Rôle imposé : une inscription publique ne crée qu'un compte client.
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, telephone, actif)
         VALUES ($1, crypt($2, gen_salt('bf', 10)), $3, 'client', '{}', $4, true)
         RETURNING id`,
        [donnees.email.toLowerCase(), donnees.mot_de_passe, donnees.nom_complet, donnees.telephone || null]
      );
      return reponse.code(201).send({ id: rows[0]!.id });
    }
  );

  app.post("/auth/deconnexion", async (requete, reponse) => {
    poserCookie(reponse, requete.audience!, "", 0);
    return { ok: true };
  });

  app.get("/auth/session", async (requete, reponse) => {
    if (!requete.utilisateur) return reponse.code(401).send({ erreur: "Non authentifié" });
    return { utilisateur: requete.utilisateur };
  });
};
