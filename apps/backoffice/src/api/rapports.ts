import type { Rapport } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "@multiboutique/front";
import { cle } from "./tableaux";

export interface ParametresRapport {
  periode: string;
  debut?: string;
  fin?: string;
  vendeur?: string;
  produit?: string;
}

export const useRapport = (boutiqueId: string, p: ParametresRapport) => {
  const chaine = new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({
    queryKey: [...cle.boutique(boutiqueId), "rapports", chaine],
    queryFn: () => appeler<Rapport>("GET", `/boutiques/${boutiqueId}/rapports?${chaine}`),
    // Garde les choix de vendeurs et de produits affichés pendant le changement de filtre.
    placeholderData: (precedent) => precedent,
  });
};
