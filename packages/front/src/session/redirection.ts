import type { SessionUtilisateur } from "@multiboutique/shared";

/**
 * Anti open-redirect, repris de la page de connexion du monolithe : seuls les
 * chemins internes propres sont acceptés (pas de « //evil.com », pas de schéma).
 */
export function retourSain(valeur: string | null): string | null {
  if (!valeur || valeur.length > 300) return null;
  if (!valeur.startsWith("/") || valeur.startsWith("//")) return null;
  if (/[\\\r\n\t\0-\u001f]/.test(valeur)) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(valeur)) return null;
  return valeur;
}

/** Écran d'arrivée selon le rôle, comme le middleware et /dashboard du monolithe. */
export function accueilDu(utilisateur: SessionUtilisateur): string | null {
  switch (utilisateur.role) {
    case "administrateur":
      return "/admin";
    case "directeur_groupe":
    case "directeur_region":
      return "/consolidation";
    case "proprietaire":
      return "/tableau-de-bord";
    default: {
      const premiere = utilisateur.boutique_ids[0];
      // Sans boutique : un écran d'explication, pas une boucle de redirection.
      return premiere ? `/b/${premiere}` : null;
    }
  }
}
