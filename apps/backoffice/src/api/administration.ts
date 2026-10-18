import type {
  BoutiquesAdmin,
  CategorieAdmin,
  CompteCree,
  ComptesAdmin,
  Organisation,
  RoleUtilisateur,
  StatistiquesAdmin,
} from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "@multiboutique/front";

const cle = (...suite: string[]) => ["admin", ...suite] as const;

export const useStatistiquesAdmin = () => useQuery({ queryKey: cle("statistiques"), queryFn: () => appeler<StatistiquesAdmin>("GET", "/admin/statistiques") });
export const useComptesAdmin = () => useQuery({ queryKey: cle("utilisateurs"), queryFn: () => appeler<ComptesAdmin>("GET", "/admin/utilisateurs") });
export const useBoutiquesAdmin = () => useQuery({ queryKey: cle("boutiques"), queryFn: () => appeler<BoutiquesAdmin>("GET", "/admin/boutiques") });
export const useOrganisation = () => useQuery({ queryKey: cle("organisation"), queryFn: () => appeler<Organisation>("GET", "/admin/organisation") });
export const useCategoriesAdmin = () => useQuery({ queryKey: cle("categories"), queryFn: () => appeler<CategorieAdmin[]>("GET", "/admin/categories") });
export const useRolesPermissions = () =>
  useQuery({ queryKey: cle("roles"), queryFn: () => appeler<{ role: string; permission: string; active: boolean }[]>("GET", "/admin/roles") });
export const useComptesBoutique = (boutiqueId: string) =>
  useQuery({ queryKey: cle("boutiques", boutiqueId, "comptes"), queryFn: () => listerComptesBoutique({ id: boutiqueId }) });

/** Toute écriture d'administration relit toutes les lectures d'administration. */
export const INVALIDE_ADMIN = [["admin"]];

export interface NouvelUtilisateur {
  nom_complet: string;
  email: string;
  password: string;
  telephone?: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id: string | null;
  groupe_id: string | null;
}

export interface BoutiqueSaisie {
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  region_id: string | null;
  statut: "active" | "inactive";
}

export interface GroupeSaisi {
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
}

export const creerUtilisateur = (corps: NouvelUtilisateur) => appeler<{ success: true }>("POST", "/admin/utilisateurs", corps);
export const toggleActifUtilisateur = ({ id }: { id: string }) => appeler<{ success: true }>("POST", `/admin/utilisateurs/${id}/activation`);
export const reinitialiserMotDePasse = ({ id, mot_de_passe }: { id: string; mot_de_passe: string }) =>
  appeler<{ success: true }>("PUT", `/admin/utilisateurs/${id}/mot-de-passe`, { mot_de_passe });
export const creerBoutique = (corps: BoutiqueSaisie) =>
  appeler<{ success: true; boutiqueId: string; comptes: CompteCree[] }>("POST", "/admin/boutiques", corps);
export const modifierBoutique = ({ id, ...corps }: BoutiqueSaisie & { id: string }) => appeler<{ success: true }>("PUT", `/admin/boutiques/${id}`, corps);
export const listerComptesBoutique = ({ id }: { id: string }) =>
  appeler<{ id: string; nom_complet: string; email: string; role: string; actif: boolean }[]>("GET", `/admin/boutiques/${id}/comptes`);
export const creerUtilisateursDefaut = ({ id }: { id: string }) =>
  appeler<{ success: true; comptes: CompteCree[] }>("POST", `/admin/boutiques/${id}/comptes-par-defaut`);
export const mettreAJourParametres = (parametres: { cle: string; valeur: string }[]) =>
  appeler<{ success: true }>("PUT", "/admin/parametres", { parametres });
export const creerGroupe = (corps: GroupeSaisi) => appeler<{ success: true }>("POST", "/admin/groupes", corps);
export const modifierGroupe = ({ id, ...corps }: GroupeSaisi & { id: string }) => appeler<{ success: true }>("PUT", `/admin/groupes/${id}`, corps);
export const creerRegion = (corps: { nom: string; groupe_id: string }) => appeler<{ success: true }>("POST", "/admin/regions", corps);
export const modifierRegion = ({ id, ...corps }: { id: string; nom: string; groupe_id: string }) =>
  appeler<{ success: true }>("PUT", `/admin/regions/${id}`, corps);
export const creerCategorie = (corps: { nom: string; description?: string }) => appeler<{ success: true; id: string }>("POST", "/admin/categories", corps);
export const modifierCategorie = ({ id, ...corps }: { id: string; nom: string; description?: string }) =>
  appeler<{ success: true }>("PUT", `/admin/categories/${id}`, corps);
export const supprimerCategorie = ({ id }: { id: string }) => appeler<{ success: true }>("DELETE", `/admin/categories/${id}`);
export const togglePermissionRole = ({ role, permission, active }: { role: string; permission: string; active: boolean }) =>
  appeler<{ success: true }>("PUT", `/admin/permissions/${role}/${encodeURIComponent(permission)}`, { active });

export const SERVICES_ADMINISTRATION = {
  creerUtilisateur,
  toggleActifUtilisateur,
  reinitialiserMotDePasse,
  creerBoutique,
  modifierBoutique,
  listerComptesBoutique,
  creerUtilisateursDefaut,
  mettreAJourParametres,
  creerGroupe,
  modifierGroupe,
  creerRegion,
  modifierRegion,
  creerCategorie,
  modifierCategorie,
  supprimerCategorie,
  togglePermissionRole,
};
