import type { LigneStock } from "@multiboutique/shared";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ligneStock } from "../../../test/donnees";
import { cellulesPdf, colonnesStock, nomFichier, stockEnExcel, stockEnPdf } from "./exportStock";

const LIGNES: LigneStock[] = [
  ligneStock({ quantite: 1250, quantite_reservee: 2, disponible: 1248, prix_vente: 2000, cout_revient: 1350 }),
  ligneStock({ id: "s-sel", produit_id: "p-sel", produit_nom: "Sel fin", produit_reference: "SEL-1", quantite: 0, disponible: 0, statut_stock: "rupture", cout_revient: null }),
];
const CONTEXTE = { boutique: "Boutique Éléphant 1", monnaie: "$", avecCout: true, filtre: "Rupture", maintenant: new Date(2026, 9, 21, 14, 5) };

describe("export du stock", () => {
  it("colonnes : coût et valeur au coût seulement avec avecCout", () => {
    expect(colonnesStock(false).map((c) => c.titre)).toEqual(["Produit", "Référence", "Stock total", "Réservé", "Disponible", "Seuil d'alerte", "Statut", "Prix de vente"]);
    expect(colonnesStock(true).map((c) => c.titre).slice(-2)).toEqual(["Coût de revient", "Valeur au coût"]);
  });

  it("nom de fichier sans accents ni espaces, daté", () => {
    expect(nomFichier("Boutique Éléphant 1", CONTEXTE.maintenant)).toBe("stock-boutique-elephant-1-2026-10-21");
  });

  it("cellules PDF : format français sans espaces insécables, tiret si le coût manque", () => {
    const [riz, sel] = cellulesPdf(LIGNES, CONTEXTE);
    expect(riz).toEqual(["Riz 25 kg", "RIZ-25", "1 250", "2", "1 248", "8", "OK", "2 000 $", "1 350 $", "1 687 500 $"]);
    expect(sel!.slice(-3)).toEqual(["22 $", "-", "-"]);
    expect(sel![6]).toBe("Rupture");
  });

  it("prix de vente absent : cellule vide, pas 0", () => {
    const [sansPrix] = cellulesPdf([ligneStock({ prix_vente: null as unknown as number })], { ...CONTEXTE, avecCout: false });
    expect(sansPrix!.at(-1)).toBe("-");
  });

  it("Excel : un vrai classeur, nombres typés, en-tête en gras", async () => {
    const blob = await stockEnExcel(LIGNES, CONTEXTE);
    const fichiers = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(strFromU8(fichiers["xl/workbook.xml"]!)).toContain('name="Stock"');
    const feuille = strFromU8(fichiers["xl/worksheets/sheet1.xml"]!);
    // Les nombres sont des cellules numériques (pas du texte) : Excel peut les additionner.
    expect(feuille).toMatch(/<c r="C2"[^>]*><v>1250<\/v><\/c>/);
    expect(feuille).toMatch(/<c r="J2"[^>]*><v>1687500<\/v><\/c>/);
    // Coût manquant : cellule absente plutôt que 0.
    expect(feuille).not.toMatch(/<c r="I3"/);
    const textes = strFromU8(fichiers["xl/sharedStrings.xml"]!);
    expect(textes).toContain("Riz 25 kg");
    expect(textes).toContain("Valeur au coût");
  });

  it("PDF : un vrai document, titre, filtre et lignes lisibles", async () => {
    const blob = await stockEnPdf(LIGNES, CONTEXTE);
    const texte = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    expect(texte.startsWith("%PDF-")).toBe(true);
    expect(texte).toContain("(Stock - Boutique ");
    expect(texte).toContain("Export");
    expect(texte).toContain("21/10/2026 14:05 - 2 produits - Rupture");
    expect(texte).toContain("(1 687 500 $)");
    expect(texte).toContain("(Page 1)");
  });
});
