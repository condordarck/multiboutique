import { describe, expect, it } from "vitest";
import { calculerCoutRevient, montantFrais } from "./prix";

describe("coût de revient", () => {
  it("prix d'achat seul", () => {
    expect(calculerCoutRevient(1000, [])).toBe(1000);
  });

  it("additionne montants et pourcentages du prix d'achat", () => {
    const frais = [
      { mode: "montant" as const, valeur: 150 },
      { mode: "pourcentage" as const, valeur: 20 },
      { mode: "montant" as const, valeur: 25.5 },
    ];
    expect(montantFrais(1000, frais[1]!)).toBe(200);
    expect(calculerCoutRevient(1000, frais)).toBe(1375.5);
  });

  it("arrondit au centime", () => {
    expect(montantFrais(333.33, { mode: "pourcentage", valeur: 7 })).toBe(23.33);
    expect(calculerCoutRevient(0.1, [{ mode: "montant", valeur: 0.2 }])).toBe(0.3);
  });
});
