import { clsx } from "clsx";
import type { ReactNode } from "react";
import { Bouton } from "./Bouton";

export interface BandeauProps {
  ton?: "info" | "alerte";
  action?: { libelle: string; onClick: () => void };
  className?: string;
  children: ReactNode;
}

/** Message pleine largeur sur l'état de l'application : hors ligne, nouvelle version. */
export function Bandeau({ ton = "info", action, className, children }: BandeauProps) {
  return (
    <div
      role="status"
      className={clsx(
        "flex flex-wrap items-center gap-3 px-4 py-2 text-libelle font-semibold tablette:px-7",
        ton === "info" ? "bg-info-fond text-info" : "bg-alerte-fond text-alerte",
        className
      )}
    >
      <span className="flex-1">{children}</span>
      {action && (
        <Bouton variante="secondaire" onClick={action.onClick}>
          {action.libelle}
        </Bouton>
      )}
    </div>
  );
}
