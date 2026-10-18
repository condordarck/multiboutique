import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, DOSSIERS } from "../../../test/donnees";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/clients`;
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");
const tuile = (libelle: string) => screen.getByText(libelle, { selector: "span" }).parentElement!;

function preparer(role: "gerant" | "comptable" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/clients`, 200, DOSSIERS);
}

async function ouvrirDossier(nom: string) {
  const table = await screen.findByRole("table", { name: "Dossiers clients" });
  await userEvent.click(within(table).getByRole("button", { name: `Ouvrir le dossier de ${nom}` }));
  return screen.getByRole("dialog", { name: nom });
}

describe("clients", () => {
  it("indicateurs, relances et dossiers", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Clients — Boutique 1" })).toBeTruthy();
    await screen.findByText("Clients VIP", { selector: "span" });
    expect(tuile("Clients").textContent).toContain("2");
    expect(espaces(tuile("Encours total").textContent)).toContain("460 $");
    expect(espaces(tuile("Crédit plafonné alloué").textContent)).toContain("500 $");
    expect(tuile("Clients VIP").textContent).toContain("1");

    const relances = screen.getByRole("region", { name: /Relances/ });
    expect(within(relances).getByText("Quincaillerie Ade")).toBeTruthy();
    expect(espaces(within(relances).getByText(/45 j/).textContent)).toBe("460 $ · 45 j");

    const table = screen.getByRole("table", { name: "Dossiers clients" });
    const [ade, bola] = within(table).getAllByRole("row").slice(1);
    expect(within(ade!).getByText("VIP")).toBeTruthy();
    expect(espaces(ade!.textContent)).toContain("40 $"); // disponible = 500 - 460
    expect(within(bola!).getByText("Comptant")).toBeTruthy();
    expect(within(bola!).getByText("Bloqué")).toBeTruthy();
    await sansViolation(container);
  });

  it("crée un client", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/clients`, 201, { success: true });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouveau client" }));
    const panneau = screen.getByRole("dialog", { name: "Nouveau client" });
    await userEvent.type(within(panneau).getByLabelText("Nom"), "Épicerie Kanza");
    await userEvent.selectOptions(within(panneau).getByLabelText("Type de client"), "detaillant");
    await userEvent.type(within(panneau).getByLabelText("Plafond de crédit (0 = au comptant)"), "200");
    await userEvent.click(within(panneau).getByRole("checkbox", { name: /Client VIP/ }));
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer le client" }));
    await waitFor(() =>
      expect(api.ecritures()[0]!.corps).toEqual({ nom: "Épicerie Kanza", type_client: "detaillant", plafond_credit: 200, est_vip: true })
    );
  });

  it("règle un montant : le registre est relu, l'encours et le plafonnement sont expliqués", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/clients/c1/reglements`, 200, { success: true });
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/clients/c1/registre`, 200, [
      { id: "r1", type: "vente", libelle: "Vente à crédit — VTE-1", montant: 460, soldeApres: 460, auteurNom: "Koffi", createdAt: "2026-10-01T10:00:00Z" },
    ]);
    rendreApp(PAGE);
    const dossier = await ouvrirDossier("Quincaillerie Ade");
    expect(await within(dossier).findByText(/Vente à crédit — VTE-1/)).toBeTruthy();
    expect(within(dossier).getByText(/au-delà de l'encours, seul l'encours est réglé/)).toBeTruthy();
    await userEvent.type(within(dossier).getByLabelText("Montant réglé"), "100");
    await userEvent.click(within(dossier).getByRole("button", { name: "Enregistrer le règlement" }));
    await waitFor(() => expect(api.ecritures()[0]).toMatchObject({ chemin: `/boutiques/${BOUTIQUE_1}/clients/c1/reglements`, corps: { montant: 100 } }));
    await waitFor(() => expect(api.appels().filter((a) => a.chemin.endsWith("/registre")).length).toBe(2));
  });

  it("VIP, blocage et modification depuis le dossier", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/clients/c1/vip`, 200, { success: true });
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/clients/c1/activation`, 200, { success: true });
    api.repondre("PUT", `/boutiques/${BOUTIQUE_1}/clients/c1`, 200, { success: true });
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/clients/c1/registre`, 200, []);
    rendreApp(PAGE);
    const dossier = await ouvrirDossier("Quincaillerie Ade");
    await userEvent.click(within(dossier).getByRole("button", { name: "Retirer le statut VIP" }));
    await userEvent.click(within(dossier).getByRole("button", { name: "Désactiver" }));
    await userEvent.click(within(dossier).getByRole("button", { name: "Modifier" }));
    const telephone = within(dossier).getByLabelText("Téléphone");
    await userEvent.clear(telephone);
    await userEvent.click(within(dossier).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.ecritures().map((a) => `${a.methode} ${a.chemin.split("/").at(-1)}`)).toEqual(["POST vip", "POST activation", "PUT c1"]));
    expect(api.ecritures()[2]!.corps).toEqual({ nom: "Quincaillerie Ade", type_client: "grossiste", plafond_credit: 500, est_vip: true });
  });

  it("sans clients:gerer, dossier en lecture : registre seulement", async () => {
    preparer("comptable");
    api.repondre("GET", `/boutiques/${BOUTIQUE_1}/clients/c1/registre`, 200, []);
    rendreApp(PAGE);
    expect(screen.queryByRole("button", { name: "Nouveau client" })).toBeNull();
    const dossier = await ouvrirDossier("Quincaillerie Ade");
    expect(await within(dossier).findByText("Aucune opération enregistrée.")).toBeTruthy();
    expect(within(dossier).queryByRole("button", { name: "Modifier" })).toBeNull();
    expect(within(dossier).queryByLabelText("Montant réglé")).toBeNull();
  });
});
