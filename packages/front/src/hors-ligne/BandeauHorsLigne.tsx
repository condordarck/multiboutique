import { Bandeau } from "@multiboutique/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { useEnLigne } from "../commun/useEnLigne";

/** Hors connexion : les écrans montrent le cache, daté de sa dernière lecture réussie. */
export function BandeauHorsLigne() {
  const enLigne = useEnLigne();
  const cache = useQueryClient().getQueryCache();
  // Suit le cache : il peut être restauré d'IndexedDB après le premier rendu.
  const derniere = useSyncExternalStore(
    useCallback((rappel) => cache.subscribe(rappel), [cache]),
    () => Math.max(0, ...cache.getAll().map((q) => q.state.dataUpdatedAt))
  );
  if (enLigne) return null;
  const heure = derniere ? new Date(derniere).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <Bandeau ton="alerte">
      {heure
        ? `Hors ligne — données du ${heure}. Les modifications reprendront avec la connexion.`
        : "Hors ligne — les modifications reprendront avec la connexion."}
    </Bandeau>
  );
}
