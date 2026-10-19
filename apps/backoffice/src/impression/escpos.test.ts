import { describe, expect, it } from "vitest";
import { encoderTexte, encoderTicket } from "./escpos";

const hex = (o: Iterable<number>) => [...o].map((b) => b.toString(16).padStart(2, "0")).join(" ");

describe("ESC/POS", () => {
  it("accents : octets de la table choisie", () => {
    expect(hex(encoderTexte("é à ç É", "cp858"))).toBe("82 20 85 20 87 20 90");
    expect(hex(encoderTexte("€", "cp858"))).toBe("d5");
    // PC850 n'a pas l'euro : écrit en toutes lettres.
    expect(hex(encoderTexte("€", "cp850"))).toBe(hex(Buffer.from("EUR")));
    // PC437 n'a pas les capitales accentuées sauf É : lettre sans accent.
    expect(hex(encoderTexte("ÀÉ", "cp437"))).toBe("41 90");
  });

  it("sans accents : lettres de base, typographie remplacée, inconnu en « ? »", () => {
    expect(Buffer.from(encoderTexte("Crème brûlée — l’œuf… ✓", "ascii")).toString("latin1")).toBe("Creme brulee - l'oeuf... ?");
    expect(Buffer.from(encoderTexte("N° 12", "ascii")).toString("latin1")).toBe("No 12");
    // Le degré existe dans les tables : pas de substitution.
    expect(hex(encoderTexte("°", "cp437"))).toBe("f8");
  });

  it("ticket : init, table, styles par ligne, avance, coupe", () => {
    const octets = encoderTicket([{ texte: "AB", centre: true, gras: true, grand: true }, { texte: "c" }], {
      jeu: "cp858",
      couper: true,
      tiroir: false,
      exemplaires: 1,
    });
    expect(hex(octets)).toBe(
      [
        "1b 40", "1b 74 13",
        "1b 61 01 1b 45 01 1d 21 01 41 42 0a",
        "1b 61 00 1b 45 00 1d 21 00 63 0a",
        "1b 61 00 1b 45 00 1d 21 00",
        "1b 64 04", "1d 56 42 00",
      ].join(" ")
    );
  });

  it("sans coupe, sans table en ASCII ; exemplaires répétés, tiroir ouvert une fois à la fin", () => {
    const options = { jeu: "ascii" as const, couper: false, tiroir: true, exemplaires: 2 };
    const un = hex(encoderTicket([{ texte: "x" }], { ...options, exemplaires: 1, tiroir: false }));
    expect(un).not.toContain("1b 74");
    expect(un).not.toContain("1d 56");
    expect(hex(encoderTicket([{ texte: "x" }], options))).toBe(`${un} ${un} 1b 70 00 19 fa`);
  });
});
