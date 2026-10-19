import type { CategorieResumee, LigneStock, Mouvement, ProduitBoutique } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "@multiboutique/front";
import { cle } from "./tableaux";

export const cleProduits = (boutiqueId: string) => [...cle.boutique(boutiqueId), "produits"] as const;

export const useProduits = (boutiqueId: string) =>
  useQuery({
    queryKey: cleProduits(boutiqueId),
    queryFn: () => appeler<ProduitBoutique[]>("GET", `/boutiques/${boutiqueId}/produits`),
  });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => appeler<CategorieResumee[]>("GET", "/categories"), staleTime: 5 * 60_000 });

export const useStock = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "stock"],
    queryFn: () => appeler<LigneStock[]>("GET", `/boutiques/${boutiqueId}/stock`),
  });

export interface FiltresMouvements {
  periode?: string;
  type?: string;
  produit?: string;
}

export const useMouvements = (boutiqueId: string, filtres: FiltresMouvements) => {
  const chaine = new URLSearchParams(Object.entries(filtres).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: [...cle.boutique(boutiqueId), "mouvements", chaine],
    queryFn: () => appeler<Mouvement[]>("GET", `/boutiques/${boutiqueId}/mouvements-stock${chaine ? `?${chaine}` : ""}`),
  });
};

/** Disponible à la vente : stock moins les quantités réservées. */
export function disponible(p: Pick<ProduitBoutique, "quantite" | "quantite_reservee">): number {
  return Number(p.quantite ?? 0) - Number(p.quantite_reservee ?? 0);
}

export interface NouveauProduit {
  boutiqueId: string;
  produit: { nom: string; reference: string; description?: string; categorie_id?: string; image_url?: string; code?: string };
  prix_vente: number;
  cout_revient?: number;
}

export const creerProduit = ({ boutiqueId, ...corps }: NouveauProduit) =>
  appeler<{ success: true; produitId: string }>("POST", `/boutiques/${boutiqueId}/produits`, corps);

export interface ProduitModifie {
  boutiqueId: string;
  produitId: string;
  produit: { nom: string; description: string; categorie_id: string; image_url: string; code?: string };
}

/** Champs vides : effacés ; code absent : inchangé. */
export const modifierProduit = ({ boutiqueId, produitId, produit }: ProduitModifie) =>
  appeler<{ success: true }>("PUT", `/boutiques/${boutiqueId}/produits/${produitId}`, produit);

interface MouvementSaisi {
  boutiqueId: string;
  produitId: string;
  quantite: number;
  motif?: string;
}

export const entrerStock = ({ boutiqueId, produitId, quantite, motif = "" }: MouvementSaisi) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/stock/${produitId}/entrees`, { quantite, motif });

/** quantite : la nouvelle quantité totale. */
export const ajusterStock = ({ boutiqueId, produitId, quantite, motif = "" }: MouvementSaisi) =>
  appeler<{ success: true }>("PUT", `/boutiques/${boutiqueId}/stock/${produitId}`, { quantite, motif });

export const transfertStock = ({
  boutiqueId,
  produitId,
  destinationId,
  quantite,
  motif = "",
}: MouvementSaisi & { destinationId: string }) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/transferts`, {
    boutique_destination_id: destinationId,
    produit_id: produitId,
    quantite,
    motif,
  });

export const modifierPrix = ({
  boutiqueId,
  produitId,
  prix_vente,
  cout_revient,
}: {
  boutiqueId: string;
  produitId: string;
  prix_vente: number;
  cout_revient?: number;
}) => appeler<{ success: true }>("PUT", `/boutiques/${boutiqueId}/prix/${produitId}`, { prix_vente, cout_revient });

export const SERVICES_CATALOGUE = { creerProduit, modifierProduit, entrerStock, ajusterStock, transfertStock, modifierPrix };
