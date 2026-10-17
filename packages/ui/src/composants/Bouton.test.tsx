import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Bouton } from "./Bouton";

describe("Bouton", () => {
  it("est un vrai bouton, de type button par défaut", () => {
    render(<Bouton>Enregistrer</Bouton>);
    const bouton = screen.getByRole("button", { name: "Enregistrer" });
    expect(bouton.getAttribute("type")).toBe("button");
  });

  it("appelle onClick au clic", async () => {
    const onClick = vi.fn();
    render(<Bouton onClick={onClick}>Valider</Bouton>);
    await userEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("pendant le chargement, se désactive, s'annonce occupé et ignore les clics", async () => {
    const onClick = vi.fn();
    render(
      <Bouton chargement onClick={onClick}>
        Encaisser
      </Bouton>
    );
    const bouton = screen.getByRole("button", { name: /Encaisser/ });
    expect(bouton.hasAttribute("disabled")).toBe(true);
    expect(bouton.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(bouton);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("garde une cible tactile d'au moins 44 px", () => {
    render(<Bouton variante="discret">Plus</Bouton>);
    const classes = screen.getByRole("button").className;
    expect(classes).toMatch(/min-h-(11|\[(4[4-9]|[5-9]\d)px\])/);
    expect(classes).toMatch(/min-w-11/);
  });

  it("n'utilise que les couleurs des tokens, selon la variante", () => {
    const { rerender } = render(<Bouton variante="primaire">A</Bouton>);
    expect(screen.getByRole("button").className).toContain("bg-primaire");
    rerender(<Bouton variante="danger">A</Bouton>);
    expect(screen.getByRole("button").className).toContain("bg-danger");
    expect(screen.getByRole("button").className).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("transmet type=submit et les classes supplémentaires", () => {
    render(
      <Bouton type="submit" className="w-full">
        Envoyer
      </Bouton>
    );
    const bouton = screen.getByRole("button", { name: "Envoyer" });
    expect(bouton.getAttribute("type")).toBe("submit");
    expect(bouton.className).toContain("w-full");
  });
});
