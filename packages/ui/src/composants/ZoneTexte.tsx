import { clsx } from "clsx";
import { useId, type TextareaHTMLAttributes } from "react";

export interface ZoneTexteProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  libelle: string;
  aide?: string;
  erreur?: string;
}

export function ZoneTexte({ libelle, aide, erreur, id, className, rows = 3, ...reste }: ZoneTexteProps) {
  const idAuto = useId();
  const idChamp = id ?? idAuto;
  const idAide = `${idChamp}-aide`;
  const idErreur = `${idChamp}-erreur`;
  const descriptions = [aide && idAide, erreur && idErreur].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idChamp} className="text-libelle font-semibold text-texte">
        {libelle}
      </label>
      <textarea
        id={idChamp}
        rows={rows}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={descriptions || undefined}
        className={clsx(
          "rounded-bouton border-[1.5px] bg-surface px-4 py-3 font-texte text-courant text-texte",
          "placeholder:text-texte-discret",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          erreur ? "border-danger" : "border-bordure-forte",
          className
        )}
        {...reste}
      />
      {aide && (
        <p id={idAide} className="m-0 text-mention text-texte-discret">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={idErreur} className="m-0 text-mention font-semibold text-danger">
          {erreur}
        </p>
      )}
    </div>
  );
}
