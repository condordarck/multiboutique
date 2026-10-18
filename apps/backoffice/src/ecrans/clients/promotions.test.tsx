import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { sansViolation } from "../../../test/axe";
import { BOUTIQUE_DETAIL, codePromo } from "../../../test/donnees";
import { fauxApi, type FauxApi } from "../../../test/faux-api";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());
const PAGE = `/b/${BOUTIQUE_1}/promotions`;

function preparer(role: "gerant" | "comptable" = "gerant") {
  api = fauxApi();
  connecte(api, utilisateur({ role }));
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}`, 200, BOUTIQUE_DETAIL);
  api.repondre("GET", `/boutiques/${BOUTIQUE_1}/codes-promo`, 200, [
    codePromo(),
    codePromo({ id: "cp2", code: "FIXE5", type_reduction: "montant", valeur_reduction: 5, max_utilisations: null, date_fin: "2020-01-01", actif: true }),
    codePromo({ id: "cp3", code: "NOEL", actif: false, max_utilisations: null }),
  ]);
}

const table = () => screen.findByRole("table", { name: "Codes promo" });

describe("promotions", () => {
  it("codes, réduction, validité, utilisations et statut", async () => {
    preparer();
    const { container } = rendreApp(PAGE);
    const lignes = within(await table()).getAllByRole("row").slice(1);
    expect(lignes[0]!.textContent).toContain("10%");
    expect(lignes[0]!.textContent).toContain("4 / 100");
    expect(within(lignes[0]!).getByText("Active")).toBeTruthy();
    expect(lignes[1]!.textContent?.replace(/[  ]/g, " ")).toContain("5 $");
    expect(within(lignes[1]!).getByText("Expirée")).toBeTruthy();
    expect(within(lignes[2]!).getByText("Inactive")).toBeTruthy();
    expect(lignes[2]!.textContent).toContain("∞");
    await sansViolation(container);
  });

  it("crée un code : majuscules, contrôles du pourcentage et des dates", async () => {
    preparer();
    api.repondre("POST", `/boutiques/${BOUTIQUE_1}/codes-promo`, 201, { success: true });
    rendreApp(PAGE);
    await userEvent.click(await screen.findByRole("button", { name: "Nouveau code promo" }));
    const panneau = screen.getByRole("dialog", { name: "Nouveau code promo" });
    await userEvent.type(within(panneau).getByLabelText("Code promo"), "rentree15");
    await userEvent.type(within(panneau).getByLabelText("Pourcentage de réduction"), "150");
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer le code" }));
    expect(within(panneau).getByRole("alert").textContent).toBe("Le pourcentage doit être entre 1 et 100");

    await userEvent.clear(within(panneau).getByLabelText("Pourcentage de réduction"));
    await userEvent.type(within(panneau).getByLabelText("Pourcentage de réduction"), "15");
    await userEvent.type(within(panneau).getByLabelText("Date de début (optionnel)"), "2026-11-01");
    await userEvent.type(within(panneau).getByLabelText("Date de fin (optionnel)"), "2026-10-01");
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer le code" }));
    expect(within(panneau).getByRole("alert").textContent).toBe("La date de fin est antérieure à la date de début");

    await userEvent.clear(within(panneau).getByLabelText("Date de fin (optionnel)"));
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer le code" }));
    await waitFor(() =>
      expect(api.ecritures()[0]!.corps).toEqual({
        code: "RENTREE15",
        type_reduction: "pourcentage",
        valeur_reduction: 15,
        max_utilisations: null,
        date_debut: "2026-11-01",
        date_fin: null,
      })
    );
  });

  it("arrête, lance et supprime après confirmation", async () => {
    preparer();
    api.repondre("POST", "/codes-promo/cp1/activation", 200, { success: true });
    api.repondre("DELETE", "/codes-promo/cp3", 200, { success: true });
    rendreApp(PAGE);
    const t = await table();
    await userEvent.click(within(t).getByRole("button", { name: "Arrêter GROSSISTE10" }));
    await userEvent.click(within(t).getByRole("button", { name: "Supprimer NOEL" }));
    const dialogue = screen.getByRole("alertdialog", { name: "Supprimer le code NOEL ?" });
    await userEvent.click(within(dialogue).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(api.ecritures().map((a) => `${a.methode} ${a.chemin}`)).toEqual(["POST /codes-promo/cp1/activation", "DELETE /codes-promo/cp3"]));
  });

  it("modifie un code", async () => {
    preparer();
    api.repondre("PUT", "/codes-promo/cp1", 200, { success: true });
    rendreApp(PAGE);
    await userEvent.click(within(await table()).getByRole("button", { name: "Modifier GROSSISTE10" }));
    const panneau = screen.getByRole("dialog", { name: "Modifier GROSSISTE10" });
    await userEvent.clear(within(panneau).getByLabelText("Limite d'utilisations (vide = illimité)"));
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(api.ecritures()[0]!.corps).toMatchObject({ code: "GROSSISTE10", max_utilisations: null, date_debut: "2026-10-01" }));
  });

  it("sans promos:gerer, lecture seule", async () => {
    preparer("comptable");
    rendreApp(PAGE);
    await table();
    expect(screen.queryByRole("button", { name: "Nouveau code promo" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Arrêter/ })).toBeNull();
  });
});
