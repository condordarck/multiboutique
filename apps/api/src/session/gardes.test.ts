import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerRegion, ORIGINES, seConnecter } from "../../test/fixtures";
import { construireApp } from "../app";
import { accesBoutique, administrateur, connecte } from "./gardes";

let base: BaseDeTest;
let app: FastifyInstance;

beforeAll(async () => {
  base = await creerBaseDeTest();
});
afterAll(async () => {
  await base.detruire();
});
beforeEach(async () => {
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  app.get("/essai/connecte", async (r) => ({ id: connecte(r).id }));
  app.get<{ Params: { boutiqueId: string } }>("/essai/boutiques/:boutiqueId", async (r) => ({
    id: accesBoutique(r, ["ventes:creer"]).id,
  }));
  app.get("/essai/admin", async (r) => ({ id: administrateur(r).id }));
});

const bo = (cookie?: string) => ({ origin: ORIGINES.backoffice, ...(cookie ? { cookie } : {}) });

describe("gardes", () => {
  it("connecte : 401 sans session, l'utilisateur sinon", async () => {
    expect((await app.inject({ url: "/essai/connecte", headers: bo() })).statusCode).toBe(401);
    const vendeur = await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] });
    const r = await app.inject({ url: "/essai/connecte", headers: bo(await seConnecter(app, vendeur, "backoffice")) });
    expect(r.json()).toEqual({ id: vendeur.id });
  });

  it("accesBoutique : 403 hors périmètre ou sans la permission, 200 sinon", async () => {
    const vendeur = await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] });
    const magasinier = await creerCompte(base.pool, "gerant_stock", { boutique_ids: [BOUTIQUES.b1] });
    const cv = await seConnecter(app, vendeur, "backoffice");
    expect((await app.inject({ url: `/essai/boutiques/${BOUTIQUES.b1}`, headers: bo(cv) })).statusCode).toBe(200);
    expect((await app.inject({ url: `/essai/boutiques/${BOUTIQUES.b2}`, headers: bo(cv) })).statusCode).toBe(403);
    const cm = await seConnecter(app, magasinier, "backoffice");
    expect((await app.inject({ url: `/essai/boutiques/${BOUTIQUES.b1}`, headers: bo(cm) })).statusCode).toBe(403);
  });

  it("administrateur : refuse le propriétaire", async () => {
    const proprio = await creerCompte(base.pool, "proprietaire");
    const admin = await creerCompte(base.pool, "administrateur");
    expect((await app.inject({ url: "/essai/admin", headers: bo(await seConnecter(app, proprio, "backoffice")) })).statusCode).toBe(403);
    expect((await app.inject({ url: "/essai/admin", headers: bo(await seConnecter(app, admin, "backoffice")) })).statusCode).toBe(200);
  });
});

describe("utilisateur rechargé à chaque requête", () => {
  it("un compte désactivé après la connexion perd l'accès à la requête suivante", async () => {
    const vendeur = await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] });
    const cookie = await seConnecter(app, vendeur, "backoffice");
    await base.pool.query(`UPDATE utilisateurs SET actif = false WHERE id = $1`, [vendeur.id]);
    expect((await app.inject({ url: "/essai/connecte", headers: bo(cookie) })).statusCode).toBe(401);
  });

  it("le cookie de la vitrine ne vaut rien sur une requête du backoffice", async () => {
    const client = await creerCompte(base.pool, "client");
    const cookie = await seConnecter(app, client, "www");
    const r = await app.inject({ url: "/essai/connecte", headers: { origin: ORIGINES.backoffice, cookie: cookie.replace("__Host-mb_session_www", "__Host-mb_session_bo") } });
    expect(r.statusCode).toBe(401);
  });

  it("un directeur de région voit les boutiques actives de sa région, et elles seules", async () => {
    const { region } = await creerRegion(base.pool, [BOUTIQUES.b2, BOUTIQUES.b3]);
    await base.pool.query(`UPDATE boutiques SET statut = 'inactive' WHERE id = $1`, [BOUTIQUES.b3]);
    try {
      const directeur = await creerCompte(base.pool, "directeur_region", { region_id: region });
      const r = await app.inject({ url: "/auth/session", headers: bo(await seConnecter(app, directeur, "backoffice")) });
      expect(r.json().utilisateur.boutique_ids).toEqual([BOUTIQUES.b2]);
    } finally {
      await base.pool.query(`UPDATE boutiques SET statut = 'active', region_id = NULL WHERE id = ANY($1)`, [[BOUTIQUES.b2, BOUTIQUES.b3]]);
    }
  });

  it("une permission retirée dans roles_permissions est refusée sans reconnexion", async () => {
    const vendeur = await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] });
    const cookie = await seConnecter(app, vendeur, "backoffice");
    expect((await app.inject({ url: `/essai/boutiques/${BOUTIQUES.b1}`, headers: bo(cookie) })).statusCode).toBe(200);
    await base.pool.query(`UPDATE roles_permissions SET active = false WHERE role = 'vendeur' AND permission = 'ventes:creer'`);
    try {
      expect((await app.inject({ url: `/essai/boutiques/${BOUTIQUES.b1}`, headers: bo(cookie) })).statusCode).toBe(403);
    } finally {
      await base.pool.query(`UPDATE roles_permissions SET active = true WHERE role = 'vendeur' AND permission = 'ventes:creer'`);
    }
  });
});
