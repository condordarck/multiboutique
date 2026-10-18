import type { ProduitBoutique } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "./client";
import { cle } from "./tableaux";

export const cleProduits = (boutiqueId: string) => [...cle.boutique(boutiqueId), "produits"] as const;

export const useProduits = (boutiqueId: string) =>
  useQuery({
    queryKey: cleProduits(boutiqueId),
    queryFn: () => appeler<ProduitBoutique[]>("GET", `/boutiques/${boutiqueId}/produits`),
  });

/** Disponible à la vente : stock moins les quantités réservées. */
export function disponible(p: Pick<ProduitBoutique, "quantite" | "quantite_reservee">): number {
  return Number(p.quantite ?? 0) - Number(p.quantite_reservee ?? 0);
}
