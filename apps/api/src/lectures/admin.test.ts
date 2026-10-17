import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { CONFIG_TEST, creerCompte, ORIGINES, seConnecter } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  cookies.admin = await seConnecter(app, await creerCompte(base.pool, "administrateur"), "backoffice");
  cookies.proprietaire = await seConnecter(app, await creerCompte(base.pool, "proprietaire"), "backoffice");
});
afterAll(async () => {
  await base.detruire();
});

const lire = (qui: string, url: string) => app.inject({ url, headers: { origin: ORIGINES.backoffice, cookie: cookies[qui] } });

describe("lectures d'administration", () => {
  it.each(["/admin/statistiques", "/admin/boutiques", "/admin/organisation", "/admin/categories", "/admin/roles", "/admin/utilisateurs"])(
    "%s : administrateur seulement",
    async (url) => {
      expect((await lire("proprietaire", url)).statusCode).toBe(403);
      expect((await lire("admin", url)).statusCode).toBe(200);
    }
  );

  it("statistiques : comptages en nombres", async () => {
    expect((await lire("admin", "/admin/statistiques")).json()).toMatchObject({ boutiques: 3, boutiques_actives: 3, utilisateurs: 4 });
  });

  it("utilisateurs : sans empreinte de mot de passe, avec les listes du formulaire", async () => {
    const r = await lire("admin", "/admin/utilisateurs");
    expect(r.body).not.toContain("password_hash");
    expect(r.json().utilisateurs).toHaveLength(4);
    expect(r.json().boutiques).toHaveLength(3);
    expect(r.json()).toHaveProperty("groupes");
    expect(r.json()).toHaveProperty("regions");
  });

  it("organisation : groupes, régions et boutiques sans région", async () => {
    const r = (await lire("admin", "/admin/organisation")).json();
    expect(r.sans_region).toHaveLength(3);
  });
});
