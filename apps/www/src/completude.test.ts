// @vitest-environment node
import * as metier from "@multiboutique/metier";
import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { SERVICES } from "./api/vitrine";
import { routes } from "./routes";

const OUTILS = new Set(["ErreurMetier", "exigerAccesBoutique", "exigerAdministrateur", "peutAccederBoutique"]);

// Services de packages/metier qui reviennent à la vitrine.
const SERVICES_VITRINE = ["creerReservation"];

// Page publique ou client du monolithe retiré (voir l'historique Git avant la
// phase 5) → adresse de la vitrine. Table figée : elle trace la parité et
// vérifie que chaque route existe toujours.
const PAGES: Record<string, string> = {
  "page.tsx": "/",
  "(public)/boutique/page.tsx": "/",
  "(public)/boutique/[id]/catalogue/page.tsx": "/boutiques/b1",
  "(public)/reservation/[id]/page.tsx": "/reservations/r1",
  "(auth)/login/page.tsx": "/connexion",
  "(auth)/register/page.tsx": "/inscription",
  "(client)/client/page.tsx": "/espace",
};

function aUnEcran(adresse: string): boolean {
  const derniere = (matchRoutes(routes, adresse) ?? []).at(-1)?.route;
  return !!derniere && derniere.path !== "*" && !derniere.children?.length && !!derniere.element;
}

describe("garde de complétude de la vitrine", () => {
  it("la vitrine appelle exactement ses services de packages/metier", () => {
    const tous = Object.keys(metier).filter((n) => typeof (metier as Record<string, unknown>)[n] === "function" && !OUTILS.has(n));
    expect(SERVICES_VITRINE.filter((s) => !tous.includes(s))).toEqual([]);
    expect(Object.keys(SERVICES).sort()).toEqual([...SERVICES_VITRINE].sort());
  });

  it("chaque page publique ou client de l'ancien monolithe a toujours sa route", () => {
    expect(Object.keys(PAGES).filter((p) => !aUnEcran(PAGES[p]!))).toEqual([]);
  });
});
