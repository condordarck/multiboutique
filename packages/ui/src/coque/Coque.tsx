import { clsx } from "clsx";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";

export interface EntreeNavigation {
  libelle: string;
  href: string;
  icone: ReactNode;
  actif?: boolean;
}

/** Composant de lien du routeur de l'application ; un simple <a> par défaut. */
export type ComposantLien = ComponentType<AnchorHTMLAttributes<HTMLAnchorElement>> | "a";

export interface CoqueProps {
  entrees: EntreeNavigation[];
  /** Logotype ou icône, en tête du rail et de la barre latérale. */
  marque?: ReactNode;
  /** Barre au-dessus du contenu : boutique courante, date, compte. */
  enTete?: ReactNode;
  composantLien?: ComposantLien;
  children: ReactNode;
}

// Au-delà de 5 entrées, la barre du bas d'un téléphone n'en montre que 4,
// plus un bouton « Plus » qui ouvre les autres.
const MAX_BARRE_BAS = 5;
const ID_CONTENU = "contenu-principal";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * Coque des PWA. Une seule <nav>, dont la mise en page suit la largeur, en CSS
 * seulement (aucun calcul JavaScript, donc aucun saut de mise en page au
 * chargement) :
 * - téléphone (< 640 px) : barre d'onglets en bas ;
 * - tablette (640–1180 px) : rail latéral, icône et libellé empilés ;
 * - bureau (> 1180 px) : barre latérale, icône et libellé côte à côte.
 */
export function Coque({ entrees, marque, enTete, composantLien: Lien = "a", children }: CoqueProps) {
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  const idPanneau = useId();
  const boutonPlus = useRef<HTMLButtonElement>(null);

  const avecDebordement = entrees.length > MAX_BARRE_BAS;
  const nbVisiblesTelephone = avecDebordement ? MAX_BARRE_BAS - 1 : entrees.length;
  const debordement = entrees.slice(nbVisiblesTelephone);

  useEffect(() => {
    if (!panneauOuvert) return;
    function surTouche(evenement: KeyboardEvent) {
      if (evenement.key === "Escape") {
        setPanneauOuvert(false);
        boutonPlus.current?.focus();
      }
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [panneauOuvert]);

  return (
    <div className="min-h-dvh bg-fond font-texte text-texte tablette:flex">
      <a
        href={`#${ID_CONTENU}`}
        className={clsx(
          "sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50",
          "focus:rounded-bouton focus:bg-surface focus:px-4 focus:py-3 focus:font-semibold",
          FOCUS
        )}
      >
        Aller au contenu
      </a>

      <nav
        aria-label="Navigation principale"
        className={clsx(
          "fixed inset-x-0 bottom-0 z-20 flex border-t border-bordure bg-surface pb-[env(safe-area-inset-bottom)]",
          "tablette:sticky tablette:top-0 tablette:h-dvh tablette:w-[104px] tablette:shrink-0 tablette:flex-col",
          "tablette:items-center tablette:gap-1.5 tablette:border-t-0 tablette:border-r tablette:py-5",
          "bureau:w-64 bureau:items-stretch bureau:px-4"
        )}
      >
        {marque && <div className="mb-4 hidden justify-center tablette:flex bureau:justify-start bureau:px-3">{marque}</div>}

        {entrees.map((entree, index) => (
          <Lien
            key={entree.href}
            href={entree.href}
            aria-current={entree.actif ? "page" : undefined}
            className={clsx(
              // Les entrées qui débordent sont cachées sur téléphone (le panneau
              // « Plus » les reprend) et réapparaissent à partir de la tablette.
              index >= nbVisiblesTelephone ? "hidden tablette:flex" : "flex",
              "min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-bouton text-mention font-semibold no-underline",
              "tablette:w-[84px] tablette:flex-none",
              "bureau:w-full bureau:flex-row bureau:justify-start bureau:gap-3 bureau:px-4 bureau:text-courant",
              entree.actif
                ? "bg-primaire-fond font-bold text-primaire"
                : "text-texte-discret hover:bg-surface-relevee",
              FOCUS
            )}
          >
            {entree.icone}
            {entree.libelle}
          </Lien>
        ))}

        {avecDebordement && (
          <>
            <button
              ref={boutonPlus}
              type="button"
              aria-expanded={panneauOuvert}
              aria-controls={idPanneau}
              data-actif={debordement.some((e) => e.actif) || undefined}
              onClick={() => setPanneauOuvert((ouvert) => !ouvert)}
              className={clsx(
                "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-bouton text-mention font-semibold tablette:hidden",
                "text-texte-discret data-[actif]:bg-primaire-fond data-[actif]:font-bold data-[actif]:text-primaire",
                FOCUS
              )}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="5" cy="12" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
              </svg>
              Plus
            </button>

            <div
              id={idPanneau}
              hidden={!panneauOuvert}
              className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-bordure bg-surface p-3 tablette:hidden"
            >
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {debordement.map((entree) => (
                  <li key={entree.href}>
                    <Lien
                      href={entree.href}
                      aria-current={entree.actif ? "page" : undefined}
                      onClick={() => setPanneauOuvert(false)}
                      className={clsx(
                        "flex min-h-14 items-center gap-3 rounded-bouton px-4 text-courant font-semibold no-underline",
                        entree.actif ? "bg-primaire-fond text-primaire" : "text-texte hover:bg-surface-relevee",
                        FOCUS
                      )}
                    >
                      {entree.icone}
                      {entree.libelle}
                    </Lien>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {enTete && (
          <header className="flex min-h-16 items-center gap-4 px-4 tablette:px-7">{enTete}</header>
        )}
        {/* La marge basse laisse le contenu dépasser la barre d'onglets fixe du téléphone. */}
        <main
          id={ID_CONTENU}
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] focus:outline-none tablette:px-7 tablette:pb-7"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
