import type { ClientActif, CodePromo, CodePromoFormData, DossiersClients, LigneRegistre, TypeClient } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "@multiboutique/front";
import { cle } from "./tableaux";

/** Liste réduite des clients actifs (caisse, commandes). */
export const useClientsActifs = (boutiqueId: string, active = true) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "clients", "actifs"],
    queryFn: () => appeler<ClientActif[]>("GET", `/boutiques/${boutiqueId}/clients?actifs=1`),
    enabled: active,
  });

export const useDossiersClients = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "clients", "dossiers"],
    queryFn: () => appeler<DossiersClients>("GET", `/boutiques/${boutiqueId}/clients`),
  });

export const useRegistre = (boutiqueId: string, clientId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "clients", clientId, "registre"],
    queryFn: () => listerRegistre({ boutiqueId, clientId }),
  });

export const useCodesPromo = (boutiqueId: string) =>
  useQuery({
    queryKey: [...cle.boutique(boutiqueId), "codes-promo"],
    queryFn: () => appeler<CodePromo[]>("GET", `/boutiques/${boutiqueId}/codes-promo`),
  });

export interface ClientSaisi {
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  type_client: TypeClient;
  plafond_credit: number;
  est_vip: boolean;
}

type RefClient = { boutiqueId: string; clientId: string };

export const creerClient = ({ boutiqueId, ...corps }: ClientSaisi & { boutiqueId: string }) =>
  appeler<{ success: true; clientId?: string }>("POST", `/boutiques/${boutiqueId}/clients`, corps);
export const modifierClient = ({ boutiqueId, clientId, ...corps }: ClientSaisi & RefClient) =>
  appeler<{ success: true }>("PUT", `/boutiques/${boutiqueId}/clients/${clientId}`, corps);
export const toggleActifClient = ({ boutiqueId, clientId }: RefClient) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/clients/${clientId}/activation`);
export const basculerVip = ({ boutiqueId, clientId }: RefClient) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/clients/${clientId}/vip`);
export const listerRegistre = ({ boutiqueId, clientId }: RefClient) =>
  appeler<LigneRegistre[]>("GET", `/boutiques/${boutiqueId}/clients/${clientId}/registre`);
export const reglerEncours = ({ boutiqueId, clientId, montant }: RefClient & { montant: number }) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/clients/${clientId}/reglements`, { montant });

export const creerCodePromo = ({ boutiqueId, ...corps }: CodePromoFormData & { boutiqueId: string }) =>
  appeler<{ success: true }>("POST", `/boutiques/${boutiqueId}/codes-promo`, corps);
export const modifierCodePromo = ({ id, ...corps }: CodePromoFormData & { id: string }) =>
  appeler<{ success: true }>("PUT", `/codes-promo/${id}`, corps);
export const toggleActifCodePromo = ({ id }: { id: string }) => appeler<{ success: true }>("POST", `/codes-promo/${id}/activation`);
export const supprimerCodePromo = ({ id }: { id: string }) => appeler<{ success: true }>("DELETE", `/codes-promo/${id}`);

export const SERVICES_CLIENTS = {
  creerClient,
  modifierClient,
  toggleActifClient,
  basculerVip,
  listerRegistre,
  reglerEncours,
  creerCodePromo,
  modifierCodePromo,
  toggleActifCodePromo,
  supprimerCodePromo,
};
