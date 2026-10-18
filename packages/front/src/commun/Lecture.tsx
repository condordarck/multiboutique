import { Bouton } from "@multiboutique/ui";
import type { ReactNode } from "react";
import { ErreurApi } from "../api/client";
import { Chargement } from "./Chargement";

interface RequeteLue<T> {
  isPending: boolean;
  error: Error | null;
  data: T | undefined;
  refetch: () => unknown;
}

/** Affiche un écran une fois sa lecture faite ; chargement et erreur sinon. */
export function Lecture<T>({ requete, children }: { requete: RequeteLue<T>; children: (donnees: T) => ReactNode }) {
  if (requete.isPending) return <Chargement />;
  // Des données en cache valent mieux qu'une erreur de relecture (hors ligne).
  if (requete.data === undefined) {
    const message = requete.error instanceof ErreurApi ? requete.error.message : "Lecture impossible.";
    return (
      <div role="alert" className="mt-6 flex flex-col items-start gap-3 rounded-carte bg-danger-fond px-5 py-4 text-danger">
        <p className="m-0 font-semibold">{message}</p>
        <Bouton variante="secondaire" onClick={() => void requete.refetch()}>
          Réessayer
        </Bouton>
      </div>
    );
  }
  return <>{children(requete.data)}</>;
}
