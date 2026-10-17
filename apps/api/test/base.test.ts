import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "./base";

describe("base de test", () => {
  let base: BaseDeTest;
  beforeAll(async () => {
    base = await creerBaseDeTest();
  });
  afterAll(async () => {
    await base.detruire();
  });

  it("contient le seed : 3 boutiques et 2 comptes", async () => {
    const { rows: boutiques } = await base.pool.query("SELECT count(*)::int AS n FROM boutiques");
    expect(boutiques[0].n).toBe(3);
    const { rows: comptes } = await base.pool.query("SELECT email FROM utilisateurs ORDER BY email");
    expect(comptes.map((c) => c.email)).toEqual([
      "admin@multiboutique.com",
      "proprietaire@multiboutique.com",
    ]);
  });

  it("contient les migrations : la table des permissions de rôle existe", async () => {
    const { rows } = await base.pool.query("SELECT count(*)::int AS n FROM roles_permissions");
    expect(rows[0].n).toBeGreaterThan(0);
  });

  it("remonte les exceptions PL/pgSQL avec le code P0001", async () => {
    await expect(
      base.pool.query("SELECT deduire_stock(uuid_generate_v4(), uuid_generate_v4(), 1)")
    ).rejects.toMatchObject({ code: "P0001" });
  });

  it("donne à chaque fichier de test sa propre base", async () => {
    const autre = await creerBaseDeTest();
    try {
      await base.pool.query("DELETE FROM utilisateurs WHERE email = 'admin@multiboutique.com'");
      const { rows } = await autre.pool.query("SELECT count(*)::int AS n FROM utilisateurs");
      expect(rows[0].n).toBe(2);
    } finally {
      await autre.detruire();
    }
  });
});
