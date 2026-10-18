import { FournisseurNotifications } from "@multiboutique/ui";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { persistance } from "./hors-ligne/instance";
import { DUREE_CACHE_MS, verifierProprietaire } from "./hors-ligne/persistance";
import { routes } from "./routes";
import { surConnexion, surDeconnexion } from "./session/Session";

export { routes };

export function creerClientRequetes() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Une erreur 4xx ne se corrige pas en réessayant ; le réseau, si.
        retry: (echecs, erreur) => echecs < 2 && (erreur as { statut?: number }).statut === 0,
        // Le cache persisté doit vivre aussi longtemps que sa conservation.
        gcTime: DUREE_CACHE_MS,
      },
    },
  });
}

const client = creerClientRequetes();
const routeur = createBrowserRouter(routes);
// Déconnexion : le cache de l'appareil part avec la session. Connexion d'un
// autre utilisateur : son prédécesseur ne doit rien laisser à l'écran.
surDeconnexion(persistance.purger);
surConnexion((id) => verifierProprietaire(client, id, persistance.purger));

export function App() {
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister: persistance.persister,
        maxAge: DUREE_CACHE_MS,
        // Une nouvelle version jette le cache de l'ancienne (formes de réponse changées).
        buster: __VERSION__,
        // Une session vide n'est pas conservée : restaurée, elle renverrait à la
        // connexion avant que l'API ait répondu.
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" && q.state.data != null },
      }}
    >
      <FournisseurNotifications>
        <RouterProvider router={routeur} />
      </FournisseurNotifications>
    </PersistQueryClientProvider>
  );
}
