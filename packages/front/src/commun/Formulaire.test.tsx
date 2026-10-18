import { Champ } from "@multiboutique/ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sansViolation } from "../../test/axe";
import { Formulaire } from "./Formulaire";

describe("Formulaire", () => {
  it("envoie, affiche le message général et bloque pendant l'envoi", async () => {
    const onEnvoyer = vi.fn();
    const { rerender, container } = render(
      <Formulaire libelleEnvoyer="Enregistrer" onEnvoyer={onEnvoyer} erreur="Cet élément existe déjà">
        <Champ libelle="Nom" />
      </Formulaire>
    );
    expect(screen.getByRole("alert").textContent).toBe("Cet élément existe déjà");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onEnvoyer).toHaveBeenCalledOnce();
    await sansViolation(container);

    rerender(
      <Formulaire libelleEnvoyer="Enregistrer" onEnvoyer={onEnvoyer} enCours>
        <Champ libelle="Nom" />
      </Formulaire>
    );
    expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
  });

  it("hors ligne, désactive l'envoi et l'explique", () => {
    render(
      <Formulaire libelleEnvoyer="Enregistrer" onEnvoyer={() => {}} desactivee>
        <Champ libelle="Nom" />
      </Formulaire>
    );
    expect(screen.getByRole("button", { name: "Enregistrer" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Hors ligne/)).toBeTruthy();
  });
});
