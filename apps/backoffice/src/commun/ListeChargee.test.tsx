import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErreurApi } from "../api/client";
import { ListeChargee } from "./ListeChargee";

const colonnes = [{ cle: "nom", libelle: "Nom", rendu: (l: { nom: string }) => l.nom, principale: true }];
const base = { legende: "Clients", colonnes, cleLigne: (l: { nom: string }) => l.nom, vide: "Aucun client" };

describe("ListeChargee", () => {
  it("chargement, erreur avec « Réessayer », vide, puis la liste", async () => {
    const relancer = vi.fn();
    const { rerender } = render(<ListeChargee {...base} requete={{ isPending: true, error: null, data: undefined, refetch: relancer }} />);
    expect(screen.getByRole("status").textContent).toContain("Chargement");

    rerender(<ListeChargee {...base} requete={{ isPending: false, error: new ErreurApi(500, "Erreur serveur, réessayez"), data: undefined, refetch: relancer }} />);
    expect(screen.getByRole("alert").textContent).toContain("Erreur serveur, réessayez");
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(relancer).toHaveBeenCalledOnce();

    rerender(<ListeChargee {...base} requete={{ isPending: false, error: null, data: [], refetch: relancer }} />);
    expect(screen.getByText("Aucun client")).toBeTruthy();

    rerender(<ListeChargee {...base} requete={{ isPending: false, error: null, data: [{ nom: "Awa" }], refetch: relancer }} />);
    expect(screen.getAllByText("Awa").length).toBeGreaterThan(0);
  });
});
