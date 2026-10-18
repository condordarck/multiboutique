import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, reservation } from "../../../test/donnees";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/reservations`;
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");
// La tuile vient avant les badges de même libellé (« En attente »).
const tuile = (libelle: string) => screen.getAllByText(libelle, { selector: "span" })[0]!.parentElement!;

function preparer(role: "gerant" | "comptable" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role, nom_complet: "Awa Gérante" }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/reservations`, 200, [
    reservation(),
    reservation({ id: "r2", reference_reservation: "R-0008", statut: "prete" }),
    reservation({ id: "r3", reference_reservation: "R-0009", statut: "retiree", lignes: [] }),
    reservation({ id: "r4", reference_reservation: "R-0010", statut: "annulee", lignes: [] }),
  ]);
}

const carte = (reference: string) => screen.getByRole("article", { name: reference });

describe("réservations", () => {
  it("indicateurs, réservations à traiter avec leurs articles, historique", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Réservations — Boutique 1" })).toBeTruthy();
    await screen.findByText("Prêtes", { selector: "span" });
    expect(tuile("En attente").textContent).toContain("2");
    expect(tuile("Prêtes").textContent).toContain("1");
    expect(tuile("Payées / Retirées").textContent).toContain("1");
    expect(tuile("Annulées").textContent).toContain("1");
    expect(espaces(within(carte("R-0007")).getByText("Sucre 1 kg × 4").nextSibling?.textContent)).toBe("8 $");
    expect(within(screen.getByRole("table", { name: "Historique des réservations" })).getAllByRole("row")).toHaveLength(5);
    await sansViolation(container);
  });

  it("confirme une réservation en attente, encaisse une réservation prête et imprime le reçu", async () => {
    preparer();
    api.repondre("POST", "/reservations/r1/confirmation", 200, { success: true });
    api.repondre("POST", "/reservations/r2/encaissement", 200, { success: true, reference: "VTE-77", montantTotal: 30 });
    rendreApp(PAGE);
    await screen.findByRole("article", { name: "R-0007" });
    expect(within(carte("R-0007")).queryByRole("button", { name: "Encaisser à la remise" })).toBeNull();
    await userEvent.click(within(carte("R-0007")).getByRole("button", { name: "Confirmer (prête)" }));

    await userEvent.click(within(carte("R-0008")).getByRole("button", { name: "Encaisser à la remise" }));
    await userEvent.click(within(carte("R-0008")).getByText("Mobile Money"));
    await userEvent.click(within(carte("R-0008")).getByRole("button", { name: "Encaisser" }));
    const recu = await screen.findByRole("region", { name: "Reçu VTE-77" });
    expect(within(recu).getByText("Réservation : R-0008")).toBeTruthy();
    expect(within(recu).getByText("Paiement : Mobile Money")).toBeTruthy();
    expect(api.ecritures().map((a) => [a.chemin, a.corps])).toEqual([
      ["/reservations/r1/confirmation", {}],
      ["/reservations/r2/encaissement", { mode_paiement: "mobile_money" }],
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Terminé" }));
    expect(screen.queryByRole("region", { name: "Reçu VTE-77" })).toBeNull();
  });

  it("annule avec un motif", async () => {
    preparer();
    api.repondre("POST", "/reservations/r1/annulation", 200, { success: true });
    rendreApp(PAGE);
    await userEvent.click(within(await screen.findByRole("article", { name: "R-0007" })).getByRole("button", { name: "Annuler la réservation" }));
    const dialogue = screen.getByRole("alertdialog", { name: "Annuler la réservation R-0007 ?" });
    await userEvent.type(within(dialogue).getByLabelText("Motif"), "Client injoignable");
    await userEvent.click(within(dialogue).getByRole("button", { name: "Confirmer l'annulation" }));
    await waitFor(() => expect(api.ecritures()[0]).toMatchObject({ chemin: "/reservations/r1/annulation", corps: { motif: "Client injoignable" } }));
  });

  it("sans reservations:gerer, aucune action", async () => {
    preparer("comptable");
    rendreApp(PAGE);
    const r = await screen.findByRole("article", { name: "R-0007" });
    expect(within(r).queryAllByRole("button")).toHaveLength(0);
  });
});
