import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Quantite } from "./Quantite";

function Controle({ initiale = 1, max }: { initiale?: number; max?: number }) {
  const [valeur, setValeur] = useState(initiale);
  return <Quantite libelle="Riz 25 kg" valeur={valeur} onChange={setValeur} max={max} />;
}

describe("Quantite", () => {
  it("annonce la quantité et le produit", () => {
    render(<Controle initiale={2} />);
    expect(screen.getByRole("group", { name: "Quantité de Riz 25 kg" })).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("augmente et diminue d'une unité", async () => {
    render(<Controle initiale={2} />);
    await userEvent.click(screen.getByRole("button", { name: "Ajouter un Riz 25 kg" }));
    expect(screen.getByText("3")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retirer un Riz 25 kg" }));
    await userEvent.click(screen.getByRole("button", { name: "Retirer un Riz 25 kg" }));
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("ne descend pas sous le minimum", () => {
    render(<Controle initiale={1} />);
    expect(screen.getByRole("button", { name: "Retirer un Riz 25 kg" }).hasAttribute("disabled")).toBe(true);
  });

  it("ne dépasse pas le maximum, le stock disponible par exemple", () => {
    render(<Controle initiale={3} max={3} />);
    expect(screen.getByRole("button", { name: "Ajouter un Riz 25 kg" }).hasAttribute("disabled")).toBe(true);
  });

  it("annonce chaque changement aux lecteurs d'écran", () => {
    render(<Controle initiale={2} />);
    expect(screen.getByText("2").getAttribute("aria-live")).toBe("polite");
  });
});
