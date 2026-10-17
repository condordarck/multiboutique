// @vitest-environment node
// Lit theme.css sur le disque : jsdom remplace URL par la sienne, que fs refuse.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";
import { tokens, type NomToken } from "./tokens";

// Paires texte/fond réellement utilisées par les composants, avec le
// minimum WCAG : 4,5:1 pour du texte, 3:1 pour un élément d'interface (1.4.11).
const PAIRES: Array<[avantPlan: NomToken, arrierePlan: NomToken, minimum: number]> = [
  ["texte", "fond", 4.5],
  ["texte", "surface", 4.5],
  ["texte", "surfaceRelevee", 4.5],
  ["texteDiscret", "fond", 4.5],
  ["texteDiscret", "surface", 4.5],
  ["texteDiscret", "surfaceRelevee", 4.5],
  ["texteDiscret", "neutreFond", 4.5],
  ["primaire", "fond", 4.5],
  ["primaire", "surface", 4.5],
  ["primaire", "primaireFond", 4.5],
  ["surPrimaire", "primaire", 4.5],
  ["surPrimaire", "primaireSurvol", 4.5],
  ["surAccent", "accent", 4.5],
  ["succes", "surface", 4.5],
  ["succes", "succesFond", 4.5],
  ["alerte", "surface", 4.5],
  ["alerte", "alerteFond", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "dangerFond", 4.5],
  ["surDanger", "danger", 4.5],
  ["info", "infoFond", 4.5],
  ["bordureForte", "surface", 3],
  ["focus", "fond", 3],
  ["focus", "surface", 3],
];

describe("contraste WCAG", () => {
  it("vaut 21 entre le noir et le blanc", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("est symétrique et reconnaît un gris juste sous 4,5:1", () => {
    expect(contraste("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contraste("#ffffff", "#777777")).toBeCloseTo(4.48, 2);
  });

  it("refuse une couleur qui n'est pas au format #rrggbb", () => {
    expect(() => contraste("bleu", "#ffffff")).toThrow();
  });
});

describe.each(["clair", "sombre"] as const)("thème %s", (theme) => {
  it.each(PAIRES)("%s sur %s atteint %d:1", (avantPlan, arrierePlan, minimum) => {
    const t = tokens[theme];
    expect(contraste(t[avantPlan], t[arrierePlan])).toBeGreaterThanOrEqual(minimum);
  });
});

it("les deux thèmes déclarent les mêmes tokens", () => {
  expect(Object.keys(tokens.sombre).sort()).toEqual(Object.keys(tokens.clair).sort());
});

// theme.css recopie les valeurs de tokens.ts : ces tests empêchent les deux
// sources de diverger, en noms comme en valeurs.
describe("theme.css", () => {
  const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

  function declarations(selecteur: string): Record<string, string> {
    const debut = css.indexOf(selecteur);
    expect(debut, `bloc ${selecteur} introuvable`).toBeGreaterThanOrEqual(0);
    const ouverture = css.indexOf("{", debut);
    const fermeture = css.indexOf("}", ouverture);
    const corps = css.slice(ouverture + 1, fermeture);
    const resultat: Record<string, string> = {};
    for (const [, nom, valeur] of corps.matchAll(/(--mb-[a-z-]+)\s*:\s*([^;]+);/g)) {
      resultat[nom!] = valeur!.trim().toUpperCase();
    }
    return resultat;
  }

  function attendu(theme: "clair" | "sombre"): Record<string, string> {
    return Object.fromEntries(
      Object.entries(tokens[theme]).map(([cle, valeur]) => [
        `--mb-${cle.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`,
        valeur.toUpperCase(),
      ])
    );
  }

  it("déclare le thème clair à la racine", () => {
    expect(declarations(":root {")).toEqual(attendu("clair"));
  });

  it("applique le sombre selon le système, sauf choix explicite du clair", () => {
    expect(declarations(':root:not([data-theme="clair"])')).toEqual(attendu("sombre"));
  });

  it("applique le sombre sur choix explicite", () => {
    expect(declarations(':root[data-theme="sombre"]')).toEqual(attendu("sombre"));
  });
});
