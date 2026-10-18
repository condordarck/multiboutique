import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { etatPwa } from "@multiboutique/front/test/pwa-register";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, PRODUITS, STOCK } from "../../test/donnees";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../test/rendu";

let api: FauxApi;
afterEach(() => {
  api.restaurer();
  vi.restoreAllMocks();
  etatPwa.besoinDeMiseAJour = false;
});

function horsLigne() {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  window.dispatchEvent(new Event("offline"));
}

describe("hors ligne", () => {
  it("annonce les données en cache et leur heure, désactive les écritures", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "gerant" }));
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/stock`, 200, STOCK);
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/mouvements-stock`, 200, []);
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, PRODUITS);
    rendreApp(`/b/${BOUTIQUE_1}/ventes/nouvelle`);
    await screen.findByRole("button", { name: /^Riz 25 kg/ });
    expect(screen.queryByText(/^Hors ligne — données du/)).toBeNull();

    horsLigne();
    expect(await screen.findByText(/^Hors ligne — données du \d{2}:\d{2}/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Riz 25 kg/ }));
    expect(screen.getByRole("button", { name: /^Encaisser/ }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/l'encaissement reprendra avec la connexion/)).toBeTruthy();
  });

  it("propose la nouvelle version quand le service worker en a une", async () => {
    etatPwa.besoinDeMiseAJour = true;
    const mettreAJour = vi.spyOn(etatPwa, "mettreAJour");
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur", boutique_ids: [] }));
    rendreApp("/");
    expect(await screen.findByText("Nouvelle version disponible")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Recharger" }));
    await waitFor(() => expect(mettreAJour).toHaveBeenCalledWith(true));
  });
});
