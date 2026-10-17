import { clsx } from "clsx";
import logoClair from "../../assets/logo.svg";
import logoSombre from "../../assets/logo-sombre.svg";

export interface LogotypeProps {
  alt?: string;
  /** Fixe la hauteur (h-7…) ; la largeur suit les proportions. */
  className?: string;
}

/**
 * Le logotype dans la couleur du thème actif. Les deux images sont dans le DOM
 * et le CSS en masque une : display: none la retire aussi de l'arbre
 * d'accessibilité, le texte alternatif n'est donc lu qu'une fois.
 */
export function Logotype({ alt = "MultiBoutique", className }: LogotypeProps) {
  return (
    <span className={clsx("inline-flex", className)}>
      <img src={logoClair} alt={alt} className="block h-full w-auto sombre:hidden" />
      <img src={logoSombre} alt={alt} className="hidden h-full w-auto sombre:block" />
    </span>
  );
}
