import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Coque, type EntreeNavigation } from "./Coque";

const icone = <svg aria-hidden="true" />;

function entrees(n: number, active = 0): EntreeNavigation[] {
  return Array.from({ length: n }, (_, i) => ({
    libelle: `Entrée ${i + 1}`,
    href: `/e${i + 1}`,
    icone,
    actif: i === active,
  }));
}

describe("Coque", () => {
  it("rend une seule navigation nommée, quelle que soit la largeur", () => {
    render(<Coque entrees={entrees(5)}>Contenu</Coque>);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeTruthy();
  });

  it("marque l'entrée active avec aria-current", () => {
    render(<Coque entrees={entrees(5, 2)}>Contenu</Coque>);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Entrée 3" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Entrée 1" }).getAttribute("aria-current")).toBeNull();
  });

  it("place le contenu dans le landmark principal, atteignable par un lien d'évitement", () => {
    render(<Coque entrees={entrees(3)}>Le contenu</Coque>);
    const principal = screen.getByRole("main");
    expect(principal.textContent).toContain("Le contenu");
    const evitement = screen.getByRole("link", { name: "Aller au contenu" });
    expect(evitement.getAttribute("href")).toBe(`#${principal.id}`);
  });

  it("jusqu'à 5 entrées, toutes tiennent dans la barre du bas, sans « Plus »", () => {
    render(<Coque entrees={entrees(5)}>Contenu</Coque>);
    expect(screen.queryByRole("button", { name: "Plus" })).toBeNull();
  });

  describe("avec 7 entrées sur téléphone", () => {
    it("la barre du bas montre 4 entrées et cache les 3 autres", () => {
      render(<Coque entrees={entrees(7)}>Contenu</Coque>);
      const liens = within(screen.getByRole("navigation")).getAllByRole("link");
      const cachesSurTelephone = liens.filter((l) => l.className.split(" ").includes("hidden"));
      expect(cachesSurTelephone.map((l) => l.textContent)).toEqual(["Entrée 5", "Entrée 6", "Entrée 7"]);
      // Elles réapparaissent à partir de la tablette.
      for (const lien of cachesSurTelephone) expect(lien.className).toContain("tablette:flex");
    });

    it("« Plus » donne accès aux 3 entrées restantes", async () => {
      render(<Coque entrees={entrees(7)}>Contenu</Coque>);
      const plus = screen.getByRole("button", { name: "Plus" });
      expect(plus.getAttribute("aria-expanded")).toBe("false");
      expect(plus.className).toContain("tablette:hidden");

      await userEvent.click(plus);
      expect(plus.getAttribute("aria-expanded")).toBe("true");
      const panneau = document.getElementById(plus.getAttribute("aria-controls")!)!;
      expect(within(panneau).getAllByRole("link").map((l) => l.textContent)).toEqual([
        "Entrée 5",
        "Entrée 6",
        "Entrée 7",
      ]);
    });

    it("Échap referme le panneau et rend le focus à « Plus »", async () => {
      render(<Coque entrees={entrees(7)}>Contenu</Coque>);
      const plus = screen.getByRole("button", { name: "Plus" });
      await userEvent.click(plus);
      await userEvent.keyboard("{Escape}");
      expect(plus.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(plus);
    });

    it("« Plus » signale visuellement qu'une entrée cachée est active", () => {
      render(<Coque entrees={entrees(7, 5)}>Contenu</Coque>);
      expect(screen.getByRole("button", { name: "Plus" }).getAttribute("data-actif")).toBe("true");
    });
  });

  it("accepte un composant de lien (routeur de l'application)", () => {
    function LienRouteur(props: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
      return <a data-routeur="oui" {...props} />;
    }
    render(
      <Coque entrees={entrees(3)} composantLien={LienRouteur}>
        Contenu
      </Coque>
    );
    expect(screen.getByRole("link", { name: "Entrée 1" }).getAttribute("data-routeur")).toBe("oui");
  });

  it("affiche la marque et l'en-tête fournis", () => {
    render(
      <Coque entrees={entrees(3)} marque={<span>Logo</span>} enTete={<span>Boutique 1</span>}>
        Contenu
      </Coque>
    );
    expect(screen.getByText("Logo")).toBeTruthy();
    expect(screen.getByText("Boutique 1")).toBeTruthy();
  });
});
