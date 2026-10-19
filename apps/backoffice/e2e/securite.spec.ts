import { expect, test } from "@playwright/test";
import { BOUTIQUE_1, seConnecter } from "./outils";

const ECRANS = ["", "/ventes", "/ventes/nouvelle", "/stock", "/produits", "/clients", "/promotions", "/commandes", "/reservations", "/achats", "/prix-conseilles", "/rapports"];

test("la CSP est servie, et aucun écran ne la viole", async ({ page, request }) => {
  const reponse = await request.get("/");
  const csp = reponse.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("connect-src 'self' http://localhost:4100");

  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  await seConnecter(page, "proprietaire");
  for (const ecran of ECRANS) {
    await page.goto(`/b/${BOUTIQUE_1}${ecran}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  for (const ecran of ["/tableau-de-bord", "/consolidation", "/impression"]) {
    await page.goto(ecran);
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});

test("aucun écran d'administration ne viole la CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  await seConnecter(page, "administrateur");
  for (const ecran of ["", "/utilisateurs", "/boutiques", "/organisation", "/categories", "/roles", "/parametres"]) {
    await page.goto(`/admin${ecran}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
  }
  expect(violations).toEqual([]);
});
