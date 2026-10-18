import { useNotifier } from "@multiboutique/ui";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";
import { ErreurApi } from "../api/client";
import { useEnLigne } from "./useEnLigne";

export const MESSAGE_HORS_LIGNE = "Hors ligne : les modifications reprendront avec la connexion.";

interface Options<V, R> {
  appel: (variables: V) => Promise<R>;
  /** Lectures à recharger après succès (préfixes de clés). */
  invalide: QueryKey[];
  /** Message annoncé après succès. */
  succes?: string;
}

/**
 * Une écriture vers l'API. `envoyer` ne lève jamais : il renvoie le résultat,
 * ou undefined en cas d'échec, et l'erreur reste lisible pour le formulaire.
 * Hors ligne, rien n'est envoyé : le backoffice n'a pas de file d'écritures.
 */
export function useEcriture<V, R>({ appel, invalide, succes }: Options<V, R>) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const enLigne = useEnLigne();
  const [horsLigne, setHorsLigne] = useState(false);
  // Enveloppé : TanStack passe un second argument (contexte) que les fonctions d'appel ne doivent pas recevoir.
  const mutation = useMutation({ mutationFn: (variables: V) => appel(variables) });

  async function envoyer(variables: V): Promise<R | undefined> {
    if (!navigator.onLine) {
      setHorsLigne(true);
      return undefined;
    }
    setHorsLigne(false);
    try {
      const resultat = await mutation.mutateAsync(variables);
      await Promise.all(invalide.map((queryKey) => client.invalidateQueries({ queryKey })));
      if (succes) notifier.succes(succes);
      return resultat;
    } catch {
      return undefined;
    }
  }

  const erreurApi = mutation.error instanceof ErreurApi ? mutation.error : null;
  return {
    envoyer,
    enCours: mutation.isPending,
    desactivee: !enLigne,
    erreur: horsLigne ? MESSAGE_HORS_LIGNE : mutation.error ? (erreurApi?.message ?? "Erreur inattendue") : null,
    champs: erreurApi?.champs ?? {},
    reinitialiser: () => {
      setHorsLigne(false);
      mutation.reset();
    },
  };
}
