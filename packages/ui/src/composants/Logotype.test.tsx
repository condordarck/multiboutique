import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logotype } from "./Logotype";

describe("Logotype", () => {
  it("fournit une version par thème, l'une masquée selon le thème actif", () => {
    render(<Logotype />);
    const [clair, sombre] = screen.getAllByAltText("MultiBoutique") as HTMLImageElement[];
    expect(clair!.className).toContain("sombre:hidden");
    expect(sombre!.className).toContain("hidden");
    expect(sombre!.className).toContain("sombre:block");
    expect(clair!.src).not.toBe(sombre!.src);
  });

  it("accepte un texte alternatif propre au contexte", () => {
    render(<Logotype alt="MultiBoutique, accueil" />);
    expect(screen.getAllByAltText("MultiBoutique, accueil")).toHaveLength(2);
  });
});
