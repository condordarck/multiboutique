import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Champ } from "./Champ";

describe("Champ", () => {
  it("associe le libellé au champ", () => {
    render(<Champ libelle="Nom du produit" />);
    expect(screen.getByLabelText("Nom du produit").tagName).toBe("INPUT");
  });

  it("relie l'erreur au champ et le marque invalide", () => {
    render(<Champ libelle="Quantité" type="nombre" erreur="La quantité doit être positive" />);
    const champ = screen.getByLabelText("Quantité");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const description = champ.getAttribute("aria-describedby") ?? "";
    const erreur = screen.getByText("La quantité doit être positive");
    expect(description.split(" ")).toContain(erreur.id);
  });

  it("relie aussi le texte d'aide, et n'est pas invalide sans erreur", () => {
    render(<Champ libelle="Prix" type="montant" aide="En dollars, TTC" />);
    const champ = screen.getByLabelText("Prix");
    expect(champ.getAttribute("aria-invalid")).toBeNull();
    expect(champ.getAttribute("aria-describedby")).toBe(screen.getByText("En dollars, TTC").id);
  });

  it("ouvre le clavier numérique adapté au type", () => {
    const { rerender } = render(<Champ libelle="Prix" type="montant" />);
    expect(screen.getByLabelText("Prix").getAttribute("inputmode")).toBe("decimal");
    rerender(<Champ libelle="Prix" type="nombre" />);
    expect(screen.getByLabelText("Prix").getAttribute("inputmode")).toBe("numeric");
  });

  it("en recherche, devient un champ de recherche", () => {
    render(<Champ libelle="Rechercher un produit" type="recherche" />);
    expect(screen.getByRole("searchbox", { name: "Rechercher un produit" })).toBeTruthy();
  });

  it("laisse saisir du texte", async () => {
    render(<Champ libelle="Client" />);
    await userEvent.type(screen.getByLabelText("Client"), "Kabila & fils");
    expect((screen.getByLabelText("Client") as HTMLInputElement).value).toBe("Kabila & fils");
  });

  it("garde une hauteur tactile d'au moins 44 px", () => {
    render(<Champ libelle="Client" />);
    expect(screen.getByLabelText("Client").className).toMatch(/min-h-(11|\[(4[4-9]|[5-9]\d)px\])/);
  });
});
