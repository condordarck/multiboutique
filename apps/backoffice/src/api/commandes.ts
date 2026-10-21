import type { CommandeListee, ModePaiement, ReservationDetaillee, TermePaiement } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "@multiboutique/front";
import { cle } from "./tableaux";

export const useCommandes = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "commandes"],
    queryFn: () => appeler<CommandeListee[]>("GET", `/boutiques/${boutiqueId}/commandes`),
  });

export const useReservations = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "reservations"],
    queryFn: () => appeler<ReservationDetaillee[]>("GET", `/boutiques/${boutiqueId}/reservations`),
  });

export interface NouvelleCommande {
  boutiqueId: string;
  client_id: string;
  terme_paiement: TermePaiement;
  code_promo?: string;
  note?: string;
  lignes: { produit_id: string; quantite: number; prix_unitaire: number }[];
}

export const creerCommande = ({ boutiqueId, ...corps }: NouvelleCommande) =>
  appeler<{ success: true; reference: string; montantTotal: number; remise: number }>("POST", `/boutiques/${boutiqueId}/commandes`, corps);
/** Avant livraison : lignes, paiement et note ; client et code promo inchangés. Note vide : effacée. */
export const modifierCommande = ({ id, ...corps }: { id: string; terme_paiement: TermePaiement; note: string; lignes: NouvelleCommande["lignes"] }) =>
  appeler<{ success: true; montantTotal: number; remise: number }>("PUT", `/commandes/${id}`, corps);
export const confirmerCommande = ({ id }: { id: string }) => appeler<{ success: true }>("POST", `/commandes/${id}/confirmation`);
export const livrerCommande = ({ id }: { id: string }) => appeler<{ success: true }>("POST", `/commandes/${id}/livraison`);
export const annulerCommande = ({ id }: { id: string }) => appeler<{ success: true }>("POST", `/commandes/${id}/annulation`);

export const confirmerReservation = ({ id }: { id: string }) => appeler<{ success: true }>("POST", `/reservations/${id}/confirmation`);
export const encaisserReservation = ({ id, mode_paiement }: { id: string; mode_paiement: ModePaiement }) =>
  appeler<{ success: true; reference: string; montantTotal: number }>("POST", `/reservations/${id}/encaissement`, { mode_paiement });
export const annulerReservation = ({ id, motif }: { id: string; motif: string }) =>
  appeler<{ success: true }>("POST", `/reservations/${id}/annulation`, { motif });

export const SERVICES_COMMANDES = {
  creerCommande,
  modifierCommande,
  confirmerCommande,
  livrerCommande,
  annulerCommande,
  confirmerReservation,
  encaisserReservation,
  annulerReservation,
};
