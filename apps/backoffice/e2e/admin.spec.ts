import { expect, test } from "@playwright/test";
import { BOUTIQUE_1, COMPTES, verifierFormats } from "./outils";

test("l'administrateur crée un vendeur, qui se connecte et ne voit que sa boutique", async ({ browser }) => {
  const admin = await browser.newPage();
  await admin.goto("/connexion");
  await admin.getByLabel("E-mail").fill(COMPTES.administrateur.email);
  await admin.getByLabel("Mot de passe").fill(COMPTES.administrateur.motDePasse);
  await admin.getByRole("button", { name: "Se connecter" }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.setViewportSize({ width: 1440, height: 900 });
  await verifierFormats(admin, "admin-accueil");

  await admin.setViewportSize({ width: 1440, height: 900 });
  await admin.goto("/admin/utilisateurs");
  await admin.getByRole("button", { name: "Créer un utilisateur" }).click();
  const panneau = admin.getByRole("dialog", { name: "Créer un utilisateur" });
  await panneau.getByLabel("Nom complet").fill("Nouveau Vendeur");
  await panneau.getByLabel("E-mail").fill("nouveau.vendeur@e2e.test");
  await panneau.getByLabel("Mot de passe").fill("vendeur-neuf");
  await panneau.getByLabel("Profil").selectOption("vendeur");
  await panneau.getByRole("checkbox", { name: "Boutique 1" }).check();
  await panneau.getByRole("button", { name: "Créer le compte" }).click();
  await expect(panneau.getByText("Compte créé avec succès")).toBeVisible();
  await panneau.getByRole("button", { name: "Fermer" }).click();
  await expect(admin.getByRole("table", { name: "Utilisateurs" }).getByText("nouveau.vendeur@e2e.test")).toBeVisible();
  await verifierFormats(admin, "admin-utilisateurs");

  const vendeur = await browser.newPage();
  await vendeur.goto("/connexion");
  await vendeur.getByLabel("E-mail").fill("nouveau.vendeur@e2e.test");
  await vendeur.getByLabel("Mot de passe").fill("vendeur-neuf");
  await vendeur.getByRole("button", { name: "Se connecter" }).click();
  await expect(vendeur).toHaveURL(new RegExp(`/b/${BOUTIQUE_1}$`));
  await expect(vendeur.getByRole("combobox", { name: "Boutique" })).toHaveCount(0);
  await expect(vendeur.getByText("Boutique 1", { exact: true }).first()).toBeVisible();
});

test("la matrice des rôles tient sur tablette sans faire défiler la page", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(COMPTES.administrateur.email);
  await page.getByLabel("Mot de passe").fill(COMPTES.administrateur.motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/roles");
  await expect(page.getByRole("checkbox", { name: "Vendeur — Encaisser une vente" })).toBeVisible();
  await verifierFormats(page, "admin-roles");
  for (const ecran of ["boutiques", "organisation", "categories", "parametres"]) {
    await page.goto(`/admin/${ecran}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await verifierFormats(page, `admin-${ecran}`);
  }
});
