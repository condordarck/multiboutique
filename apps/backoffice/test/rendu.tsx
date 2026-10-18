import type { SessionUtilisateur } from "@multiboutique/shared";
import { FournisseurNotifications } from "@multiboutique/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "../src/routes";
import type { FauxApi } from "./faux-api";

/** Rend l'application entière à l'adresse donnée, sur le faux serveur. */
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

export function utilisateur(surcharge: Partial<SessionUtilisateur> = {}): SessionUtilisateur {
  return {
    id: "u1",
    email: "gerant@exemple.org",
    nom_complet: "Awa Gérante",
    role: "gerant",
    boutique_ids: [BOUTIQUE_1],
    permissions: [],
    ...surcharge,
  };
}

/** Déclare une session ouverte (et les boutiques de l'utilisateur) sur le faux serveur. */
export function connecte(api: FauxApi, u: SessionUtilisateur = utilisateur()) {
  api.repondre("GET", "/auth/session", 200, { utilisateur: u });
  api.repondre("GET", "/me/boutiques", 200, [
    { id: BOUTIQUE_1, nom: "Boutique 1", statut: "active" },
    { id: BOUTIQUE_2, nom: "Boutique 2", statut: "active" },
  ].filter((b) => u.role === "proprietaire" || u.boutique_ids.includes(b.id)));
  api.repondre("GET", "/parametres", 200, { monnaie: "$", nom_application: "MultiBoutique", seuil_alerte_defaut: "10" });
  return u;
}
