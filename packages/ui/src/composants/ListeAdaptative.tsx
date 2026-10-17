import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface Colonne<T> {
  cle: string;
  libelle: string;
  rendu: (ligne: T) => ReactNode;
  /** Titre de la carte en dessous du format bureau. Une seule colonne principale. */
  principale?: boolean;
  /** « fin » pour les montants et quantités : alignés à droite dans le tableau. */
  alignement?: "debut" | "fin";
}

export interface ListeAdaptativeProps<T> {
  /** Nom de la liste pour les lecteurs d'écran (légende du tableau). */
  legende: string;
  colonnes: Colonne<T>[];
  lignes: T[];
  cleLigne: (ligne: T) => string;
  /** Affiché à la place de la liste quand elle est vide. */
  vide: ReactNode;
  className?: string;
}

/**
 * Une liste qui s'affiche en cartes jusqu'à la tablette et en tableau au format
 * bureau. Les deux rendus sont dans le DOM et le CSS en masque un : un élément
 * en display: none sort aussi de l'arbre d'accessibilité, donc un lecteur
 * d'écran n'en lit jamais qu'un seul.
 */
export function ListeAdaptative<T>({
  legende,
  colonnes,
  lignes,
  cleLigne,
  vide,
  className,
}: ListeAdaptativeProps<T>) {
  if (lignes.length === 0) {
    return <div className={className}>{vide}</div>;
  }

  const principale = colonnes.find((c) => c.principale) ?? colonnes[0]!;
  const secondaires = colonnes.filter((c) => c !== principale);

  return (
    <div className={className}>
      <ul aria-label={legende} className="m-0 flex list-none flex-col gap-2 p-0 bureau:hidden">
        {lignes.map((ligne) => (
          <li
            key={cleLigne(ligne)}
            className="flex flex-col gap-2 rounded-carte border border-bordure bg-surface px-4 py-3"
          >
            <p className="m-0 text-courant font-semibold text-texte">{principale.rendu(ligne)}</p>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {secondaires.map((colonne) => (
                <div key={colonne.cle} className="contents">
                  <dt className="text-mention text-texte-discret">{colonne.libelle}</dt>
                  <dd className={clsx("m-0 text-libelle text-texte", colonne.alignement === "fin" && "tabular-nums")}>
                    {colonne.rendu(ligne)}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <table className="hidden w-full border-collapse text-libelle bureau:table">
        <caption className="sr-only">{legende}</caption>
        <thead>
          <tr className="border-b border-bordure text-left">
            {colonnes.map((colonne) => (
              <th
                key={colonne.cle}
                scope="col"
                className={clsx(
                  "px-3 py-2.5 text-mention font-semibold text-texte-discret",
                  colonne.alignement === "fin" && "text-right"
                )}
              >
                {colonne.libelle}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={cleLigne(ligne)} className="h-14 border-b border-bordure last:border-b-0">
              {colonnes.map((colonne) => (
                <td
                  key={colonne.cle}
                  className={clsx(
                    "px-3 text-texte",
                    colonne.principale && "font-semibold",
                    colonne.alignement === "fin" && "text-right font-bold tabular-nums"
                  )}
                >
                  {colonne.rendu(ligne)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
