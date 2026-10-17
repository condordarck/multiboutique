import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChoixSegmente } from "./ChoixSegmente";

const options = [
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "mobile", libelle: "Mobile money" },
  { valeur: "credit", libelle: "Crédit" },
];

function Controle({ surChangement = () => {} }: { surChangement?: (v: string) => void }) {
  const [valeur, setValeur] = useState("especes");
  return (
    <ChoixSegmente
      legende="Mode de paiement"
      options={options}
      valeur={valeur}
      onChange={(v) => {
        setValeur(v);
        surChangement(v);
      }}
    />
  );
}

describe("ChoixSegmente", () => {
  it("est un groupe de boutons radio nommé", () => {
    render(<Controle />);
    expect(screen.getByRole("radiogroup", { name: "Mode de paiement" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("coche l'option courante", () => {
    render(<Controle />);
    expect((screen.getByRole("radio", { name: "Espèces" }) as HTMLInputElement).checked).toBe(true);
  });

  it("signale le changement au clic", async () => {
    const surChangement = vi.fn();
    render(<Controle surChangement={surChangement} />);
    await userEvent.click(screen.getByText("Crédit"));
    expect(surChangement).toHaveBeenCalledWith("credit");
    expect((screen.getByRole("radio", { name: "Crédit" }) as HTMLInputElement).checked).toBe(true);
  });

  it("se pilote aux flèches du clavier, comme tout groupe radio natif", async () => {
    render(<Controle />);
    await userEvent.click(screen.getByText("Espèces"));
    await userEvent.keyboard("{ArrowRight}");
    expect((screen.getByRole("radio", { name: "Mobile money" }) as HTMLInputElement).checked).toBe(true);
  });

  it("offre des cibles tactiles d'au moins 44 px", () => {
    render(<Controle />);
    const etiquette = screen.getByText("Espèces").closest("label")!;
    expect(etiquette.className).toMatch(/min-h-(11|1[2-9]|\[(4[4-9]|[5-9]\d)px\])/);
  });
});
