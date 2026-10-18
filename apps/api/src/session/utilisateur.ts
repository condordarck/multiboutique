import type { Db, Utilisateur } from "@multiboutique/metier";
import type { RoleUtilisateur } from "@multiboutique/shared";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import type { Config } from "../config";
import { verifierJeton, type Audience } from "./jeton";

declare module "fastify" {
  interface FastifyRequest {
    /** Utilisateur connecté sur le front d'où vient la requête, rechargé en base. */
    utilisateur: Utilisateur | null;
  }
}

// __Host- : le navigateur n'accepte ce cookie que Secure, Path=/ et sans Domain,
// et refuse qu'une page d'un sous-domaine voisin en impose un du même nom.
export const NOMS_COOKIE: Record<Audience, string> = {
  www: "__Host-mb_session_www",
  backoffice: "__Host-mb_session_bo",
};

/** Seul un client se connecte à la vitrine ; tout autre rôle, au backoffice. */
export function audienceDuRole(role: RoleUtilisateur): Audience {
  return role === "client" ? "www" : "backoffice";
}

interface LigneUtilisateur {
  id: string;
  email: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[] | null;
  region_id: string | null;
  groupe_id: string | null;
}

/**
 * Reprise de getSession (lib/auth.ts) : un utilisateur actif, son périmètre
 * effectif (un directeur voit les boutiques actives de son groupe ou de sa région)
 * et ses permissions lues dans roles_permissions.
 */
export async function chargerUtilisateur(db: Db, id: string): Promise<Utilisateur | null> {
  const { rows } = await db.query<LigneUtilisateur>(
    `SELECT id, email, nom_complet, role, boutique_ids, region_id, groupe_id
     FROM utilisateurs WHERE id = $1 AND actif = true`,
    [id]
  );
  const ligne = rows[0];
  if (!ligne) return null;
  return completer(db, ligne);
}

export async function completer(db: Db, ligne: LigneUtilisateur): Promise<Utilisateur> {
  let boutiqueIds = ligne.boutique_ids ?? [];
  if (ligne.role === "directeur_groupe" && ligne.groupe_id) {
    const { rows } = await db.query<{ id: string }>(
      `SELECT b.id FROM boutiques b
       JOIN regions r ON r.id = b.region_id
       WHERE r.groupe_id = $1 AND b.statut = 'active'`,
      [ligne.groupe_id]
    );
    boutiqueIds = rows.map((r) => r.id);
  } else if (ligne.role === "directeur_region" && ligne.region_id) {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM boutiques WHERE region_id = $1 AND statut = 'active'`,
      [ligne.region_id]
    );
    boutiqueIds = rows.map((r) => r.id);
  }

  const { rows: permissions } = await db.query<{ permission: string }>(
    `SELECT permission FROM roles_permissions WHERE role = $1 AND active = true`,
    [ligne.role]
  );

  return {
    id: ligne.id,
    email: ligne.email,
    nom_complet: ligne.nom_complet,
    role: ligne.role,
    boutique_ids: boutiqueIds,
    region_id: ligne.region_id,
    groupe_id: ligne.groupe_id,
    permissions: permissions.map((p) => p.permission),
  };
}

export function poserCookie(reponse: FastifyReply, audience: Audience, jeton: string, maxAge: number) {
  reponse.setCookie(NOMS_COOKIE[audience], jeton, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

/**
 * Charge requete.utilisateur à chaque requête qui porte le cookie du front
 * d'origine. Rien n'est mis en cache : une désactivation ou un retrait de droit
 * prend effet à la requête suivante, comme dans le monolithe.
 */
const plugin: FastifyPluginAsync<{ db: Db; config: Config }> = async (app, { db, config }) => {
  app.decorateRequest("utilisateur", null);
  app.addHook("onRequest", async (requete) => {
    const audience = requete.audience;
    if (!audience) return;
    const jeton = requete.cookies[NOMS_COOKIE[audience]];
    if (!jeton) return;
    const verifie = verifierJeton(config.jwtSecret, jeton, audience);
    if (!verifie) return;
    const utilisateur = await chargerUtilisateur(db, verifie.id);
    // Un rôle changé depuis la connexion ne garde pas l'accès à l'autre front.
    if (utilisateur && audienceDuRole(utilisateur.role) === audience) {
      requete.utilisateur = utilisateur;
    }
  });
};

export const sessions = fp(plugin, { name: "sessions", dependencies: ["securite"] });
