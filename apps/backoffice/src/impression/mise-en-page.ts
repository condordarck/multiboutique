import { formatMontant, formatNombre } from "@multiboutique/front";
import { bandeauAnnulation, estAnnulee, nombreArticles, PIED_TICKET, totauxTicket, type TicketProps } from "./contenu";
import type { LargeurPapier } from "./reglages";

/** Une ligne du ticket imprimé en direct, déjà à la largeur du papier. */
export interface LigneImprimee {
  texte: string;
  centre?: boolean;
  gras?: boolean;
  /** Double hauteur : même nombre de colonnes, deux fois plus haut. */
  grand?: boolean;
}

/** Caractères par ligne de la police standard (12 × 24 points). */
export function colonnes(largeur: LargeurPapier): number {
  return largeur === 58 ? 32 : 48;
}

// formatMontant sépare les milliers par des espaces insécables, que les
// imprimantes ne connaissent pas.
const espaces = (texte: string) => texte.replace(/[  ]/g, " ");

/**
 * Coupe aux espaces ; un mot plus long que la ligne est coupé net. Le retrait
 * de tête (« ␣␣CER-0001 ») est gardé sur chaque ligne.
 */
export function couper(texte: string, largeur: number): string[] {
  const propre = espaces(texte);
  const retrait = /^ */.exec(propre)![0];
  if (retrait && retrait.length < largeur) return couper(propre.slice(retrait.length), largeur - retrait.length).map((l) => retrait + l);
  const lignes: string[] = [];
  let ligne = "";
  for (const mot of propre.split(/\s+/).filter(Boolean)) {
    let reste = mot;
    while (reste.length > largeur) {
      if (ligne) {
        lignes.push(ligne);
        ligne = "";
      }
      lignes.push(reste.slice(0, largeur));
      reste = reste.slice(largeur);
    }
    if (!reste) continue;
    if (!ligne) ligne = reste;
    else if (ligne.length + 1 + reste.length <= largeur) ligne += ` ${reste}`;
    else {
      lignes.push(ligne);
      ligne = reste;
    }
  }
  if (ligne || lignes.length === 0) lignes.push(ligne);
  return lignes;
}

/** Libellé à gauche, valeur calée à droite ; la valeur passe dessous si la place manque. */
export function deuxColonnes(gauche: string, droite: string, largeur: number): string[] {
  const g = espaces(gauche);
  const d = espaces(droite);
  if (g.length + 1 + d.length <= largeur) return [g + " ".repeat(largeur - g.length - d.length) + d];
  return [...couper(g, largeur), d.padStart(largeur)];
}

export function miseEnPage(t: TicketProps, largeur: LargeurPapier): LigneImprimee[] {
  const n = colonnes(largeur);
  const sortie: LigneImprimee[] = [];
  const ajouter = (textes: string[], style: Omit<LigneImprimee, "texte"> = {}) => {
    for (const texte of textes) sortie.push({ texte, ...style });
  };
  const separation = () => ajouter(["-".repeat(n)]);

  if (estAnnulee(t)) {
    ajouter(couper(bandeauAnnulation(t), n), { centre: true, gras: true });
    ajouter([""]);
  }
  ajouter(couper(t.boutique.nom.toUpperCase(), n), { centre: true, gras: true, grand: true });
  if (t.boutique.adresse) ajouter(couper(t.boutique.adresse, n), { centre: true });
  if (t.boutique.telephone) ajouter(couper(`Tél : ${t.boutique.telephone}`, n), { centre: true });

  separation();
  ajouter(couper(`N° ${t.reference}`, n), { gras: true });
  ajouter(couper(t.date, n));
  for (const m of t.mentions ?? []) ajouter(couper(m, n));
  ajouter(couper(`${t.libelleVendeur ?? "Vendeur"} : ${t.vendeur}`, n));
  if (t.client) ajouter(couper(`Client : ${t.client}`, n), { gras: true });

  separation();
  for (const l of t.lignes) {
    ajouter(couper(l.nom, n));
    if (l.code) ajouter(couper(`  ${l.code}`, n));
    ajouter(
      deuxColonnes(
        `  ${formatNombre(l.quantite)} x ${formatMontant(l.prix, t.monnaie)}`,
        formatMontant(l.quantite * l.prix, t.monnaie),
        n
      )
    );
  }

  separation();
  for (const total of totauxTicket(t)) {
    ajouter(deuxColonnes(total.libelle, total.valeur, n), { gras: total.total || total.gras, grand: total.total });
  }

  separation();
  ajouter([nombreArticles(t)], { centre: true });
  ajouter([""]);
  for (const texte of PIED_TICKET) ajouter(couper(texte, n), { centre: true });
  return sortie;
}
