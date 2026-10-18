import type { DetailVente, ModePaiement, ResultatVente, StatistiquesVentes, VenteAvecVendeur } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "./client";
import { cle } from "./tableaux";

export const useVentes = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "ventes"],
    queryFn: () => appeler<VenteAvecVendeur[]>("GET", `/boutiques/${boutiqueId}/ventes`),
  });

export const useStatistiquesVentes = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "ventes", "statistiques"],
    queryFn: () => appeler<StatistiquesVentes>("GET", `/boutiques/${boutiqueId}/ventes/statistiques`),
  });

export const useVente = (boutiqueId: string, venteId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "ventes", venteId],
    queryFn: () => appeler<DetailVente>("GET", `/boutiques/${boutiqueId}/ventes/${venteId}`),
  });

export interface NouvelleVente {
  boutiqueId: string;
  mode_paiement: ModePaiement;
  code_promo?: string;
  client_id?: string;
  montant_paye?: number;
  lignes: { produit_id: string; quantite: number; prix_unitaire: number }[];
}

export const creerVente = ({ boutiqueId, ...corps }: NouvelleVente) =>
  appeler<ResultatVente>("POST", `/boutiques/${boutiqueId}/ventes`, corps);

export const annulerVente = ({ venteId, motif }: { venteId: string; motif: string }) =>
  appeler<{ success: true; boutique_id: string }>("POST", `/ventes/${venteId}/annulation`, { motif });

export const LIBELLES_PAIEMENT: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  carte: "Carte",
};

export const SERVICES_VENTES = { creerVente, annulerVente };
