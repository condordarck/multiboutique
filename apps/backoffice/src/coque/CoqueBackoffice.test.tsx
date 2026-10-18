import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { sansViolation } from "@multiboutique/front/test/axe";
import { BOUTIQUE_1, BOUTIQUE_2, connecte, rendreApp, utilisateur } from "../../test/rendu";

let api: FauxApi;
afterEach(() => {
  api.restaurer();
  localStorage.clear();
});

async function libellesMenu() {
  const nav = await screen.findByRole("navigation", { name: "Navigation principale" });
  return within(nav)
    .getAllByRole("link")
    .map((l) => l.textContent);
}

describe("coque du backoffice", () => {
  it("un vendeur ne voit que ses sections (matrice du monolithe)", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur" }));
    rendreApp(`/b/${BOUTIQUE_1}/ventes`);
    expect(await libellesMenu()).toEqual(["Vue d'ensemble", "Ventes", "Stock", "Produits"]);
  });

  it("un gérant voit tout l'opérationnel, et la consolidation (matrice : tout sauf publier les prix conseillés)", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "gerant" }));
    rendreApp(`/b/${BOUTIQUE_1}`);
    expect(await libellesMenu()).toEqual([
      "Consolidation siège",
      "Vue d'ensemble",
      "Ventes",
      "Stock",
      "Clients",
      "Produits",
      "Commandes B2B",
      "Réservations",
      "Rapports",
      "Promotions",
      "Achats & fournisseurs",
      "Prix conseillés",
    ]);
  });

  it("les permissions enregistrées l'emportent sur la matrice par défaut", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur", permissions: ["ventes:voir", "consolidation:voir"] }));
    rendreApp(`/b/${BOUTIQUE_1}/ventes`);
    expect(await libellesMenu()).toEqual(["Consolidation siège", "Vue d'ensemble", "Ventes"]);
  });

  it("le propriétaire a le tableau de bord et la consolidation ; l'entrée active est marquée", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "proprietaire", boutique_ids: [] }));
    rendreApp(`/b/${BOUTIQUE_2}/stock`);
    const libelles = await libellesMenu();
    expect(libelles.slice(0, 3)).toEqual(["Tableau de bord", "Consolidation siège", "Vue d'ensemble"]);
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(within(nav).getByRole("link", { current: "page" }).textContent).toBe("Stock");
    expect(within(nav).getByRole("link", { name: "Stock" }).getAttribute("href")).toBe(`/b/${BOUTIQUE_2}/stock`);
  });

  it("changer de boutique garde la section ouverte", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "proprietaire", boutique_ids: [] }));
    const app = rendreApp(`/b/${BOUTIQUE_1}/stock`);
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Boutique" }), BOUTIQUE_2);
    await waitFor(() => expect(app.adresse()).toBe(`/b/${BOUTIQUE_2}/stock`));
  });

  it("avec une seule boutique, son nom au lieu d'un sélecteur", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur" }));
    rendreApp(`/b/${BOUTIQUE_1}/ventes`);
    expect(await screen.findByText("Boutique 1")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Boutique" })).toBeNull();
  });

  it("affiche le nom et le rôle, et propose la déconnexion", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "gerant_stock", nom_complet: "Ali Magasinier" }));
    rendreApp(`/b/${BOUTIQUE_1}/stock`);
    const compte = await screen.findByRole("button", { name: /Ali Magasinier/ });
    expect(compte.textContent).toContain("Gérant de stock");
    expect(screen.queryByRole("button", { name: "Se déconnecter" })).toBeNull();
    await userEvent.click(compte);
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeTruthy();
  });

  it("une boutique hors du périmètre est annoncée inaccessible", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur" }));
    rendreApp(`/b/${BOUTIQUE_2}/ventes`);
    expect(await screen.findByText("Boutique inaccessible")).toBeTruthy();
  });

  it("l'administrateur est renvoyé à l'administration, le siège n'y entre pas", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "administrateur", boutique_ids: [] }));
    let app = rendreApp(`/b/${BOUTIQUE_1}`);
    await waitFor(() => expect(app.adresse()).toBe("/admin"));
    expect(await libellesMenu()).toContain("Rôles & habilitations");
    app.unmount();
    api.restaurer();

    api = fauxApi();
    connecte(api, utilisateur({ role: "directeur_region" }));
    app = rendreApp("/admin/utilisateurs");
    await waitFor(() => expect(app.adresse()).toBe("/consolidation"));
  });

  it("sans violation d'accessibilité", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "proprietaire", boutique_ids: [] }));
    const { container } = rendreApp(`/b/${BOUTIQUE_1}/stock`);
    await screen.findByRole("combobox", { name: "Boutique" });
    await sansViolation(container);
  });
});
