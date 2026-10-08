import type { SessionUser } from "@/lib/session";
import type { RoleUtilisateur } from "@/types";

// Matrice de permissions : chaque profil a des droits spécifiques.
// Une action n'est exécutable que si le rôle de l'utilisateur possède
// la permission correspondante (en plus de l'accès à la boutique).

export type Permission =
  | "ventes:voir"
  | "ventes:creer"
  | "ventes:annuler"
  | "reservations:voir"
  | "reservations:gerer"
  | "stock:voir"
  | "stock:gerer"
  | "produits:voir"
  | "produits:gerer"
  | "prix:gerer"
  | "rapports:voir"
  | "promos:voir"
  | "promos:gerer"
  | "clients:voir"
  | "clients:gerer"
  | "commandes:voir"
  | "commandes:gerer"
  | "achats:voir"
  | "achats:gerer"
  | "consolidation:voir"
  | "prix_conseilles:voir"
  | "prix_conseilles:gerer";

const TOUTES_PERMISSIONS: Permission[] = [
  "ventes:voir",
  "ventes:creer",
  "ventes:annuler",
  "reservations:voir",
  "reservations:gerer",
  "stock:voir",
  "stock:gerer",
  "produits:voir",
  "produits:gerer",
  "prix:gerer",
  "rapports:voir",
  "promos:voir",
  "promos:gerer",
  "clients:voir",
  "clients:gerer",
  "commandes:voir",
  "commandes:gerer",
  "achats:voir",
  "achats:gerer",
  "consolidation:voir",
  "prix_conseilles:voir",
  "prix_conseilles:gerer",
];

// Permissions "siège" : lecture + consolidation pour les directions
const PERMISSIONS_DIRECTION: Permission[] = [
  "ventes:voir",
  "reservations:voir",
  "stock:voir",
  "produits:voir",
  "rapports:voir",
  "promos:voir",
  "clients:voir",
  "commandes:voir",
  "achats:voir",
  "consolidation:voir",
  "prix_conseilles:voir",
];

const PERMISSIONS_PAR_ROLE: Record<RoleUtilisateur, Permission[]> = {
  // Configuration générale uniquement (pas de données commerciales)
  administrateur: [],

  // Toutes les boutiques, toutes les fonctionnalités
  proprietaire: TOUTES_PERMISSIONS,

  // Direction d'un groupe (siège) : vue consolidée lecture
  directeur_groupe: PERMISSIONS_DIRECTION,

  // Direction d'une région : vue consolidée lecture
  directeur_region: PERMISSIONS_DIRECTION,

  // Gère sa boutique : tout l'opérationnel
  // (hors publication des prix conseillés, réservée au siège)
  gerant: TOUTES_PERMISSIONS.filter((p) => p !== "prix_conseilles:gerer"),

  // Uniquement les entrées/ajustements de stock
  gerant_stock: ["stock:voir", "stock:gerer", "produits:voir"],

  // Lecture seule des ventes et réservations (suivi financier)
  comptable: [
    "ventes:voir",
    "reservations:voir",
    "stock:voir",
    "produits:voir",
    "rapports:voir",
    "promos:voir",
    "clients:voir",
    "commandes:voir",
    "achats:voir",
    "consolidation:voir",
    "prix_conseilles:voir",
  ],

  // Encaisse les ventes uniquement (pas de gestion de stock/prix)
  vendeur: ["ventes:voir", "ventes:creer", "stock:voir", "produits:voir"],

  // Espace client (hors dashboard)
  client: [],
};

export function permissionsDuRole(role: RoleUtilisateur): Permission[] {
  return PERMISSIONS_PAR_ROLE[role] || [];
}

export function aPermission(
  user: SessionUser | null,
  permission: Permission
): boolean {
  if (!user) return false;
  return permissionsDuRole(user.role).includes(permission);
}

export function aToutesPermissions(
  user: SessionUser | null,
  permissions: Permission[]
): boolean {
  return permissions.every((p) => aPermission(user, p));
}