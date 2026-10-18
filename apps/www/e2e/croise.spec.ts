import { expect, test } from "@playwright/test";
import { BOUTIQUE_1, COMPTES, seConnecter, seConnecterBackoffice, verifierFormats } from "./outils";
import { URL_BACKOFFICE } from "./ports";

test("un client réserve sur la vitrine ; la gérante confirme puis encaisse ; l'espace client suit", async ({ page, browser }) => {
  await seConnecter(page, COMPTES.client.email, COMPTES.client.motDePasse);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/boutiques/${BOUTIQUE_1}`);
  await page.getByRole("list", { name: "Articles" }).getByRole("button", { name: "Réserver Sucre 1 kg" }).click();
  const panier = page.getByRole("region", { name: /^Réservation/ });
  // Client connecté : nom pré-rempli ; le téléphone reste à saisir.
  await expect(panier.getByLabel("Nom complet")).toHaveValue("Client Vitrine");
  await panier.getByLabel("Téléphone").fill("+243 900 333 444");
  await panier.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(page).toHaveURL(/\/reservations\//);
  const reference = (await page.getByText(/^RES-/).textContent())!;

  await page.goto("/espace");
  const ligne = () => page.getByRole("table", { name: "Mes réservations" }).getByRole("row").filter({ hasText: reference });
  await expect(ligne()).toContainText("En attente");

  const gerante = await browser.newPage();
  await seConnecterBackoffice(gerante, "gerant");
  await gerante.setViewportSize({ width: 1440, height: 900 });
  await gerante.goto(`${URL_BACKOFFICE}/b/${BOUTIQUE_1}/reservations`);
  const carte = gerante.getByRole("article", { name: reference });
  await carte.getByRole("button", { name: "Confirmer (prête)" }).click();
  await expect(carte.getByText("Prête")).toBeVisible();

  await page.reload();
  await expect(ligne()).toContainText("Prête");

  await carte.getByRole("button", { name: "Encaisser à la remise" }).click();
  await carte.getByRole("button", { name: "Encaisser" }).click();
  await expect(gerante.getByText(`Réservation : ${reference}`)).toBeVisible();

  await page.reload();
  await expect(ligne()).toContainText("Retirée");
});

test("une réservation anonyme n'apparaît dans aucun espace client", async ({ page, browser }) => {
  await page.goto(`/boutiques/${BOUTIQUE_1}`);
  await page.getByRole("list", { name: "Articles" }).getByRole("button", { name: "Réserver Riz 25 kg" }).click();
  const panier = page.getByRole("region", { name: /^Réservation/ });
  await panier.getByLabel("Nom complet").fill("Anonyme e2e");
  await panier.getByLabel("Téléphone").fill("+243 900 555 666");
  await panier.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(page).toHaveURL(/\/reservations\//);
  const reference = (await page.getByText(/^RES-/).textContent())!;

  const client = await browser.newPage();
  await seConnecter(client, COMPTES.client.email, COMPTES.client.motDePasse);
  await client.goto("/espace");
  await client.waitForLoadState("networkidle");
  await expect(client.getByText(reference)).toHaveCount(0);
});

test("l'accueil et l'espace client tiennent aux quatre formats", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Nos boutiques" })).toBeVisible();
  await verifierFormats(page, "accueil");
  await seConnecter(page, COMPTES.client.email, COMPTES.client.motDePasse);
  await page.goto("/espace");
  await page.waitForLoadState("networkidle");
  await verifierFormats(page, "espace");
});
