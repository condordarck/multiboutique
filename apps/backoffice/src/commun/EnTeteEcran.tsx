import type { ReactNode } from "react";

/** Titre d'écran (h1), sous-titre et actions principales à droite. */
export function EnTeteEcran({ titre, sousTitre, actions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        <h1 className="m-0 font-titre text-[1.875rem] font-extrabold tracking-[-0.02em] tablette:text-ecran">{titre}</h1>
        {sousTitre && <p className="m-0 mt-1 text-courant text-texte-discret">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
