import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sansViolation } from "../test/axe";
import { Selecteur } from "./Selecteur";

const OPTIONS = [
  { valeur: "b1", libelle: "Boutique 1" },
  { valeur: "b2", libelle: "Boutique 2" },
];

describe("Selecteur", () => {
  it("associe le libellé, l'erreur et propose les options", async () => {
    const onChange = vi.fn();
    render(<Selecteur libelle="Boutique" options={OPTIONS} value="b1" onChange={(e) => onChange(e.target.value)} erreur="Requis" />);
    const champ = screen.getByRole("combobox", { name: "Boutique" });
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    expect(champ.getAttribute("aria-describedby")).toBe(screen.getByText("Requis").id);
    await userEvent.selectOptions(champ, "b2");
    expect(onChange).toHaveBeenCalledWith("b2");
  });

  it("propose une option vide quand on la demande", () => {
    render(<Selecteur libelle="Client" options={OPTIONS} optionVide="Aucun client" defaultValue="" />);
    expect(screen.getByRole("option", { name: "Aucun client" })).toBeTruthy();
  });

  it("garde un nom accessible quand le libellé est masqué", () => {
    render(<Selecteur libelle="Boutique" libelleMasque options={OPTIONS} />);
    expect(screen.getByRole("combobox", { name: "Boutique" })).toBeTruthy();
    expect(screen.getByText("Boutique").className).toContain("sr-only");
  });

  it("sans violation d'accessibilité", async () => {
    const { container } = render(<Selecteur libelle="Boutique" options={OPTIONS} aide="Boutique de destination" />);
    await sansViolation(container);
  });
});
