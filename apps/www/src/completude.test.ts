// @vitest-environment node
import * as metier from "@multiboutique/metier";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { SERVICES } from "./api/vitrine";
import { routes } from "./routes";

const OUTILS = new Set(["ErreurMetier", "exigerAccesBoutique", "exigerAdministrateur", "peutAccederBoutique"]);

// Services de packages/metier qui reviennent à la vitrine.
const SERVICES_VITRINE = ["creerReservation"];

// Page publique ou client du monolithe (sous app/) → adresse de la vitrine.
const PAGES: Record<string, string> = {
  "page.tsx": "/",
  "(public)/boutique/page.tsx": "/",
  "(public)/boutique/[id]/catalogue/page.tsx": "/boutiques/b1",
  "(public)/reservation/[id]/page.tsx": "/reservations/r1",
  "(auth)/login/page.tsx": "/connexion",
  "(auth)/register/page.tsx": "/inscription",
  "(client)/client/page.tsx": "/espace",
};

const APP = fileURLToPath(new URL("../../../app/", import.meta.url));

function pages(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return pages(chemin);
    return nom === "page.tsx" ? [relative(APP, chemin)] : [];
  });
}

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

  it("chaque page publique ou client du monolithe a sa route", () => {
    const monolithe = ["page.tsx", "(auth)/login/page.tsx", "(auth)/register/page.tsx", ...pages(join(APP, "(public)")), ...pages(join(APP, "(client)"))];
    // Une page ajoutée au monolithe doit être reportée dans la table.
    expect(monolithe.filter((p) => !(p in PAGES))).toEqual([]);
    expect(monolithe.filter((p) => !aUnEcran(PAGES[p]!))).toEqual([]);
  });
});
