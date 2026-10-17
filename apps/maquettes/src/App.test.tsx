import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function aller(route: string) {
  act(() => {
    window.location.hash = route;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

describe("maquettes", () => {
  it("l'accueil mène aux trois écrans", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Maquettes" })).toBeTruthy();
    for (const nom of [/Nouvelle vente/, /Stock/, /Catalogue/]) {
      expect(screen.getByRole("link", { name: nom })).toBeTruthy();
    }
  });

  it("nouvelle vente : du panier à l'encaissement", async () => {
    render(<App />);
    aller("/vente");
    await userEvent.click(screen.getByRole("button", { name: /^Riz 25 kg/ }));
    await userEvent.click(screen.getByRole("button", { name: "Ajouter un Riz 25 kg" }));
    expect(screen.getByTestId("total").textContent).toBe("44,00\u00a0$");
    // La barre de résumé, pour les écrans où le panier est hors de vue.
    expect(screen.getByText(/2 articles ·/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Voir le panier" })).toBeTruthy();

    await userEvent.click(screen.getByText("Mobile money"));
    await userEvent.click(screen.getByRole("button", { name: /^Encaisser/ }));
    expect(await screen.findByText("Vente enregistrée")).toBeTruthy();
    expect(screen.getByText(/44,00\s\$ encaissés en mobile money/)).toBeTruthy();
  });

  it("nouvelle vente : un produit en rupture ne s'ajoute pas", () => {
    render(<App />);
    aller("/vente");
    expect(screen.getByRole("button", { name: /^Huile de palme 5 L/ }).hasAttribute("disabled")).toBe(true);
  });

  it("stock : le filtre « Rupture » ne garde que les produits épuisés", async () => {
    render(<App />);
    aller("/stock");
    await userEvent.click(screen.getByText(/^Rupture \(/));
    const tableau = screen.getByRole("table", { name: "Produits en stock" });
    const lignes = within(tableau).getAllByRole("row").slice(1);
    expect(lignes.map((l) => within(l).getAllByRole("cell")[0]!.textContent)).toEqual(["Huile de palme 5 L"]);
  });

  it("stock : « Voir » ouvre la fiche du produit", async () => {
    render(<App />);
    aller("/stock");
    const tableau = screen.getByRole("table");
    await userEvent.click(within(tableau).getByRole("button", { name: "Voir la fiche de Sucre 1 kg" }));
    expect(screen.getByRole("region", { name: "Sucre 1 kg" })).toBeTruthy();
  });

  it("catalogue : réserver remplit la barre de réservation", async () => {
    render(<App />);
    aller("/catalogue");
    await userEvent.click(screen.getAllByRole("button", { name: "Réserver" })[0]!);
    expect(screen.getByText(/1 article ·/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(screen.getByText("Réservation envoyée")).toBeTruthy();
  });
});
