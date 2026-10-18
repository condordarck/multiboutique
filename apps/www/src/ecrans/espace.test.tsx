import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { sansViolation } from "@multiboutique/front/test/axe";
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { connecte, rendreApp } from "../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");

function reservation(id: string, statut: string, surcharge = {}) {
  return {
    id,
    reference_reservation: `RES-${id}`,
    boutique_nom: "Boutique 1",
    statut,
    montant_total: 23.5,
    nombre_articles: 3,
    created_at: "2026-10-18T09:00:00Z",
    date_retrait_prevue: null,
    ...surcharge,
  };
}

describe("espace client", () => {
  it("salue, compte les réservations en attente et les liste, chacune vers son suivi", async () => {
    api = fauxApi();
    connecte(api);
    api.repondre("GET", "/me/reservations", 200, [reservation("1", "en_attente"), reservation("2", "en_attente"), reservation("3", "retiree")]);
    const { container } = rendreApp("/espace");
    expect(await screen.findByRole("heading", { level: 1, name: "Bonjour Mme Ade" })).toBeTruthy();
    expect(await screen.findByText("Vous avez 2 réservations en attente de retrait.")).toBeTruthy();
    const table = screen.getByRole("table", { name: "Mes réservations" });
    const lignes = within(table).getAllByRole("row").slice(1);
    expect(lignes).toHaveLength(3);
    expect(espaces(lignes[0]!.textContent)).toContain("23,5 $");
    expect(within(lignes[0]!).getByText("En attente")).toBeTruthy();
    expect(within(lignes[2]!).getByText("Retirée")).toBeTruthy();
    expect(within(lignes[0]!).getByRole("link", { name: "Suivre RES-1" }).getAttribute("href")).toBe("/reservations/1");
    expect(screen.getByRole("link", { name: "Voir les boutiques" }).getAttribute("href")).toBe("/");
    await sansViolation(container);
  });

  it("sans réservation, le dit et propose de réserver", async () => {
    api = fauxApi();
    connecte(api);
    api.repondre("GET", "/me/reservations", 200, []);
    rendreApp("/espace");
    expect(await screen.findByText("Aucune réservation pour le moment")).toBeTruthy();
    expect(screen.queryByText(/en attente de retrait/)).toBeNull();
  });
});
