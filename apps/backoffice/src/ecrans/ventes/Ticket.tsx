import { formatMontant, formatNombre } from "@multiboutique/front";

export interface LigneTicket {
  nom: string;
  code?: string | null;
  quantite: number;
  prix: number;
}

export interface TicketProps {
  boutique: { nom: string; adresse?: string | null; telephone?: string | null };
  reference: string;
  date: string;
  vendeur: string;
  /** « Vendeur » par défaut ; « Caissier » pour une réservation encaissée. */
  libelleVendeur?: string;
  /** Lignes d'en-tête supplémentaires (« Réservation : R-0007 »). */
  mentions?: string[];
  paiement: string;
  client?: string | null;
  lignes: LigneTicket[];
  monnaie: string;
  total: number;
  remise?: number;
  codePromo?: string;
  /** Vente à un client : montant payé et reste dû. */
  paye?: number;
  reste?: number;
  /** Espèces sans client : monnaie rendue. */
  rendu?: number;
  annulee?: string | null;
}

/**
 * Reçu de vente, à l'écran et à l'impression (la zone imprimée). Reprend les
 * deux reçus du monolithe : celui de la caisse et celui de la page de la vente.
 */
export function Ticket(t: TicketProps) {
  const ligne = "flex justify-between gap-3";
  const sousTotal = t.lignes.reduce((s, l) => s + l.quantite * l.prix, 0);
  return (
    <section
      aria-label={`Reçu ${t.reference}`}
      className="zone-impression mx-auto w-full max-w-sm rounded-carte bg-surface p-6 text-libelle text-texte shadow-carte"
    >
      {t.annulee !== undefined && t.annulee !== null && (
        <p className="m-0 mb-3 rounded-bouton bg-danger-fond px-3 py-2 text-center font-bold text-danger">
          VENTE ANNULÉE — {t.annulee || "motif non précisé"}
        </p>
      )}
      <div className="text-center">
        <p className="m-0 text-courant font-bold">{t.boutique.nom}</p>
        {t.boutique.adresse && <p className="m-0 text-mention text-texte-discret">{t.boutique.adresse}</p>}
        {t.boutique.telephone && <p className="m-0 text-mention text-texte-discret">Tél : {t.boutique.telephone}</p>}
      </div>

      <div className="my-4 border-t border-dashed border-bordure-forte pt-2 text-mention text-texte-discret">
        <div className={ligne}>
          <span className="font-semibold text-texte">N° {t.reference}</span>
          <span>{t.date}</span>
        </div>
        {t.mentions?.map((m) => (
          <p key={m} className="m-0 mt-1">
            {m}
          </p>
        ))}
        <p className="m-0 mt-1">
          {t.libelleVendeur ?? "Vendeur"} : {t.vendeur}
        </p>
        <p className="m-0">Paiement : {t.paiement}</p>
        {t.client && <p className="m-0 font-semibold text-texte">Client : {t.client}</p>}
      </div>

      <table className="w-full border-t border-dashed border-bordure-forte">
        <thead>
          <tr className="text-left text-mention text-texte-discret uppercase">
            <th className="pb-1 font-semibold">Article</th>
            <th className="pb-1 text-center font-semibold">Qté</th>
            <th className="pb-1 text-right font-semibold">PU</th>
            <th className="pb-1 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {t.lignes.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="py-1.5 pr-2">
                {l.nom}
                {l.code && <span className="block text-mention text-texte-discret">{l.code}</span>}
              </td>
              <td className="py-1.5 text-center tabular-nums">{formatNombre(l.quantite)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMontant(l.prix, t.monnaie)}</td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{formatMontant(l.quantite * l.prix, t.monnaie)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex flex-col gap-1 border-t border-bordure-forte pt-2 tabular-nums">
        {!!t.remise && t.remise > 0 && (
          <>
            <div className={ligne}>
              <span>Sous-total</span>
              <span>{formatMontant(sousTotal, t.monnaie)}</span>
            </div>
            <div className={`${ligne} text-succes`}>
              <span>{t.codePromo ? `Remise (${t.codePromo})` : "Remise"}</span>
              <span>-{formatMontant(t.remise, t.monnaie)}</span>
            </div>
          </>
        )}
        <div className={`${ligne} text-courant font-bold`}>
          <span>TOTAL</span>
          <span>{formatMontant(t.total, t.monnaie)}</span>
        </div>
        {t.rendu !== undefined && (
          <div className={`${ligne} text-texte-discret`}>
            <span>Rendu</span>
            <span>{formatMontant(Math.max(0, t.rendu), t.monnaie)}</span>
          </div>
        )}
        {t.paye !== undefined && (
          <div className={`${ligne} text-texte-discret`}>
            <span>Payé</span>
            <span>{formatMontant(t.paye, t.monnaie)}</span>
          </div>
        )}
        {!!t.reste && t.reste > 0 && (
          <div className={`${ligne} font-semibold text-danger`}>
            <span>Reste à devoir</span>
            <span>{formatMontant(t.reste, t.monnaie)}</span>
          </div>
        )}
      </div>
      <p className="m-0 mt-6 text-center text-mention text-texte-discret">Merci de votre visite !</p>
    </section>
  );
}
