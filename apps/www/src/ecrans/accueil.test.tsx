import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { sansViolation } from "@multiboutique/front/test/axe";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { BOUTIQUE_1, BOUTIQUE_2, rendreApp, visiteur } from "../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());

const BOUTIQUES = [
  { id: BOUTIQUE_1, nom: "Boutique 1", adresse: "Avenue du Commerce 12", telephone: "+243 000 000 001", email: null },
  { id: BOUTIQUE_2, nom: "Boutique 2", adresse: null, telephone: null, email: null },
];

describe("accueil", () => {
  it("présente la vitrine et ses boutiques, chacune vers son catalogue", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/public/boutiques", 200, BOUTIQUES);
    const { container } = rendreApp("/");
    expect(await screen.findByRole("heading", { level: 1, name: "MultiBoutique" })).toBeTruthy();
    expect(await screen.findByText("2 boutiques")).toBeTruthy();
    const liste = screen.getByRole("list", { name: "Nos boutiques" });
    const cartes = within(liste).getAllByRole("listitem");
    expect(cartes).toHaveLength(2);
    expect(within(cartes[0]!).getByText("Avenue du Commerce 12")).toBeTruthy();
    expect(within(cartes[0]!).getByRole("link", { name: /Boutique 1/ }).getAttribute("href")).toBe(`/boutiques/${BOUTIQUE_1}`);
    await sansViolation(container);
  });

  it("sans boutique, le dit", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/public/boutiques", 200, []);
    rendreApp("/");
    expect(await screen.findByText("Aucune boutique disponible pour le moment")).toBeTruthy();
  });

  it("une erreur de l'API se rattrape avec « Réessayer »", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/public/boutiques", 500, { erreur: "Erreur serveur, réessayez" });
    rendreApp("/");
    expect((await screen.findByRole("alert")).textContent).toContain("Erreur serveur, réessayez");
    api.repondre("GET", "/public/boutiques", 200, BOUTIQUES);
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByRole("list", { name: "Nos boutiques" })).toBeTruthy();
  });
});
