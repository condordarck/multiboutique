import { aPermission, type Permission } from "@multiboutique/shared";
import type { Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";

// Reprise de canAccessBoutique (lib/auth.ts) et des gardes de lib/actions, sans
// accès base : l'utilisateur est chargé par l'appelant. Les messages sont ceux
// du monolithe, que les écrans affichent.

export function peutAccederBoutique(utilisateur: Utilisateur | null, boutiqueId: string): boolean {
  if (!utilisateur) return false;
  // L'administrateur gère la configuration, pas les données commerciales
  if (utilisateur.role === "administrateur") return false;
  if (utilisateur.role === "proprietaire") return true;
  return utilisateur.boutique_ids.includes(boutiqueId);
}

export function exigerAccesBoutique(
  utilisateur: Utilisateur,
  boutiqueId: string,
  permissions: Permission[] = []
): Utilisateur {
  if (!peutAccederBoutique(utilisateur, boutiqueId)) {
    throw new ErreurMetier("Accès refusé à cette boutique", 403);
  }
  if (permissions.length > 0 && !permissions.every((p) => aPermission(utilisateur, p))) {
    throw new ErreurMetier("Votre profil n'a pas les droits pour cette action", 403);
  }
  return utilisateur;
}

export function exigerAdministrateur(utilisateur: Utilisateur): Utilisateur {
  if (utilisateur.role !== "administrateur") {
    throw new ErreurMetier("Réservé à l'administrateur", 403);
  }
  return utilisateur;
}
