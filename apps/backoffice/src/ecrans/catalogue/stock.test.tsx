import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, MOUVEMENTS, STOCK } from "../../../test/donnees";
import { BOUTIQUE_1, BOUTIQUE_2, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/stock`;
const tuile = (libelle: string) => screen.getByText(libelle, { selector: "span" }).parentElement!;

function preparer(role: "gerant" | "vendeur" | "proprietaire" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role, boutique_ids: role === "proprietaire" ? [] : [BOUTIQUE_1] }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/stock`, 200, STOCK);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/mouvements-stock`, 200, MOUVEMENTS);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/mouvements-stock?type=sortie`, 200, [MOUVEMENTS[1]]);
}

async function ouvrirFiche(nom: string) {
  // La liste existe deux fois dans le DOM (cartes et tableau, l'une masquée en CSS).
  const table = await screen.findByRole("table", { name: "État du stock" });
  await userEvent.click(within(table).getByRole("button", { name: `Gérer le stock de ${nom}` }));
  return screen.getByRole("dialog", { name: nom });
}

describe("stock", () => {
  it("résumé, état du stock et filtres", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Stock — Boutique 1" })).toBeTruthy();
    await screen.findByText("Ruptures", { selector: "span" });
    expect(tuile("Produits en stock").textContent).toContain("2");
    expect(tuile("Alertes stock").textContent).toContain("1");
    expect(tuile("Ruptures").textContent).toContain("1");

    const table = screen.getByRole("table", { name: "État du stock" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    await userEvent.click(screen.getByText(/^Rupture \(/));
    expect(within(screen.getByRole("table", { name: "État du stock" })).getAllByRole("row")).toHaveLength(2);
    await sansViolation(container);
  });

  it("historique des mouvements filtré par type, dans l'adresse", async () => {
    preparer();
    const app = rendreApp(PAGE);
    const mouvements = await screen.findByRole("table", { name: "Mouvements de stock" });
    expect(within(mouvements).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("2 mouvements")).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText("Type"), "sortie");
    await waitFor(() => expect(app.adresse()).toBe(`${PAGE}?type=sortie`));
    await waitFor(() => expect(screen.getByText("1 mouvement")).toBeTruthy());
  });

  it("entrée de stock depuis la fiche", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/stock/p-riz/entrees`, 200, { success: true });
    rendreApp(PAGE);
    const fiche = await ouvrirFiche("Riz 25 kg");
    await userEvent.type(within(fiche).getByLabelText("Quantité entrée"), "12");
    await userEvent.type(within(fiche).getByLabelText("Motif (optionnel)"), "Livraison grossiste");
    await userEvent.click(within(fiche).getByRole("button", { name: "Enregistrer l'entrée" }));
    await waitFor(() => expect(api.ecritures()[0]).toMatchObject({ corps: { quantite: 12, motif: "Livraison grossiste" } }));
  });

  it("ajustement : nouvelle quantité totale, motif facultatif", async () => {
    preparer();
    api.repondre("PUT", `/boutiques/${BOUTIQUE_1}/stock/p-riz`, 200, { success: true });
    rendreApp(PAGE);
    const fiche = await ouvrirFiche("Riz 25 kg");
    await userEvent.click(within(fiche).getByText("Ajuster"));
    await userEvent.type(within(fiche).getByLabelText("Nouvelle quantité (total)"), "15");
    await userEvent.click(within(fiche).getByRole("button", { name: "Enregistrer l'ajustement" }));
    await waitFor(() => expect(api.ecritures()[0]).toMatchObject({ methode: "PUT", corps: { quantite: 15, motif: "" } }));
  });

  it("transfert vers une autre boutique du périmètre, jamais vers la boutique courante", async () => {
    preparer("proprietaire");
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/transferts`, 200, { success: true });
    rendreApp(PAGE);
    const fiche = await ouvrirFiche("Riz 25 kg");
    await userEvent.click(within(fiche).getByText("Transférer"));
    const destination = within(fiche).getByLabelText("Boutique de destination");
    expect(within(destination).queryByRole("option", { name: "Boutique 1" })).toBeNull();
    await userEvent.selectOptions(destination, BOUTIQUE_2);
    await userEvent.type(within(fiche).getByLabelText("Quantité à transférer"), "5");
    await userEvent.click(within(fiche).getByRole("button", { name: "Transférer le stock" }));
    await waitFor(() =>
      expect(api.ecritures()[0]!.corps).toEqual({ boutique_destination_id: BOUTIQUE_2, produit_id: "p-riz", quantite: 5, motif: "" })
    );
  });

  it("sans stock:gerer, consultation seule", async () => {
    preparer("vendeur");
    rendreApp(PAGE);
    await screen.findByRole("table", { name: "État du stock" });
    expect(screen.queryByRole("button", { name: /Gérer le stock/ })).toBeNull();
  });
});
