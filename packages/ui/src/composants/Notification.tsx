import { clsx } from "clsx";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Genre = "succes" | "erreur";

interface Message {
  id: number;
  genre: Genre;
  texte: string;
}

export interface Notifier {
  succes: (texte: string) => void;
  erreur: (texte: string) => void;
}

const Contexte = createContext<Notifier | null>(null);

const DUREE_SUCCES_MS = 4000;

/**
 * Messages brefs après une action. La région est toujours dans le DOM :
 * un lecteur d'écran n'annonce que ce qui change dans une région déjà présente.
 * Un succès s'efface seul ; une erreur reste jusqu'à ce qu'on la ferme.
 */
export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const suivant = useRef(0);

  const retirer = useCallback((id: number) => setMessages((liste) => liste.filter((m) => m.id !== id)), []);

  const ajouter = useCallback(
    (genre: Genre, texte: string) => {
      const id = ++suivant.current;
      setMessages((liste) => [...liste, { id, genre, texte }]);
      if (genre === "succes") setTimeout(() => retirer(id), DUREE_SUCCES_MS);
    },
    [retirer]
  );

  const notifier = useMemo<Notifier>(
    () => ({ succes: (t) => ajouter("succes", t), erreur: (t) => ajouter("erreur", t) }),
    [ajouter]
  );

  return (
    <Contexte.Provider value={notifier}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={clsx(
          "pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4",
          "bottom-[calc(5rem+env(safe-area-inset-bottom))] tablette:bottom-6"
        )}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={clsx(
              "pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-bouton px-4 py-3 font-semibold shadow-carte",
              m.genre === "succes" ? "bg-succes-fond text-succes" : "bg-danger-fond text-danger"
            )}
          >
            <span className="flex-1">{m.texte}</span>
            {m.genre === "erreur" && (
              <button
                type="button"
                aria-label="Fermer la notification"
                onClick={() => retirer(m.id)}
                className="inline-flex size-11 items-center justify-center rounded-bouton focus-visible:outline-2 focus-visible:outline-focus"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </Contexte.Provider>
  );
}

export function useNotifier(): Notifier {
  const notifier = useContext(Contexte);
  if (!notifier) throw new Error("useNotifier exige un FournisseurNotifications.");
  return notifier;
}
