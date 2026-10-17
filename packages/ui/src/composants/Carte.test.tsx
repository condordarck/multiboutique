import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Carte } from "./Carte";

describe("Carte", () => {
  it("affiche ses enfants", () => {
    render(<Carte>Contenu de la carte</Carte>);
    expect(screen.getByText("Contenu de la carte")).toBeTruthy();
  });

  it("titre la région avec un en-tête du niveau demandé", () => {
    render(
      <Carte titre="Dernières ventes" niveauTitre={3}>
        …
      </Carte>
    );
    expect(screen.getByRole("heading", { level: 3, name: "Dernières ventes" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Dernières ventes" })).toBeTruthy();
  });

  it("utilise un titre de niveau 2 par défaut", () => {
    render(<Carte titre="Stock">…</Carte>);
    expect(screen.getByRole("heading", { level: 2, name: "Stock" })).toBeTruthy();
  });

  it("place l'action dans l'en-tête", () => {
    render(
      <Carte titre="Stock" action={<a href="/stock">Tout voir</a>}>
        …
      </Carte>
    );
    expect(screen.getByRole("link", { name: "Tout voir" })).toBeTruthy();
  });

  it("sans titre, n'est pas une région nommée", () => {
    render(<Carte>Sans titre</Carte>);
    expect(screen.queryByRole("region")).toBeNull();
  });
});
