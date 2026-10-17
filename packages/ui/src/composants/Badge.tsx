import { clsx } from "clsx";
import type { ReactNode } from "react";

export type TonBadge = "neutre" | "succes" | "alerte" | "danger" | "info";

const TONS: Record<TonBadge, string> = {
  neutre: "bg-neutre-fond text-texte-discret",
  succes: "bg-succes-fond text-succes",
  alerte: "bg-alerte-fond text-alerte",
  danger: "bg-danger-fond text-danger",
  info: "bg-info-fond text-info",
};

export interface BadgeProps {
  ton?: TonBadge;
  className?: string;
  /** Le texte porte le sens : la couleur ne fait que le souligner. */
  children: ReactNode;
}

export function Badge({ ton = "neutre", className, children }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-mention font-semibold whitespace-nowrap",
        TONS[ton],
        className
      )}
    >
      {children}
    </span>
  );
}
