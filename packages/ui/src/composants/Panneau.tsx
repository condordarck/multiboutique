import { clsx } from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";

export interface PanneauProps {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  /** Boutons du bas (Enregistrer, Annuler), toujours visibles. */
  pied?: ReactNode;
  className?: string;
  children: ReactNode;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/**
 * Formulaire ou fiche par-dessus la liste : feuille du bas sur téléphone,
 * panneau latéral à partir de la tablette. C'est un <dialog> modal natif : le
 * navigateur piège le focus, rend le fond inerte et ferme sur Échap.
 */
export function Panneau({ ouvert, titre, onFermer, pied, className, children }: PanneauProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitre = useId();
  // L'élément qui avait le focus à l'ouverture : il le retrouve à la fermeture.
  const declencheur = useRef<Element | null>(null);

  useEffect(() => {
    const dialogue = ref.current;
    if (!dialogue || !ouvert) return;
    declencheur.current = document.activeElement;
    dialogue.showModal();
    return () => {
      dialogue.close();
      if (declencheur.current instanceof HTMLElement) declencheur.current.focus();
    };
  }, [ouvert]);

  if (!ouvert) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitre}
      onCancel={(evenement) => {
        // Échap : c'est le parent qui décide de fermer (état contrôlé).
        evenement.preventDefault();
        onFermer();
      }}
      onClick={(evenement) => {
        // Un clic sur le <dialog> lui-même, hors de son contenu, est un clic sur le voile.
        if (evenement.target === evenement.currentTarget) onFermer();
      }}
      className={clsx(
        "m-0 mt-auto flex max-h-[92dvh] w-full max-w-none flex-col rounded-t-carte bg-surface p-0 text-texte",
        "tablette:mt-0 tablette:ml-auto tablette:h-dvh tablette:max-h-none tablette:w-[28rem] tablette:rounded-none",
        "backdrop:bg-[rgb(31_27_22/45%)]",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-bordure px-5 py-3">
        <h2 id={idTitre} className="m-0 font-titre text-panneau font-bold">
          {titre}
        </h2>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className={clsx("inline-flex size-11 items-center justify-center rounded-bouton hover:bg-surface-relevee", FOCUS)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {pied && (
        <div className="flex flex-wrap justify-end gap-3 border-t border-bordure px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {pied}
        </div>
      )}
    </dialog>
  );
}
