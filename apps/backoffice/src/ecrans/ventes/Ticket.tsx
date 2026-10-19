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
 * Reçu de vente au format ticket de caisse (rouleau thermique de 80 mm), à
 * l'écran et à l'impression (la zone imprimée, voir styles.css). Reprend les
 * deux reçus du monolithe : celui de la caisse et celui de la page de la vente.
 */
export function Ticket(t: TicketProps) {
  const ligne = "flex justify-between gap-3";
  const separation = "my-2 border-t border-dashed border-texte";
  const sousTotal = t.lignes.reduce((s, l) => s + l.quantite * l.prix, 0);
  const articles = t.lignes.reduce((s, l) => s + l.quantite, 0);
  return (
    <section
      aria-label={`Reçu ${t.reference}`}
      className="zone-impression ticket mx-auto w-full max-w-[80mm] bg-surface px-4 py-5 font-mono text-[13px] leading-snug text-texte shadow-carte"
    >
      {t.annulee !== undefined && t.annulee !== null && (
        <p className="m-0 mb-3 border-2 border-texte px-2 py-1 text-center font-bold">
          VENTE ANNULÉE — {t.annulee || "motif non précisé"}
        </p>
      )}
      <div className="text-center">
        <p className="m-0 text-[15px] font-bold uppercase">{t.boutique.nom}</p>
        {t.boutique.adresse && <p className="m-0">{t.boutique.adresse}</p>}
        {t.boutique.telephone && <p className="m-0">Tél : {t.boutique.telephone}</p>}
      </div>

      <div className={separation} />
      <p className="m-0 font-bold break-all">N° {t.reference}</p>
      <p className="m-0">{t.date}</p>
      {t.mentions?.map((m) => (
        <p key={m} className="m-0">
          {m}
        </p>
      ))}
      <p className="m-0">
        {t.libelleVendeur ?? "Vendeur"} : {t.vendeur}
      </p>
      {t.client && <p className="m-0 font-bold">Client : {t.client}</p>}

      <div className={separation} />
      <ul aria-label="Articles" className="m-0 flex list-none flex-col gap-1.5 p-0">
        {t.lignes.map((l, i) => (
          <li key={i}>
            <span className="block break-words">{l.nom}</span>
            {l.code && <span className="block pl-3">{l.code}</span>}
            <span className={`${ligne} tabular-nums`}>
              <span className="pl-3">
                {formatNombre(l.quantite)} x {formatMontant(l.prix, t.monnaie)}
              </span>
              <span>{formatMontant(l.quantite * l.prix, t.monnaie)}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className={separation} />
      <div className="flex flex-col gap-0.5 tabular-nums">
        {!!t.remise && t.remise > 0 && (
          <>
            <div className={ligne}>
              <span>Sous-total</span>
              <span>{formatMontant(sousTotal, t.monnaie)}</span>
            </div>
            <div className={ligne}>
              <span>{t.codePromo ? `Remise (${t.codePromo})` : "Remise"}</span>
              <span>-{formatMontant(t.remise, t.monnaie)}</span>
            </div>
          </>
        )}
        <div className={`${ligne} text-[16px] font-bold`}>
          <span>TOTAL</span>
          <span>{formatMontant(t.total, t.monnaie)}</span>
        </div>
        <div className={ligne}>
          <span>Paiement</span>
          <span>{t.paiement}</span>
        </div>
        {t.rendu !== undefined && (
          <div className={ligne}>
            <span>Rendu</span>
            <span>{formatMontant(Math.max(0, t.rendu), t.monnaie)}</span>
          </div>
        )}
        {t.paye !== undefined && (
          <div className={ligne}>
            <span>Payé</span>
            <span>{formatMontant(t.paye, t.monnaie)}</span>
          </div>
        )}
        {!!t.reste && t.reste > 0 && (
          <div className={`${ligne} font-bold`}>
            <span>Reste à devoir</span>
            <span>{formatMontant(t.reste, t.monnaie)}</span>
          </div>
        )}
      </div>

      <div className={separation} />
      <p className="m-0 text-center">
        {formatNombre(articles)} article{articles > 1 ? "s" : ""}
      </p>
      <p className="m-0 mt-3 text-center">Merci de votre visite !</p>
      <p className="m-0 text-center">Conservez ce ticket</p>
    </section>
  );
}
