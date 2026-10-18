import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "../../../test/axe";
import { BOUTIQUE_DETAIL, PRODUITS } from "../../../test/donnees";
import { fauxApi, type FauxApi } from "../../../test/faux-api";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");
const PAGE = `/b/${BOUTIQUE_1}/produits`;

function preparer(role: "gerant" | "vendeur" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  // Comme l'API : pas de coût de revient sans prix:gerer.
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, role === "vendeur" ? PRODUITS.map(({ cout_revient: _c, ...p }) => p) : PRODUITS);
  api.repondre("GET", "/categories", 200, [{ id: "cat-1", nom: "Céréales", code: "CER" }]);
}

describe("produits", () => {
  it("catalogue avec prix, coût, marge et disponible", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Produits — Boutique 1" })).toBeTruthy();
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    const riz = within(table).getAllByRole("row")[1]!;
    expect(espaces(riz.textContent)).toContain("22 $");
    expect(espaces(riz.textContent)).toContain("18 $");
    expect(riz.textContent).toContain("22.2%");
    expect(within(table).getAllByRole("row")[3]!.textContent).toContain("0");
    await sansViolation(container);
  });

  it("un vendeur ne voit ni coût ni marge, ni création, ni modification de prix", async () => {
    preparer("vendeur");
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    const entetes = within(table).getAllByRole("columnheader").map((c) => c.textContent);
    expect(entetes).not.toContain("Coût revient");
    expect(entetes).not.toContain("Marge");
    expect(screen.queryByRole("button", { name: "Nouveau produit" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Modifier le prix/ })).toBeNull();
  });

  it("crée un produit avec photo et stock initial", async () => {
    preparer();
    api.repondre("POST", "/uploads", 200, { url: "/uploads/produits/abc.png" });
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/produits`, 201, { success: true, produitId: "p-neuf" });
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/stock/p-neuf/entrees`, 200, { success: true });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouveau produit" }));
    const panneau = screen.getByRole("dialog", { name: "Nouveau produit" });
    await userEvent.type(within(panneau).getByLabelText("Nom du produit"), "Farine de blé 1 kg");
    await userEvent.selectOptions(within(panneau).getByLabelText("Catégorie (rayon)"), "cat-1");
    await userEvent.type(within(panneau).getByLabelText("Prix de vente"), "1,6");
    await userEvent.type(within(panneau).getByLabelText("Coût de revient"), "1.2");
    await userEvent.type(within(panneau).getByLabelText("Quantité initiale en stock"), "40");
    await userEvent.upload(within(panneau).getByLabelText("Photo du produit"), new File(["x"], "farine.png", { type: "image/png" }));
    expect((await within(panneau).findByRole("img", { name: "Aperçu du produit" })).getAttribute("src")).toBe(
      "https://api.test/uploads/produits/abc.png"
    );
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter le produit" }));

    await waitFor(() => expect(api.ecritures().map((a) => a.chemin)).toEqual([
      "/uploads",
      `/boutiques/${BOUTIQUE_1}/produits`,
      `/boutiques/${BOUTIQUE_1}/stock/p-neuf/entrees`,
    ]));
    expect(api.ecritures()[1]!.corps).toEqual({
      produit: { nom: "Farine de blé 1 kg", reference: "FARINE-DE-BLÉ-1-KG", categorie_id: "cat-1", image_url: "/uploads/produits/abc.png" },
      prix_vente: 1.6,
      cout_revient: 1.2,
    });
    expect(api.ecritures()[2]!.corps).toEqual({ quantite: 40, motif: "Stock initial" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("refuse un prix nul sans appeler l'API, et affiche les erreurs de l'API", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/produits`, 400, { erreur: "Ce code produit existe déjà" });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouveau produit" }));
    const panneau = screen.getByRole("dialog", { name: "Nouveau produit" });
    await userEvent.type(within(panneau).getByLabelText("Nom du produit"), "Sel");
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter le produit" }));
    expect(within(panneau).getByText("Le prix de vente doit être un nombre positif")).toBeTruthy();
    expect(api.ecritures()).toEqual([]);

    await userEvent.type(within(panneau).getByLabelText("Prix de vente"), "1");
    await userEvent.type(within(panneau).getByLabelText(/Code produit/), "riz-1");
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter le produit" }));
    expect((await within(panneau).findByRole("alert")).textContent).toBe("Ce code produit existe déjà");
  });

  it("modifie le prix et le coût de revient", async () => {
    preparer();
    api.repondre("PUT", `/boutiques/${BOUTIQUE_1}/prix/p-riz`, 200, { success: true });
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    await userEvent.click(within(table).getByRole("button", { name: "Modifier le prix de Riz 25 kg" }));
    const panneau = screen.getByRole("dialog", { name: "Prix de Riz 25 kg" });
    const prix = within(panneau).getByLabelText("Prix de vente");
    await userEvent.clear(prix);
    await userEvent.type(prix, "24");
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.ecritures()[0]).toMatchObject({ methode: "PUT", corps: { prix_vente: 24, cout_revient: 18 } }));
  });
});
