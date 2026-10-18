import { clsx } from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Bouton } from "./Bouton";

export interface DialogueProps {
  ouvert: boolean;
  titre: string;
  message?: string;
  libelleConfirmer: string;
  libelleAnnuler?: string;
  variante?: "primaire" | "danger";
  chargement?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
  /** Champ supplémentaire, par exemple le motif d'une annulation. */
  children?: ReactNode;
}

/** Confirmation d'une action, centrée : role="alertdialog", la décision est attendue. */
export function Dialogue({
  ouvert,
  titre,
  message,
  libelleConfirmer,
  libelleAnnuler = "Annuler",
  variante = "primaire",
  chargement = false,
  onConfirmer,
  onAnnuler,
  children,
}: DialogueProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitre = useId();
  const idMessage = useId();
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
      role="alertdialog"
      aria-labelledby={idTitre}
      aria-describedby={message ? idMessage : undefined}
      onCancel={(evenement) => {
        evenement.preventDefault();
        if (!chargement) onAnnuler();
      }}
      className={clsx(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-carte bg-surface p-6 text-texte",
        "backdrop:bg-[rgb(31_27_22/45%)]"
      )}
    >
      <form
        method="dialog"
        className="flex flex-col gap-4"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          onConfirmer();
        }}
      >
        <h2 id={idTitre} className="m-0 font-titre text-panneau font-bold">
          {titre}
        </h2>
        {message && (
          <p id={idMessage} className="m-0 text-courant text-texte-discret">
            {message}
          </p>
        )}
        {children}
        <div className="flex flex-wrap justify-end gap-3">
          <Bouton variante="secondaire" onClick={onAnnuler} disabled={chargement}>
            {libelleAnnuler}
          </Bouton>
          <Bouton type="submit" variante={variante} chargement={chargement}>
            {libelleConfirmer}
          </Bouton>
        </div>
      </form>
    </dialog>
  );
}
