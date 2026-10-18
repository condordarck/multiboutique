import { expect, test } from "@playwright/test";
import { BOUTIQUE_1, seConnecter, verifierFormats } from "./outils";

test("une vente à crédit crée un encours, que la gérante règle", async ({ page }) => {
  await seConnecter(page, "gerant");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/b/${BOUTIQUE_1}/ventes/nouvelle`);
  await page.getByRole("button", { name: /^Riz 25 kg/ }).click();
  await page.getByLabel("Client (facultatif)").selectOption({ label: "Quincaillerie Ade" });
  await page.getByLabel("Montant payé").fill("2");
  await page.getByRole("button", { name: /^Encaisser/ }).click();
  await expect(page.getByText("Reste à devoir")).toBeVisible();

  await page.goto(`/b/${BOUTIQUE_1}/clients`);
  const ligne = page.getByRole("table", { name: "Dossiers clients" }).getByRole("row").filter({ hasText: "Quincaillerie Ade" });
  await expect(ligne).toContainText("20");
  await verifierFormats(page, "clients");
  await page.setViewportSize({ width: 1440, height: 900 });

  await ligne.getByRole("button", { name: /Ouvrir le dossier/ }).click();
  const dossier = page.getByRole("dialog", { name: "Quincaillerie Ade" });
  await expect(dossier.getByText(/Vente à crédit/)).toBeVisible();
  // Plus que l'encours : seul l'encours est réglé (plafonnement du service).
  await dossier.getByLabel("Montant réglé").fill("50");
  await dossier.getByRole("button", { name: "Enregistrer le règlement" }).click();
  await expect(dossier.getByText(/^Versement/)).toBeVisible();
  await expect(dossier.getByLabel("Montant réglé")).toHaveCount(0);
  await expect(ligne.getByRole("cell").nth(3)).toHaveText("—");
});

test("la gérante crée puis lance un code promo, accepté en caisse", async ({ page }) => {
  await seConnecter(page, "gerant");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/b/${BOUTIQUE_1}/promotions`);
  await page.getByRole("button", { name: "Nouveau code promo" }).click();
  const panneau = page.getByRole("dialog", { name: "Nouveau code promo" });
  await panneau.getByLabel("Code promo").fill("E2E10");
  await panneau.getByLabel("Pourcentage de réduction").fill("10");
  await panneau.getByRole("button", { name: "Créer le code" }).click();
  await expect(panneau).toHaveCount(0);
  await page.getByRole("table", { name: "Codes promo" }).getByRole("button", { name: "Lancer E2E10" }).click();
  await expect(page.getByRole("table", { name: "Codes promo" }).getByRole("row").filter({ hasText: "E2E10" })).toContainText("Active");
  await verifierFormats(page, "promotions");

  await page.goto(`/b/${BOUTIQUE_1}/ventes/nouvelle`);
  await page.getByRole("button", { name: /^Sucre 1 kg/ }).click();
  await page.getByRole("button", { name: /^Riz 25 kg/ }).click();
  await page.getByLabel("Code promo (optionnel)").fill("E2E10");
  await page.getByRole("button", { name: /^Encaisser/ }).click();
  await expect(page.getByText("Remise (E2E10)")).toBeVisible();
});
