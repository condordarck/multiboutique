import { expect, test, type Page } from "@playwright/test";
import { BOUTIQUE_1, seConnecter, verifierFormats } from "./outils";

const espaces = (t: string | null) => (t ?? "").replace(/[  ]/g, " ");

async function disponibleRiz(page: Page): Promise<number> {
  await page.goto(`/b/${BOUTIQUE_1}/ventes/nouvelle`);
  const carte = page.getByRole("button", { name: /^Riz 25 kg/ });
  const texte = espaces(await carte.textContent());
  return Number(/(\d[\d ]*) dispo\./.exec(texte)![1]!.replace(/ /g, ""));
}

test("un vendeur encaisse, la gérante annule : le stock suit", async ({ browser }) => {
  const vendeur = await browser.newPage();
  await seConnecter(vendeur, "vendeur");
  await vendeur.setViewportSize({ width: 1180, height: 820 });
  const avant = await disponibleRiz(vendeur);

  await vendeur.getByRole("button", { name: /^Riz 25 kg/ }).click();
  await vendeur.getByRole("button", { name: /^Riz 25 kg/ }).click();
  // L'huile : aucun autre parcours ne change son prix (3,2).
  await vendeur.getByRole("button", { name: /^Huile d'arachide 1 L/ }).click();
  await expect(vendeur.getByTestId("total")).toHaveText(/47,2/);
  await vendeur.getByLabel("Montant reçu ($)").fill("50");
  await verifierFormats(vendeur, "caisse");
  await vendeur.setViewportSize({ width: 1180, height: 820 });
  await vendeur.getByRole("button", { name: /^Encaisser/ }).click();

  const recu = vendeur.getByRole("region", { name: /^Reçu / });
  await expect(recu).toBeVisible();
  const reference = (await recu.getAttribute("aria-label"))!.replace("Reçu ", "");
  expect(await disponibleRiz(vendeur)).toBe(avant - 2);

  await vendeur.goto(`/b/${BOUTIQUE_1}/ventes`);
  // 1180 px : format tablette, l'historique est en cartes.
  await expect(vendeur.getByRole("list", { name: "Historique des ventes" }).getByText(reference)).toBeVisible();

  const gerante = await browser.newPage();
  await seConnecter(gerante, "gerant");
  await gerante.setViewportSize({ width: 1440, height: 900 });
  await gerante.goto(`/b/${BOUTIQUE_1}/ventes`);
  await gerante.getByRole("link", { name: `Reçu de ${reference}` }).click();
  await verifierFormats(gerante, "recu-vente");
  await gerante.getByRole("button", { name: "Annuler la vente" }).click();
  await gerante.getByLabel("Motif").fill("Erreur de saisie");
  await gerante.getByRole("button", { name: "Confirmer l'annulation" }).click();
  await expect(gerante.getByText("VENTE ANNULÉE — Erreur de saisie")).toBeVisible();

  expect(await disponibleRiz(vendeur)).toBe(avant);
});

test("un refus de l'API garde le panier", async ({ page }) => {
  await seConnecter(page, "vendeur");
  await page.goto(`/b/${BOUTIQUE_1}/ventes/nouvelle`);
  await page.getByRole("button", { name: /^Riz 25 kg/ }).click();
  await page.getByLabel("Code promo (optionnel)").fill("INCONNU");
  await page.getByRole("button", { name: /^Encaisser/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("group", { name: "Quantité de Riz 25 kg" })).toContainText("1");
});
