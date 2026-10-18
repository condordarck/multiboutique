import { expect, test } from "@playwright/test";
import { COMPTES, seConnecter, verifierFormats } from "./outils";
import { PORT_API, URL_BACKOFFICE } from "./ports";

test("un visiteur s'inscrit, se connecte, arrive dans son espace, puis se déconnecte", async ({ page }) => {
  const email = `inscrit.${Date.now()}@e2e.test`;
  await page.goto("/inscription");
  await page.getByLabel("Nom complet").fill("Client Inscrit");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("inscrit-e2e");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByText("Compte créé, connectez-vous.")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  await verifierFormats(page, "connexion");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Mot de passe").fill("inscrit-e2e");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/espace$/);

  // Le cookie de la vitrine n'ouvre rien sur le backoffice.
  const session = await page.request.get(`http://localhost:${PORT_API}/auth/session`, { headers: { origin: URL_BACKOFFICE } });
  expect(session.status()).toBe(401);

  await page.getByRole("banner").getByRole("button", { name: "Client Inscrit" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/espace");
  await expect(page).toHaveURL(/\/connexion\?retour=%2Fespace/);
});

test("un même e-mail ne s'inscrit pas deux fois", async ({ page }) => {
  await page.goto("/inscription");
  await page.getByLabel("Nom complet").fill("Doublon");
  await page.getByLabel("E-mail").fill(COMPTES.client.email);
  await page.getByLabel("Mot de passe").fill("doublon-e2e");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("alert")).toHaveText("Cet e-mail est déjà utilisé");
});

test("la gérante est refusée sur la vitrine, avec le lien vers l'espace professionnel", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(COMPTES.gerant.email);
  await page.getByLabel("Mot de passe").fill(COMPTES.gerant.motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert")).toContainText("Ce compte ne se connecte pas ici");
  await expect(page.getByRole("link", { name: "Aller à l'espace professionnel" })).toHaveAttribute("href", URL_BACKOFFICE);
});

test("le client du jeu de données se connecte", async ({ page }) => {
  await seConnecter(page, COMPTES.client.email, COMPTES.client.motDePasse);
  await expect(page).toHaveURL(/\/espace$/);
});
