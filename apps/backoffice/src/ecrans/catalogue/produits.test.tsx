import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, produit, PRODUITS } from "../../../test/donnees";
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
  api.repondre("GET", "/types-frais", 200, TYPES_FRAIS);
}

const TYPES_FRAIS = [
  { id: "tf-douane", libelle: "Douane", actif: true },
  { id: "tf-transport", libelle: "Transport", actif: true },
  { id: "tf-ancien", libelle: "Octroi", actif: false },
];
const ligneCout = (panneau: HTMLElement, terme: string) => espaces(within(panneau).getByText(terme, { selector: "dt" }).nextElementSibling?.textContent);

describe("produits", () => {
  it("catalogue avec prix, coût, marge et disponible", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Produits — Boutique 1" })).toBeTruthy();
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    const riz = within(table).getAllByRole("row")[1]!;
    expect(espaces(riz.textContent)).toContain("22 $");
    expect(espaces(riz.textContent)).toContain("18 $");
    expect(espaces(riz.textContent)).toContain("22,2 %");
    expect(within(table).getAllByRole("columnheader").map((c) => c.textContent)).toContain("Bénéfice");
    expect(espaces(riz.textContent)).toContain("4 $");
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
    expect(screen.queryByRole("button", { name: /Modifier/ })).toBeNull();
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
    await userEvent.type(within(panneau).getByLabelText("Prix de vente"), "2000");
    await userEvent.type(within(panneau).getByLabelText("Prix d'achat (par unité)"), "1000");
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter un frais" }));
    await userEvent.selectOptions(within(panneau).getByLabelText("Frais n°1"), "tf-transport");
    await userEvent.type(within(panneau).getByLabelText("Montant du frais n°1"), "150");
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter un frais" }));
    // Seuls les types actifs et pas encore choisis sont proposés.
    const choix = within(within(panneau).getByLabelText("Frais n°2")).getAllByRole("option").map((o) => o.textContent);
    expect(choix).toEqual(["Choisir…", "Douane"]);
    await userEvent.selectOptions(within(panneau).getByLabelText("Calcul du frais n°2"), "pourcentage");
    await userEvent.type(within(panneau).getByLabelText("Taux du frais n°2 (%)"), "20");
    expect(ligneCout(panneau, "Coût de revient")).toBe("1 350 $");
    expect(ligneCout(panneau, "Bénéfice par unité")).toBe("650 $");
    expect(ligneCout(panneau, "Marge (sur le coût)")).toBe("48,1 %");
    expect(within(panneau).getByRole("button", { name: "Ajouter un frais" }).hasAttribute("disabled")).toBe(true);
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
      prix_vente: 2000,
      detail_cout: {
        prix_achat: 1000,
        frais: [
          { type_frais_id: "tf-transport", mode: "montant", valeur: 150 },
          { type_frais_id: "tf-douane", mode: "pourcentage", valeur: 20 },
        ],
      },
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

  it("refuse une quantité initiale décimale avant de créer quoi que ce soit", async () => {
    preparer();
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouveau produit" }));
    const panneau = screen.getByRole("dialog", { name: "Nouveau produit" });
    await userEvent.type(within(panneau).getByLabelText("Nom du produit"), "Sel");
    await userEvent.type(within(panneau).getByLabelText("Prix de vente"), "1");
    await userEvent.type(within(panneau).getByLabelText("Quantité initiale en stock"), "2,5");
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter le produit" }));
    expect(within(panneau).getByRole("alert").textContent).toBe("La quantité initiale doit être un nombre entier");
    expect(api.ecritures()).toEqual([]);
  });

  it("si l'entrée de stock initiale échoue, le dit et rafraîchit la liste (le produit existe)", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/produits`, 201, { success: true, produitId: "p-neuf" });
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/stock/p-neuf/entrees`, 404, { erreur: "Stock introuvable" });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouveau produit" }));
    const panneau = screen.getByRole("dialog", { name: "Nouveau produit" });
    await userEvent.type(within(panneau).getByLabelText("Nom du produit"), "Sel");
    await userEvent.type(within(panneau).getByLabelText("Prix de vente"), "1");
    await userEvent.type(within(panneau).getByLabelText("Quantité initiale en stock"), "5");
    const lecturesAvant = api.appels().filter((a) => a.chemin.endsWith("/produits") && a.methode === "GET").length;
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter le produit" }));
    expect((await within(panneau).findByRole("alert")).textContent).toMatch(/^Produit créé, mais l'entrée de stock initiale a échoué : Stock introuvable/);
    await waitFor(() => expect(api.appels().filter((a) => a.chemin.endsWith("/produits") && a.methode === "GET").length).toBeGreaterThan(lecturesAvant));
  });

  it("prix : reprend le détail enregistré, le recalcule et l'envoie ; un frais désactivé reste affiché", async () => {
    preparer();
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, [
      produit({
        prix_achat: 15,
        frais: [
          { type_frais_id: "tf-douane", libelle: "Douane", mode: "pourcentage", valeur: 20 },
          { type_frais_id: "tf-ancien", libelle: "Octroi", mode: "montant", valeur: 0 },
        ],
      }),
    ]);
    api.repondre("PUT", `/boutiques/${BOUTIQUE_1}/prix/p-riz`, 200, { success: true });
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    await userEvent.click(within(table).getByRole("button", { name: "Modifier le prix de Riz 25 kg" }));
    const panneau = screen.getByRole("dialog", { name: "Prix de Riz 25 kg" });
    expect(ligneCout(panneau, "Coût de revient")).toBe("18 $");
    expect((within(panneau).getByLabelText("Frais n°2") as HTMLSelectElement).selectedOptions[0]!.textContent).toBe("Octroi (désactivé)");
    await userEvent.click(within(panneau).getByRole("button", { name: "Retirer le frais Octroi" }));
    const taux = within(panneau).getByLabelText("Taux du frais n°1 (%)");
    await userEvent.clear(taux);
    await userEvent.type(taux, "10");
    expect(ligneCout(panneau, "Coût de revient")).toBe("16,5 $");
    expect(ligneCout(panneau, "Bénéfice par unité")).toBe("5,5 $");
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(api.ecritures()[0]!.corps).toEqual({
        prix_vente: 22,
        detail_cout: { prix_achat: 15, frais: [{ type_frais_id: "tf-douane", mode: "pourcentage", valeur: 10 }] },
      })
    );
  });

  it("prix : des frais sans prix d'achat sont refusés sans appeler l'API", async () => {
    preparer();
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    await userEvent.click(within(table).getByRole("button", { name: "Modifier le prix de Riz 25 kg" }));
    const panneau = screen.getByRole("dialog", { name: "Prix de Riz 25 kg" });
    expect(within(panneau).getByText(/Coût actuel 18 \$, saisi sans détail/)).toBeTruthy();
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter un frais" }));
    await userEvent.type(within(panneau).getByLabelText("Montant du frais n°1"), "2");
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    expect(within(panneau).getByRole("alert").textContent).toBe("Le prix d'achat doit être un nombre positif ou nul");
    expect(api.ecritures()).toEqual([]);
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

  it("modifie les informations et remplace la photo", async () => {
    preparer();
    api.repondre("POST", "/uploads", 200, { url: "/uploads/produits/neuve.png" });
    api.repondre("PUT", `/boutiques/${BOUTIQUE_1}/produits/p-riz`, 200, { success: true });
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    await userEvent.click(within(table).getByRole("button", { name: "Modifier Riz 25 kg" }));
    const panneau = screen.getByRole("dialog", { name: "Modifier Riz 25 kg" });
    expect((within(panneau).getByLabelText("Nom du produit") as HTMLInputElement).value).toBe("Riz 25 kg");
    expect((within(panneau).getByLabelText(/Code produit/) as HTMLInputElement).value).toBe("CER-0001");
    expect((within(panneau).getByLabelText("Catégorie (rayon)") as HTMLSelectElement).value).toBe("cat-1");

    const nom = within(panneau).getByLabelText("Nom du produit");
    await userEvent.clear(nom);
    await userEvent.type(nom, "Riz parfumé 25 kg");
    await userEvent.upload(within(panneau).getByLabelText("Photo du produit"), new File(["x"], "riz.png", { type: "image/png" }));
    expect((await within(panneau).findByRole("img", { name: "Aperçu du produit" })).getAttribute("src")).toBe(
      "https://api.test/uploads/produits/neuve.png"
    );
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(api.ecritures().map((a) => a.chemin)).toEqual(["/uploads", `/boutiques/${BOUTIQUE_1}/produits/p-riz`]));
    expect(api.ecritures()[1]!.corps).toEqual({
      nom: "Riz parfumé 25 kg",
      description: "",
      categorie_id: "cat-1",
      image_url: "/uploads/produits/neuve.png",
      code: "CER-0001",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("retire la photo d'un produit", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "gerant" }));
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, [{ ...PRODUITS[0]!, produit_image: "/uploads/produits/ancienne.png" }]);
    api.repondre("GET", "/categories", 200, [{ id: "cat-1", nom: "Céréales", code: "CER" }]);
    api.repondre("PUT", `/boutiques/${BOUTIQUE_1}/produits/p-riz`, 200, { success: true });
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    await userEvent.click(within(table).getByRole("button", { name: "Modifier Riz 25 kg" }));
    const panneau = screen.getByRole("dialog", { name: "Modifier Riz 25 kg" });
    expect(within(panneau).getByRole("img", { name: "Aperçu du produit" }).getAttribute("src")).toBe(
      "https://api.test/uploads/produits/ancienne.png"
    );
    await userEvent.click(within(panneau).getByRole("button", { name: "Retirer la photo" }));
    expect(within(panneau).queryByRole("img", { name: "Aperçu du produit" })).toBeNull();
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.ecritures()[0]!.corps).toMatchObject({ image_url: "" }));
  });

  it("refuse un nom vide sans appeler l'API", async () => {
    preparer();
    rendreApp(PAGE);
    const table = await screen.findByRole("table", { name: "Produits de la boutique" });
    await userEvent.click(within(table).getByRole("button", { name: "Modifier Riz 25 kg" }));
    const panneau = screen.getByRole("dialog", { name: "Modifier Riz 25 kg" });
    await userEvent.clear(within(panneau).getByLabelText("Nom du produit"));
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    expect(within(panneau).getByText("Le nom du produit est requis")).toBeTruthy();
    expect(api.ecritures()).toEqual([]);
  });
});
