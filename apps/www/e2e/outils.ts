import { expect, type Page } from "@playwright/test";
import { URL_BACKOFFICE } from "./ports";

export const COMPTES = {
  proprietaire: { email: "proprietaire@multiboutique.com", motDePasse: "proprietaire123" },
  gerant: { email: "gerant@e2e.test", motDePasse: "gerant-e2e" },
  client: { email: "client@e2e.test", motDePasse: "client-e2e" },
} as const;

export const BOUTIQUE_1 = "11111111-1111-1111-1111-111111111111";
export const RIZ = "aaaaaaaa-0000-4000-8000-000000000001";

/** Connexion d'un client sur la vitrine. */
export async function seConnecter(page: Page, email: string, motDePasse: string) {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

/** Connexion du personnel sur le backoffice des parcours. */
export async function seConnecterBackoffice(page: Page, compte: "gerant" | "proprietaire") {
  await page.goto(`${URL_BACKOFFICE}/connexion`);
  await page.getByLabel("E-mail").fill(COMPTES[compte].email);
  await page.getByLabel("Mot de passe").fill(COMPTES[compte].motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

export const FORMATS = [
  { nom: "telephone", largeur: 390, hauteur: 844 },
  { nom: "tablette-portrait", largeur: 820, hauteur: 1180 },
  { nom: "tablette-paysage", largeur: 1180, hauteur: 820 },
  { nom: "bureau", largeur: 1440, hauteur: 900 },
] as const;

/** L'écran courant aux quatre largeurs : aucun défilement horizontal, une capture par format. */
export async function verifierFormats(page: Page, nomEcran: string) {
  for (const format of FORMATS) {
    await page.setViewportSize({ width: format.largeur, height: format.hauteur });
    await page.waitForTimeout(100);
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debordement, `${nomEcran} déborde horizontalement à ${format.largeur} px`).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `test-results/captures/${nomEcran}-${format.nom}.png`, fullPage: true });
  }
}
