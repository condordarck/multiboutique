import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TuileChiffre } from "./TuileChiffre";

describe("TuileChiffre", () => {
  it("affiche le libellé et la valeur", () => {
    render(<TuileChiffre libelle="Chiffre d'affaires" valeur="1 240 $" />);
    expect(screen.getByText("Chiffre d'affaires")).toBeTruthy();
    expect(screen.getByText("1 240 $")).toBeTruthy();
  });

  it("annonce la variation en toutes lettres", () => {
    render(
      <TuileChiffre libelle="CA" valeur="1 240 $" variation={{ sens: "hausse", pourcentage: 8 }} />
    );
    expect(screen.getByText(/en hausse de 8\s%/i)).toBeTruthy();
  });

  it("colore une hausse en succès et une baisse en danger, par défaut", () => {
    const { rerender } = render(
      <TuileChiffre libelle="CA" valeur="1" variation={{ sens: "hausse", pourcentage: 8 }} />
    );
    expect(screen.getByText(/en hausse/i).className).toContain("text-succes");
    rerender(<TuileChiffre libelle="CA" valeur="1" variation={{ sens: "baisse", pourcentage: 3 }} />);
    expect(screen.getByText(/en baisse de 3\s%/i).className).toContain("text-danger");
  });

  it("inverse les couleurs quand une baisse est favorable", () => {
    render(
      <TuileChiffre
        libelle="Ruptures"
        valeur="2"
        variation={{ sens: "baisse", pourcentage: 50, favorable: true }}
      />
    );
    expect(screen.getByText(/en baisse/i).className).toContain("text-succes");
  });

  it("affiche un détail libre à la place d'une variation", () => {
    render(<TuileChiffre libelle="Ventes" valeur="32" detail="dont 4 à crédit" />);
    expect(screen.getByText("dont 4 à crédit")).toBeTruthy();
  });

  it("aligne les chiffres en colonnes", () => {
    render(<TuileChiffre libelle="CA" valeur="1 240 $" />);
    expect(screen.getByText("1 240 $").className).toContain("tabular-nums");
  });

  it("passe en safran quand elle est mise en avant", () => {
    const { container } = render(<TuileChiffre libelle="Stock" valeur="5" miseEnAvant />);
    expect((container.firstElementChild as HTMLElement).className).toContain("bg-accent");
  });
});
