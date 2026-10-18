import { Bouton, EtatVide, ListeAdaptative, type ListeAdaptativeProps } from "@multiboutique/ui";
import type { ReactNode } from "react";
import { ErreurApi } from "../api/client";

interface RequeteListe<T> {
  isPending: boolean;
  error: Error | null;
  data: T[] | undefined;
  refetch: () => unknown;
}

export interface ListeChargeeProps<T> extends Omit<ListeAdaptativeProps<T>, "lignes" | "vide"> {
  requete: RequeteListe<T>;
  /** Message quand la liste est vide. */
  vide: ReactNode;
}

/** Une liste lue dans l'API : chargement, erreur (avec « Réessayer »), vide, ou la liste. */
export function ListeChargee<T>({ requete, vide, ...liste }: ListeChargeeProps<T>) {
  if (requete.isPending) {
    return (
      <div role="status" className="flex flex-col gap-2 py-2" aria-label="Chargement">
        <span className="sr-only">Chargement…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-carte bg-surface-relevee motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  if (requete.error || !requete.data) {
    const message = requete.error instanceof ErreurApi ? requete.error.message : "Lecture impossible.";
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-carte bg-danger-fond px-4 py-3 text-danger">
        <p className="m-0 font-semibold">{message}</p>
        <Bouton variante="secondaire" onClick={() => void requete.refetch()}>
          Réessayer
        </Bouton>
      </div>
    );
  }
  return (
    <ListeAdaptative
      {...liste}
      lignes={requete.data}
      vide={typeof vide === "string" ? <EtatVide message={vide} /> : vide}
    />
  );
}
