import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sansViolation } from "../test/axe";
import { ZoneTexte } from "./ZoneTexte";

describe("ZoneTexte", () => {
  it("associe le libellé et l'erreur", async () => {
    const { container } = render(<ZoneTexte libelle="Notes" erreur="Trop long" />);
    const zone = screen.getByRole("textbox", { name: "Notes" });
    expect(zone.tagName).toBe("TEXTAREA");
    expect(zone.getAttribute("aria-describedby")).toBe(screen.getByText("Trop long").id);
    await sansViolation(container);
  });
});
