import { expect, test } from "@playwright/test";
import { BOUTIQUE_1, COMPTES, seConnecter } from "./outils";

test("la gérante se connecte, garde sa session au rechargement, puis se déconnecte", async ({ page }) => {
  await seConnecter(page, "gerant");
  await expect(page).toHaveURL(new RegExp(`/b/${BOUTIQUE_1}$`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/b/${BOUTIQUE_1}$`));
  await expect(page.getByRole("heading", { name: "Connexion" })).toHaveCount(0);

  await page.getByRole("button", { name: /Awa Gérante/ }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
  await page.goto(`/b/${BOUTIQUE_1}/stock`);
  await expect(page).toHaveURL(/\/connexion\?retour=%2Fb%2F/);
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
