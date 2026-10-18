import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "../../../test/axe";
import { BOUTIQUE_DETAIL, CLIENTS_ACTIFS, commande, PRODUITS } from "../../../test/donnees";
import { fauxApi, type FauxApi } from "../../../test/faux-api";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/commandes`;
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");

function preparer(role: "gerant" | "comptable" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/commandes`, 200, [
    commande(),
    commande({ id: "cmd2", reference_commande: "CMD-0002", statut: "confirmee", remise: 0, montant_total: 440, code_promo: null, terme_paiement: "comptant" }),
    commande({ id: "cmd3", reference_commande: "CMD-0003", statut: "livree" }),
  ]);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/clients?actifs=1`, 200, CLIENTS_ACTIFS);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, PRODUITS);
}

const tableau = () => screen.findByRole("table", { name: "Commandes en cours" });

describe("commandes B2B", () => {
  it("liste : montants, remise, paiement, statut", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Commandes B2B — Boutique 1" })).toBeTruthy();
    const [c1, c2, c3] = within(await tableau()).getAllByRole("row").slice(1);
    expect(espaces(c1!.textContent)).toContain("−44 $");
    expect(c1!.textContent).toContain("À crédit");
    expect(c1!.textContent).toContain("GROSSISTE10");
    expect(c1!.textContent).toContain("2 articles");
    expect(within(c2!).getByText("Confirmée")).toBeTruthy();
    expect(within(c3!).getByText("Livrée")).toBeTruthy();
    await sansViolation(container);
  });

  it("actions selon le statut : confirmer, livrer (confirmé), annuler", async () => {
    preparer();
    api.repondre("POST", "/commandes/cmd1/confirmation", 200, { success: true });
    api.repondre("POST", "/commandes/cmd2/livraison", 200, { success: true });
    rendreApp(PAGE);
    const [c1, c2, c3] = within(await tableau()).getAllByRole("row").slice(1);
    expect(within(c1!).queryByRole("button", { name: /^Livrer/ })).toBeNull();
    expect(within(c2!).queryByRole("button", { name: /^Confirmer/ })).toBeNull();
    expect(within(c3!).queryAllByRole("button")).toHaveLength(0);

    await userEvent.click(within(c1!).getByRole("button", { name: "Confirmer CMD-0001" }));
    await userEvent.click(within(c2!).getByRole("button", { name: "Livrer CMD-0002" }));
    const dialogue = screen.getByRole("alertdialog", { name: "Livrer CMD-0002 ?" });
    expect(within(dialogue).getByText("Le stock sera déduit de la boutique.")).toBeTruthy();
    await userEvent.click(within(dialogue).getByRole("button", { name: "Livrer" }));
    await waitFor(() =>
      expect(api.ecritures().map((a) => a.chemin)).toEqual(["/commandes/cmd1/confirmation", "/commandes/cmd2/livraison"])
    );
  });

  it("crée une commande : client, terme, lignes au prix officiel modifiable", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/commandes`, 201, { success: true, reference: "CMD-0009", montantTotal: 64, remise: 0 });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouvelle commande grossiste" }));
    const panneau = screen.getByRole("dialog", { name: "Nouvelle commande grossiste" });
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer la commande" }));
    expect(within(panneau).getByRole("alert").textContent).toBe("Choisissez un client");

    await userEvent.selectOptions(within(panneau).getByLabelText("Client"), "c1");
    await userEvent.click(within(panneau).getByText("À crédit (encours)"));
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer la commande" }));
    expect(within(panneau).getByRole("alert").textContent).toBe("Ajoutez au moins une ligne avec un produit");

    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter un article" }));
    await userEvent.selectOptions(within(panneau).getByLabelText("Produit de l'article 1"), "p-riz");
    expect((within(panneau).getByLabelText("Prix unitaire de l'article 1") as HTMLInputElement).value).toBe("22");
    const qte = within(panneau).getByLabelText("Quantité de l'article 1");
    await userEvent.clear(qte);
    await userEvent.type(qte, "3");
    expect(espaces(within(panneau).getByText(/^Total brut/).textContent)).toBe("Total brut : 66 $");
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer la commande" }));
    await waitFor(() =>
      expect(api.ecritures()[0]!.corps).toEqual({
        client_id: "c1",
        terme_paiement: "credit",
        lignes: [{ produit_id: "p-riz", quantite: 3, prix_unitaire: 22 }],
      })
    );
  });

  it("sans commandes:gerer, lecture seule", async () => {
    preparer("comptable");
    rendreApp(PAGE);
    expect(within(await tableau()).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Nouvelle commande grossiste" })).toBeNull();
  });
});
