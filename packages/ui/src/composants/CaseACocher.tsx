import { clsx } from "clsx";
import { useId, type InputHTMLAttributes } from "react";

export interface CaseACocherProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  libelle: string;
  aide?: string;
}

/** Case à cocher : toute la ligne est la cible tactile (≥ 44 px). */
export function CaseACocher({ libelle, aide, id, className, ...reste }: CaseACocherProps) {
  const idAuto = useId();
  const idCase = id ?? idAuto;
  const idAide = `${idCase}-aide`;
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <label htmlFor={idCase} className="flex min-h-11 cursor-pointer items-center gap-3 text-courant font-semibold">
        <input
          id={idCase}
          type="checkbox"
          aria-describedby={aide ? idAide : undefined}
          className="size-6 shrink-0 accent-primaire focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          {...reste}
        />
        {libelle}
      </label>
      {aide && (
        <p id={idAide} className="m-0 pl-9 text-mention text-texte-discret">
          {aide}
        </p>
      )}
    </div>
  );
}
