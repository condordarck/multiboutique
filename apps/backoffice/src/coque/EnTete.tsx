import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ReactNode } from "react";
import { MenuCompte } from "./MenuCompte";

/** Barre au-dessus du contenu : contexte à gauche, date et compte à droite. */
export function EnTete({ contexte }: { contexte?: ReactNode }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 py-2">
      {contexte}
      <span className="hidden text-libelle text-texte-discret tablette:inline">
        {format(new Date(), "EEEE d MMMM", { locale: fr })}
      </span>
      <span className="flex-1" />
      <MenuCompte />
    </div>
  );
}
