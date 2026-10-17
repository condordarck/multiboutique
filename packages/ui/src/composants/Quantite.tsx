import { clsx } from "clsx";

export interface QuantiteProps {
  /** Nom de l'article, repris dans les libellés des boutons. */
  libelle: string;
  valeur: number;
  onChange: (valeur: number) => void;
  min?: number;
  /** Le stock disponible, typiquement. */
  max?: number;
  className?: string;
}

const BOUTON = clsx(
  "inline-flex size-12 items-center justify-center rounded-bouton border-[1.5px] border-bordure-forte bg-surface text-texte",
  "enabled:hover:bg-surface-relevee disabled:cursor-not-allowed disabled:opacity-40",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
);

export function Quantite({ libelle, valeur, onChange, min = 1, max, className }: QuantiteProps) {
  return (
    <div role="group" aria-label={`Quantité de ${libelle}`} className={clsx("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        aria-label={`Retirer un ${libelle}`}
        disabled={valeur <= min}
        onClick={() => onChange(valeur - 1)}
        className={BOUTON}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <span aria-live="polite" className="min-w-8 text-center text-courant font-bold tabular-nums">
        {valeur}
      </span>
      <button
        type="button"
        aria-label={`Ajouter un ${libelle}`}
        disabled={max !== undefined && valeur >= max}
        onClick={() => onChange(valeur + 1)}
        className={BOUTON}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
