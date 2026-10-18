import type { CommandeFournisseurListee, Fournisseur, GrillePrixConseilles } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "./client";
import { cle } from "./tableaux";

export const useFournisseurs = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "fournisseurs"],
    queryFn: () => appeler<Fournisseur[]>("GET", `/boutiques/${boutiqueId}/fournisseurs`),
  });

export const useCommandesFournisseurs = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "commandes-fournisseurs"],
    queryFn: () => appeler<CommandeFournisseurListee[]>("GET", `/boutiques/${boutiqueId}/commandes-fournisseurs`),
  });

export const usePrixConseilles = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "prix-conseilles"],
    queryFn: () => appeler<GrillePrixConseilles>("GET", `/boutiques/${boutiqueId}/prix-conseilles`),
  });

export interface FournisseurSaisi {
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
}

type RefFournisseur = { boutiqueId: string; fournisseurId: string };

export const creerFournisseur = ({ boutiqueId, ...corps }: FournisseurSaisi & { boutiqueId: string }) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/fournisseurs`, corps);
export const modifierFournisseur = ({ boutiqueId, fournisseurId, ...corps }: FournisseurSaisi & RefFournisseur) =>
  appeler<{ success: true }>("PUT", `/boutiques/${boutiqueId}/fournisseurs/${fournisseurId}`, corps);
export const toggleActifFournisseur = ({ boutiqueId, fournisseurId }: RefFournisseur) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/fournisseurs/${fournisseurId}/activation`);

export interface NouvelleCommandeFournisseur {
  boutiqueId: string;
  fournisseur_id: string;
  note?: string;
  lignes: { produit_id: string; quantite: number; prix_unitaire: number }[];
}

export const creerCommandeFournisseur = ({ boutiqueId, ...corps }: NouvelleCommandeFournisseur) =>
  appeler<{ success: true; reference: string }>("POST", `/boutiques/${boutiqueId}/commandes-fournisseurs`, corps);
export const recevoirCommandeFournisseur = ({ id, receptions }: { id: string; receptions: { ligne_id: string; quantite_recue: number }[] }) =>
  appeler<{ success: true; reference: string }>("POST", `/commandes-fournisseurs/${id}/reception`, { receptions });
export const annulerCommandeFournisseur = ({ id }: { id: string }) =>
  appeler<{ success: true }>("POST", `/commandes-fournisseurs/${id}/annulation`);

export const publierPrixReference = (corps: { produit_id: string; prix_vente: number; cout_revient: number | null; actif: boolean }) =>
  appeler<{ success: true }>("POST", "/prix-reference", corps);
export const appliquerPrixConseilles = ({ boutiqueId, produit_ids }: { boutiqueId: string; produit_ids?: string[] }) =>
  appeler<{ success: true; appliques: number }>("POST", `/boutiques/${boutiqueId}/prix-conseilles/application`, produit_ids ? { produit_ids } : {});

export const SERVICES_ACHATS = {
  creerFournisseur,
  modifierFournisseur,
  toggleActifFournisseur,
  creerCommandeFournisseur,
  recevoirCommandeFournisseur,
  annulerCommandeFournisseur,
  publierPrixReference,
  appliquerPrixConseilles,
};
