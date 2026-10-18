import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { QueryClient } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";
import { CLE_SESSION } from "../session/Session";

export const CLE_CACHE = "mb-cache-requetes";
export const CLE_PROPRIETAIRE = "mb-cache-proprietaire";
/** Durée de vie des lectures conservées pour le hors-ligne (spec §6.3). */
export const DUREE_CACHE_MS = 24 * 60 * 60 * 1000;

// IndexedDB peut manquer (navigation privée, tests) : le cache devient alors
// seulement mémoire, sans casser l'application.
const sur = async <T>(action: () => Promise<T>): Promise<T | undefined> => {
  try {
    return await action();
  } catch {
    return undefined;
  }
};

/** Cache de TanStack Query dans IndexedDB, et sa purge. */
export function creerPersistance() {
  const persister = createAsyncStoragePersister({
    key: CLE_CACHE,
    storage: {
      getItem: async (cle) => (await sur(() => get<string>(cle))) ?? null,
      setItem: async (cle, valeur) => void (await sur(() => set(cle, valeur))),
      removeItem: async (cle) => void (await sur(() => del(cle))),
    },
  });
  async function purger() {
    await sur(() => del(CLE_CACHE));
    await sur(() => del(CLE_PROPRIETAIRE));
  }
  return { persister, purger };
}

/**
 * Le cache appartient à un utilisateur. Si un autre ouvre une session sur
 * l'appareil (tablette partagée, session précédente expirée sans déconnexion),
 * tout ce qui n'est pas sa session est vidé avant qu'il le voie.
 */
export async function verifierProprietaire(client: QueryClient, utilisateurId: string, purger: () => Promise<void>) {
  const proprietaire = await sur(() => get<string>(CLE_PROPRIETAIRE));
  if (proprietaire && proprietaire !== utilisateurId) {
    client.removeQueries({ predicate: (requete) => requete.queryKey[0] !== CLE_SESSION[0] });
    await purger();
  }
  await sur(() => set(CLE_PROPRIETAIRE, utilisateurId));
}
