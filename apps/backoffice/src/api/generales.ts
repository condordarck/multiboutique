import type { BoutiqueResumee } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler, CLE_PARAMETRES } from "@multiboutique/front";

// Paramètres (monnaie…) : lecture commune aux deux fronts, dans @multiboutique/front.
export { useMonnaie, useParametres } from "@multiboutique/front";

export const cles = {
  parametres: CLE_PARAMETRES,
  mesBoutiques: ["me", "boutiques"] as const,
};

export function useMesBoutiques() {
  return useQuery({
    queryKey: cles.mesBoutiques,
    queryFn: () => appeler<BoutiqueResumee[]>("GET", "/me/boutiques"),
    staleTime: 60_000,
  });
}
