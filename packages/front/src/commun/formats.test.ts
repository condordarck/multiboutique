import { describe, expect, it } from "vitest";
import { formatDate, formatDateHeure, formatMontant, formatPourcentage } from "./formats";

// Les formats du monolithe (lib/utils.ts et pages) : toLocaleString("fr-FR") puis le symbole.
const monolithe = (v: number, monnaie: string) => `${Number(v).toLocaleString("fr-FR")} ${monnaie}`;
const espaces = (t: string) => t.replace(/[   ]/g, " ");

describe("formats", () => {
  it.each([0, 1, 1.5, 22, 1240, 1240.75, 99999.999, 1234567, -350, 0.1])("montant %d : identique au monolithe", (v) => {
    expect(espaces(formatMontant(v, "$"))).toBe(espaces(monolithe(v, "$")));
  });

  it("le symbole ne se sépare jamais du nombre (espace insécable)", () => {
    expect(formatMontant(5, "FC")).toMatch(/5 FC$/);
  });

  it("pourcentage : une décimale, virgule, espace insécable avant %", () => {
    expect(formatPourcentage(48.148)).toBe("48,1\u00a0%");
    expect(formatPourcentage(20)).toBe("20,0\u00a0%");
    expect(espaces(formatPourcentage(-12.35))).toBe("-12,4 %");
  });

  it("accepte un montant reçu en texte", () => {
    expect(espaces(formatMontant("12.5" as unknown as number, "$"))).toBe("12,5 $");
  });

  it("dates comme le monolithe", () => {
    const iso = "2026-10-17T09:05:00Z";
    expect(formatDate(iso)).toBe(new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }));
    expect(formatDateHeure(iso)).toBe(
      new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    );
  });
});
