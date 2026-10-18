import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sansViolation } from "../test/axe";
import { Dialogue } from "./Dialogue";

describe("Dialogue", () => {
  it("demande confirmation et appelle le bon rappel", async () => {
    const onConfirmer = vi.fn();
    const onAnnuler = vi.fn();
    render(
      <Dialogue
        ouvert
        titre="Supprimer le code PROMO10 ?"
        message="Le code ne pourra plus être utilisé."
        libelleConfirmer="Supprimer"
        variante="danger"
        onConfirmer={onConfirmer}
        onAnnuler={onAnnuler}
      />
    );
    const dialogue = screen.getByRole("alertdialog", { name: "Supprimer le code PROMO10 ?" });
    expect(dialogue.getAttribute("aria-describedby")).toBe(screen.getByText(/ne pourra plus/).id);
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onAnnuler).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(onConfirmer).toHaveBeenCalledOnce();
  });

  it("affiche un contenu supplémentaire (motif) et bloque pendant l'envoi", () => {
    render(
      <Dialogue ouvert titre="Annuler la vente ?" libelleConfirmer="Annuler la vente" chargement onConfirmer={() => {}} onAnnuler={() => {}}>
        <label>
          Motif <input />
        </label>
      </Dialogue>
    );
    expect(screen.getByLabelText("Motif")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Annuler la vente" }).hasAttribute("disabled")).toBe(true);
  });

  it("sans violation d'accessibilité", async () => {
    const { container } = render(
      <Dialogue ouvert titre="Confirmer ?" libelleConfirmer="Confirmer" onConfirmer={() => {}} onAnnuler={() => {}} />
    );
    await sansViolation(container);
  });
});
