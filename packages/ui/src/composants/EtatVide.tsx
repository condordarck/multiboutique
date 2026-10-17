import { clsx } from "clsx";
import { Bouton } from "./Bouton";

export interface EtatVideProps {
  message: string;
  description?: string;
  action?: { libelle: string; onClick: () => void };
  className?: string;
}

export function EtatVide({ message, description, action, className }: EtatVideProps) {
  return (
    <div className={clsx("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <p className="m-0 font-titre text-panneau font-bold text-texte">{message}</p>
      {description && <p className="m-0 max-w-prose text-courant text-texte-discret">{description}</p>}
      {action && (
        <Bouton className="mt-2" onClick={action.onClick}>
          {action.libelle}
        </Bouton>
      )}
    </div>
  );
}
