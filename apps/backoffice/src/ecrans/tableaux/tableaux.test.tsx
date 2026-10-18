import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "../../../test/axe";
import { BOUTIQUE_DETAIL, CONSOLIDATION, RESUME_BOUTIQUE, resumeJour } from "../../../test/donnees";
import { fauxApi, type FauxApi } from "../../../test/faux-api";
import { BOUTIQUE_1, BOUTIQUE_2, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());

const tuile = (libelle: string) => screen.getByText(libelle, { selector: "span" }).parentElement!;
const espaces = (t: string | null) => (t ?? "").replace(/[  ]/g, " ");

describe("tableau de bord du propriétaire", () => {
  it("totaux du jour et résumé par boutique", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "proprietaire", boutique_ids: [] }));
    api.repondre("GET", "/resume", 200, [
      resumeJour(),
      resumeJour({ boutique_id: BOUTIQUE_2, boutique_nom: "Boutique 2", nombre_ventes: 3, chiffre_affaires: 60, alertes_stock: 0, reservations_en_attente: 0 }),
    ]);
    const { container } = rendreApp("/tableau-de-bord");
    expect(await screen.findByRole("heading", { level: 1, name: "Tableau de bord" })).toBeTruthy();
    await screen.findByText("Ventes aujourd'hui", { selector: "span" });
    expect(tuile("Ventes aujourd'hui").textContent).toContain("15");
    expect(espaces(tuile("Chiffre d'affaires").textContent)).toContain("1 300,5 $");
    expect(tuile("Réservations en attente").textContent).toContain("1");
    expect(tuile("Alertes stock").textContent).toContain("2");

    const liste = screen.getByRole("table", { name: "Résumé par boutique" });
    const lignes = within(liste).getAllByRole("row").slice(1);
    expect(within(lignes[0]!).getByText("1 en attente")).toBeTruthy();
    expect(within(lignes[0]!).getByText("2 alertes")).toBeTruthy();
    expect(within(lignes[1]!).getByText("OK")).toBeTruthy();
    expect(within(lignes[1]!).getByRole("link", { name: "Voir Boutique 2" }).getAttribute("href")).toBe(`/b/${BOUTIQUE_2}`);
    await sansViolation(container);
  });

  it("réservé au propriétaire : les autres retournent à leur accueil", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "gerant" }));
    const app = rendreApp("/tableau-de-bord");
    await waitFor(() => expect(app.adresse()).toBe(`/b/${BOUTIQUE_1}`));
  });
});

describe("consolidation siège", () => {
  it("totaux, groupes, régions et détail par boutique", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "directeur_groupe" }));
    api.repondre("GET", "/consolidation", 200, CONSOLIDATION);
    const { container } = rendreApp("/consolidation");
    expect(await screen.findByRole("heading", { level: 1, name: "Consolidation siège" })).toBeTruthy();
    await screen.findByText("Encours clients (crédit)", { selector: "span" });
    expect(espaces(tuile("Encours clients (crédit)").textContent)).toContain("300 $");
    expect(tuile("Commandes grossistes à valider").textContent).toContain("2");

    const groupes = screen.getByRole("table", { name: "Par groupe" });
    expect(within(groupes).getAllByRole("row")[1]!.textContent).toContain("Groupe Ouest");
    const regions = screen.getByRole("table", { name: "Par région" });
    expect(within(regions).getAllByRole("row")[2]!.textContent).toContain("Sans région");
    const detail = screen.getByRole("table", { name: "Détail par boutique" });
    const b2 = within(detail).getAllByRole("row")[2]!;
    expect(within(b2).getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(within(b2).getByRole("link", { name: "Ouvrir Boutique 2" }).getAttribute("href")).toBe(`/b/${BOUTIQUE_2}`);
    await sansViolation(container);
  });

  it("sans consolidation:voir, retour à l'accueil", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur" }));
    const app = rendreApp("/consolidation");
    await waitFor(() => expect(app.adresse()).toBe(`/b/${BOUTIQUE_1}`));
  });
});

describe("vue d'ensemble d'une boutique", () => {
  it("chiffres du jour, dernières ventes, réservations et alertes", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "gerant" }));
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/resume`, 200, RESUME_BOUTIQUE);
    const { container } = rendreApp(`/b/${BOUTIQUE_1}`);
    expect(await screen.findByRole("heading", { level: 1, name: "Boutique 1" })).toBeTruthy();
    expect(screen.getByText("Adresse boutique 1")).toBeTruthy();
    await screen.findByText("Dernières ventes");
    expect(tuile("Ventes aujourd'hui").textContent).toContain("12");
    expect(espaces(tuile("Chiffre d'affaires").textContent)).toContain("1 240,5 $");

    const ventes = screen.getByRole("region", { name: "Dernières ventes" });
    expect(within(ventes).getByText("V-0001")).toBeTruthy();
    expect(within(ventes).getByText(/Koffi Vendeur/)).toBeTruthy();
    expect(espaces(within(ventes).getByText(/44/).textContent)).toBe("44 $");
    const reservations = screen.getByRole("region", { name: "Réservations en attente" });
    expect(within(reservations).getByText(/Mme Ade — \+243 900 000 001/)).toBeTruthy();
    const alertes = screen.getByRole("table", { name: "Alertes stock" });
    expect(within(alertes).getByText("Rupture")).toBeTruthy();
    expect(within(alertes).getByText("Stock bas")).toBeTruthy();

    // Actions rapides vers les écrans du gérant.
    expect(screen.getByRole("link", { name: /Nouvelle vente/ }).getAttribute("href")).toBe(`/b/${BOUTIQUE_1}/ventes/nouvelle`);
    expect(screen.getByRole("link", { name: /Réception stock/ }).getAttribute("href")).toBe(`/b/${BOUTIQUE_1}/stock`);
    await sansViolation(container);
  });

  it("un gérant de stock n'a pas les raccourcis de vente ni de réservation", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "gerant_stock" }));
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/resume`, 200, { ...RESUME_BOUTIQUE, alertes_stock: [] });
    rendreApp(`/b/${BOUTIQUE_1}`);
    await screen.findByText("Dernières ventes");
    expect(screen.queryByRole("link", { name: /Nouvelle vente/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Réservations/ })).toBeNull();
    expect(screen.queryByRole("table", { name: "Alertes stock" })).toBeNull();
  });
});
