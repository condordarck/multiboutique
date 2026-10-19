import { Bouton, Carte, CaseACocher, ChoixSegmente, Selecteur } from "@multiboutique/ui";
import { EnTeteEcran, useSession } from "@multiboutique/front";
import { useState } from "react";
import { Navigate } from "react-router";
import type { TicketProps } from "../../impression/contenu";
import { useImpression } from "../../impression/ImpressionTicket";
import { type JeuCaracteres, type ModeImpression, useReglagesImpression, VITESSES } from "../../impression/reglages";
import { choisirImprimante, ErreurImpression, type ModeDirect, modeDisponible } from "../../impression/transports";
import { Ticket } from "../ventes/Ticket";

const MODES: { valeur: ModeImpression; libelle: string; aide: string }[] = [
  {
    valeur: "navigateur",
    libelle: "Navigateur",
    aide:
      "Toute imprimante installée sur l'appareil, par la fenêtre d'impression. Pour imprimer sans cette fenêtre, lancez Chrome avec l'option --kiosk-printing et faites de l'imprimante de tickets l'imprimante par défaut.",
  },
  {
    valeur: "usb",
    libelle: "USB direct",
    aide:
      "Imprimante thermique branchée en USB. Sous Windows, si un pilote d'imprimante est installé, il la garde pour lui : installez à la place le pilote WinUSB (outil Zadig), ou utilisez le mode Port série. Sous Linux, le module usblp doit la libérer.",
  },
  {
    valeur: "bluetooth",
    libelle: "Bluetooth",
    aide:
      "Imprimante Bluetooth basse consommation (la plupart des imprimantes portables récentes). Chrome ne la retient pas d'une session à l'autre : après un rechargement, le premier ticket redemande de la choisir.",
  },
  {
    valeur: "serie",
    libelle: "Port série",
    aide:
      "Imprimante Bluetooth « classique » appairée dans le système (elle apparaît comme un port COM), ou imprimante USB vue comme port série. Ordinateur seulement.",
  },
];

const JEUX: { valeur: JeuCaracteres; libelle: string }[] = [
  { valeur: "cp858", libelle: "PC858, avec € (recommandé)" },
  { valeur: "cp850", libelle: "PC850" },
  { valeur: "cp437", libelle: "PC437 (d'origine)" },
  { valeur: "ascii", libelle: "Sans accents" },
];

const TICKET_TEST: TicketProps = {
  boutique: { nom: "Ticket de test", adresse: "Accents : é è ê à ç ù ô É À Ç", telephone: "+000 00 00 00" },
  reference: "TEST-0001",
  date: new Date().toLocaleString("fr-FR"),
  vendeur: "Réglages d'impression",
  paiement: "Espèces",
  lignes: [
    { nom: "Café moulu 250 g", code: "EPI-0001", quantite: 2, prix: 3.5 },
    { nom: "Crème fraîche épaisse, pot familial de 50 cl", code: "LAI-0002", quantite: 1, prix: 1234.5 },
  ],
  monnaie: "$",
  total: 1241.5,
  rendu: 8.5,
};

/** Imprimante de ce poste : réglages gardés dans ce navigateur. */
export function ReglagesImpression() {
  const { peut } = useSession();
  const { reglages, modifier } = useReglagesImpression();
  const { imprimer, enCours, erreur } = useImpression();
  const [choix, setChoix] = useState<{ enCours: boolean; erreur: string | null }>({ enCours: false, erreur: null });
  const [testEnvoye, setTestEnvoye] = useState(false);

  if (!peut("ventes:creer") && !peut("reservations:gerer")) return <Navigate to="/" replace />;

  const mode = MODES.find((m) => m.valeur === reglages.mode)!;
  const direct = reglages.mode !== "navigateur" ? (reglages.mode as ModeDirect) : null;
  const imprimante = direct ? reglages.imprimantes[direct] : undefined;

  async function associer(m: ModeDirect) {
    setChoix({ enCours: true, erreur: null });
    try {
      const associee = await choisirImprimante(m);
      modifier({ imprimantes: { ...reglages.imprimantes, [m]: associee } });
      setChoix({ enCours: false, erreur: null });
    } catch (e) {
      setChoix({ enCours: false, erreur: e instanceof ErreurImpression ? e.message : "Imprimante non associée." });
    }
  }

  async function tester() {
    setTestEnvoye(false);
    setTestEnvoye(await imprimer(TICKET_TEST));
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran titre="Impression des tickets" sousTitre="Réglages de ce poste, enregistrés dans ce navigateur" />
      <div className="grid grid-cols-1 gap-6 bureau:grid-cols-[minmax(0,1fr)_auto] bureau:items-start">
        <div className="flex flex-col gap-6">
          <Carte titre="Imprimante">
            <div className="flex flex-col gap-4">
              <Selecteur
                className="w-full min-w-0"
                libelle="Mode d'impression"
                options={MODES.map((m) => ({
                  valeur: m.valeur,
                  libelle: m.valeur === "navigateur" || modeDisponible(m.valeur) ? m.libelle : `${m.libelle} (non disponible sur ce navigateur)`,
                }))}
                value={reglages.mode}
                onChange={(e) => modifier({ mode: e.target.value as ModeImpression })}
                aide={mode.aide}
              />
              {direct && !modeDisponible(direct) && (
                <p role="alert" className="m-0 font-semibold text-danger">
                  Ce navigateur ne permet pas ce mode : utilisez Chrome ou Edge (sur ordinateur, ou Chrome sur Android hors port série).
                </p>
              )}
              {direct && modeDisponible(direct) && (
                <div className="flex flex-col gap-2">
                  <p className="m-0">
                    <span className="font-semibold">Imprimante associée : </span>
                    {imprimante?.nom ?? "aucune"}
                  </p>
                  <Bouton variante="secondaire" className="self-start" chargement={choix.enCours} onClick={() => void associer(direct)}>
                    {imprimante ? "Changer d'imprimante" : "Choisir l'imprimante"}
                  </Bouton>
                  {choix.erreur && (
                    <p role="alert" className="m-0 font-semibold text-danger">
                      {choix.erreur}
                    </p>
                  )}
                </div>
              )}
              {direct === "serie" && (
                <Selecteur
                  className="w-full min-w-0"
                  libelle="Vitesse du port (bauds)"
                  options={VITESSES.map((v) => ({ valeur: String(v), libelle: String(v) }))}
                  value={String(reglages.vitesse)}
                  onChange={(e) => modifier({ vitesse: Number(e.target.value) })}
                  aide="Indiquée dans la notice ou sur le ticket d'autotest de l'imprimante (souvent 9600 ou 115200)."
                />
              )}
            </div>
          </Carte>

          <Carte titre="Ticket">
            <div className="flex flex-col gap-4">
              <ChoixSegmente
                legende="Largeur du rouleau"
                legendeVisible
                options={[
                  { valeur: "80", libelle: "80 mm" },
                  { valeur: "58", libelle: "58 mm" },
                ]}
                valeur={String(reglages.largeur) as "80" | "58"}
                onChange={(v) => modifier({ largeur: Number(v) as 58 | 80 })}
              />
              {direct && (
                <>
                  <Selecteur
                    className="w-full min-w-0"
                    libelle="Jeu de caractères"
                    options={JEUX}
                    value={reglages.jeu}
                    onChange={(e) => modifier({ jeu: e.target.value as JeuCaracteres })}
                    aide="Si les accents du ticket de test sortent mal, essayez un autre jeu."
                  />
                  <Selecteur
                    className="w-full min-w-0"
                    libelle="Exemplaires"
                    options={[1, 2, 3].map((n) => ({ valeur: String(n), libelle: String(n) }))}
                    value={String(reglages.exemplaires)}
                    onChange={(e) => modifier({ exemplaires: Number(e.target.value) })}
                  />
                  <CaseACocher libelle="Couper le papier" checked={reglages.couper} onChange={(e) => modifier({ couper: e.target.checked })} />
                  <CaseACocher
                    libelle="Ouvrir le tiroir-caisse"
                    aide="Tiroir branché sur l'imprimante (prise RJ11)."
                    checked={reglages.tiroir}
                    onChange={(e) => modifier({ tiroir: e.target.checked })}
                  />
                </>
              )}
              <CaseACocher
                libelle="Imprimer automatiquement après l'encaissement"
                aide="Ventes en caisse et réservations encaissées."
                checked={reglages.automatique}
                onChange={(e) => modifier({ automatique: e.target.checked })}
              />
            </div>
          </Carte>

          <div className="flex flex-col gap-2">
            <Bouton className="self-start" chargement={enCours} onClick={() => void tester()}>
              Imprimer un ticket de test
            </Bouton>
            {testEnvoye && direct && <p role="status" className="m-0 text-succes font-semibold">Ticket de test envoyé à l'imprimante.</p>}
            {erreur && (
              <p role="alert" className="m-0 font-semibold text-danger">
                {erreur}
              </p>
            )}
          </div>
        </div>

        <section aria-labelledby="titre-apercu" className="flex flex-col gap-3">
          <h2 id="titre-apercu" className="m-0 font-titre text-panneau font-bold text-texte">
            Aperçu
          </h2>
          <Ticket {...TICKET_TEST} />
        </section>
      </div>
    </div>
  );
}
