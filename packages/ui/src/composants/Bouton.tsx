import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

export type VarianteBouton = "primaire" | "secondaire" | "danger" | "discret";

export interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  /** Action principale d'un écran : plus haute (60 px) et plus grande. */
  grand?: boolean;
  /** Désactive le bouton et l'annonce occupé, le temps d'une requête. */
  chargement?: boolean;
}

const VARIANTES: Record<VarianteBouton, string> = {
  primaire: "bg-primaire text-sur-primaire shadow-action enabled:hover:bg-primaire-survol",
  secondaire:
    "bg-surface text-texte border-[1.5px] border-bordure-forte enabled:hover:bg-surface-relevee",
  danger: "bg-danger text-sur-danger enabled:hover:brightness-95",
  discret: "bg-transparent text-primaire enabled:hover:bg-primaire-fond",
};

export function Bouton({
  variante = "primaire",
  grand = false,
  chargement = false,
  disabled,
  type = "button",
  className,
  children,
  ...reste
}: BoutonProps) {
  return (
    <button
      type={type}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      className={clsx(
        "inline-flex min-w-11 items-center justify-center gap-2 rounded-bouton font-texte font-bold",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-60",
        grand ? "min-h-[60px] px-7 text-[1.1875rem]" : "min-h-[52px] px-5 text-courant",
        VARIANTES[variante],
        className
      )}
      {...reste}
    >
      {chargement && (
        <svg
          className="size-5 motion-safe:animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}
