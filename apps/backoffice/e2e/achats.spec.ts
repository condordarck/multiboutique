import { expect, test, type Page } from "@playwright/test";
import { BOUTIQUE_1, seConnecter, verifierFormats } from "./outils";

async function stockHuile(page: Page): Promise<number> {
  await page.goto(`/b/${BOUTIQUE_1}/stock`);
  // Le cache local s'affiche d'abord ; on lit après la relecture de l'API.
  await page.waitForLoadState("networkidle");
  const ligne = page.getByRole("table", { name: "État du stock" }).getByRole("row").filter({ hasText: "Huile d'arachide 1 L" });
  return Number((await ligne.getByRole("cell").nth(2).textContent())?.replace(/\D/g, ""));
}

test("la gérante commande à un fournisseur et réceptionne en deux fois : le stock suit", async ({ page }) => {
  await seConnecter(page, "gerant");
  await page.setViewportSize({ width: 1440, height: 900 });
  const avant = await stockHuile(page);

  await page.goto(`/b/${BOUTIQUE_1}/achats`);
  await page.getByRole("button", { name: "Nouveau fournisseur" }).click();
  const fiche = page.getByRole("dialog", { name: "Nouveau fournisseur" });
  await fiche.getByLabel("Nom").fill("Huilerie e2e");
  await fiche.getByRole("button", { name: "Ajouter le fournisseur" }).click();
  await expect(fiche).toHaveCount(0);

  await page.getByRole("button", { name: "Nouvelle commande fournisseur" }).click();
  const panneau = page.getByRole("dialog", { name: "Nouvelle commande fournisseur" });
  await panneau.getByLabel("Fournisseur").selectOption({ label: "Huilerie e2e" });
  await panneau.getByRole("button", { name: "Ajouter un article" }).click();
  await panneau.getByLabel("Produit de l'article 1").selectOption({ label: "Huile d'arachide 1 L" });
  await expect(panneau.getByLabel("Prix d'achat de l'article 1")).toHaveValue("2.5");
  await panneau.getByLabel("Quantité de l'article 1").fill("30");
  await panneau.getByRole("button", { name: "Créer la commande" }).click();
  const message = panneau.getByText(/^Commande fournisseur .* enregistrée$/);
  await expect(message).toBeVisible();
  const reference = /fournisseur (\S+) enregistrée/.exec((await message.textContent()) ?? "")![1]!;
  await panneau.getByRole("button", { name: "Fermer" }).click();

  const commandes = page.getByRole("table", { name: "Commandes fournisseur" });
  for (const quantite of ["10", "20"]) {
    await commandes.getByRole("button", { name: `Réceptionner ${reference}` }).click();
    const reception = page.getByRole("dialog", { name: `Réception — ${reference}` });
    await reception.getByLabel(/^Huile d'arachide 1 L — reçu/).fill(quantite);
    await reception.getByRole("button", { name: "Valider la réception" }).click();
    await expect(reception).toHaveCount(0);
  }
  await expect(commandes.getByRole("row").filter({ hasText: reference })).toContainText("Réceptionnée");
  await expect(commandes.getByRole("button", { name: `Réceptionner ${reference}` })).toHaveCount(0);
  await verifierFormats(page, "achats");

  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await stockHuile(page)).toBe(avant + 30);
});

test("le propriétaire publie un prix conseillé que la gérante applique", async ({ browser }) => {
  const siege = await browser.newPage();
  await seConnecter(siege, "proprietaire");
  await siege.setViewportSize({ width: 1440, height: 900 });
  await siege.goto(`/b/${BOUTIQUE_1}/prix-conseilles`);
  await siege.getByRole("button", { name: "Publier un prix conseillé" }).click();
  const panneau = siege.getByRole("dialog", { name: "Publier un prix conseillé" });
  await panneau.getByLabel("Produit").selectOption({ label: "Sucre 1 kg" });
  await panneau.getByLabel("Prix de vente conseillé").fill("1,75");
  await panneau.getByRole("button", { name: "Publier" }).click();
  await expect(panneau).toHaveCount(0);

  const gerante = await browser.newPage();
  await seConnecter(gerante, "gerant");
  await gerante.setViewportSize({ width: 1440, height: 900 });
  await gerante.goto(`/b/${BOUTIQUE_1}/prix-conseilles`);
  const grille = gerante.getByRole("table", { name: "Grille publiée" });
  await grille.getByRole("button", { name: "Appliquer Sucre 1 kg ici" }).click();
  await expect(gerante.getByText(/^1 prix appliqué$/)).toBeVisible();
  await verifierFormats(gerante, "prix-conseilles");
  await gerante.setViewportSize({ width: 1440, height: 900 });
  await gerante.goto(`/b/${BOUTIQUE_1}/produits`);
  await expect(gerante.getByRole("table", { name: "Produits de la boutique" }).getByRole("row").filter({ hasText: "Sucre 1 kg" })).toContainText("1,75");
});
