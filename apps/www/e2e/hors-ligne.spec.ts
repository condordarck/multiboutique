import { expect, test, type Page } from "@playwright/test";
import { BOUTIQUE_1, COMPTES, seConnecter } from "./outils";

function lireIdb(page: Page, cle: string) {
  return page.evaluate(
    (k) =>
      new Promise<unknown>((resoudre, rejeter) => {
        const ouverture = indexedDB.open("keyval-store");
        ouverture.onerror = () => rejeter(ouverture.error);
        ouverture.onsuccess = () => {
          const base = ouverture.result;
          if (!base.objectStoreNames.contains("keyval")) return resoudre(undefined);
          const lecture = base.transaction("keyval").objectStore("keyval").get(k);
          lecture.onsuccess = () => resoudre(lecture.result);
          lecture.onerror = () => rejeter(lecture.error);
        };
      }),
    cle
  );
}

test("le manifeste rend la vitrine installable", async ({ request }) => {
  const manifeste = await (await request.get("/manifest.webmanifest")).json();
  expect(manifeste).toMatchObject({ name: "MultiBoutique", display: "standalone", start_url: "/" });
  for (const icone of manifeste.icons) expect((await request.get(icone.src)).status()).toBe(200);
});

test("hors ligne, le catalogue consulté s'affiche depuis le cache et la réservation est bloquée", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/boutiques/${BOUTIQUE_1}`);
  await expect(page.getByRole("heading", { name: "Riz 25 kg" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Riz 25 kg" })).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(async () => String(await lireIdb(page, "mb-cache-requetes")), { timeout: 5000 }).toContain("Riz 25 kg");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/^Hors ligne — données du \d{2}:\d{2}/)).toBeVisible();
  await page.getByRole("button", { name: "Réserver Riz 25 kg" }).click();
  await expect(page.getByRole("region", { name: /^Réservation/ }).getByRole("button", { name: /^Confirmer/ })).toBeDisabled();
  await context.setOffline(false);
});

test("la déconnexion vide le cache de l'appareil", async ({ page }) => {
  await seConnecter(page, COMPTES.client.email, COMPTES.client.motDePasse);
  await expect(page.getByRole("heading", { level: 1, name: /^Bonjour/ })).toBeVisible();
  await expect.poll(() => lireIdb(page, "mb-cache-proprietaire"), { timeout: 5000 }).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("banner").getByRole("button", { name: "Client Vitrine" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await lireIdb(page, "mb-cache-proprietaire")).toBeUndefined();
  await expect.poll(async () => String((await lireIdb(page, "mb-cache-requetes")) ?? "")).not.toContain('"reservations"');
});
