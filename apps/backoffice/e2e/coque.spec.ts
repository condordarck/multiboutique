import { expect, test } from "@playwright/test";
import { BOUTIQUE_1, seConnecter, verifierFormats } from "./outils";

test("la coque tient aux quatre formats, et le menu suit le rôle", async ({ page }) => {
  await seConnecter(page, "vendeur");
  await expect(page).toHaveURL(new RegExp(`/b/${BOUTIQUE_1}$`));
  const menu = page.getByRole("navigation", { name: "Navigation principale" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(menu.getByRole("link")).toHaveText(["Vue d'ensemble", "Ventes", "Stock", "Produits"]);
  await verifierFormats(page, "coque-vendeur");
});
