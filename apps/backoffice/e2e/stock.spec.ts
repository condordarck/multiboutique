import { expect, test, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { BOUTIQUE_1, BOUTIQUE_2, seConnecter, verifierFormats } from "./outils";

const PHOTO = fileURLToPath(new URL("photo.png", import.meta.url));

/** Ligne d'un produit dans le tableau « État du stock » (format bureau). */
function ligne(page: Page, produit: string) {
  return page.getByRole("table", { name: "État du stock" }).getByRole("row").filter({ hasText: produit });
}

async function disponible(page: Page, boutique: string, produit: string): Promise<string> {
  await page.goto(`/b/${boutique}/stock`);
  return (await ligne(page, produit).getByRole("cell").nth(4).textContent()) ?? "";
}

test("la gérante crée un produit avec photo et stock initial, puis fait une entrée", async ({ page }) => {
  await seConnecter(page, "gerant");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/b/${BOUTIQUE_1}/produits`);
  await page.getByRole("button", { name: "Nouveau produit" }).click();
  const panneau = page.getByRole("dialog", { name: "Nouveau produit" });
  await panneau.getByLabel("Nom du produit").fill("Farine de blé e2e");
  await panneau.getByLabel("Prix de vente").fill("1,6");
  await panneau.getByLabel("Quantité initiale en stock").fill("40");
  await panneau.getByLabel("Photo du produit").setInputFiles(PHOTO);
  await expect(panneau.getByRole("img", { name: "Aperçu du produit" })).toBeVisible();
  // L'image est servie par l'API : elle s'affiche si la CSP et le volume suivent.
  expect(await panneau.getByRole("img", { name: "Aperçu du produit" }).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await panneau.getByRole("button", { name: "Ajouter le produit" }).click();
  await expect(panneau).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Produits de la boutique" }).getByText("Farine de blé e2e")).toBeVisible();
  await verifierFormats(page, "produits");

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await disponible(page, BOUTIQUE_1, "Farine de blé e2e")).toBe("40");
  await ligne(page, "Farine de blé e2e").getByRole("button", { name: /Gérer le stock/ }).click();
  const fiche = page.getByRole("dialog", { name: "Farine de blé e2e" });
  await fiche.getByLabel("Quantité entrée").fill("12");
  await fiche.getByRole("button", { name: "Enregistrer l'entrée" }).click();
  await expect(fiche).toHaveCount(0);
  await expect(ligne(page, "Farine de blé e2e").getByRole("cell").nth(4)).toHaveText("52");
  await expect(page.getByRole("table", { name: "Mouvements de stock" }).getByText("Stock initial")).toBeVisible();
  await verifierFormats(page, "stock");
});

test("le propriétaire transfère du riz de la boutique 1 vers la boutique 2", async ({ page }) => {
  await seConnecter(page, "proprietaire");
  await page.setViewportSize({ width: 1440, height: 900 });
  const avant1 = Number(await disponible(page, BOUTIQUE_1, "Riz 25 kg"));
  const avant2 = Number(await disponible(page, BOUTIQUE_2, "Riz 25 kg"));

  await page.goto(`/b/${BOUTIQUE_1}/stock`);
  await ligne(page, "Riz 25 kg").getByRole("button", { name: /Gérer le stock/ }).click();
  const fiche = page.getByRole("dialog", { name: "Riz 25 kg" });
  await fiche.getByText("Transférer").click();
  await fiche.getByLabel("Boutique de destination").selectOption({ label: "Boutique 2" });
  await fiche.getByLabel("Quantité à transférer").fill("5");
  await fiche.getByRole("button", { name: "Transférer le stock" }).click();
  await expect(fiche).toHaveCount(0);

  expect(Number(await disponible(page, BOUTIQUE_1, "Riz 25 kg"))).toBe(avant1 - 5);
  expect(Number(await disponible(page, BOUTIQUE_2, "Riz 25 kg"))).toBe(avant2 + 5);
});
