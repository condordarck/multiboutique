import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_DETAIL, commandeFournisseur, FOURNISSEURS, PRODUITS } from "../../../test/donnees";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/achats`;
const espaces = (t: string | null | undefined) => (t ?? "").replace(/[  ]/g, " ");
const tuile = (libelle: string) => screen.getByText(libelle, { selector: "span" }).parentElement!;

function preparer(role: "gerant" | "comptable" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/fournisseurs`, 200, FOURNISSEURS);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/produits`, 200, PRODUITS);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/commandes-fournisseurs`, 200, [
    commandeFournisseur(),
    commandeFournisseur({ id: "cf2", reference_cmd: "CF-0002", statut: "en_attente", total_attendu: 50, lignes: [{ commande_id: "cf2", ligne_id: "l2", produit_id: "p-sucre", produit_nom: "Sucre 1 kg", quantite_commandee: 30, quantite_recue: 0, prix_unitaire: 1 }] }),
    commandeFournisseur({ id: "cf3", reference_cmd: "CF-0003", statut: "annulee", total_attendu: 99 }),
  ]);
}

const commandes = () => screen.findByRole("table", { name: "Commandes fournisseur" });

describe("achats", () => {
  it("indicateurs, commandes avec réception partielle, fournisseurs", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    expect(await screen.findByRole("heading", { level: 1, name: "Achats — Boutique 1" })).toBeTruthy();
    const [cf1, , cf3] = within(await commandes()).getAllByRole("row").slice(1);
    expect(tuile("Fournisseurs").textContent).toContain("2");
    expect(tuile("Commandes en cours").textContent).toContain("2");
    expect(espaces(tuile("Engagé (en cours)").textContent)).toContain("770 $");
    expect(cf1!.textContent).toContain("10 / 40 unités");
    expect(within(cf1!).getByText("Partielle")).toBeTruthy();
    // Une commande annulée ne se réceptionne pas (ni ne s'annule).
    expect(within(cf3!).queryAllByRole("button")).toHaveLength(0);
    const fournisseurs = screen.getByRole("table", { name: "Fournisseurs" });
    expect(within(fournisseurs).getByText("Inactif")).toBeTruthy();
    await sansViolation(container);
  });

  it("modifie une commande sans réception : fournisseur figé, lignes reprises, total recalculé", async () => {
    preparer();
    api.repondre("PUT", "/commandes-fournisseurs/cf2", 200, { success: true, totalAttendu: 70 });
    rendreApp(PAGE);
    const [cf1, cf2] = within(await commandes()).getAllByRole("row").slice(1);
    // Une réception a commencé : plus de modification.
    expect(within(cf1!).queryByRole("button", { name: /^Modifier/ })).toBeNull();
    await userEvent.click(within(cf2!).getByRole("button", { name: "Modifier CF-0002" }));
    const panneau = screen.getByRole("dialog", { name: "Modifier CF-0002" });
    expect(within(panneau).getByText("Minoterie du Fleuve")).toBeTruthy();
    expect(within(panneau).queryByLabelText("Fournisseur")).toBeNull();
    const qte = within(panneau).getByLabelText("Quantité de l'article 1");
    expect((qte as HTMLInputElement).value).toBe("30");
    await userEvent.clear(qte);
    await userEvent.type(qte, "70");
    expect(espaces(within(panneau).getByText(/^Total attendu/).textContent)).toBe("Total attendu : 70 $");
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer les modifications" }));
    await waitFor(() =>
      expect(api.ecritures()[0]).toMatchObject({
        methode: "PUT",
        chemin: "/commandes-fournisseurs/cf2",
        corps: { note: "", lignes: [{ produit_id: "p-sucre", quantite: 70, prix_unitaire: 1 }] },
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("réception partielle : seules les quantités saisies partent, plafonnées au restant", async () => {
    preparer();
    api.repondre("POST", "/commandes-fournisseurs/cf1/reception", 200, { success: true, reference: "CF-0001" });
    rendreApp(PAGE);
    await userEvent.click(within(await commandes()).getByRole("button", { name: "Réceptionner CF-0001" }));
    const panneau = screen.getByRole("dialog", { name: "Réception — CF-0001" });
    await userEvent.click(within(panneau).getByRole("button", { name: "Valider la réception" }));
    expect(within(panneau).getByRole("alert").textContent).toBe("Entrez au moins une quantité reçue");
    const champ = within(panneau).getByLabelText("Riz 25 kg — reçu 10 / 40");
    expect(champ.getAttribute("placeholder")).toBe("Max 30");
    await userEvent.type(champ, "12");
    await userEvent.click(within(panneau).getByRole("button", { name: "Valider la réception" }));
    await waitFor(() => expect(api.ecritures()[0]!.corps).toEqual({ receptions: [{ ligne_id: "l1", quantite_recue: 12 }] }));
  });

  it("annule une commande en attente, après confirmation", async () => {
    preparer();
    api.repondre("POST", "/commandes-fournisseurs/cf2/annulation", 200, { success: true });
    rendreApp(PAGE);
    const t = await commandes();
    expect(within(t).queryByRole("button", { name: "Annuler CF-0001" })).toBeNull();
    await userEvent.click(within(t).getByRole("button", { name: "Annuler CF-0002" }));
    await userEvent.click(within(screen.getByRole("alertdialog", { name: "Annuler la commande fournisseur CF-0002 ?" })).getByRole("button", { name: "Annuler la commande" }));
    await waitFor(() => expect(api.ecritures()[0]!.chemin).toBe("/commandes-fournisseurs/cf2/annulation"));
  });

  it("commande à un fournisseur actif, prix d'achat proposé au coût de revient", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/commandes-fournisseurs`, 201, { success: true, reference: "CF-0004" });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouvelle commande fournisseur" }));
    const panneau = screen.getByRole("dialog", { name: "Nouvelle commande fournisseur" });
    const fournisseur = within(panneau).getByLabelText("Fournisseur");
    expect(within(fournisseur).queryByRole("option", { name: "Ancien grossiste" })).toBeNull();
    await userEvent.selectOptions(fournisseur, "f1");
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter un article" }));
    await userEvent.selectOptions(within(panneau).getByLabelText("Produit de l'article 1"), "p-riz");
    expect((within(panneau).getByLabelText("Prix d'achat de l'article 1") as HTMLInputElement).value).toBe("18");
    await userEvent.clear(within(panneau).getByLabelText("Quantité de l'article 1"));
    await userEvent.type(within(panneau).getByLabelText("Quantité de l'article 1"), "40");
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer la commande" }));
    await waitFor(() =>
      expect(api.ecritures()[0]!.corps).toEqual({ fournisseur_id: "f1", lignes: [{ produit_id: "p-riz", quantite: 40, prix_unitaire: 18 }] })
    );
    expect(await within(panneau).findByText("Commande fournisseur CF-0004 enregistrée")).toBeTruthy();
  });

  it("crée, modifie et désactive un fournisseur", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/fournisseurs`, 201, { success: true });
    api.repondre("PUT", `/boutiques/${BOUTIQUE_1}/fournisseurs/f1`, 200, { success: true });
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/fournisseurs/f1/activation`, 200, { success: true });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouveau fournisseur" }));
    let panneau = screen.getByRole("dialog", { name: "Nouveau fournisseur" });
    await userEvent.type(within(panneau).getByLabelText("Nom"), "Huilerie Kwilu");
    await userEvent.click(within(panneau).getByRole("button", { name: "Ajouter le fournisseur" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const fournisseurs = screen.getByRole("table", { name: "Fournisseurs" });
    await userEvent.click(within(fournisseurs).getByRole("button", { name: "Modifier Minoterie du Fleuve" }));
    panneau = screen.getByRole("dialog", { name: "Minoterie du Fleuve" });
    await userEvent.clear(within(panneau).getByLabelText("Adresse"));
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(within(fournisseurs).getByRole("button", { name: "Désactiver Minoterie du Fleuve" }));
    await waitFor(() =>
      expect(api.ecritures().map((a) => [a.methode, a.corps])).toEqual([
        ["POST", { nom: "Huilerie Kwilu" }],
        ["PUT", { nom: "Minoterie du Fleuve", telephone: "+243 811 000 000" }],
        ["POST", {}],
      ])
    );
  });

  it("sans achats:gerer, lecture seule", async () => {
    preparer("comptable");
    rendreApp(PAGE);
    expect(within(await commandes()).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Nouveau fournisseur" })).toBeNull();
  });
});
