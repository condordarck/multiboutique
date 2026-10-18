import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, CLIENTS_ACTIFS, PRODUITS } from "../../../test/donnees";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
const CAISSE = `/b/${BOUTIQUE_1}/ventes/nouvelle`;
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");

beforeEach(() => {
  api = fauxApi();
  connecte(api, utilisateur({ role: "vendeur", nom_complet: "Koffi Vendeur" }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/fiche`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, PRODUITS);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/clients?actifs=1`, 200, CLIENTS_ACTIFS);
});
afterEach(() => api.restaurer());

async function ajouter(nom: RegExp, fois = 1) {
  const bouton = await screen.findByRole("button", { name: nom });
  for (let i = 0; i < fois; i++) await userEvent.click(bouton);
}

describe("caisse", () => {
  it("vente au comptant : envoie le panier, puis montre le reçu avec la monnaie rendue", async () => {
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/ventes`, 201, { success: true, reference: "V-0042", montantTotal: 45.5, remise: 0, reste: 0 });
    rendreApp(CAISSE);
    await ajouter(/^Riz 25 kg/, 2);
    await ajouter(/^Sucre 1 kg/);
    expect(espaces(screen.getByTestId("total").textContent)).toBe("45,5 $");

    await userEvent.type(screen.getByLabelText("Montant reçu ($)"), "50");
    expect(espaces(screen.getByText(/^Rendu :/).textContent)).toBe("Rendu : 4,5 $");
    await userEvent.click(screen.getByRole("button", { name: /^Encaisser/ }));

    expect(api.ecritures()[0]).toMatchObject({
      chemin: `/boutiques/${BOUTIQUE_1}/ventes`,
      corps: {
        mode_paiement: "especes",
        lignes: [
          { produit_id: "p-riz", quantite: 2, prix_unitaire: 22 },
          { produit_id: "p-sucre", quantite: 1, prix_unitaire: 1.5 },
        ],
      },
    });
    expect(api.ecritures()[0]!.corps).not.toHaveProperty("client_id");
    const recu = await screen.findByRole("region", { name: "Reçu V-0042" });
    expect(within(recu).getByText("Koffi Vendeur", { exact: false })).toBeTruthy();
    expect(espaces(within(recu).getByText("Rendu").nextSibling?.textContent)).toBe("4,5 $");
    expect(screen.getByRole("button", { name: "Imprimer le reçu" })).toBeTruthy();
  });

  it("refuse un montant reçu insuffisant sans appeler l'API", async () => {
    rendreApp(CAISSE);
    await ajouter(/^Riz 25 kg/);
    await userEvent.type(screen.getByLabelText("Montant reçu ($)"), "10");
    await userEvent.click(screen.getByRole("button", { name: /^Encaisser/ }));
    expect(espaces((await screen.findByRole("alert")).textContent)).toBe("Montant reçu insuffisant (il manque 12 $)");
    expect(api.ecritures()).toEqual([]);
  });

  it("vente à crédit : client et montant payé, puis reste à devoir sur le reçu", async () => {
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/ventes`, 201, { success: true, reference: "V-0043", montantTotal: 22, remise: 0, reste: 12 });
    rendreApp(CAISSE);
    await ajouter(/^Riz 25 kg/);
    await userEvent.selectOptions(screen.getByLabelText("Client (facultatif)"), "c1");
    expect(screen.queryByLabelText("Montant reçu ($)")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^Encaisser/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Indiquez le montant payé par le client");

    await userEvent.type(screen.getByLabelText("Montant payé"), "10");
    await userEvent.click(screen.getByRole("button", { name: /^Encaisser/ }));
    await screen.findByRole("region", { name: "Reçu V-0043" });
    expect(api.ecritures()[0]!.corps).toMatchObject({ client_id: "c1", montant_paye: 10, mode_paiement: "especes" });
    expect(espaces(screen.getByText("Reste à devoir").nextSibling?.textContent)).toBe("12 $");
    expect(screen.getByText(/Client : Quincaillerie Ade/)).toBeTruthy();
  });

  it("code promo : envoyé en majuscules, sans exiger le montant reçu ; la remise figure au reçu", async () => {
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/ventes`, 201, { success: true, reference: "V-0044", montantTotal: 19.8, remise: 2.2, reste: 0 });
    rendreApp(CAISSE);
    await ajouter(/^Riz 25 kg/);
    await userEvent.click(screen.getByText("Mobile Money"));
    await userEvent.type(screen.getByLabelText("Code promo (optionnel)"), "promo10");
    await userEvent.click(screen.getByRole("button", { name: /^Encaisser/ }));
    await screen.findByRole("region", { name: "Reçu V-0044" });
    expect(api.ecritures()[0]!.corps).toMatchObject({ code_promo: "PROMO10", mode_paiement: "mobile_money" });
    expect(espaces(screen.getByText("Remise (PROMO10)").nextSibling?.textContent)).toBe("-2,2 $");
  });

  it("refus de l'API (stock insuffisant) : message affiché, panier intact", async () => {
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/ventes`, 409, { erreur: "Stock insuffisant pour Riz 25 kg" });
    rendreApp(CAISSE);
    await ajouter(/^Riz 25 kg/, 2);
    await userEvent.type(screen.getByLabelText("Montant reçu ($)"), "100");
    await userEvent.click(screen.getByRole("button", { name: /^Encaisser/ }));
    expect((await screen.findByRole("alert")).textContent).toBe("Stock insuffisant pour Riz 25 kg");
    expect(espaces(screen.getByTestId("total").textContent)).toBe("44 $");
    expect(screen.getByRole("group", { name: "Quantité de Riz 25 kg" }).textContent).toContain("2");
  });

  it("un produit sans disponible ne s'ajoute pas ; la quantité est plafonnée au disponible", async () => {
    rendreApp(CAISSE);
    expect((await screen.findByRole("button", { name: /^Huile de palme 5 L/ })).hasAttribute("disabled")).toBe(true);
    await ajouter(/^Riz 25 kg/);
    const quantite = screen.getByRole("group", { name: "Quantité de Riz 25 kg" });
    expect(within(quantite).getByRole("button", { name: "Ajouter un Riz 25 kg" }).hasAttribute("disabled")).toBe(false);
  });

  it("sans ventes:creer, pas de caisse", async () => {
    api.restaurer();
    api = fauxApi();
    connecte(api, utilisateur({ role: "comptable" }));
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, PRODUITS);
    rendreApp(CAISSE);
    expect(await screen.findByText("Encaissement non autorisé")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Riz 25 kg/ })).toBeNull();
  });

  it("sans violation d'accessibilité", async () => {
    const { container } = rendreApp(CAISSE);
    await ajouter(/^Riz 25 kg/);
    await waitFor(() => expect(screen.getByTestId("total")).toBeTruthy());
    await sansViolation(container);
  });
});
