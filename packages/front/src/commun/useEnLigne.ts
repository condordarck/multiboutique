import { useSyncExternalStore } from "react";

function abonner(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

/** L'appareil a-t-il une connexion ? Les écritures en dépendent (aucune file différée). */
export function useEnLigne(): boolean {
  return useSyncExternalStore(abonner, () => navigator.onLine, () => true);
}
