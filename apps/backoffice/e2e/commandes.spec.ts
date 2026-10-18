import { expect, request, test } from "@playwright/test";
import { BOUTIQUE_1, seConnecter, verifierFormats } from "./outils";
import { ORIGINE_WWW, PORT_API } from "./ports";

const RIZ = "aaaaaaaa-0000-4000-8000-000000000001";

test("une réservation de la vitrine est confirmée puis encaissée au backoffice", async ({ page }) => {
  // La vitrine (phase 4) n'existe pas encore : la réservation passe par l'API publique.
  const vitrine = await request.newContext({ baseURL: `http://localhost:${PORT_API}`, extraHTTPHeaders: { origin: ORIGINE_WWW } });
  const reponse = await vitrine.post("/reservations", {
    data: { client_nom: "Mme Ade", client_telephone: "+243 900 000 001", boutique_id: BOUTIQUE_1, lignes: [{ produit_id: RIZ, quantite: 1 }] },
  });
  expect(reponse.status()).toBe(201);
  const { reference } = (await reponse.json()) as { reference: string };

  await seConnecter(page, "gerant");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/b/${BOUTIQUE_1}/reservations`);
  const carte = page.getByRole("article", { name: reference });
  await expect(carte).toContainText("Riz 25 kg × 1");
  await verifierFormats(page, "reservations");
  await page.setViewportSize({ width: 1440, height: 900 });

  await carte.getByRole("button", { name: "Confirmer (prête)" }).click();
  await expect(carte.getByText("Prête")).toBeVisible();
  await carte.getByRole("button", { name: "Encaisser à la remise" }).click();
  await carte.getByText("Mobile Money").click();
  await carte.getByRole("button", { name: "Encaisser" }).click();
  await expect(page.getByText(`Réservation : ${reference}`)).toBeVisible();
  await page.getByRole("button", { name: "Terminé" }).click();
  await expect(
    page.getByRole("table", { name: "Historique des réservations" }).getByRole("row").filter({ hasText: reference })
  ).toContainText("Retirée");
});

test("une commande grossiste est créée, confirmée puis livrée", async ({ page }) => {
  await seConnecter(page, "gerant");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/b/${BOUTIQUE_1}/commandes`);
  await page.getByRole("button", { name: "Nouvelle commande grossiste" }).click();
  const panneau = page.getByRole("dialog", { name: "Nouvelle commande grossiste" });
  await panneau.getByLabel("Client").selectOption({ label: "Quincaillerie Ade" });
  await panneau.getByRole("button", { name: "Ajouter un article" }).click();
  await panneau.getByLabel("Produit de l'article 1").selectOption({ label: "Sucre 1 kg" });
  await panneau.getByLabel("Quantité de l'article 1").fill("4");
  await panneau.getByRole("button", { name: "Créer la commande" }).click();
  const message = panneau.getByText(/^Commande .* enregistrée/);
  await expect(message).toBeVisible();
  const reference = /Commande (\S+) enregistrée/.exec((await message.textContent()) ?? "")![1]!;
  await panneau.getByRole("button", { name: "Fermer" }).click();

  const tableau = page.getByRole("table", { name: "Commandes en cours" });
  await tableau.getByRole("button", { name: `Confirmer ${reference}` }).click();
  await tableau.getByRole("button", { name: `Livrer ${reference}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Livrer" }).click();
  await expect(tableau.getByRole("row").filter({ hasText: reference })).toContainText("Livrée");
  await verifierFormats(page, "commandes");
});
