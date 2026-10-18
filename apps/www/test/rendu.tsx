import type { SessionUtilisateur } from "@multiboutique/shared";
import { FournisseurNotifications } from "@multiboutique/ui";
import type { FauxApi } from "@multiboutique/front/test/faux-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "../src/routes";

/** Rend la vitrine entière à l'adresse donnée, sur le faux serveur. */
export function rendreApp(chemin: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const routeur = createMemoryRouter(routes, { initialEntries: [chemin] });
  const rendu = render(
    <QueryClientProvider client={client}>
      <FournisseurNotifications>
        <RouterProvider router={routeur} />
      </FournisseurNotifications>
    </QueryClientProvider>
  );
  return { ...rendu, routeur, client, adresse: () => routeur.state.location.pathname + routeur.state.location.search };
}

export const BOUTIQUE_1 = "11111111-1111-1111-1111-111111111111";
export const BOUTIQUE_2 = "22222222-2222-2222-2222-222222222222";

export function client(surcharge: Partial<SessionUtilisateur> = {}): SessionUtilisateur {
  return {
    id: "c-1",
    email: "ade@exemple.org",
    nom_complet: "Mme Ade",
    role: "client",
    boutique_ids: [],
    permissions: [],
    ...surcharge,
  };
}

/** Un visiteur : pas de session ; paramètres publics. */
export function visiteur(api: FauxApi) {
  api.repondre("GET", "/auth/session", 401, { erreur: "Non authentifié" });
  api.repondre("GET", "/parametres", 200, { monnaie: "$", nom_application: "MultiBoutique", seuil_alerte_defaut: "10" });
}

/** Un client connecté. */
export function connecte(api: FauxApi, u: SessionUtilisateur = client()) {
  api.repondre("GET", "/auth/session", 200, { utilisateur: u });
  api.repondre("GET", "/parametres", 200, { monnaie: "$", nom_application: "MultiBoutique", seuil_alerte_defaut: "10" });
  return u;
}
