import type { Permission, SessionUtilisateur } from "@multiboutique/shared";
import { aPermission } from "@multiboutique/shared";

export interface Section {
  /** Segment après /b/:boutiqueId ; vide pour la vue d'ensemble. */
  segment: string;
  libelle: string;
  permission?: Permission;
}

/**
 * Sections d'une boutique : mêmes libellés et mêmes permissions que le menu du
 * monolithe (components/dashboard/Sidebar.tsx). L'ordre sert le téléphone, où
 * seules les quatre premières tiennent dans la barre du bas.
 */
export const SECTIONS_BOUTIQUE: Section[] = [
  { segment: "", libelle: "Vue d'ensemble" },
  { segment: "ventes", libelle: "Ventes", permission: "ventes:voir" },
  { segment: "stock", libelle: "Stock", permission: "stock:voir" },
  { segment: "clients", libelle: "Clients", permission: "clients:voir" },
  { segment: "produits", libelle: "Produits", permission: "produits:voir" },
  { segment: "commandes", libelle: "Commandes B2B", permission: "commandes:voir" },
  { segment: "reservations", libelle: "Réservations", permission: "reservations:voir" },
  { segment: "rapports", libelle: "Rapports", permission: "rapports:voir" },
  { segment: "promotions", libelle: "Promotions", permission: "promos:voir" },
  { segment: "achats", libelle: "Achats & fournisseurs", permission: "achats:voir" },
  { segment: "prix-conseilles", libelle: "Prix conseillés", permission: "prix_conseilles:voir" },
];

export interface Entree {
  cle: string;
  libelle: string;
  chemin: string;
}

/** Entrées du menu du personnel, pour la boutique courante (s'il y en a une). */
export function entreesPersonnel(utilisateur: SessionUtilisateur, boutiqueId: string | null): Entree[] {
  const entrees: Entree[] = [];
  if (utilisateur.role === "proprietaire") {
    entrees.push({ cle: "tableau-de-bord", libelle: "Tableau de bord", chemin: "/tableau-de-bord" });
  }
  if (aPermission(utilisateur, "consolidation:voir")) {
    entrees.push({ cle: "consolidation", libelle: "Consolidation siège", chemin: "/consolidation" });
  }
  if (boutiqueId) {
    for (const section of SECTIONS_BOUTIQUE) {
      if (section.permission && !aPermission(utilisateur, section.permission)) continue;
      entrees.push({
        cle: section.segment || "ensemble",
        libelle: section.libelle,
        chemin: section.segment ? `/b/${boutiqueId}/${section.segment}` : `/b/${boutiqueId}`,
      });
    }
  }
  return entrees;
}

/** Entrées de l'administration, comme le menu de app/(admin)/layout.tsx. */
export const ENTREES_ADMIN: Entree[] = [
  { cle: "admin", libelle: "Accueil", chemin: "/admin" },
  { cle: "organisation", libelle: "Organisation", chemin: "/admin/organisation" },
  { cle: "utilisateurs", libelle: "Utilisateurs", chemin: "/admin/utilisateurs" },
  { cle: "roles", libelle: "Rôles & habilitations", chemin: "/admin/roles" },
  { cle: "boutiques", libelle: "Boutiques", chemin: "/admin/boutiques" },
  { cle: "categories", libelle: "Catégories", chemin: "/admin/categories" },
  { cle: "types-frais", libelle: "Types de frais", chemin: "/admin/types-frais" },
  { cle: "parametres", libelle: "Paramètres", chemin: "/admin/parametres" },
];

/** L'entrée active : celle dont le chemin est le plus long préfixe de l'adresse. */
export function entreeActive(entrees: Entree[], adresse: string): string | undefined {
  return entrees
    .filter((e) => adresse === e.chemin || adresse.startsWith(`${e.chemin}/`))
    .sort((a, b) => b.chemin.length - a.chemin.length)[0]?.cle;
}

export const LIBELLES_ROLE: Record<string, string> = {
  administrateur: "Administrateur",
  proprietaire: "Propriétaire",
  directeur_groupe: "Directeur de groupe",
  directeur_region: "Directeur de région",
  gerant: "Gérant",
  gerant_stock: "Gérant de stock",
  comptable: "Comptable",
  vendeur: "Vendeur",
  client: "Client",
};
