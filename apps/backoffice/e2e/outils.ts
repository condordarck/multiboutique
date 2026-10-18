import { expect, type Page } from "@playwright/test";

export const COMPTES = {
  proprietaire: { email: "proprietaire@multiboutique.com", motDePasse: "proprietaire123" },
  administrateur: { email: "admin@multiboutique.com", motDePasse: "admin123" },
  gerant: { email: "gerant@e2e.test", motDePasse: "gerant-e2e" },
  vendeur: { email: "vendeur@e2e.test", motDePasse: "vendeur-e2e" },
  client: { email: "client@e2e.test", motDePasse: "client-e2e" },
} as const;

export const BOUTIQUE_1 = "11111111-1111-1111-1111-111111111111";
export const BOUTIQUE_2 = "22222222-2222-2222-2222-222222222222";

export async function seConnecter(page: Page, compte: keyof typeof COMPTES) {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(COMPTES[compte].email);
  await page.getByLabel("Mot de passe").fill(COMPTES[compte].motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}
