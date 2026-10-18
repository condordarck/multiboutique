import type { Parametres } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "./client";

export const CLE_PARAMETRES = ["parametres"] as const;

/** GET /parametres (public) : monnaie, nom de l'application… */
export function useParametres(options: { refetchOnMount?: "always" } = {}) {
  return useQuery({
    queryKey: CLE_PARAMETRES,
    queryFn: () => appeler<Parametres>("GET", "/parametres"),
    staleTime: 5 * 60_000,
    ...options,
  });
}

/** Le symbole monétaire ; « $ » tant que les paramètres ne sont pas lus (défaut du monolithe). */
export function useMonnaie(): string {
  return useParametres().data?.monnaie ?? "$";
}
