import { clsx } from "clsx";
import { useId, type InputHTMLAttributes } from "react";

export type TypeChamp = "texte" | "nombre" | "montant" | "recherche" | "email" | "motDePasse";

export interface ChampProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  libelle: string;
  type?: TypeChamp;
  aide?: string;
  erreur?: string;
}

// Les montants et quantités restent des champs texte : type="number" accepte
// « 1e3 », ignore la virgule décimale française et change de valeur à la
// molette. inputMode suffit à ouvrir le bon clavier sur tablette.
const MODES_SAISIE: Record<TypeChamp, InputHTMLAttributes<HTMLInputElement>["inputMode"]> = {
  texte: undefined,
  nombre: "numeric",
  montant: "decimal",
  recherche: undefined,
  email: undefined,
  motDePasse: undefined,
};

const TYPES_HTML: Record<TypeChamp, string> = {
  texte: "text",
  nombre: "text",
  montant: "text",
  recherche: "search",
  email: "email",
  motDePasse: "password",
};

export function Champ({ libelle, type = "texte", aide, erreur, id, className, ...reste }: ChampProps) {
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
      <input
        id={idChamp}
        type={TYPES_HTML[type]}
        inputMode={MODES_SAISIE[type]}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={descriptions || undefined}
        className={clsx(
          "min-h-[52px] rounded-bouton border-[1.5px] bg-surface px-4 font-texte text-courant text-texte",
          "placeholder:text-texte-discret",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          erreur ? "border-danger" : "border-bordure-forte",
          (type === "nombre" || type === "montant") && "tabular-nums",
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
