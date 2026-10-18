import { Bouton } from "@multiboutique/ui";
import type { FormEvent, ReactNode } from "react";

export interface FormulaireProps {
  onEnvoyer: () => void;
  libelleEnvoyer: string;
  erreur?: string | null;
  enCours?: boolean;
  /** Hors ligne : l'envoi est impossible. */
  desactivee?: boolean;
  /** Boutons secondaires, à gauche du bouton d'envoi (Annuler). */
  actions?: ReactNode;
  variante?: "primaire" | "danger";
  children: ReactNode;
}

/** Formulaire d'écriture : message général en tête, envoi bloqué pendant l'appel et hors ligne. */
export function Formulaire({
  onEnvoyer,
  libelleEnvoyer,
  erreur,
  enCours = false,
  desactivee = false,
  actions,
  variante = "primaire",
  children,
}: FormulaireProps) {
  function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    if (!enCours && !desactivee) onEnvoyer();
  }

  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
      {erreur && (
        <p role="alert" className="m-0 rounded-bouton bg-danger-fond px-4 py-3 font-semibold text-danger">
          {erreur}
        </p>
      )}
      {children}
      {desactivee && (
        <p className="m-0 text-mention font-semibold text-alerte">Hors ligne : l'enregistrement reprendra avec la connexion.</p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        {actions}
        <Bouton type="submit" variante={variante} chargement={enCours} disabled={desactivee}>
          {libelleEnvoyer}
        </Bouton>
      </div>
    </form>
  );
}
