import { describe, expect, it } from "vitest";
import { lireEntier, lireNombre } from "./saisie";

describe("saisie des nombres", () => {
  it.each([
    ["12", 12],
    ["1,5", 1.5],
    ["1.5", 1.5],
    ["10 000", 10000],
    ["10 000,25", 10000.25],
    ["-3", -3],
  ])("« %s » vaut %d", (texte, attendu) => {
    expect(lireNombre(texte)).toBe(attendu);
  });

  it.each(["", "abc", "0x10", "1e3", "Infinity", "12a", "1,2,3"])("« %s » n'est pas un nombre", (texte) => {
    expect(lireNombre(texte)).toBeNaN();
  });

  it("un entier, au-dessus d'un minimum", () => {
    expect(lireEntier("40", 0)).toBe(40);
    expect(lireEntier("0", 0)).toBe(0);
    expect(lireEntier("0", 1)).toBeNaN();
    expect(lireEntier("2,5", 0)).toBeNaN();
    expect(lireEntier("-1", 0)).toBeNaN();
  });
});
