import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { sansViolation } from "@multiboutique/front/test/axe";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BOUTIQUE_1, rendreApp, visiteur } from "../../test/rendu";

let api: FauxApi;
afterEach(() => {
  api.restaurer();
  vi.restoreAllMocks();
});
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");

const RESERVATION = {
  id: "r-9",
  reference_reservation: "RES-20261018-AB12",
  client_nom: "Mme Ade",
  boutique_id: BOUTIQUE_1,
  statut: "en_attente",
  montant_total: 23.5,
  date_retrait_prevue: "2026-10-25",
  created_at: "2026-10-18T09:00:00Z",
  boutique: { id: BOUTIQUE_1, nom: "Boutique 1", adresse: "Avenue du Commerce 12", telephone: "+243 000 000 001", email: null },
  lignes: [
    { id: "l1", produit_nom: "Riz 25 kg", produit_reference: "RIZ-25", quantite: 1, prix_unitaire: 22 },
    { id: "l2", produit_nom: "Sucre 1 kg", produit_reference: "SUC-1", quantite: 1, prix_unitaire: 1.5 },
  ],
};

describe("réservation publique", () => {
  it("référence, statut, boutique, articles, total et prochaine étape — sans téléphone ni e-mail du client", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/public/reservations/r-9", 200, RESERVATION);
    const { container } = rendreApp("/reservations/r-9");
    expect(await screen.findByRole("heading", { level: 1, name: "Détail de la réservation" })).toBeTruthy();
    expect(screen.getByText("RES-20261018-AB12")).toBeTruthy();
    expect(screen.getByText("En attente de retrait")).toBeTruthy();
    expect(screen.getByText("Mme Ade")).toBeTruthy();
    const boutique = screen.getByRole("region", { name: "Boutique de retrait" });
    expect(boutique.textContent).toContain("Avenue du Commerce 12");
    const articles = screen.getByRole("region", { name: "Articles réservés" });
    expect(within(articles).getByText(/RIZ-25 — Qté : 1/)).toBeTruthy();
    expect(espaces(screen.getByText("Total à payer").nextSibling?.textContent)).toBe("23,5 $");
    expect(screen.getByText(/Retrait prévu le/)).toBeTruthy();
    expect(screen.getByText(/Présentez-vous en boutique avec cette référence/)).toBeTruthy();
    // Aucune coordonnée du client sur une page que tout détenteur du lien peut ouvrir.
    expect(container.textContent).not.toMatch(/\+243 900|@/);
    await sansViolation(container);
  });

  it("copie le lien de suivi", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/public/reservations/r-9", 200, RESERVATION);
    const ecrire = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true });
    rendreApp("/reservations/r-9");
    await userEvent.click(await screen.findByRole("button", { name: "Copier le lien" }));
    expect(ecrire).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByText("Lien copié")).toBeTruthy();
  });

  it("une réservation retirée n'affiche plus la prochaine étape", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/public/reservations/r-9", 200, { ...RESERVATION, statut: "retiree", date_retrait_prevue: null });
    rendreApp("/reservations/r-9");
    expect(await screen.findByText("Retirée")).toBeTruthy();
    expect(screen.queryByText(/Présentez-vous en boutique/)).toBeNull();
    expect(screen.queryByText(/Retrait prévu le/)).toBeNull();
  });

  it("une réservation inconnue est annoncée introuvable", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("GET", "/public/reservations/r-0", 404, { erreur: "Réservation introuvable" });
    rendreApp("/reservations/r-0");
    expect(await screen.findByRole("heading", { level: 1, name: "Réservation introuvable" })).toBeTruthy();
  });
});
