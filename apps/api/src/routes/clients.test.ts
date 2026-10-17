import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerClient, creerCodePromo, creerCompte, ecriture, ORIGINES, seConnecter } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  const comptes = {
    gerant: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }),
    gerantB2: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b2] }),
    vendeur: await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }),
    comptable: await creerCompte(base.pool, "comptable", { boutique_ids: [BOUTIQUES.b1] }),
  };
  for (const [nom, compte] of Object.entries(comptes)) cookies[nom] = await seConnecter(app, compte, "backoffice");
});
afterAll(async () => {
  await base.detruire();
});

function envoyer(qui: string, methode: "POST" | "PUT" | "DELETE", url: string, payload?: unknown) {
  return app.inject({ method: methode, url, headers: ecriture("backoffice", cookies[qui]), payload: payload as never });
}
const clientsDe = (b: string) => `/boutiques/${b}/clients`;
const fiche = { nom: "Kabila et fils", type_client: "grossiste", plafond_credit: 500 };

describe("clients", () => {
  it("crée un client ; refuse le vendeur, une autre boutique, un nom vide", async () => {
    expect((await envoyer("gerant", "POST", clientsDe(BOUTIQUES.b1), fiche)).statusCode).toBe(201);
    const { rows } = await base.pool.query(`SELECT boutique_id, plafond_credit FROM clients WHERE nom = 'Kabila et fils'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].boutique_id).toBe(BOUTIQUES.b1);
    expect((await envoyer("vendeur", "POST", clientsDe(BOUTIQUES.b1), fiche)).statusCode).toBe(403);
    expect((await envoyer("gerantB2", "POST", clientsDe(BOUTIQUES.b1), fiche)).statusCode).toBe(403);
    expect((await envoyer("gerant", "POST", clientsDe(BOUTIQUES.b1), { ...fiche, nom: "  " })).statusCode).toBe(400);
  });

  it("modifie un client de la boutique, pas celui d'une autre", async () => {
    const c1 = await creerClient(base.pool, BOUTIQUES.b1);
    const c2 = await creerClient(base.pool, BOUTIQUES.b2);
    expect((await envoyer("gerant", "PUT", `${clientsDe(BOUTIQUES.b1)}/${c1}`, { ...fiche, nom: "Nouveau nom" })).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT nom FROM clients WHERE id = $1`, [c1]);
    expect(rows[0].nom).toBe("Nouveau nom");
    // Client de la boutique 2 adressé par l'URL de la boutique 1.
    expect((await envoyer("gerant", "PUT", `${clientsDe(BOUTIQUES.b1)}/${c2}`, fiche)).statusCode).toBe(404);
  });

  it("bascule l'activité et le statut VIP", async () => {
    const c = await creerClient(base.pool, BOUTIQUES.b1);
    expect((await envoyer("gerant", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/activation`)).statusCode).toBe(200);
    expect((await envoyer("gerant", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/vip`)).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT actif, est_vip FROM clients WHERE id = $1`, [c]);
    expect(rows[0]).toEqual({ actif: false, est_vip: true });
    expect((await envoyer("vendeur", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/vip`)).statusCode).toBe(403);
  });
});

describe("crédit", () => {
  it("un règlement supérieur à l'encours est plafonné à l'encours", async () => {
    const c = await creerClient(base.pool, BOUTIQUES.b1, { encours: 30 });
    expect((await envoyer("gerant", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/reglements`, { montant: 50 })).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT encours FROM clients WHERE id = $1`, [c]);
    expect(Number(rows[0].encours)).toBe(0);
    const { rows: reg } = await base.pool.query(`SELECT type, montant, solde_apres FROM registre_credits WHERE client_id = $1`, [c]);
    expect(reg.map((l) => [l.type, Number(l.montant), Number(l.solde_apres)])).toEqual([["versement", -30, 0]]);
  });

  it("refuse un montant nul et un profil sans clients:gerer", async () => {
    const c = await creerClient(base.pool, BOUTIQUES.b1, { encours: 10 });
    expect((await envoyer("gerant", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/reglements`, { montant: 0 })).statusCode).toBe(400);
    expect((await envoyer("vendeur", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/reglements`, { montant: 5 })).statusCode).toBe(403);
  });

  it("registre : du plus récent au plus ancien, lisible par le comptable, pas par le vendeur", async () => {
    const c = await creerClient(base.pool, BOUTIQUES.b1, { encours: 100 });
    await envoyer("gerant", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/reglements`, { montant: 10 });
    await envoyer("gerant", "POST", `${clientsDe(BOUTIQUES.b1)}/${c}/reglements`, { montant: 20 });
    const r = await app.inject({ url: `${clientsDe(BOUTIQUES.b1)}/${c}/registre`, headers: { origin: ORIGINES.backoffice, cookie: cookies.comptable } });
    expect(r.statusCode).toBe(200);
    expect(r.json().map((l: { montant: number }) => l.montant)).toEqual([-20, -10]);
    const refus = await app.inject({ url: `${clientsDe(BOUTIQUES.b1)}/${c}/registre`, headers: { origin: ORIGINES.backoffice, cookie: cookies.vendeur } });
    expect(refus.statusCode).toBe(403);
  });
});

describe("codes promo", () => {
  const promo = { code: "rentree", type_reduction: "pourcentage", valeur_reduction: 15 };

  it("crée un code inactif, en majuscules ; refuse une valeur nulle et le vendeur", async () => {
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/codes-promo`, promo)).statusCode).toBe(201);
    const { rows } = await base.pool.query(`SELECT actif FROM codes_promo WHERE code = 'RENTREE'`);
    expect(rows).toEqual([{ actif: false }]);
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/codes-promo`, { ...promo, code: "X", valeur_reduction: 0 })).statusCode).toBe(400);
    expect((await envoyer("vendeur", "POST", `/boutiques/${BOUTIQUES.b1}/codes-promo`, { ...promo, code: "Y" })).statusCode).toBe(403);
  });

  it("modifie, active et supprime un code de sa boutique", async () => {
    const code = await creerCodePromo(base.pool, BOUTIQUES.b1, { actif: false });
    const { rows } = await base.pool.query(`SELECT id FROM codes_promo WHERE code = $1`, [code]);
    const id = rows[0].id;
    expect((await envoyer("gerant", "PUT", `/codes-promo/${id}`, { ...promo, code, valeur_reduction: 20 })).statusCode).toBe(200);
    expect((await envoyer("gerant", "POST", `/codes-promo/${id}/activation`)).statusCode).toBe(200);
    const { rows: apres } = await base.pool.query(`SELECT actif, valeur_reduction FROM codes_promo WHERE id = $1`, [id]);
    expect([apres[0].actif, Number(apres[0].valeur_reduction)]).toEqual([true, 20]);
    expect((await envoyer("gerant", "DELETE", `/codes-promo/${id}`)).statusCode).toBe(200);
    expect((await base.pool.query(`SELECT 1 FROM codes_promo WHERE id = $1`, [id])).rows).toHaveLength(0);
  });

  it("refuse le gérant d'une autre boutique et un code inconnu", async () => {
    const code = await creerCodePromo(base.pool, BOUTIQUES.b1);
    const { rows } = await base.pool.query(`SELECT id FROM codes_promo WHERE code = $1`, [code]);
    expect((await envoyer("gerantB2", "DELETE", `/codes-promo/${rows[0].id}`)).statusCode).toBe(403);
    expect((await envoyer("gerant", "DELETE", "/codes-promo/00000000-0000-0000-0000-000000000000")).statusCode).toBe(404);
  });
});
