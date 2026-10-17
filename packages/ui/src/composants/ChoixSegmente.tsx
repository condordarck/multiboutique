import { clsx } from "clsx";
import { useId } from "react";

export interface OptionChoix<V extends string> {
  valeur: V;
  libelle: string;
}

export interface ChoixSegmenteProps<V extends string> {
  /** Nom du groupe, lu par les lecteurs d'écran. */
  legende: string;
  /** Affiche la légende au-dessus des options ; sinon elle reste invisible. */
  legendeVisible?: boolean;
  options: OptionChoix<V>[];
  valeur: V;
  onChange: (valeur: V) => void;
  className?: string;
}

/**
 * Choix exclusif en boutons segmentés. Ce sont de vrais boutons radio, masqués
 * visuellement : les flèches du clavier et les lecteurs d'écran fonctionnent
 * sans code supplémentaire.
 */
export function ChoixSegmente<V extends string>({
  legende,
  legendeVisible = false,
  options,
  valeur,
  onChange,
  className,
}: ChoixSegmenteProps<V>) {
  const nom = useId();
  const idLegende = `${nom}-legende`;

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <span id={idLegende} className={legendeVisible ? "text-libelle font-semibold text-texte" : "sr-only"}>
        {legende}
      </span>
      <div role="radiogroup" aria-labelledby={idLegende} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.valeur}
            className={clsx(
              "inline-flex min-h-12 cursor-pointer items-center rounded-full border-[1.5px] px-4 text-libelle font-semibold",
              "border-bordure-forte bg-surface text-texte",
              "has-checked:border-primaire has-checked:bg-primaire has-checked:text-sur-primaire",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
            )}
          >
            <input
              type="radio"
              name={nom}
              value={option.valeur}
              checked={option.valeur === valeur}
              onChange={() => onChange(option.valeur)}
              className="sr-only"
            />
            {option.libelle}
          </label>
        ))}
      </div>
    </div>
  );
}
