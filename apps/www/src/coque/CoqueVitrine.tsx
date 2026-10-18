import { useParametres, useSession } from "@multiboutique/front";
import { Logotype, Panneau, SelecteurTheme } from "@multiboutique/ui";
import { clsx } from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { URL_BACKOFFICE } from "../config";
import { MenuCompte } from "./MenuCompte";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const LIEN = clsx("inline-flex min-h-11 items-center rounded-bouton px-3 font-semibold no-underline text-texte hover:bg-surface-relevee", FOCUS);

function Liens({ client, compte }: { client: boolean; compte?: ReactNode }) {
  const classe = ({ isActive }: { isActive: boolean }) => clsx(LIEN, isActive && "bg-primaire-fond text-primaire");
  return (
    <>
      <NavLink to="/" end className={classe}>
        Boutiques
      </NavLink>
      {client ? (
        <>
          <NavLink to="/espace" className={classe}>
            Mes réservations
          </NavLink>
          {compte}
        </>
      ) : (
        <>
          <NavLink to="/connexion" className={classe}>
            Connexion
          </NavLink>
          <a href={URL_BACKOFFICE} className={clsx(LIEN, "text-texte-discret")}>
            Espace professionnel
          </a>
        </>
      )}
    </>
  );
}

/** Coque publique de la vitrine : en-tête, contenu, pied de page. */
export function CoqueVitrine() {
  const { utilisateur } = useSession();
  const nom = useParametres().data?.nom_application ?? "MultiBoutique";
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  const client = !!utilisateur;
  // Le menu du téléphone se ferme à chaque changement d'adresse (lien, déconnexion).
  useEffect(() => setMenu(false), [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-fond font-texte text-texte">
      <a href="#contenu" className={clsx("sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-bouton focus:bg-surface focus:px-4 focus:py-3", FOCUS)}>
        Aller au contenu
      </a>
      <header className="border-b border-bordure bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-2 tablette:px-8">
          <Link to="/" className={clsx("rounded-bouton py-2", FOCUS)}>
            <Logotype alt={`${nom}, accueil`} className="h-7" />
          </Link>
          <span className="flex-1" />
          <nav aria-label="Navigation de la vitrine" className="hidden items-center gap-1 tablette:flex">
            <Liens client={client} compte={<MenuCompte />} />
          </nav>
          <button
            type="button"
            onClick={() => setMenu(true)}
            className={clsx("inline-flex min-h-11 items-center rounded-bouton border-[1.5px] border-bordure-forte px-4 font-semibold tablette:hidden", FOCUS)}
          >
            Menu
          </button>
        </div>
      </header>
      <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 focus:outline-none tablette:px-8">
        <Outlet />
      </main>
      <footer className="border-t border-bordure bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-libelle text-texte-discret tablette:px-8">
          <span>{`© ${new Date().getFullYear()} ${nom}`}</span>
          <SelecteurTheme />
        </div>
      </footer>
      {menu && (
        <Panneau ouvert titre="Menu" onFermer={() => setMenu(false)}>
          <nav aria-label="Menu de la vitrine" className="flex flex-col gap-2" onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(false)}>
            <Liens client={client} compte={client && <MenuCompte />} />
          </nav>
        </Panneau>
      )}
    </div>
  );
}
