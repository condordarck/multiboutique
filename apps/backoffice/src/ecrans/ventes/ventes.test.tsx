import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, DETAIL_VENTE, RESUME_BOUTIQUE } from "../../../test/donnees";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");
const tuile = (libelle: string) => screen.getByText(libelle, { selector: "span" }).parentElement!;

function preparer(role: "gerant" | "comptable" | "vendeur" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/ventes`, 200, [
    ...RESUME_BOUTIQUE.dernieres_ventes,
    { ...RESUME_BOUTIQUE.dernieres_ventes[0]!, id: "v2", reference_vente: "V-0002", statut: "annulee", mode_paiement: "mobile_money" },
  ]);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/ventes/statistiques`, 200, { ventes_jour: 3, ca_jour: 120, ventes_mois: 40, ca_mois: 1980.5 });
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/ventes/v1`, 200, DETAIL_VENTE);
}

describe("liste des ventes", () => {
  it("statistiques, historique et lien vers le reçu", async () => {
    preparer();
    const { container } = rendreApp(`/b/${BOUTIQUE_1}/ventes`);
    expect(await screen.findByRole("heading", { level: 1, name: "Ventes — Boutique 1" })).toBeTruthy();
    await screen.findByText("Ventes du mois", { selector: "span" });
    expect(tuile("Ventes aujourd'hui").textContent).toContain("3");
    expect(espaces(tuile("CA du mois").textContent)).toContain("1 980,5 $");

    const table = await screen.findByRole("table", { name: "Historique des ventes" });
    const lignes = within(table).getAllByRole("row").slice(1);
    expect(within(lignes[0]!).getByText("Validée")).toBeTruthy();
    expect(within(lignes[1]!).getByText("Annulée")).toBeTruthy();
    expect(within(lignes[1]!).getByText("Mobile Money")).toBeTruthy();
    expect(within(lignes[0]!).getByRole("link", { name: "Reçu de V-0001" }).getAttribute("href")).toBe(`/b/${BOUTIQUE_1}/ventes/v1`);
    expect(screen.getByRole("link", { name: "Nouvelle vente" }).getAttribute("href")).toBe(`/b/${BOUTIQUE_1}/ventes/nouvelle`);
    await sansViolation(container);
  });

  it("sans ventes:creer, pas de bouton « Nouvelle vente »", async () => {
    preparer("comptable");
    rendreApp(`/b/${BOUTIQUE_1}/ventes`);
    await screen.findByRole("table", { name: "Historique des ventes" });
    expect(screen.queryByRole("link", { name: "Nouvelle vente" })).toBeNull();
  });
});

describe("reçu d'une vente", () => {
  it("affiche le reçu et annule avec un motif", async () => {
    preparer();
    api.repondre("POST", "/ventes/v1/annulation", 200, { success: true, boutique_id: BOUTIQUE_1 });
    const { container } = rendreApp(`/b/${BOUTIQUE_1}/ventes/v1`);
    const recu = await screen.findByRole("region", { name: "Reçu V-0001" });
    expect(within(recu).getByText("Riz 25 kg")).toBeTruthy();
    expect(within(recu).getByText("CER-0001")).toBeTruthy();
    expect(espaces(within(recu).getByText("TOTAL").nextSibling?.textContent)).toBe("44 $");
    await sansViolation(container);

    await userEvent.click(screen.getByRole("button", { name: "Annuler la vente" }));
    const dialogue = screen.getByRole("alertdialog", { name: "Annuler la vente V-0001 ?" });
    await userEvent.click(within(dialogue).getByRole("button", { name: "Confirmer l'annulation" }));
    expect(within(dialogue).getByText("Un motif d'annulation est requis")).toBeTruthy();
    expect(api.ecritures()).toEqual([]);

    await userEvent.type(within(dialogue).getByLabelText("Motif"), "Erreur de saisie");
    await userEvent.click(within(dialogue).getByRole("button", { name: "Confirmer l'annulation" }));
    await waitFor(() => expect(api.ecritures()[0]).toMatchObject({ chemin: "/ventes/v1/annulation", corps: { motif: "Erreur de saisie" } }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("une vente annulée l'annonce, et ne propose plus l'annulation", async () => {
    preparer();
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/ventes/v1`, 200, {
      ...DETAIL_VENTE,
      vente: { ...DETAIL_VENTE.vente, statut: "annulee", motif_annulation: "Erreur de saisie" },
    });
    rendreApp(`/b/${BOUTIQUE_1}/ventes/v1`);
    expect(await screen.findByText("VENTE ANNULÉE — Erreur de saisie")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Annuler la vente" })).toBeNull();
  });

  it("sans ventes:annuler, pas de bouton d'annulation", async () => {
    preparer("vendeur");
    rendreApp(`/b/${BOUTIQUE_1}/ventes/v1`);
    await screen.findByRole("region", { name: "Reçu V-0001" });
    expect(screen.queryByRole("button", { name: "Annuler la vente" })).toBeNull();
  });
});
