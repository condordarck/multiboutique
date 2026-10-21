import type { LigneStock } from "@multiboutique/shared";
import { formatMontant, formatNombre } from "@multiboutique/front";

// Export de l'état du stock affiché (recherche et filtre appliqués), en .xlsx
// ou en .pdf. Les bibliothèques ne sont chargées qu'au clic : le premier
// chargement du backoffice n'en paie pas le poids.

const STATUTS: Record<LigneStock["statut_stock"], string> = { ok: "OK", alerte: "Stock bas", rupture: "Rupture" };

type Nature = "texte" | "quantite" | "montant";

interface Colonne {
  titre: string;
  nature: Nature;
  /** Largeur Excel, en caractères. */
  largeur: number;
  valeur: (l: LigneStock) => string | number | null;
}

/** Colonnes de l'export ; le coût de revient et la valeur au coût seulement pour qui les voit. */
export function colonnesStock(avecCout: boolean): Colonne[] {
  const cout = (l: LigneStock) => (l.cout_revient != null ? Number(l.cout_revient) : null);
  return [
    { titre: "Produit", nature: "texte", largeur: 32, valeur: (l) => l.produit_nom },
    { titre: "Référence", nature: "texte", largeur: 16, valeur: (l) => l.produit_reference },
    { titre: "Stock total", nature: "quantite", largeur: 12, valeur: (l) => Number(l.quantite) },
    { titre: "Réservé", nature: "quantite", largeur: 10, valeur: (l) => Number(l.quantite_reservee) },
    { titre: "Disponible", nature: "quantite", largeur: 12, valeur: (l) => Number(l.disponible) },
    { titre: "Seuil d'alerte", nature: "quantite", largeur: 14, valeur: (l) => Number(l.seuil_alerte) },
    { titre: "Statut", nature: "texte", largeur: 12, valeur: (l) => STATUTS[l.statut_stock] },
    // Prix absent : cellule vide, pas un 0 qui passerait pour un vrai prix.
    { titre: "Prix de vente", nature: "montant", largeur: 14, valeur: (l) => (l.prix_vente != null ? Number(l.prix_vente) : null) },
    ...(avecCout
      ? [
          { titre: "Coût de revient", nature: "montant" as const, largeur: 16, valeur: cout },
          {
            titre: "Valeur au coût",
            nature: "montant" as const,
            largeur: 16,
            valeur: (l: LigneStock) => {
              const c = cout(l);
              return c != null ? Math.round(Number(l.quantite) * c * 100) / 100 : null;
            },
          },
        ]
      : []),
  ];
}

export interface ContexteExport {
  boutique: string;
  monnaie: string;
  avecCout: boolean;
  /** Ce qui restreint la liste (« Sous le seuil », « recherche : riz »), vide sinon. */
  filtre: string;
  maintenant?: Date;
}

/** stock-boutique-1-2026-10-21 */
export function nomFichier(boutique: string, maintenant: Date): string {
  const slug = boutique
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const jour = `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, "0")}-${String(maintenant.getDate()).padStart(2, "0")}`;
  return `stock-${slug || "boutique"}-${jour}`;
}

/** Classeur .xlsx : une feuille « Stock », en-tête figé, nombres typés. */
export async function stockEnExcel(lignes: LigneStock[], contexte: ContexteExport): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const colonnes = colonnesStock(contexte.avecCout);
  const formats: Record<Nature, string | undefined> = { texte: undefined, quantite: "#,##0", montant: "#,##0.00" };
  const entete = colonnes.map((c) => ({ value: c.titre, fontWeight: "bold" as const }));
  const corps = lignes.map((l) =>
    colonnes.map((c) => {
      const v = c.valeur(l);
      if (v == null) return null;
      return typeof v === "number" ? { value: v, type: Number, format: formats[c.nature] } : { value: v, type: String };
    })
  );
  return writeXlsxFile([entete, ...corps], {
    sheet: "Stock",
    columns: colonnes.map((c) => ({ width: c.largeur })),
    stickyRowsCount: 1,
  }).toBlob();
}

// Les polices standard du PDF ignorent les espaces insécables du format
// français (« 1 350 ») : on les remplace par des espaces simples.
const pourPdf = (texte: string) => texte.replace(/[  ]/g, " ");

/** Lignes du tableau PDF, déjà mises en forme (nombres et montants à la française). */
export function cellulesPdf(lignes: LigneStock[], contexte: ContexteExport): string[][] {
  const colonnes = colonnesStock(contexte.avecCout);
  return lignes.map((l) =>
    colonnes.map((c) => {
      const v = c.valeur(l);
      if (v == null) return "-";
      if (typeof v === "string") return v;
      return pourPdf(c.nature === "montant" ? formatMontant(v, contexte.monnaie) : formatNombre(v));
    })
  );
}

/** Document A4 paysage : titre, date et filtre, tableau paginé. */
export async function stockEnPdf(lignes: LigneStock[], contexte: ContexteExport): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const colonnes = colonnesStock(contexte.avecCout);
  const maintenant = contexte.maintenant ?? new Date();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(16);
  doc.text(`Stock - ${contexte.boutique}`, 14, 16);
  doc.setFontSize(9);
  const date = maintenant.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const details = [`Exporté le ${date}`, `${lignes.length} produit${lignes.length > 1 ? "s" : ""}`, contexte.filtre].filter(Boolean).join(" - ");
  doc.text(pourPdf(details), 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [colonnes.map((c) => c.titre)],
    body: cellulesPdf(lignes, contexte),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [43, 80, 217] }, // --mb-primaire
    columnStyles: Object.fromEntries(colonnes.map((c, i) => [i, { halign: c.nature === "texte" ? "left" : "right" }])),
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${page}`, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 8, { align: "right" });
    },
  });
  return doc.output("blob");
}

function telecharger(contenu: Blob, nom: string) {
  const url = URL.createObjectURL(contenu);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  lien.click();
  // Laisse au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exporterStock(format: "excel" | "pdf", lignes: LigneStock[], contexte: ContexteExport): Promise<void> {
  const nom = nomFichier(contexte.boutique, contexte.maintenant ?? new Date());
  if (format === "excel") telecharger(await stockEnExcel(lignes, contexte), `${nom}.xlsx`);
  else telecharger(await stockEnPdf(lignes, contexte), `${nom}.pdf`);
}
