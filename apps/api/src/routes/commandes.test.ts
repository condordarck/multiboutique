import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, compter, CONFIG_TEST, creerClient, creerCompte, creerProduit, ecriture, seConnecter, stock } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let produit: string;

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  produit = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10, stock: 100 });
  const comptes = {
    gerant: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }),
    gerantB2: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b2] }),
    vendeur: await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }),
  };
  for (const [nom, compte] of Object.entries(comptes)) cookies[nom] = await seConnecter(app, compte, "backoffice");
});
afterAll(async () => {
  await base.detruire();
});

function envoyer(qui: string, url: string, payload?: unknown) {
  return app.inject({ method: "POST", url, headers: ecriture("backoffice", cookies[qui]), payload: payload as never });
}

async function commande(options: { client?: string; terme?: "comptant" | "credit"; quantite?: number; prod?: string } = {}) {
  const client = options.client ?? (await creerClient(base.pool, BOUTIQUES.b1, { plafond: 1000 }));
  const r = await envoyer("gerant", `/boutiques/${BOUTIQUES.b1}/commandes`, {
    client_id: client,
    terme_paiement: options.terme ?? "comptant",
    lignes: [{ produit_id: options.prod ?? produit, quantite: options.quantite ?? 3, prix_unitaire: 9 }],
  });
  if (r.statusCode !== 201) throw new Error(r.body);
  const { rows } = await base.pool.query(`SELECT id FROM commandes WHERE reference_commande = $1`, [r.json().reference]);
  return { id: rows[0].id as string, client };
}

describe("POST /boutiques/:boutiqueId/commandes", () => {
  it("crée la commande en attente sans toucher au stock", async () => {
    const avant = await stock(base.pool, produit, BOUTIQUES.b1);
    const { id } = await commande({ quantite: 4 });
    const { rows } = await base.pool.query(`SELECT statut, montant_total FROM commandes WHERE id = $1`, [id]);
    expect([rows[0].statut, Number(rows[0].montant_total)]).toEqual(["en_attente", 36]);
    expect(await stock(base.pool, produit, BOUTIQUES.b1)).toEqual(avant);
  });

  it("refuse le vendeur, un client d'une autre boutique, un prix nul", async () => {
    const client = await creerClient(base.pool, BOUTIQUES.b1);
    const lignes = [{ produit_id: produit, quantite: 1, prix_unitaire: 9 }];
    expect((await envoyer("vendeur", `/boutiques/${BOUTIQUES.b1}/commandes`, { client_id: client, terme_paiement: "comptant", lignes })).statusCode).toBe(403);
    const autre = await creerClient(base.pool, BOUTIQUES.b2);
    expect((await envoyer("gerant", `/boutiques/${BOUTIQUES.b1}/commandes`, { client_id: autre, terme_paiement: "comptant", lignes })).statusCode).toBe(404);
    const prixNul = [{ produit_id: produit, quantite: 1, prix_unitaire: 0 }];
    expect((await envoyer("gerant", `/boutiques/${BOUTIQUES.b1}/commandes`, { client_id: client, terme_paiement: "comptant", lignes: prixNul })).statusCode).toBe(400);
  });
});

describe("cycle d'une commande", () => {
  it("confirmation : une seule fois, et pas par une autre boutique", async () => {
    const { id } = await commande();
    expect((await envoyer("gerantB2", `/commandes/${id}/confirmation`)).statusCode).toBe(403);
    expect((await envoyer("gerant", `/commandes/${id}/confirmation`)).statusCode).toBe(200);
    expect((await envoyer("gerant", `/commandes/${id}/confirmation`)).statusCode).toBe(400);
  });

  it("livraison au comptant : sort le stock et trace le mouvement", async () => {
    const { id } = await commande({ quantite: 5 });
    expect((await envoyer("gerant", `/commandes/${id}/livraison`)).statusCode).toBe(400); // pas encore confirmée
    await envoyer("gerant", `/commandes/${id}/confirmation`);
    const avant = await stock(base.pool, produit, BOUTIQUES.b1);
    const r = await envoyer("gerant", `/commandes/${id}/livraison`);
    expect(r.statusCode).toBe(200);
    expect((await stock(base.pool, produit, BOUTIQUES.b1)).quantite).toBe(avant.quantite - 5);
    const { rows } = await base.pool.query(`SELECT statut FROM commandes WHERE id = $1`, [id]);
    expect(rows[0].statut).toBe("livree");
  });

  it("livraison à crédit : augmente l'encours du client dans la limite du plafond", async () => {
    const client = await creerClient(base.pool, BOUTIQUES.b1, { plafond: 50, encours: 10 });
    const ok = await commande({ client, terme: "credit", quantite: 3 }); // 27
    await envoyer("gerant", `/commandes/${ok.id}/confirmation`);
    expect((await envoyer("gerant", `/commandes/${ok.id}/livraison`)).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT encours FROM clients WHERE id = $1`, [client]);
    expect(Number(rows[0].encours)).toBe(37);

    const trop = await commande({ client, terme: "credit", quantite: 2 }); // 37 + 18 > 50
    await envoyer("gerant", `/commandes/${trop.id}/confirmation`);
    const refus = await envoyer("gerant", `/commandes/${trop.id}/livraison`);
    expect(refus.statusCode).toBe(400);
    expect(refus.json().erreur).toContain("Plafond de crédit dépassé");
  });

  it("livraison impossible faute de stock : rien n'est écrit", async () => {
    const rare = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10, stock: 1 });
    const { id } = await commande({ prod: rare, quantite: 4 });
    await envoyer("gerant", `/commandes/${id}/confirmation`);
    const mouvements = await compter(base.pool, "mouvements_stock");
    expect((await envoyer("gerant", `/commandes/${id}/livraison`)).statusCode).toBe(409);
    expect(await compter(base.pool, "mouvements_stock")).toBe(mouvements);
    const { rows } = await base.pool.query(`SELECT statut FROM commandes WHERE id = $1`, [id]);
    expect(rows[0].statut).toBe("confirmee");
  });

  it("annulation : possible avant livraison, refusée après, 404 si inconnue", async () => {
    const { id } = await commande();
    expect((await envoyer("gerantB2", `/commandes/${id}/annulation`)).statusCode).toBe(403);
    expect((await envoyer("gerant", `/commandes/${id}/annulation`)).statusCode).toBe(200);
    const livree = await commande({ quantite: 1 });
    await envoyer("gerant", `/commandes/${livree.id}/confirmation`);
    await envoyer("gerant", `/commandes/${livree.id}/livraison`);
    expect((await envoyer("gerant", `/commandes/${livree.id}/annulation`)).statusCode).toBe(400);
    expect((await envoyer("gerant", "/commandes/00000000-0000-0000-0000-000000000000/annulation")).statusCode).toBe(404);
  });
});
