import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("porte son sens dans le texte, pas seulement dans la couleur", () => {
    render(<Badge ton="danger">Rupture</Badge>);
    expect(screen.getByText("Rupture")).toBeTruthy();
  });

  it.each([
    ["neutre", "bg-neutre-fond"],
    ["succes", "bg-succes-fond"],
    ["alerte", "bg-alerte-fond"],
    ["danger", "bg-danger-fond"],
    ["info", "bg-info-fond"],
  ] as const)("ton %s → fond %s", (ton, classe) => {
    render(<Badge ton={ton}>x</Badge>);
    expect(screen.getByText("x").className).toContain(classe);
  });

  it("est neutre par défaut", () => {
    render(<Badge>Brouillon</Badge>);
    expect(screen.getByText("Brouillon").className).toContain("bg-neutre-fond");
  });
});
