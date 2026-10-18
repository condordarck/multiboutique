import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Link } from "react-router";

const VARIANTES = {
  primaire: "bg-primaire text-sur-primaire shadow-action hover:bg-primaire-survol",
  secondaire: "bg-surface text-texte border-[1.5px] border-bordure-forte hover:bg-surface-relevee",
  discret: "bg-transparent text-primaire hover:bg-primaire-fond",
};

/** Un lien qui a l'allure d'un bouton (« Voir », « Nouvelle vente »). */
export function LienBouton({
  to,
  variante = "discret",
  className,
  children,
  ...reste
}: {
  to: string;
  variante?: keyof typeof VARIANTES;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <Link
      to={to}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-bouton px-4 font-bold whitespace-nowrap no-underline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        VARIANTES[variante],
        className
      )}
      {...reste}
    >
      {children}
    </Link>
  );
}
