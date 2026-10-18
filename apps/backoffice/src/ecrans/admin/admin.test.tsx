import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sansViolation } from "@multiboutique/front/test/axe";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { BOUTIQUE_1, BOUTIQUE_2, connecte, rendreApp, utilisateur } from "../../../test/rendu";

let api: FauxApi;
const ADMIN = utilisateur({ id: "admin-1", role: "administrateur", boutique_ids: [], nom_complet: "Administrateur" });
const GROUPE = { id: "g1", nom: "Groupe Ouest", created_at: "", updated_at: "" };
const REGION = { id: "rg1", nom: "Kinshasa", groupe_id: "g1", created_at: "", updated_at: "" };
const BOUTIQUES = [
  { id: BOUTIQUE_1, nom: "Boutique 1", statut: "active", adresse: "Adresse 1", telephone: null, email: null, region_id: "rg1", region_nom: "Kinshasa", groupe_nom: "Groupe Ouest" },
  { id: BOUTIQUE_2, nom: "Boutique 2", statut: "inactive", adresse: null, telephone: null, email: null, region_id: null, region_nom: null, groupe_nom: null },
];

beforeEach(() => {
  api = fauxApi();
  connecte(api, ADMIN);
});
afterEach(() => api.restaurer());

describe("administration", () => {
  it("accueil : compteurs et raccourcis", async () => {
    api.repondre("GET", "/admin/statistiques", 200, { utilisateurs: 12, boutiques: 3, boutiques_actives: 2, produits: 140 });
    const { container } = rendreApp("/admin");
    expect(await screen.findByRole("heading", { level: 1, name: "Accueil administrateur" })).toBeTruthy();
    expect(await screen.findByText("2 / 3")).toBeTruthy();
    // Le raccourci du contenu (le menu a aussi un lien « Utilisateurs »).
    expect(within(screen.getByRole("main")).getByRole("link", { name: /^Utilisateurs/ }).getAttribute("href")).toBe("/admin/utilisateurs");
    await sansViolation(container);
  });

  describe("utilisateurs", () => {
    beforeEach(() => {
      api.repondre("GET", "/admin/utilisateurs", 200, {
        utilisateurs: [
          { id: "admin-1", email: "admin@x", nom_complet: "Administrateur", role: "administrateur", boutique_ids: [], region_id: null, groupe_id: null, telephone: null, actif: true, created_at: "", boutique_noms: [], region_nom: null, groupe_nom: null },
          { id: "u2", email: "awa@x", nom_complet: "Awa", role: "gerant", boutique_ids: [BOUTIQUE_1], region_id: null, groupe_id: null, telephone: null, actif: true, created_at: "", boutique_noms: ["Boutique 1"], region_nom: null, groupe_nom: null },
          { id: "u3", email: "dir@x", nom_complet: "Directeur", role: "directeur_region", boutique_ids: [], region_id: "rg1", groupe_id: null, telephone: null, actif: false, created_at: "", boutique_noms: [], region_nom: "Kinshasa", groupe_nom: null },
        ],
        boutiques: BOUTIQUES.filter((b) => b.statut === "active"),
        groupes: [GROUPE],
        regions: [REGION],
      });
    });

    it("liste, profil, périmètre ; on ne se désactive pas soi-même", async () => {
      const { container } = rendreApp("/admin/utilisateurs");
      const table = await screen.findByRole("table", { name: "Utilisateurs" });
      const [moi, awa, dir] = within(table).getAllByRole("row").slice(1);
      expect(within(moi!).getByRole("button", { name: "Désactiver Administrateur" }).hasAttribute("disabled")).toBe(true);
      expect(within(awa!).getByText("Boutique 1")).toBeTruthy();
      expect(dir!.textContent).toContain("Région : Kinshasa");
      expect(within(dir!).getByText("Désactivé")).toBeTruthy();
      await sansViolation(container);
    });

    it("crée un gérant rattaché à ses boutiques, puis un directeur de région", async () => {
      api.repondre("POST", "/admin/utilisateurs", 201, { success: true });
      rendreApp("/admin/utilisateurs");
      await userEvent.click(await screen.findByRole("button", { name: "Créer un utilisateur" }));
      let panneau = screen.getByRole("dialog", { name: "Créer un utilisateur" });
      await userEvent.type(within(panneau).getByLabelText("Nom complet"), "Koffi");
      await userEvent.type(within(panneau).getByLabelText("E-mail"), "koffi@x");
      await userEvent.type(within(panneau).getByLabelText("Mot de passe"), "secret1");
      await userEvent.click(within(panneau).getByRole("checkbox", { name: "Boutique 1" }));
      await userEvent.click(within(panneau).getByRole("button", { name: "Créer le compte" }));
      await waitFor(() =>
        expect(api.ecritures()[0]!.corps).toEqual({
          nom_complet: "Koffi",
          email: "koffi@x",
          password: "secret1",
          role: "gerant",
          boutique_ids: [BOUTIQUE_1],
          region_id: null,
          groupe_id: null,
        })
      );

      panneau = screen.getByRole("dialog", { name: "Créer un utilisateur" });
      await userEvent.selectOptions(within(panneau).getByLabelText("Profil"), "directeur_region");
      expect(within(panneau).queryByRole("checkbox", { name: "Boutique 1" })).toBeNull();
      await userEvent.type(within(panneau).getByLabelText("Nom complet"), "Dir");
      await userEvent.type(within(panneau).getByLabelText("E-mail"), "dir2@x");
      await userEvent.type(within(panneau).getByLabelText("Mot de passe"), "secret1");
      await userEvent.selectOptions(within(panneau).getByLabelText("Région supervisée"), "rg1");
      await userEvent.click(within(panneau).getByRole("button", { name: "Créer le compte" }));
      await waitFor(() => expect(api.ecritures()[1]!.corps).toMatchObject({ role: "directeur_region", region_id: "rg1", boutique_ids: [] }));
    });

    it("réinitialise un mot de passe et désactive un compte", async () => {
      api.repondre("PUT", "/admin/utilisateurs/u2/mot-de-passe", 200, { success: true });
      api.repondre("POST", "/admin/utilisateurs/u2/activation", 200, { success: true });
      rendreApp("/admin/utilisateurs");
      const table = await screen.findByRole("table", { name: "Utilisateurs" });
      await userEvent.click(within(table).getByRole("button", { name: "Mot de passe de Awa" }));
      const panneau = screen.getByRole("dialog", { name: "Nouveau mot de passe — Awa" });
      await userEvent.type(within(panneau).getByLabelText("Nouveau mot de passe"), "nouveau1");
      await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
      await userEvent.click(within(table).getByRole("button", { name: "Désactiver Awa" }));
      await waitFor(() =>
        expect(api.ecritures().map((a) => [a.chemin, a.corps])).toEqual([
          ["/admin/utilisateurs/u2/mot-de-passe", { mot_de_passe: "nouveau1" }],
          ["/admin/utilisateurs/u2/activation", {}],
        ])
      );
    });
  });

  describe("boutiques", () => {
    beforeEach(() => {
      api.repondre("GET", "/admin/boutiques", 200, { boutiques: BOUTIQUES, regions: [REGION] });
    });

    it("crée une boutique : les comptes par défaut s'affichent une fois, puis disparaissent", async () => {
      api.repondre("POST", "/admin/boutiques", 201, {
        success: true,
        boutiqueId: "b9",
        comptes: [{ role: "gerant", label: "Gérant", email: "gerant.b9@x", password: "Xy7-secret" }],
      });
      rendreApp("/admin/boutiques");
      await userEvent.click(await screen.findByRole("button", { name: "Créer une boutique" }));
      const panneau = screen.getByRole("dialog", { name: "Créer une boutique" });
      await userEvent.type(within(panneau).getByLabelText("Nom"), "Boutique 9");
      await userEvent.selectOptions(within(panneau).getByLabelText("Région"), "rg1");
      await userEvent.click(within(panneau).getByRole("button", { name: "Créer la boutique" }));
      expect(await within(panneau).findByText("Xy7-secret")).toBeTruthy();
      expect(api.ecritures()[0]!.corps).toEqual({ nom: "Boutique 9", region_id: "rg1", statut: "active" });
      await userEvent.click(within(panneau).getByRole("button", { name: "Fermer" }));
      await userEvent.click(screen.getByRole("button", { name: "Créer une boutique" }));
      expect(screen.queryByText("Xy7-secret")).toBeNull();
    });

    it("modifier ou désactiver garde la région", async () => {
      api.repondre("PUT", `/admin/boutiques/${BOUTIQUE_1}`, 200, { success: true });
      rendreApp("/admin/boutiques");
      const table = await screen.findByRole("table", { name: "Boutiques" });
      await userEvent.click(within(table).getByRole("button", { name: "Désactiver Boutique 1" }));
      await waitFor(() =>
        expect(api.ecritures()[0]!.corps).toEqual({ nom: "Boutique 1", adresse: "Adresse 1", region_id: "rg1", statut: "inactive" })
      );
    });

    it("comptes d'une boutique et création des profils par défaut manquants", async () => {
      api.repondre("GET", `/admin/boutiques/${BOUTIQUE_1}/comptes`, 200, [{ id: "u2", nom_complet: "Awa", email: "awa@x", role: "gerant", actif: true }]);
      api.repondre("POST", `/admin/boutiques/${BOUTIQUE_1}/comptes-par-defaut`, 200, {
        success: true,
        comptes: [{ role: "vendeur", label: "Vendeur", email: "vendeur.b1@x", password: "Pw-123" }],
      });
      rendreApp("/admin/boutiques");
      await userEvent.click(within(await screen.findByRole("table", { name: "Boutiques" })).getByRole("button", { name: "Comptes de Boutique 1" }));
      const panneau = screen.getByRole("dialog", { name: "Comptes — Boutique 1" });
      expect(await within(panneau).findByText("Awa")).toBeTruthy();
      await userEvent.click(within(panneau).getByRole("button", { name: "Créer les profils par défaut manquants" }));
      expect(await within(panneau).findByText("Pw-123")).toBeTruthy();
    });
  });

  it("organisation : organigramme, création et modification d'un groupe et d'une région", async () => {
    api.repondre("GET", "/admin/organisation", 200, {
      groupes: [GROUPE],
      regions: [{ ...REGION, groupe_nom: "Groupe Ouest", nb_boutiques: 1, boutique_noms: ["Boutique 1"] }],
      sans_region: [{ nom: "Boutique 2" }],
    });
    api.repondre("POST", "/admin/groupes", 201, { success: true });
    api.repondre("PUT", "/admin/regions/rg1", 200, { success: true });
    const { container } = rendreApp("/admin/organisation");
    const groupe = await screen.findByRole("region", { name: "Groupe Ouest" });
    expect(groupe.textContent).toContain("1 région · 1 boutique");
    expect(within(groupe).getByText("Boutique 1")).toBeTruthy();
    expect(screen.getByText("Boutiques sans région (1)")).toBeTruthy();
    await sansViolation(container);

    await userEvent.click(screen.getByRole("button", { name: "Nouveau groupe" }));
    let panneau = screen.getByRole("dialog", { name: "Nouveau groupe" });
    await userEvent.type(within(panneau).getByLabelText("Nom du groupe"), "Groupe Est");
    await userEvent.click(within(panneau).getByRole("button", { name: "Créer le groupe" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(within(groupe).getByRole("button", { name: "Modifier la région Kinshasa" }));
    panneau = screen.getByRole("dialog", { name: "Région Kinshasa" });
    const nom = within(panneau).getByLabelText("Nom de la région");
    await userEvent.clear(nom);
    await userEvent.type(nom, "Kinshasa-Est");
    await userEvent.click(within(panneau).getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(api.ecritures().map((a) => [a.methode, a.chemin, a.corps])).toEqual([
        ["POST", "/admin/groupes", { nom: "Groupe Est" }],
        ["PUT", "/admin/regions/rg1", { nom: "Kinshasa-Est", groupe_id: "g1" }],
      ])
    );
  });

  it("catégories : création, modification ; suppression impossible avec des produits", async () => {
    api.repondre("GET", "/admin/categories", 200, [
      { id: "c1", nom: "Boissons", description: null, nb_produits: 4 },
      { id: "c2", nom: "Vide", description: "À retirer", nb_produits: 0 },
    ]);
    api.repondre("DELETE", "/admin/categories/c2", 200, { success: true });
    rendreApp("/admin/categories");
    const table = await screen.findByRole("table", { name: "Catégories" });
    expect(within(table).getByRole("button", { name: "Supprimer Boissons" }).hasAttribute("disabled")).toBe(true);
    await userEvent.click(within(table).getByRole("button", { name: "Supprimer Vide" }));
    await userEvent.click(within(screen.getByRole("alertdialog", { name: "Supprimer la catégorie « Vide » ?" })).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(api.ecritures()[0]!.chemin).toBe("/admin/categories/c2"));
  });

  it("rôles : une case cochée est un appel ; l'échec rétablit la case", async () => {
    api.repondre("GET", "/admin/roles", 200, [{ role: "vendeur", permission: "ventes:creer", active: true }]);
    api.repondre("PUT", "/admin/permissions/vendeur/stock%3Agerer", 200, { success: true });
    api.repondre("PUT", "/admin/permissions/vendeur/ventes%3Acreer", 500, { erreur: "Erreur serveur, réessayez" });
    rendreApp("/admin/roles");
    const caseStock = await screen.findByRole("checkbox", { name: "Vendeur — Entrées / ajustements de stock" });
    await userEvent.click(caseStock);
    await waitFor(() => expect(api.ecritures()[0]!.corps).toEqual({ active: true }));
    const caseVente = screen.getByRole("checkbox", { name: "Vendeur — Encaisser une vente" }) as HTMLInputElement;
    expect(caseVente.checked).toBe(true);
    await userEvent.click(caseVente);
    expect(await screen.findByText("Erreur serveur, réessayez")).toBeTruthy();
    expect(caseVente.checked).toBe(true);
  });

  it("paramètres : un seuil non entier est refusé avant l'API", async () => {
    rendreApp("/admin/parametres");
    const seuil = await screen.findByLabelText("Seuil d'alerte stock par défaut");
    await userEvent.clear(seuil);
    await userEvent.type(seuil, "1,5");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Le seuil d'alerte doit être un entier positif ou nul");
    expect(api.ecritures()).toEqual([]);
  });

  it("paramètres : les quatre valeurs partent ensemble", async () => {
    api.repondre("PUT", "/admin/parametres", 200, { success: true });
    rendreApp("/admin/parametres");
    const monnaie = await screen.findByLabelText("Monnaie affichée");
    await waitFor(() => expect((monnaie as HTMLInputElement).value).toBe("$"));
    await userEvent.clear(monnaie);
    await userEvent.type(monnaie, "FC");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(api.ecritures()[0]!.corps).toEqual({
        parametres: [
          { cle: "monnaie", valeur: "FC" },
          { cle: "nom_application", valeur: "MultiBoutique" },
          { cle: "seuil_alerte_defaut", valeur: "10" },
          { cle: "relance_delai_jours", valeur: "30" },
        ],
      })
    );
  });
});
