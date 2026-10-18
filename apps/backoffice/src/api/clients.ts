import type { ClientActif } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "./client";
import { cle } from "./tableaux";

/** Liste réduite des clients actifs (caisse, commandes). */
export const useClientsActifs = (boutiqueId: string, active = true) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "clients", "actifs"],
    queryFn: () => appeler<ClientActif[]>("GET", `/boutiques/${boutiqueId}/clients?actifs=1`),
    enabled: active,
  });
