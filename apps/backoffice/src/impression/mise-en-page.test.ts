import { describe, expect, it } from "vitest";
import type { TicketProps } from "./contenu";
import { colonnes, couper, deuxColonnes, miseEnPage } from "./mise-en-page";

const TICKET: TicketProps = {
  boutique: { nom: "Boutique 1", adresse: "Avenue du Commerce", telephone: "+243 000" },
  reference: "V-0042",
  date: "19/10/2026 14:32:00",
  vendeur: "Koffi",
  paiement: "Espèces",
  lignes: [
    { nom: "Riz 25 kg", code: "CER-0001", quantite: 2, prix: 22 },
    { nom: "Huile", quantite: 1, prix: 1234.5 },
  ],
  monnaie: "$",
  total: 1278.5,
  rendu: 21.5,
};

describe("mise en page", () => {
  it("48 colonnes en 80 mm, 32 en 58 mm", () => {
    expect([colonnes(80), colonnes(58)]).toEqual([48, 32]);
  });

  it("coupe aux espaces, et net un mot trop long", () => {
    expect(couper("Crème fraîche épaisse pot familial", 14)).toEqual(["Crème fraîche", "épaisse pot", "familial"]);
    expect(couper("ABCDEFGHIJ", 4)).toEqual(["ABCD", "EFGH", "IJ"]);
    expect(couper("", 4)).toEqual([""]);
    expect(couper("  CER-0001 et suite", 10)).toEqual(["  CER-0001", "  et suite"]);
  });

  it("deux colonnes : valeur calée à droite, ou dessous faute de place", () => {
    expect(deuxColonnes("TOTAL", "12 $", 12)).toEqual(["TOTAL   12 $"]);
    expect(deuxColonnes("Reste à devoir", "1 234 $", 12)).toEqual(["Reste à", "devoir", "     1 234 $"]);
  });

  it("ticket 80 mm : chaque ligne tient, mêmes informations qu'à l'écran", () => {
    const lignes = miseEnPage(TICKET, 80);
    expect(lignes.every((l) => l.texte.length <= 48)).toBe(true);
    expect(lignes.every((l) => !/[  ]/.test(l.texte))).toBe(true);
    const textes = lignes.map((l) => l.texte);
    expect(lignes[0]).toEqual({ texte: "BOUTIQUE 1", centre: true, gras: true, grand: true });
    expect(textes).toContain("  2 x 22 $" + " ".repeat(48 - 10 - 4) + "44 $");
    expect(textes).toContain("  CER-0001");
    expect(textes).toContain("  1 x 1 234,5 $" + " ".repeat(48 - 15 - 9) + "1 234,5 $");
    expect(lignes.find((l) => l.texte.startsWith("TOTAL"))).toMatchObject({ gras: true, grand: true });
    expect(textes).toContain("Rendu" + " ".repeat(48 - 5 - 6) + "21,5 $");
    expect(textes).toContain("3 articles");
    expect(textes.at(-1)).toBe("Conservez ce ticket");
  });

  it("ticket 58 mm, annulé, avec client et remise", () => {
    const lignes = miseEnPage(
      { ...TICKET, client: "Quincaillerie Ade", remise: 10, codePromo: "PROMO10", paye: 100, reste: 1168.5, rendu: undefined, annulee: "" },
      58
    );
    expect(lignes.every((l) => l.texte.length <= 32)).toBe(true);
    const textes = lignes.map((l) => l.texte);
    expect(lignes[0]).toMatchObject({ texte: "VENTE ANNULÉE — motif non", gras: true, centre: true });
    expect(textes).toContain("Client : Quincaillerie Ade");
    expect(textes.some((t) => t.startsWith("Remise (PROMO10)") && t.endsWith("-10 $"))).toBe(true);
    expect(lignes.find((l) => l.texte.startsWith("Reste à devoir"))).toMatchObject({ gras: true });
  });
});
