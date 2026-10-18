import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { BOUTIQUE_1, COMPTES, seConnecter, seConnecterBackoffice } from "./outils";
import { PORT_API, URL_BACKOFFICE } from "./ports";

const PHOTO = fileURLToPath(new URL("photo.png", import.meta.url));

test("la CSP est servie, aucun écran ne la viole, et la photo d'un produit s'affiche", async ({ page, request, browser }) => {
  const csp = (await request.get("/")).headers()["content-security-policy"] ?? "";
  expect(csp).toContain(`connect-src 'self' http://localhost:${PORT_API}`);
  expect(csp).toContain(`img-src 'self' data: http://localhost:${PORT_API}`);

  // Une photo, déposée par la gérante dans le backoffice.
  const gerante = await browser.newPage();
  await seConnecterBackoffice(gerante, "gerant");
  await gerante.goto(`${URL_BACKOFFICE}/b/${BOUTIQUE_1}/produits`);
  await gerante.getByRole("button", { name: "Nouveau produit" }).click();
  const panneau = gerante.getByRole("dialog", { name: "Nouveau produit" });
  await panneau.getByLabel("Nom du produit").fill("Savon photo e2e");
  await panneau.getByLabel("Prix de vente").fill("2");
  await panneau.getByLabel("Quantité initiale en stock").fill("10");
  await panneau.getByLabel("Photo du produit").setInputFiles(PHOTO);
  await expect(panneau.getByRole("img", { name: "Aperçu du produit" })).toBeVisible();
  await panneau.getByRole("button", { name: "Ajouter le produit" }).click();
  await expect(panneau).toHaveCount(0);

  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  for (const adresse of ["/", `/boutiques/${BOUTIQUE_1}`, "/connexion", "/inscription"]) {
    await page.goto(adresse);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  await page.goto(`/boutiques/${BOUTIQUE_1}`);
  const carte = page.getByRole("list", { name: "Articles" }).getByRole("listitem").filter({ hasText: "Savon photo e2e" });
  const image = carte.locator("img");
  await expect(image).toBeVisible();
  expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);

  await seConnecter(page, COMPTES.client.email, COMPTES.client.motDePasse);
  await page.goto("/espace");
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});
