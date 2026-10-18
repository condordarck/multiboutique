import { Chargement, ErreurApi, formatMontant, useMonnaie } from "@multiboutique/front";
import { Badge, Bouton, Carte, EtatVide, type TonBadge } from "@multiboutique/ui";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { LIBELLES_STATUT, useReservationPublique } from "../api/vitrine";

const TONS: Record<string, TonBadge> = { en_attente: "alerte", prete: "info", payee: "succes", retiree: "succes", annulee: "danger" };

/**
 * Suivi public d'une réservation (reservation/[id]/page.tsx). Le lien suffit à
 * l'ouvrir : la page ne montre ni le téléphone ni l'e-mail du client.
 */
export function Reservation() {
  const { reservationId = "" } = useParams();
  const monnaie = useMonnaie();
  const requete = useReservationPublique(reservationId);
  const [copie, setCopie] = useState(false);

  if (requete.isPending) return <Chargement />;
  if (requete.error instanceof ErreurApi && requete.error.statut === 404) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="m-0 font-titre text-ecran font-extrabold">Réservation introuvable</h1>
        <p className="m-0 text-texte-discret">Vérifiez le lien reçu après votre réservation.</p>
        <Link to="/" className="font-semibold text-primaire">
          Voir les boutiques
        </Link>
      </div>
    );
  }
  if (!requete.data) {
    return (
      <EtatVide
        message="Lecture impossible"
        description={requete.error instanceof ErreurApi ? requete.error.message : undefined}
        action={{ libelle: "Réessayer", onClick: () => void requete.refetch() }}
      />
    );
  }

  const r = requete.data;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 py-8">
      <h1 className="m-0 font-titre text-[1.875rem] font-extrabold tracking-[-0.02em] tablette:text-ecran">Détail de la réservation</h1>
      <Carte>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 text-mention text-texte-discret">Référence</p>
            <p className="m-0 text-panneau font-bold">{r.reference_reservation}</p>
          </div>
          <Badge ton={TONS[r.statut] ?? "neutre"}>{LIBELLES_STATUT[r.statut] ?? r.statut}</Badge>
        </div>
        <p className="m-0">
          <span className="text-texte-discret">Au nom de </span>
          <strong>{r.client_nom}</strong>
        </p>
        {r.boutique && (
          <section aria-labelledby="titre-boutique" className="flex flex-col gap-0.5">
            <h2 id="titre-boutique" className="m-0 text-courant font-bold">
              Boutique de retrait
            </h2>
            <p className="m-0">{r.boutique.nom}</p>
            {r.boutique.adresse && <p className="m-0 text-texte-discret">{r.boutique.adresse}</p>}
            {r.boutique.telephone && <p className="m-0 text-texte-discret">{r.boutique.telephone}</p>}
          </section>
        )}
        <section aria-labelledby="titre-articles" className="flex flex-col gap-2">
          <h2 id="titre-articles" className="m-0 text-courant font-bold">
            Articles réservés
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {r.lignes.map((l) => (
              <li key={l.id} className="flex items-start justify-between gap-3 rounded-bouton bg-surface-relevee px-4 py-3">
                <span className="flex flex-col">
                  <span className="font-semibold">{l.produit_nom}</span>
                  <span className="text-mention text-texte-discret">{`${l.produit_reference} — Qté : ${l.quantite}`}</span>
                </span>
                <span className="font-bold tabular-nums">{formatMontant(Number(l.prix_unitaire) * Number(l.quantite), monnaie)}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="flex items-baseline justify-between border-t-2 border-texte pt-3">
          <span className="font-semibold">Total à payer</span>
          <span className="text-chiffre font-bold tabular-nums">{formatMontant(r.montant_total, monnaie)}</span>
        </div>
        <p className="m-0 text-libelle text-texte-discret">{`Réservation effectuée le : ${new Date(r.created_at).toLocaleString("fr-FR")}`}</p>
        {r.date_retrait_prevue && (
          <p className="m-0 text-libelle text-texte-discret">{`Retrait prévu le : ${new Date(r.date_retrait_prevue).toLocaleDateString("fr-FR")}`}</p>
        )}
        {r.statut === "en_attente" && (
          <div className="rounded-bouton bg-info-fond px-4 py-3 text-info">
            <p className="m-0 font-semibold">Prochaine étape :</p>
            <p className="m-0">Présentez-vous en boutique avec cette référence pour régler en espèces et récupérer vos articles.</p>
          </div>
        )}
      </Carte>
      <div className="flex flex-wrap items-center gap-3">
        <Bouton
          variante="secondaire"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopie(true);
            } catch {
              setCopie(false);
            }
          }}
        >
          Copier le lien
        </Bouton>
        <span role="status" className="text-libelle font-semibold text-succes">
          {copie ? "Lien copié" : ""}
        </span>
      </div>
      <p className="m-0 text-mention text-texte-discret">Gardez ce lien : il permet de suivre la réservation.</p>
    </div>
  );
}
