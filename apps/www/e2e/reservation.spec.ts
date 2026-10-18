import { expect, test, type Page } from "@playwright/test";
import { BOUTIQUE_1, seConnecterBackoffice, verifierFormats } from "./outils";
import { URL_BACKOFFICE } from "./ports";

/** Disponible affiché pour un article du catalogue (après relecture de l'API). */
async function disponible(page: Page, nom: string): Promise<number> {
  await page.goto(`/boutiques/${BOUTIQUE_1}`);
  await page.waitForLoadState("networkidle");
  const carte = page.getByRole("list", { name: "Articles" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: nom }) });
  const texte = (await carte.textContent())!.replace(/[   ]/g, "");
  return Number(/(?:Plusque|^|\D)(\d+)disponibles|Plusque(\d+)/.exec(texte)!.slice(1).find(Boolean));
}

test("un visiteur réserve deux articles ; la réservation arrive au backoffice et le disponible baisse", async ({ page, browser }) => {
  const avant = await disponible(page, "Riz 25 kg");
  await page.setViewportSize({ width: 1440, height: 900 });
  const articles = page.getByRole("list", { name: "Articles" });
  await articles.getByRole("button", { name: "Réserver Riz 25 kg" }).click();
  await articles.getByRole("button", { name: "Réserver Huile d'arachide 1 L" }).click();
  const panier = page.getByRole("region", { name: /^Réservation/ });
  await panier.getByLabel("Nom complet").fill("Visiteur e2e");
  await panier.getByLabel("Téléphone").fill("+243 900 111 222");
  await verifierFormats(page, "catalogue");

  await page.setViewportSize({ width: 1440, height: 900 });
  await panier.getByRole("button", { name: /^Confirmer/ }).click();
  await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);
  await expect(page.getByText("En attente de retrait")).toBeVisible();
  const reference = (await page.getByText(/^RES-/).textContent())!;
  await verifierFormats(page, "reservation");

  expect(await disponible(page, "Riz 25 kg")).toBe(avant - 1);

  const gerante = await browser.newPage();
  await seConnecterBackoffice(gerante, "gerant");
  await gerante.goto(`${URL_BACKOFFICE}/b/${BOUTIQUE_1}/reservations`);
  await expect(gerante.getByRole("article", { name: reference })).toContainText("Visiteur e2e");
});
