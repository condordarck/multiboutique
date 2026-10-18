import { expect, test, type Page } from "@playwright/test";
import { BOUTIQUE_1, seConnecter } from "./outils";

/** Lit une clé de idb-keyval (base « keyval-store »), comme le fait l'application. */
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

test("le manifeste rend la PWA installable", async ({ request }) => {
  const manifeste = await (await request.get("/manifest.webmanifest")).json();
  expect(manifeste).toMatchObject({ name: "MultiBoutique Backoffice", display: "standalone", start_url: "/" });
  const tailles = manifeste.icons.map((i: { sizes: string }) => i.sizes);
  expect(tailles).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifeste.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
  for (const icone of manifeste.icons) expect((await request.get(icone.src)).status()).toBe(200);
});

test("hors ligne, le stock consulté s'affiche depuis le cache et l'écriture est bloquée", async ({ page, context }) => {
  await seConnecter(page, "gerant");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/b/${BOUTIQUE_1}/stock`);
  await expect(page.getByRole("table", { name: "État du stock" }).getByText("Riz 25 kg")).toBeVisible();
  // Le service worker s'installe, puis prend la main au rechargement suivant.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByRole("table", { name: "État du stock" }).getByText("Riz 25 kg")).toBeVisible();
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  // La persistance écrit au plus une fois par seconde : on attend que le stock y soit.
  await expect.poll(async () => String(await lireIdb(page, "mb-cache-requetes")), { timeout: 5000 }).toContain("Riz 25 kg");

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/^Hors ligne — données du \d{2}:\d{2}/)).toBeVisible();
  const ligne = page.getByRole("table", { name: "État du stock" }).getByRole("row").filter({ hasText: "Riz 25 kg" });
  await expect(ligne).toBeVisible();
  await ligne.getByRole("button", { name: /Gérer le stock/ }).click();
  await expect(page.getByRole("dialog", { name: "Riz 25 kg" }).getByRole("button", { name: "Enregistrer l'entrée" })).toBeDisabled();
  await context.setOffline(false);
});

test("la déconnexion vide le cache de l'appareil", async ({ page }) => {
  await seConnecter(page, "gerant");
  await page.goto(`/b/${BOUTIQUE_1}/stock`);
  await expect(page.getByRole("heading", { level: 1, name: /^Stock/ })).toBeVisible();
  await expect.poll(() => lireIdb(page, "mb-cache-requetes"), { timeout: 5000 }).toBeTruthy();
  expect(await lireIdb(page, "mb-cache-proprietaire")).toBeTruthy();

  await page.getByRole("button", { name: /Awa Gérante/ }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
  // Seule l'entrée « session : null » peut être réécrite ; aucune donnée de boutique.
  await expect
    .poll(async () => JSON.stringify((await lireIdb(page, "mb-cache-requetes")) ?? null))
    .not.toContain("Riz 25 kg");
  expect(await lireIdb(page, "mb-cache-proprietaire")).toBeUndefined();
});
