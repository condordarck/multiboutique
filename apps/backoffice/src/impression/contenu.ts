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

export interface LigneTotal {
  libelle: string;
  valeur: string;
  /** TOTAL : en gros caractères. */
  total?: boolean;
  gras?: boolean;
}

/**
 * Bas du ticket, du sous-total au reste dû : le même contenu à l'écran
 * (Ticket.tsx) et sur l'imprimante (mise-en-page.ts).
 */
export function totauxTicket(t: TicketProps): LigneTotal[] {
  const lignes: LigneTotal[] = [];
  if (t.remise && t.remise > 0) {
    const sousTotal = t.lignes.reduce((s, l) => s + l.quantite * l.prix, 0);
    lignes.push({ libelle: "Sous-total", valeur: formatMontant(sousTotal, t.monnaie) });
    lignes.push({ libelle: t.codePromo ? `Remise (${t.codePromo})` : "Remise", valeur: `-${formatMontant(t.remise, t.monnaie)}` });
  }
  lignes.push({ libelle: "TOTAL", valeur: formatMontant(t.total, t.monnaie), total: true });
  lignes.push({ libelle: "Paiement", valeur: t.paiement });
  if (t.rendu !== undefined) lignes.push({ libelle: "Rendu", valeur: formatMontant(Math.max(0, t.rendu), t.monnaie) });
  if (t.paye !== undefined) lignes.push({ libelle: "Payé", valeur: formatMontant(t.paye, t.monnaie) });
  if (t.reste && t.reste > 0) lignes.push({ libelle: "Reste à devoir", valeur: formatMontant(t.reste, t.monnaie), gras: true });
  return lignes;
}

export function nombreArticles(t: TicketProps): string {
  const n = t.lignes.reduce((s, l) => s + l.quantite, 0);
  return `${formatNombre(n)} article${n > 1 ? "s" : ""}`;
}

export const PIED_TICKET = ["Merci de votre visite !", "Conservez ce ticket"];

export function estAnnulee(t: TicketProps): boolean {
  return t.annulee !== undefined && t.annulee !== null;
}

export function bandeauAnnulation(t: TicketProps): string {
  return `VENTE ANNULÉE — ${t.annulee || "motif non précisé"}`;
}
