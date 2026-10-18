import { clsx } from "clsx";
import { useEffect, useId, useRef, useState } from "react";
import { useSession, useUtilisateur } from "@multiboutique/front";
import { LIBELLES_ROLE } from "./navigation";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Nom et rôle de l'utilisateur ; ouvre la déconnexion. */
export function MenuCompte() {
  const utilisateur = useUtilisateur();
  const { deconnecter } = useSession();
  const [ouvert, setOuvert] = useState(false);
  const idPanneau = useId();
  const racine = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function fermer(evenement: Event) {
      if (evenement instanceof KeyboardEvent ? evenement.key === "Escape" : !racine.current?.contains(evenement.target as Node)) {
        setOuvert(false);
      }
    }
    document.addEventListener("keydown", fermer);
    document.addEventListener("pointerdown", fermer);
    return () => {
      document.removeEventListener("keydown", fermer);
      document.removeEventListener("pointerdown", fermer);
    };
  }, [ouvert]);

  return (
    <div ref={racine} className="relative">
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={idPanneau}
        onClick={() => setOuvert((o) => !o)}
        className={clsx("flex min-h-11 flex-col items-end rounded-bouton px-3 py-1 text-right hover:bg-surface-relevee", FOCUS)}
      >
        <span className="text-libelle font-semibold">{utilisateur.nom_complet}</span>
        <span className="text-mention text-texte-discret">{LIBELLES_ROLE[utilisateur.role] ?? utilisateur.role}</span>
      </button>
      <div
        id={idPanneau}
        hidden={!ouvert}
        className="absolute right-0 z-30 mt-2 w-56 rounded-carte border border-bordure bg-surface p-2 shadow-carte"
      >
        <p className="m-0 truncate px-3 py-2 text-mention text-texte-discret">{utilisateur.email}</p>
        <button
          type="button"
          onClick={() => void deconnecter()}
          className={clsx("flex min-h-12 w-full items-center rounded-bouton px-3 font-semibold text-danger hover:bg-danger-fond", FOCUS)}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
