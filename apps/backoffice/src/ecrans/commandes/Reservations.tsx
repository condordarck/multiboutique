import type { ModePaiement, ReservationDetaillee, StatutReservation } from "@multiboutique/shared";
import { Badge, Bouton, Carte, ChoixSegmente, Dialogue, TuileChiffre, ZoneTexte, type TonBadge } from "@multiboutique/ui";
import { useId, useState } from "react";
import { useParams } from "react-router";
import { annulerReservation, confirmerReservation, encaisserReservation, useReservations } from "../../api/commandes";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { LIBELLES_PAIEMENT } from "../../api/ventes";
import { EnTeteEcran, formatMontant, formatNombre, ListeChargee, useEcriture, useSession, useUtilisateur } from "@multiboutique/front";
import { Ticket, type TicketProps } from "../ventes/Ticket";

const STATUTS: Record<StatutReservation, { libelle: string; ton: TonBadge }> = {
  en_attente: { libelle: "En attente", ton: "alerte" },
  prete: { libelle: "Prête", ton: "info" },
  payee: { libelle: "Payée", ton: "succes" },
  retiree: { libelle: "Retirée", ton: "succes" },
  annulee: { libelle: "Annulée", ton: "danger" },
};

const MODES: { valeur: ModePaiement; libelle: string }[] = [
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "mobile_money", libelle: "Mobile Money" },
  { valeur: "carte", libelle: "Carte" },
];

/** Réservations en ligne (app/(dashboard)/dashboard/[boutiqueId]/reservations/page.tsx). */
export function Reservations() {
  const { boutiqueId = "" } = useParams();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const reservations = useReservations(boutiqueId);
  const [recu, setRecu] = useState<TicketProps | null>(null);
  const liste = reservations.data ?? [];
  const nb = (...s: StatutReservation[]) => liste.filter((r) => s.includes(r.statut)).length;
  const aTraiter = liste.filter((r) => r.statut === "en_attente" || r.statut === "prete");

  if (recu) {
    return (
      <div className="flex flex-col gap-5 pb-6">
        <EnTeteEcran
          titre="Réservation encaissée"
          actions={
            <>
              <Bouton onClick={() => window.print()}>Imprimer le reçu</Bouton>
              <Bouton variante="secondaire" onClick={() => setRecu(null)}>
                Terminé
              </Bouton>
            </>
          }
        />
        <Ticket {...recu} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran titre={`Réservations — ${boutique.data?.nom ?? ""}`} sousTitre="Gestion des réservations en ligne" />
      <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
        <TuileChiffre libelle="En attente" valeur={formatNombre(nb("en_attente", "prete"))} />
        <TuileChiffre libelle="Prêtes" valeur={formatNombre(nb("prete"))} />
        <TuileChiffre libelle="Payées / Retirées" valeur={formatNombre(nb("payee", "retiree"))} />
        <TuileChiffre libelle="Annulées" valeur={formatNombre(nb("annulee"))} />
      </div>
      {aTraiter.length > 0 && (
        <Carte titre="En attente de retrait">
          <div className="grid grid-cols-1 gap-3 bureau:grid-cols-2">
            {aTraiter.map((r) => (
              <CarteReservation
                key={r.id}
                boutiqueId={boutiqueId}
                reservation={r}
                onEncaissee={(reference, montant, mode, caissier) =>
                  setRecu({
                    boutique: boutique.data ?? { nom: "" },
                    reference,
                    date: new Date().toLocaleString("fr-FR"),
                    vendeur: caissier,
                    libelleVendeur: "Caissier",
                    paiement: LIBELLES_PAIEMENT[mode] ?? mode,
                    client: r.client_nom,
                    mentions: [`Réservation : ${r.reference_reservation}`],
                    lignes: r.lignes.map((l) => ({ nom: l.produit_nom, quantite: Number(l.quantite), prix: Number(l.prix_unitaire) })),
                    monnaie,
                    total: montant,
                  })
                }
              />
            ))}
          </div>
        </Carte>
      )}
      <Carte titre="Historique des réservations">
        <ListeChargee
          legende="Historique des réservations"
          requete={reservations}
          cleLigne={(r) => r.id}
          vide="Aucune réservation"
          colonnes={[
            { cle: "reference", libelle: "Référence", rendu: (r) => r.reference_reservation, principale: true },
            {
              cle: "client",
              libelle: "Client",
              rendu: (r) => (
                <span className="flex flex-col">
                  <span>{r.client_nom}</span>
                  <span className="text-mention text-texte-discret">{r.client_telephone}</span>
                </span>
              ),
            },
            { cle: "montant", libelle: "Montant", rendu: (r) => formatMontant(r.montant_total, monnaie), alignement: "fin" },
            { cle: "date", libelle: "Date", rendu: (r) => new Date(r.created_at).toLocaleString("fr-FR") },
            { cle: "statut", libelle: "Statut", rendu: (r) => <Badge ton={STATUTS[r.statut].ton}>{STATUTS[r.statut].libelle}</Badge> },
          ]}
        />
      </Carte>
    </div>
  );
}

/** Une réservation à traiter et ses actions (components/dashboard/ReservationActions.tsx). */
function CarteReservation({
  boutiqueId,
  reservation: r,
  onEncaissee,
}: {
  boutiqueId: string;
  reservation: ReservationDetaillee;
  onEncaissee: (reference: string, montant: number, mode: ModePaiement, caissier: string) => void;
}) {
  const { peut } = useSession();
  const utilisateur = useUtilisateur();
  const monnaie = useMonnaie();
  const idTitre = useId();
  const invalide = [["boutiques", boutiqueId]];
  const confirmation = useEcriture({ appel: confirmerReservation, invalide, succes: "Réservation prête" });
  const encaissement = useEcriture({ appel: encaisserReservation, invalide });
  const annulation = useEcriture({ appel: annulerReservation, invalide, succes: "Réservation annulée, stock libéré" });
  const [encaisser, setEncaisser] = useState(false);
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [annuler, setAnnuler] = useState(false);
  const [motif, setMotif] = useState("");
  const [motifManquant, setMotifManquant] = useState(false);
  const peutGerer = peut("reservations:gerer");
  const erreur = confirmation.erreur ?? encaissement.erreur;

  return (
    <article aria-labelledby={idTitre} className="flex flex-col gap-3 rounded-carte bg-alerte-fond p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={idTitre} className="m-0 text-courant font-bold">
            {r.reference_reservation}
          </h3>
          <p className="m-0 text-libelle">
            {r.client_nom} — {r.client_telephone}
          </p>
          {r.client_email && <p className="m-0 text-mention text-texte-discret">{r.client_email}</p>}
        </div>
        <div className="text-right">
          <p className="m-0 text-panneau font-bold tabular-nums">{formatMontant(r.montant_total, monnaie)}</p>
          <p className="m-0 text-mention text-texte-discret">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
          <Badge ton={STATUTS[r.statut].ton}>{STATUTS[r.statut].libelle}</Badge>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1 border-t border-bordure-forte p-0 pt-2 text-libelle">
        {r.lignes.map((l) => (
          <li key={l.id} className="flex justify-between gap-3">
            <span>{`${l.produit_nom} × ${l.quantite}`}</span>
            <span className="tabular-nums">{formatMontant(Number(l.prix_unitaire) * Number(l.quantite), monnaie)}</span>
          </li>
        ))}
      </ul>
      {r.date_retrait_prevue && (
        <p className="m-0 text-mention text-texte-discret">{`Retrait prévu le : ${new Date(r.date_retrait_prevue).toLocaleDateString("fr-FR")}`}</p>
      )}
      {erreur && (
        <p role="alert" className="m-0 font-semibold text-danger">
          {erreur}
        </p>
      )}
      {peutGerer && (
        <div className="flex flex-col gap-3">
          {encaisser ? (
            <div className="flex flex-col gap-3 rounded-bouton bg-surface p-3">
              <ChoixSegmente legende="Mode de paiement" legendeVisible options={MODES} valeur={mode} onChange={setMode} />
              <div className="flex flex-wrap gap-2">
                <Bouton
                  chargement={encaissement.enCours}
                  disabled={encaissement.desactivee}
                  onClick={async () => {
                    const resultat = await encaissement.envoyer({ id: r.id, mode_paiement: mode });
                    if (resultat) onEncaissee(resultat.reference, resultat.montantTotal, mode, utilisateur.nom_complet);
                  }}
                >
                  Encaisser
                </Bouton>
                <Bouton variante="secondaire" onClick={() => setEncaisser(false)}>
                  Revenir
                </Bouton>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {r.statut === "en_attente" && (
                <Bouton
                  variante="secondaire"
                  chargement={confirmation.enCours}
                  disabled={confirmation.desactivee}
                  onClick={() => void confirmation.envoyer({ id: r.id })}
                >
                  Confirmer (prête)
                </Bouton>
              )}
              {r.statut === "prete" && <Bouton onClick={() => setEncaisser(true)}>Encaisser à la remise</Bouton>}
              <Bouton variante="discret" onClick={() => setAnnuler(true)}>
                Annuler la réservation
              </Bouton>
            </div>
          )}
        </div>
      )}
      <Dialogue
        ouvert={annuler}
        titre={`Annuler la réservation ${r.reference_reservation} ?`}
        message="Le stock réservé sera libéré."
        libelleConfirmer="Confirmer l'annulation"
        libelleAnnuler="Revenir"
        variante="danger"
        chargement={annulation.enCours}
        onAnnuler={() => setAnnuler(false)}
        onConfirmer={async () => {
          if (!motif.trim()) return setMotifManquant(true);
          if (await annulation.envoyer({ id: r.id, motif: motif.trim() })) setAnnuler(false);
        }}
      >
        <ZoneTexte
          libelle="Motif"
          value={motif}
          onChange={(e) => {
            setMotif(e.target.value);
            setMotifManquant(false);
          }}
          erreur={motifManquant ? "Un motif d'annulation est requis" : undefined}
        />
        {annulation.erreur && (
          <p role="alert" className="m-0 font-semibold text-danger">
            {annulation.erreur}
          </p>
        )}
      </Dialogue>
    </article>
  );
}
