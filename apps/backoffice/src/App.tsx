import { FournisseurNotifications } from "@multiboutique/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Outlet, RouterProvider, type RouteObject } from "react-router";
import { Accueil } from "./ecrans/Accueil";
import { Connexion } from "./ecrans/Connexion";
import { Introuvable } from "./ecrans/Introuvable";
import { GardeSession } from "./session/GardeSession";
import { FournisseurSession } from "./session/Session";

export const routes: RouteObject[] = [
  {
    element: (
      <FournisseurSession>
        <Outlet />
      </FournisseurSession>
    ),
    children: [
      { path: "/connexion", element: <Connexion /> },
      {
        element: <GardeSession />,
        children: [
          { index: true, element: <Accueil /> },
          // Écrans ajoutés par les tâches suivantes du plan.
          { path: "b/:boutiqueId/*", element: <Outlet /> },
        ],
      },
      { path: "*", element: <Introuvable /> },
    ],
  },
];

export function creerClientRequetes() {
  return new QueryClient({
    defaultOptions: {
      // Une erreur 4xx ne se corrige pas en réessayant ; le réseau, si.
      queries: {
        retry: (echecs, erreur) => echecs < 2 && (erreur as { statut?: number }).statut === 0,
      },
    },
  });
}

const client = creerClientRequetes();
const routeur = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={client}>
      <FournisseurNotifications>
        <RouterProvider router={routeur} />
      </FournisseurNotifications>
    </QueryClientProvider>
  );
}
