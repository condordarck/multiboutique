import * as metier from "@multiboutique/metier";
import { describe, expect, it } from "vitest";
import { CONFIG_TEST } from "../../test/fixtures";
import { construireApp } from "../app";

// Exports de @multiboutique/metier qui ne sont pas des services.
const OUTILS = new Set(["ErreurMetier", "exigerAccesBoutique", "exigerAdministrateur", "peutAccederBoutique"]);

// Seules écritures ouvertes aux visiteurs anonymes.
const ECRITURES_PUBLIQUES = new Set(["POST /reservations"]);

async function registre() {
  const app = await construireApp({ pool: { query: async () => ({ rows: [] }) } as never, config: CONFIG_TEST });
  await app.ready();
  return app.registre;
}

describe("registre des routes", () => {
  it("chaque service de @multiboutique/metier est exposé par exactement une route", async () => {
    const services = Object.entries(metier)
      .filter(([nom, valeur]) => typeof valeur === "function" && !OUTILS.has(nom))
      .map(([nom]) => nom)
      .sort();
    expect(services).toHaveLength(56);

    const appels = (await registre()).flatMap((e) => (e.service ? [e.service] : []));
    const manquants = services.filter((s) => !appels.includes(s));
    const doublons = appels.filter((s, i) => appels.indexOf(s) !== i);
    const inconnus = appels.filter((s) => !services.includes(s));
    expect({ manquants, doublons, inconnus }).toEqual({ manquants: [], doublons: [], inconnus: [] });
  });

  it("aucune écriture n'est publique, sauf celles déclarées", async () => {
    const publiques = (await registre())
      .filter((e) => e.methode !== "GET" && e.garde === "public")
      .map((e) => `${e.methode} ${e.chemin}`);
    expect(publiques).toEqual([...ECRITURES_PUBLIQUES]);
  });

  it("chaque route /admin exige l'administrateur, chaque route /public n'exige rien", async () => {
    const entrees = await registre();
    expect(entrees.filter((e) => e.chemin.startsWith("/admin") && e.garde !== "administrateur")).toEqual([]);
    expect(entrees.filter((e) => e.chemin.startsWith("/public") && e.garde !== "public")).toEqual([]);
  });

  it("chaque route sous /boutiques/:boutiqueId vérifie l'accès à la boutique", async () => {
    const entrees = await registre();
    expect(entrees.filter((e) => e.chemin.startsWith("/boutiques/:boutiqueId") && e.garde !== "boutique")).toEqual([]);
  });
});
