import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { sansViolation } from "../test/axe";
import { Panneau } from "./Panneau";

function Exemple({ onFermer = () => {} }: { onFermer?: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button onClick={() => setOuvert(true)}>Nouveau client</button>
      <Panneau
        ouvert={ouvert}
        titre="Nouveau client"
        onFermer={() => {
          setOuvert(false);
          onFermer();
        }}
      >
        <label>
          Nom <input />
        </label>
      </Panneau>
    </>
  );
}

describe("Panneau", () => {
  it("s'ouvre en dialogue nommé par son titre", async () => {
    render(<Exemple />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Nouveau client" }));
    expect(screen.getByRole("dialog", { name: "Nouveau client" })).toBeTruthy();
  });

  it("se ferme par son bouton et rend le focus au bouton d'ouverture", async () => {
    const onFermer = vi.fn();
    render(<Exemple onFermer={onFermer} />);
    const ouvrir = screen.getByRole("button", { name: "Nouveau client" });
    await userEvent.click(ouvrir);
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onFermer).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(ouvrir);
  });

  it("se ferme par Échap (événement cancel du navigateur)", async () => {
    const onFermer = vi.fn();
    render(<Exemple onFermer={onFermer} />);
    await userEvent.click(screen.getByRole("button", { name: "Nouveau client" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(onFermer).toHaveBeenCalledOnce();
  });

  it("se ferme par un clic sur le voile, pas par un clic dans le contenu", async () => {
    const onFermer = vi.fn();
    render(<Exemple onFermer={onFermer} />);
    await userEvent.click(screen.getByRole("button", { name: "Nouveau client" }));
    await userEvent.click(screen.getByLabelText("Nom"));
    expect(onFermer).not.toHaveBeenCalled();
    // Sélection commencée dans un champ et relâchée sur le voile : pas de fermeture.
    fireEvent.pointerDown(screen.getByLabelText("Nom"));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onFermer).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByRole("dialog"));
    fireEvent.click(screen.getByRole("dialog"));
    expect(onFermer).toHaveBeenCalledOnce();
  });

  it("sans violation d'accessibilité", async () => {
    const { container } = render(<Exemple />);
    await userEvent.click(screen.getByRole("button", { name: "Nouveau client" }));
    await sansViolation(container);
  });
});
