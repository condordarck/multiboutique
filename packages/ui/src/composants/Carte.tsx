import { clsx } from "clsx";
import { useId, type ReactNode } from "react";

export interface CarteProps {
  titre?: string;
  /** Niveau de l'en-tête, selon la place de la carte dans la page. */
  niveauTitre?: 2 | 3 | 4;
  /** Lien ou bouton placé à droite du titre (« Tout voir »). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Carte({ titre, niveauTitre = 2, action, className, children }: CarteProps) {
  const idTitre = useId();
  const Titre = `h${niveauTitre}` as const;
  const classes = clsx("flex flex-col gap-3 rounded-carte bg-surface p-5 shadow-carte", className);

  if (!titre) {
    return <div className={classes}>{children}</div>;
  }

  // Une carte titrée est une région nommée : les lecteurs d'écran la listent
  // et permettent d'y sauter directement.
  return (
    <section aria-labelledby={idTitre} className={classes}>
      <div className="flex items-center justify-between gap-3">
        <Titre id={idTitre} className="m-0 font-titre text-panneau font-bold text-texte">
          {titre}
        </Titre>
        {action}
      </div>
      {children}
    </section>
  );
}
