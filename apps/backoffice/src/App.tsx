import { FournisseurNotifications } from "@multiboutique/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router";
import { routes } from "./routes";

export { routes };
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
