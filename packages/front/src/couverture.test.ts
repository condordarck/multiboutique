// @vitest-environment node
import * as metier from "@multiboutique/metier";
import { describe, expect, it } from "vitest";
// Les tables d'appels des deux fronts (import de test seulement).
import { SERVICES as SERVICES_BACKOFFICE } from "../../../apps/backoffice/src/api/services";
import { SERVICES as SERVICES_VITRINE } from "../../../apps/www/src/api/vitrine";

const OUTILS = new Set(["ErreurMetier", "exigerAccesBoutique", "exigerAdministrateur", "peutAccederBoutique"]);

// Services couverts par aucun front, et déclarés comme tels.
const SANS_ECRAN = new Set([
  // « Payée » et stock déduit sans vente : recoupe encaisserReservation ; à décider.
  "validerReservation",
]);

describe("couverture des services par les fronts", () => {
  it("chaque service de packages/metier est appelé par le backoffice ou la vitrine, sauf exception déclarée", () => {
    const services = Object.keys(metier).filter((n) => typeof (metier as Record<string, unknown>)[n] === "function" && !OUTILS.has(n));
    const couverts = new Set([...Object.keys(SERVICES_BACKOFFICE), ...Object.keys(SERVICES_VITRINE), ...SANS_ECRAN]);
    const orphelins = services.filter((s) => !couverts.has(s));
    // Une exception devenue couverte doit sortir de la liste.
    const exceptionsPerimees = [...SANS_ECRAN].filter((s) => SERVICES_BACKOFFICE[s] || (SERVICES_VITRINE as Record<string, unknown>)[s]);
    expect({ orphelins, exceptionsPerimees }).toEqual({ orphelins: [], exceptionsPerimees: [] });
  });
});
