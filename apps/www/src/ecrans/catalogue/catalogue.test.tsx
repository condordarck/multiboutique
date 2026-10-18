import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { sansViolation } from "@multiboutique/front/test/axe";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE } from "../../../test/donnees";
import { BOUTIQUE_1, client, connecte, rendreApp, visiteur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => {
  api.restaurer();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
const PAGE = `/boutiques/${BOUTIQUE_1}`;
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");

function preparer(qui: "visiteur" | "client" = "visiteur") {
  api = fauxApi();
  if (qui === "client") connecte(api, client());
  else visiteur(api);
  api.repondre("GET", `/public/boutiques/${BOUTIQUE_1}/catalogue`, 200, CATALOGUE);
}

const grille = () => screen.findByRole("list", { name: "Articles" });
const nomsAffiches = async () =>
  within(await grille())
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);
const panier = () => screen.getByRole("region", { name: /^Réservation/ });

async function ajouter(nom: string) {
  await userEvent.click(within(await grille()).getByRole("button", { name: `Réserver ${nom}` }));
}

async function remplir(nom = "Mme Ade", telephone = "+243 900 000 001") {
  if (nom) await userEvent.type(within(panier()).getByLabelText("Nom complet"), nom);
  if (telephone) await userEvent.type(within(panier()).getByLabelText("Téléphone"), telephone);
}

describe("catalogue", () => {
  it("fil d'Ariane, catégories non vides avec leur nombre, filtre", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Boutique 1" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Fil d'Ariane" }).textContent).toContain("Boutiques");
    const categories = screen.getByRole("radiogroup", { name: "Catégorie" });
    expect(within(categories).queryByText(/Boissons/)).toBeNull();
    expect(within(categories).getByText("Épicerie (2)")).toBeTruthy();
    await userEvent.click(within(categories).getByText("Huiles (1)"));
    expect(await nomsAffiches()).toEqual(["Huile d'arachide 1 L"]);
    expect(screen.getByText("1 article")).toBeTruthy();
    await sansViolation(container);
  });

  it("recherche sans accents ni casse, et tri", async () => {
    preparer();
    rendreApp(PAGE);
    await grille();
    await userEvent.type(screen.getByLabelText("Rechercher un article"), "epicerie");
    expect(await nomsAffiches()).toEqual(["Riz 25 kg", "Sucre 1 kg"]);
    expect(screen.getByText(/2 articles pour « epicerie »/)).toBeTruthy();
    await userEvent.clear(screen.getByLabelText("Rechercher un article"));
    await userEvent.selectOptions(screen.getByLabelText("Trier les articles"), "prix_desc");
    expect(await nomsAffiches()).toEqual(["Riz 25 kg", "Huile d'arachide 1 L", "Sucre 1 kg"]);
    await userEvent.selectOptions(screen.getByLabelText("Trier les articles"), "dispo_desc");
    expect(await nomsAffiches()).toEqual(["Riz 25 kg", "Huile d'arachide 1 L", "Sucre 1 kg"]);
    await userEvent.selectOptions(screen.getByLabelText("Trier les articles"), "prix_asc");
    expect(await nomsAffiches()).toEqual(["Sucre 1 kg", "Huile d'arachide 1 L", "Riz 25 kg"]);
  });

  it("?reserve= ajoute le produit, ?categorie= présélectionne la catégorie", async () => {
    preparer();
    rendreApp(`${PAGE}?reserve=p-suc-1&categorie=cat-hui`);
    expect(await nomsAffiches()).toEqual(["Huile d'arachide 1 L"]);
    expect(within(panier()).getByText("Sucre 1 kg")).toBeTruthy();
  });

  it("la quantité est plafonnée au disponible ; à zéro, l'article sort du panier", async () => {
    preparer();
    rendreApp(PAGE);
    await ajouter("Sucre 1 kg");
    const quantite = within(panier()).getByRole("group", { name: "Quantité de Sucre 1 kg" });
    await userEvent.click(within(quantite).getByRole("button", { name: "Ajouter un Sucre 1 kg" }));
    await userEvent.click(within(quantite).getByRole("button", { name: "Ajouter un Sucre 1 kg" }));
    expect(within(quantite).getByRole("button", { name: "Ajouter un Sucre 1 kg" }).hasAttribute("disabled")).toBe(true);
    expect(espaces(within(panier()).getByTestId("total").textContent)).toBe("4,5 $");
    for (let i = 0; i < 3; i++) await userEvent.click(within(quantite).getByRole("button", { name: "Retirer un Sucre 1 kg" }));
    expect(within(panier()).getByText("Votre panier est vide.")).toBeTruthy();
  });

  it("nom et téléphone exigés avant l'appel ; réservation envoyée, panier vidé, page de la réservation", async () => {
    preparer();
    api.repondre("POST", "/reservations", 201, { success: true, reference: "RES-1", reservationId: "r-9" });
    const app = rendreApp(PAGE);
    await ajouter("Riz 25 kg");
    await ajouter("Sucre 1 kg");
    await userEvent.click(within(panier()).getByRole("button", { name: /^Confirmer/ }));
    expect(within(panier()).getByRole("alert").textContent).toBe("Le nom et le téléphone sont requis");
    expect(api.ecritures()).toEqual([]);

    await remplir();
    await userEvent.type(within(panier()).getByLabelText("Date de retrait prévue (optionnel)"), "2026-10-25");
    await userEvent.click(within(panier()).getByRole("button", { name: /^Confirmer/ }));
    await waitFor(() => expect(app.adresse()).toBe("/reservations/r-9"));
    expect(api.ecritures()[0]!.corps).toEqual({
      client_nom: "Mme Ade",
      client_telephone: "+243 900 000 001",
      boutique_id: BOUTIQUE_1,
      date_retrait_prevue: "2026-10-25",
      lignes: [
        { produit_id: "p-riz-25", quantite: 1 },
        { produit_id: "p-suc-1", quantite: 1 },
      ],
    });
    expect(sessionStorage.getItem(`mb-panier-${BOUTIQUE_1}`)).toBeNull();
  });

  it("?reserve= ne remet pas au panier un article retiré quand le catalogue est relu", async () => {
    preparer();
    const app = rendreApp(`${PAGE}?reserve=p-suc-1`);
    await grille();
    await userEvent.click(within(panier()).getByRole("button", { name: "Vider" }));
    // Une vente ailleurs change le stock : le catalogue relu est différent.
    api.repondre("GET", `/public/boutiques/${BOUTIQUE_1}/catalogue`, 200, {
      ...CATALOGUE,
      produits: CATALOGUE.produits.map((p) => ({ ...p, disponible: p.disponible - 1 })),
    });
    await app.client.invalidateQueries();
    // Le catalogue relu est affiché (Riz : 40 → 39 disponibles)…
    expect(await within(await grille()).findByText("39 disponibles")).toBeTruthy();
    // …et l'article retiré n'est pas revenu.
    expect(within(panier()).getByText("Votre panier est vide.")).toBeTruthy();
  });

  it("un panier restauré suit le catalogue : prix et disponible à jour, article disparu retiré", async () => {
    preparer();
    sessionStorage.setItem(
      `mb-panier-${BOUTIQUE_1}`,
      JSON.stringify([
        { produit_id: "p-riz-25", produit_nom: "Riz 25 kg", quantite: 50, disponible: 99, prix_vente: 10 },
        { produit_id: "p-disparu", produit_nom: "Disparu", quantite: 1, disponible: 5, prix_vente: 1 },
        { pas: "une ligne" },
      ])
    );
    rendreApp(PAGE);
    await grille();
    expect(within(panier()).queryByText("Disparu")).toBeNull();
    // 40 disponibles à 22 $ : quantité ramenée à 40, prix du catalogue.
    expect(within(panier()).getByRole("group", { name: "Quantité de Riz 25 kg" }).textContent).toContain("40");
    expect(espaces(within(panier()).getByTestId("total").textContent)).toBe("880 $");
  });

  it("le panier survit à un rechargement", async () => {
    preparer();
    let app = rendreApp(PAGE);
    await ajouter("Riz 25 kg");
    app.unmount();
    app = rendreApp(PAGE);
    await grille();
    expect(within(panier()).getByText("Riz 25 kg")).toBeTruthy();
  });

  it("un refus de l'API (stock, limite de réservations) s'affiche ; le panier reste", async () => {
    preparer();
    api.repondre("POST", "/reservations", 409, { erreur: "Stock insuffisant pour Riz 25 kg" });
    rendreApp(PAGE);
    await ajouter("Riz 25 kg");
    await remplir();
    await userEvent.click(within(panier()).getByRole("button", { name: /^Confirmer/ }));
    expect((await within(panier()).findByRole("alert")).textContent).toBe("Stock insuffisant pour Riz 25 kg");
    expect(within(panier()).getByText("Riz 25 kg")).toBeTruthy();

    api.repondre("POST", "/reservations", 429, { erreur: "Trop de réservations depuis cette adresse. Réessayez plus tard." });
    await userEvent.click(within(panier()).getByRole("button", { name: /^Confirmer/ }));
    await waitFor(() => expect(within(panier()).getByRole("alert").textContent).toBe("Trop de réservations depuis cette adresse. Réessayez plus tard."));
  });

  it("un client connecté a son nom et son e-mail pré-remplis", async () => {
    preparer("client");
    rendreApp(PAGE);
    await ajouter("Riz 25 kg");
    await waitFor(() => expect((within(panier()).getByLabelText("Nom complet") as HTMLInputElement).value).toBe("Mme Ade"));
    expect((within(panier()).getByLabelText("E-mail (optionnel)") as HTMLInputElement).value).toBe("ade@exemple.org");
  });

  it("hors ligne, la réservation est impossible", async () => {
    preparer();
    rendreApp(PAGE);
    await ajouter("Riz 25 kg");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
    await waitFor(() => expect(within(panier()).getByRole("button", { name: /^Confirmer/ }).hasAttribute("disabled")).toBe(true));
  });
});
