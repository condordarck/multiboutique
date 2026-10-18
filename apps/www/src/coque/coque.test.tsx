import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { sansViolation } from "@multiboutique/front/test/axe";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { connecte, rendreApp, visiteur } from "../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());

const entete = () => screen.getByRole("banner");

describe("coque de la vitrine", () => {
  it("un visiteur voit Connexion et l'espace professionnel, qui mène au backoffice", async () => {
    api = fauxApi();
    visiteur(api);
    const { container } = rendreApp("/inconnu-pour-la-coque");
    const nav = await within(entete()).findByRole("navigation", { name: "Navigation de la vitrine" });
    expect(within(nav).getByRole("link", { name: "Connexion" }).getAttribute("href")).toBe("/connexion");
    expect(within(nav).getByRole("link", { name: "Espace professionnel" }).getAttribute("href")).toBe("https://backoffice.test");
    expect(within(nav).queryByRole("link", { name: "Mes réservations" })).toBeNull();
    await sansViolation(container);
  });

  it("un client voit Mes réservations et son nom ; la déconnexion vide le cache et ramène à l'accueil", async () => {
    api = fauxApi();
    connecte(api);
    api.repondre("POST", "/auth/deconnexion", 200, { ok: true });
    const app = rendreApp("/inconnu-pour-la-coque");
    const nav = await within(entete()).findByRole("navigation", { name: "Navigation de la vitrine" });
    await waitFor(() => expect(within(nav).getByRole("link", { name: "Mes réservations" }).getAttribute("href")).toBe("/espace"));
    expect(within(nav).queryByRole("link", { name: "Connexion" })).toBeNull();
    app.client.setQueryData(["public", "boutiques"], [{ id: "x" }]);
    await userEvent.click(within(nav).getByRole("button", { name: /Mme Ade/ }));
    await userEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    await waitFor(() => expect(app.adresse()).toBe("/"));
    expect(app.client.getQueryData(["public", "boutiques"])).toBeUndefined();
    expect(api.ecritures().map((a) => a.chemin)).toEqual(["/auth/deconnexion"]);
  });

  it("sur téléphone, le menu se replie dans un panneau", async () => {
    api = fauxApi();
    visiteur(api);
    rendreApp("/inconnu-pour-la-coque");
    await userEvent.click(await screen.findByRole("button", { name: "Menu" }));
    const panneau = screen.getByRole("dialog", { name: "Menu" });
    expect(within(panneau).getByRole("link", { name: "Connexion" })).toBeTruthy();
  });

  it("le pied de page reprend le nom de l'application", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/parametres", 200, { monnaie: "FC", nom_application: "Boutiques Kanza" });
    rendreApp("/inconnu-pour-la-coque");
    expect(await within(screen.getByRole("contentinfo")).findByText(/Boutiques Kanza/)).toBeTruthy();
  });
});
