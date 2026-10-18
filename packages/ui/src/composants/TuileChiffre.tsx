import { clsx } from "clsx";

export interface Variation {
  sens: "hausse" | "baisse";
  pourcentage: number;
  /** Par défaut, une hausse est favorable. À préciser pour un indicateur
   *  dont la baisse est une bonne nouvelle (ruptures, impayés). */
  favorable?: boolean;
}

export interface TuileChiffreProps {
  libelle: string;
  /** Valeur déjà formatée (« 1 240 $ ») : la tuile ne connaît pas la monnaie. */
  valeur: string;
  variation?: Variation;
  /** Texte libre sous la valeur, quand il n'y a pas de variation. */
  detail?: string;
  /** Fond safran, pour l'indicateur qui demande une action. */
  miseEnAvant?: boolean;
  className?: string;
}

const formatPourcentage = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export function TuileChiffre({
  libelle,
  valeur,
  variation,
  detail,
  miseEnAvant = false,
  className,
}: TuileChiffreProps) {
  const favorable = variation ? (variation.favorable ?? variation.sens === "hausse") : false;

  return (
    <div
      className={clsx(
        "flex flex-col gap-1.5 rounded-carte px-5 py-[18px]",
        miseEnAvant ? "bg-accent text-sur-accent" : "bg-surface text-texte shadow-carte",
        className
      )}
    >
      <span className={clsx("text-libelle", miseEnAvant ? "font-semibold" : "text-texte-discret")}>
        {libelle}
      </span>
      {/* Plus petit sur téléphone, où les tuiles vont par deux. */}
      <span className="text-[1.5rem] leading-tight font-bold tabular-nums [overflow-wrap:anywhere] tablette:text-chiffre">{valeur}</span>
      {/* La variation s'écrit en toutes lettres : une flèche ou une couleur
          seules ne disent rien à un lecteur d'écran ni à un daltonien. */}
      {variation && (
        <span
          className={clsx(
            "text-mention font-semibold",
            miseEnAvant ? "text-sur-accent" : favorable ? "text-succes" : "text-danger"
          )}
        >
          {`En ${variation.sens} de ${formatPourcentage.format(variation.pourcentage)}\u00a0%`}
        </span>
      )}
      {!variation && detail && (
        <span className={clsx("text-mention", miseEnAvant ? "font-semibold" : "text-texte-discret")}>
          {detail}
        </span>
      )}
    </div>
  );
}
