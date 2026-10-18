import { expect, test } from "@playwright/test";
import { COMPTES, seConnecter } from "./outils";

test("le propriétaire se connecte, garde sa session au rechargement, puis se déconnecte", async ({ page }) => {
  await seConnecter(page, "proprietaire");
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await page.reload();
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toHaveCount(0);

  await page.getByRole("button", { name: /Propriétaire/ }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto("/tableau-de-bord");
  await expect(page).toHaveURL(/\/connexion\?retour=%2Ftableau-de-bord/);
});

test("un compte client est refusé avec le message de l'API", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(COMPTES.client.email);
  await page.getByLabel("Mot de passe").fill(COMPTES.client.motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toHaveText("Ce compte ne se connecte pas ici");
});

test("un mauvais mot de passe est refusé", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(COMPTES.gerant.email);
  await page.getByLabel("Mot de passe").fill("faux");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toHaveText("Email ou mot de passe incorrect");
});
