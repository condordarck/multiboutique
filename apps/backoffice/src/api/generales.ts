import type { BoutiqueResumee, Parametres } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "./client";

export const cles = {
  parametres: ["parametres"] as const,
  mesBoutiques: ["me", "boutiques"] as const,
};

export function useParametres() {
  return useQuery({
    queryKey: cles.parametres,
    queryFn: () => appeler<Parametres>("GET", "/parametres"),
    staleTime: 5 * 60_000,
  });
}

/** Le symbole monétaire ; « $ » tant que les paramètres ne sont pas lus (défaut du monolithe). */
export function useMonnaie(): string {
  return useParametres().data?.monnaie ?? "$";
}

export function useMesBoutiques() {
  return useQuery({
    queryKey: cles.mesBoutiques,
    queryFn: () => appeler<BoutiqueResumee[]>("GET", "/me/boutiques"),
    staleTime: 60_000,
  });
}
