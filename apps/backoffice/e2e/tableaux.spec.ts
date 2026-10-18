import { expect, test } from "@playwright/test";
import { BOUTIQUE_1, seConnecter, verifierFormats } from "./outils";

test("le propriétaire voit les trois boutiques du seed, puis ouvre la première", async ({ page }) => {
  await seConnecter(page, "proprietaire");
  await expect(page).toHaveURL(/\/tableau-de-bord$/);
  await page.setViewportSize({ width: 1440, height: 900 });
  const resume = page.getByRole("table", { name: "Résumé par boutique" });
  await expect(resume.getByRole("row")).toHaveCount(4);
  await verifierFormats(page, "tableau-de-bord");

  await page.setViewportSize({ width: 1440, height: 900 });
  await resume.getByRole("link", { name: "Voir Boutique 1" }).click();
  await expect(page).toHaveURL(new RegExp(`/b/${BOUTIQUE_1}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Boutique 1" })).toBeVisible();
  // Les autres parcours peuvent avoir vendu : on ne présume pas du contenu.
  await expect(page.getByRole("region", { name: "Dernières ventes" })).toBeVisible();
  await verifierFormats(page, "vue-boutique");
});

test("la consolidation agrège les trois boutiques", async ({ page }) => {
  await seConnecter(page, "proprietaire");
  await page.goto("/consolidation");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("table", { name: "Détail par boutique" }).getByRole("row")).toHaveCount(4);
  await verifierFormats(page, "consolidation");
});
