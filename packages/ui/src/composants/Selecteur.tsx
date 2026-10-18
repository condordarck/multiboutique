import { clsx } from "clsx";
import { useId, type SelectHTMLAttributes } from "react";

export interface OptionSelecteur {
  valeur: string;
  libelle: string;
}

export interface SelecteurProps extends SelectHTMLAttributes<HTMLSelectElement> {
  libelle: string;
  options: OptionSelecteur[];
  /** Libellé d'une première option sans valeur (« Aucun client »). */
  optionVide?: string;
  aide?: string;
  erreur?: string;
  /** Libellé lu par les lecteurs d'écran seulement (en-tête compact). */
  libelleMasque?: boolean;
}

export function Selecteur({ libelle, options, optionVide, aide, erreur, libelleMasque = false, id, className, ...reste }: SelecteurProps) {
  const idAuto = useId();
  const idChamp = id ?? idAuto;
  const idAide = `${idChamp}-aide`;
  const idErreur = `${idChamp}-erreur`;
  const descriptions = [aide && idAide, erreur && idErreur].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idChamp} className={libelleMasque ? "sr-only" : "text-libelle font-semibold text-texte"}>
        {libelle}
      </label>
      <select
        id={idChamp}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={descriptions || undefined}
        className={clsx(
          "min-h-[52px] rounded-bouton border-[1.5px] bg-surface px-4 font-texte text-courant text-texte",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          erreur ? "border-danger" : "border-bordure-forte",
          className
        )}
        {...reste}
      >
        {optionVide !== undefined && <option value="">{optionVide}</option>}
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
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
