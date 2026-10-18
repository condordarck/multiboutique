import { Link } from "react-router";

/** Dans la coque : la page reste habillée et la navigation disponible. */
export function Introuvable() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 py-16">
      <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Page introuvable</h1>
      <p className="m-0 text-courant text-texte-discret">Cette adresse ne correspond à aucune page de la vitrine.</p>
      <Link to="/" className="font-semibold text-primaire">
        Retour à l'accueil
      </Link>
    </div>
  );
}
