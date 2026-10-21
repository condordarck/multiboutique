import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL } from "../../../test/donnees";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/rapports`;
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");
const tuile = (libelle: string) => screen.getByText(libelle, { selector: "span" }).parentElement!;

const RAPPORT = {
  periode: "mois",
  debut: new Date(2026, 9, 1).toISOString(),
  fin: new Date(2026, 10, 1).toISOString(),
  totaux: { nb_ventes: 3, ca: 1000, remises: 20, nb_promos: 1, panier_moyen: 333.333 },
  par_jour: [{ jour: "2026-10-17", nb: 3, ca: 1000 }],
  par_mode: [
    { mode_paiement: "especes", nb: 2, ca: 750 },
    { mode_paiement: "mobile_money", nb: 1, ca: 250 },
  ],
  top_produits: [{ nom: "Riz 25 kg", qte: 40, ca: 880 }],
  reservations: { nb: 2, montant: 60 },
  vendeur: null,
  produit: null,
  vendeurs: [
    { id: "v1", nom: "Awa Diallo" },
    { id: "v2", nom: "Koffi Mensah" },
  ],
  produits: [{ id: "p1", nom: "Riz 25 kg" }],
};

function preparer() {
  api = fauxApi();
  connecte(api, utilisateur({ role: "gerant" }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/rapports?periode=mois`, 200, RAPPORT);
}

describe("rapports", () => {
  it("synthèse, ventes par jour, modes de paiement, top produits et réservations", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 2, name: "Rapport mensuel — 01/10/2026 au 31/10/2026" })).toBeTruthy();
    expect(tuile("Ventes validées").textContent).toContain("3");
    expect(espaces(tuile("Chiffre d'affaires").textContent)).toContain("1 000 $");
    expect(espaces(tuile("Panier moyen").textContent)).toContain("333 $");
    expect(espaces(tuile("Remises accordées").textContent)).toContain("20 $");
    expect(within(screen.getByRole("table", { name: "Ventes par jour" })).getByText("2026-10-17")).toBeTruthy();
    const modes = screen.getByRole("region", { name: "Modes de paiement" });
    expect(within(modes).getByText("Espèces")).toBeTruthy();
    expect(within(modes).getByRole("meter", { name: "Mobile Money" }).getAttribute("aria-valuenow")).toBe("25");
    expect(within(screen.getByRole("table", { name: "Top produits (CA)" })).getByText("Riz 25 kg")).toBeTruthy();
    expect(tuile("Réservations créées").textContent).toContain("2");
    await sansViolation(container);
  });

  it("la période choisie part à l'API et reste dans l'adresse", async () => {
    preparer();
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/rapports?periode=personnalisee&debut=2026-10-01&fin=2026-10-15`, 200, {
      ...RAPPORT,
      periode: "personnalisee",
      fin: new Date(2026, 9, 16).toISOString(),
    });
    const app = rendreApp(PAGE);
    await screen.findByRole("heading", { level: 2, name: /Rapport mensuel/ });
    await userEvent.selectOptions(screen.getByLabelText("Période"), "personnalisee");
    await userEvent.type(screen.getByLabelText("Du"), "2026-10-01");
    await userEvent.type(screen.getByLabelText("Au"), "2026-10-15");
    await userEvent.click(screen.getByRole("button", { name: "Générer le rapport" }));
    await waitFor(() => expect(app.adresse()).toBe(`${PAGE}?periode=personnalisee&debut=2026-10-01&fin=2026-10-15`));
    expect(await screen.findByRole("heading", { level: 2, name: "Rapport personnalisé — 01/10/2026 au 15/10/2026" })).toBeTruthy();
  });

  it("filtres vendeur et produit : partent à l'API, nommés sous le titre", async () => {
    preparer();
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/rapports?periode=mois&vendeur=v2&produit=p1`, 200, {
      ...RAPPORT,
      vendeur: "v2",
      produit: "p1",
    });
    const app = rendreApp(PAGE);
    await screen.findByRole("heading", { level: 2, name: /Rapport mensuel/ });
    expect(screen.getByText("Remises accordées", { selector: "span" })).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText("Vendeur"), "v2");
    await userEvent.selectOptions(screen.getByLabelText("Produit"), "p1");
    await userEvent.click(screen.getByRole("button", { name: "Générer le rapport" }));
    await waitFor(() => expect(app.adresse()).toBe(`${PAGE}?periode=mois&vendeur=v2&produit=p1`));
    expect(await screen.findByText("Vendeur : Koffi Mensah")).toBeTruthy();
    expect(screen.getByText(/Produit : Riz 25 kg/)).toBeTruthy();
    expect(screen.queryByText("Remises accordées", { selector: "span" })).toBeNull();
    expect(screen.getByText(/ce filtre ne s'y applique pas/)).toBeTruthy();
  });
});
