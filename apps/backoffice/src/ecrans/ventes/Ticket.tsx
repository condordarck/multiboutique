import { formatMontant, formatNombre } from "@multiboutique/front";
import { bandeauAnnulation, estAnnulee, nombreArticles, PIED_TICKET, totauxTicket, type TicketProps } from "../../impression/contenu";
import { useReglagesImpression } from "../../impression/reglages";

export type { LigneTicket, TicketProps } from "../../impression/contenu";

/**
 * Reçu de vente au format ticket de caisse, à l'écran et à l'impression par le
 * navigateur (la zone imprimée, voir styles.css), à la largeur du rouleau
 * réglée sur ce poste. Les imprimantes branchées en direct reçoivent le même
 * contenu par mise-en-page.ts. Reprend les deux reçus du monolithe : celui de
 * la caisse et celui de la page de la vente.
 */
export function Ticket(t: TicketProps) {
  const { reglages } = useReglagesImpression();
  const ligne = "flex justify-between gap-3";
  const separation = "my-2 border-t border-dashed border-texte";
  return (
    <section
      aria-label={`Reçu ${t.reference}`}
      data-papier={reglages.largeur}
      className={`zone-impression ticket mx-auto w-full ${reglages.largeur === 58 ? "max-w-[58mm]" : "max-w-[80mm]"} bg-surface px-4 py-5 font-mono text-[13px] leading-snug text-texte shadow-carte`}
    >
      {estAnnulee(t) && <p className="m-0 mb-3 border-2 border-texte px-2 py-1 text-center font-bold">{bandeauAnnulation(t)}</p>}
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
        {totauxTicket(t).map((total) => (
          <div key={total.libelle} className={`${ligne} ${total.total ? "text-[16px] font-bold" : total.gras ? "font-bold" : ""}`}>
            <span>{total.libelle}</span>
            <span>{total.valeur}</span>
          </div>
        ))}
      </div>

      <div className={separation} />
      <p className="m-0 text-center">{nombreArticles(t)}</p>
      <p className="m-0 mt-3 text-center">{PIED_TICKET[0]}</p>
      <p className="m-0 text-center">{PIED_TICKET[1]}</p>
    </section>
  );
}
