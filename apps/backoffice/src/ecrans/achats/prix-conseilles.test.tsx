import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "../../../test/axe";
import { BOUTIQUE_DETAIL } from "../../../test/donnees";
import { fauxApi, type FauxApi } from "../../../test/faux-api";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/prix-conseilles`;

const GRILLE = {
  prix: [
    { produit_id: "p-riz", produit_nom: "Riz 25 kg", prix_vente: 23, cout_revient: 18, actif: true, applique: true, created_by: null, created_at: "", updated_at: "" },
    { produit_id: "p-sel", produit_nom: "Sel 1 kg", prix_vente: 0.8, cout_revient: null, actif: true, applique: false, created_by: null, created_at: "", updated_at: "" },
  ],
  produits: [
    { produit_id: "p-riz", nom: "Riz 25 kg", prix_vente: 22 },
    { produit_id: "p-sel", nom: "Sel 1 kg", prix_vente: null },
  ],
};

function preparer(role: "proprietaire" | "gerant" | "comptable") {
  api = fauxApi();
  connecte(api, utilisateur({ role, boutique_ids: role === "proprietaire" ? [] : [BOUTIQUE_1] }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/prix-conseilles`, 200, GRILLE);
}

describe("prix conseillés", () => {
  it("grille publiée et application par la boutique (tout ou une ligne)", async () => {
    preparer("gerant");
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/prix-conseilles/application`, 200, { success: true, appliques: 1 });
    const { container } = rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Grille publiée" });
    const [riz, sel] = within(table).getAllByRole("row").slice(1);
    expect(within(riz!).getByText("Appliqué")).toBeTruthy();
    expect(within(sel!).getByText("Non appliqué")).toBeTruthy();
    // Un gérant applique, il ne publie pas (prix_conseilles:gerer est réservé au siège).
    expect(screen.queryByRole("button", { name: "Publier un prix conseillé" })).toBeNull();
    await sansViolation(container);

    await userEvent.click(within(sel!).getByRole("button", { name: "Appliquer Sel 1 kg ici" }));
    await userEvent.click(screen.getByRole("button", { name: "Appliquer toute la grille ici" }));
    await waitFor(() => expect(api.ecritures().map((a) => a.corps)).toEqual([{ produit_ids: ["p-sel"] }, {}]));
    expect(await screen.findByText("1 prix appliqué")).toBeTruthy();
  });

  it("le propriétaire publie un prix, proposé au prix actuel de la boutique", async () => {
    preparer("proprietaire");
    api.repondre("POST", "/prix-reference", 200, { success: true });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Publier un prix conseillé" }));
    const panneau = screen.getByRole("dialog", { name: "Publier un prix conseillé" });
    await userEvent.selectOptions(within(panneau).getByLabelText("Produit"), "p-riz");
    expect((within(panneau).getByLabelText("Prix de vente conseillé") as HTMLInputElement).value).toBe("22");
    await userEvent.click(within(panneau).getByRole("button", { name: "Publier" }));
    await waitFor(() => expect(api.ecritures()[0]!.corps).toEqual({ produit_id: "p-riz", prix_vente: 22, cout_revient: null, actif: true }));
  });

  it("sans prix:gerer, la grille est en lecture seule", async () => {
    preparer("comptable");
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Grille publiée" });
    expect(within(table).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText(/La grille est en lecture seule/)).toBeTruthy();
  });
});
