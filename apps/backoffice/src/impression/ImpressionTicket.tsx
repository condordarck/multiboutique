import { Bouton } from "@multiboutique/ui";
import { EnTeteEcran, LienBouton } from "@multiboutique/front";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ticket } from "../ecrans/ventes/Ticket";
import type { TicketProps } from "./contenu";
import { encoderTicket } from "./escpos";
import { miseEnPage } from "./mise-en-page";
import { lireReglages, type ModeImpression } from "./reglages";
import { envoyer, ErreurImpression } from "./transports";

/** Imprime un ticket selon les réglages de ce poste. */
export function useImpression() {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function imprimer(ticket: TicketProps, force?: ModeImpression): Promise<boolean> {
    const reglages = lireReglages();
    const mode = force ?? reglages.mode;
    setErreur(null);
    if (mode === "navigateur") {
      window.print();
      return true;
    }
    setEnCours(true);
    try {
      const octets = encoderTicket(miseEnPage(ticket, reglages.largeur), reglages);
      await envoyer(mode, reglages.imprimantes[mode], octets, reglages.vitesse);
      return true;
    } catch (e) {
      setErreur(e instanceof ErreurImpression ? e.message : "Impression impossible.");
      return false;
    } finally {
      setEnCours(false);
    }
  }

  return { imprimer, enCours, erreur };
}

/**
 * Écran d'un reçu : titre, bouton d'impression, le ticket. `automatique` :
 * imprimé dès l'affichage si le poste le demande (après un encaissement).
 * Si l'imprimante échoue, le vendeur peut repasser par le navigateur.
 */
export function ImpressionTicket({
  titre,
  ticket,
  actions,
  automatique = false,
}: {
  titre: string;
  ticket: TicketProps;
  actions?: ReactNode;
  automatique?: boolean;
}) {
  const { imprimer, enCours, erreur } = useImpression();
  // Une seule impression automatique par ticket, même si l'effet est rejoué.
  const dejaImprime = useRef(false);

  useEffect(() => {
    if (!automatique || dejaImprime.current || !lireReglages().automatique) return;
    dejaImprime.current = true;
    void imprimer(ticket);
    // Au premier affichage seulement : le ticket ne change pas ensuite.
  }, []);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <EnTeteEcran
        titre={titre}
        actions={
          <>
            <Bouton onClick={() => void imprimer(ticket)} chargement={enCours}>
              Imprimer le reçu
            </Bouton>
            {actions}
          </>
        }
      />
      {erreur && (
        <div role="alert" className="flex flex-col gap-3 rounded-carte bg-danger-fond p-4 text-danger tablette:flex-row tablette:items-center">
          <p className="m-0 flex-1 font-semibold">{erreur}</p>
          <span className="flex flex-wrap gap-2">
            <Bouton variante="secondaire" onClick={() => void imprimer(ticket, "navigateur")}>
              Imprimer avec le navigateur
            </Bouton>
            <LienBouton to="/impression" variante="secondaire">
              Réglages d'impression
            </LienBouton>
          </span>
        </div>
      )}
      <Ticket {...ticket} />
    </div>
  );
}
