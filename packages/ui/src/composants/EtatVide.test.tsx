import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EtatVide } from "./EtatVide";

describe("EtatVide", () => {
  it("affiche le message et la description", () => {
    render(<EtatVide message="Aucune vente aujourd'hui" description="Les ventes apparaîtront ici." />);
    expect(screen.getByText("Aucune vente aujourd'hui")).toBeTruthy();
    expect(screen.getByText("Les ventes apparaîtront ici.")).toBeTruthy();
  });

  it("propose l'action quand elle est fournie", async () => {
    const onClick = vi.fn();
    render(
      <EtatVide message="Aucune vente" action={{ libelle: "Nouvelle vente", onClick }} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Nouvelle vente" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("n'affiche aucun bouton sans action", () => {
    render(<EtatVide message="Aucune vente" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
