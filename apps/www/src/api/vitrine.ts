import type { BoutiquePublique, CataloguePublic, ReservationClient, ReservationPublique } from "@multiboutique/shared";
import { appeler } from "@multiboutique/front";
import { useQuery } from "@tanstack/react-query";

export const cles = {
  boutiques: ["public", "boutiques"] as const,
  catalogue: (id: string) => ["public", "boutiques", id, "catalogue"] as const,
  reservation: (id: string) => ["public", "reservations", id] as const,
  mesReservations: ["me", "reservations"] as const,
};

export const useBoutiquesPubliques = () =>
  useQuery({ queryKey: cles.boutiques, queryFn: () => appeler<BoutiquePublique[]>("GET", "/public/boutiques") });

export const useCatalogue = (boutiqueId: string) =>
  useQuery({
    queryKey: cles.catalogue(boutiqueId),
    queryFn: () => appeler<CataloguePublic>("GET", `/public/boutiques/${boutiqueId}/catalogue`),
  });

export const useReservationPublique = (id: string) =>
  useQuery({ queryKey: cles.reservation(id), queryFn: () => appeler<ReservationPublique>("GET", `/public/reservations/${id}`) });

export const useMesReservations = () =>
  useQuery({ queryKey: cles.mesReservations, queryFn: () => appeler<ReservationClient[]>("GET", "/me/reservations") });

export interface NouvelleReservation {
  client_nom: string;
  client_telephone: string;
  client_email?: string;
  boutique_id: string;
  date_retrait_prevue?: string;
  lignes: { produit_id: string; quantite: number }[];
}

export const creerReservation = (corps: NouvelleReservation) =>
  appeler<{ success: true; reference: string; reservationId: string }>("POST", "/reservations", corps);

/** Services de packages/metier appelés par la vitrine (garde de complétude). */
export const SERVICES = { creerReservation };

export const LIBELLES_STATUT: Record<string, string> = {
  en_attente: "En attente de retrait",
  prete: "Prête pour retrait",
  payee: "Payée",
  retiree: "Retirée",
  annulee: "Annulée",
};
