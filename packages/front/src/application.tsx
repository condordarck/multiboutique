import { FournisseurNotifications } from "@multiboutique/ui";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { DUREE_CACHE_MS, verifierProprietaire, type creerPersistance } from "./hors-ligne/persistance";
import { surConnexion, surDeconnexion } from "./session/Session";

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

/**
 * L'application d'un front : routeur, cache persisté dans IndexedDB et
 * notifications. À appeler une fois, au chargement du module de l'application.
 */
export function creerApplication(routes: RouteObject[], persistance: ReturnType<typeof creerPersistance>) {
  const client = creerClientRequetes();
  const routeur = createBrowserRouter(routes);
  // Déconnexion : le cache de l'appareil part avec la session. Connexion d'un
  // autre utilisateur : son prédécesseur ne doit rien laisser à l'écran.
  surDeconnexion(persistance.purger);
  surConnexion((id) => verifierProprietaire(client, id, persistance.purger));

  return function Application() {
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
  };
}
