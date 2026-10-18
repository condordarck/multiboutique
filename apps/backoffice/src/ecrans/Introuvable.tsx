import { Link } from "react-router";

export function Introuvable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Page introuvable</h1>
      <p className="m-0 text-courant text-texte-discret">Cette adresse ne correspond à aucun écran du backoffice.</p>
      <Link to="/" className="font-semibold text-primaire">
        Retour à l'accueil
      </Link>
    </main>
  );
}
