import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerProduit, ecriture, seConnecter, stock } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let produit: string;
let fournisseur: string;

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  produit = await creerProduit(base.pool, BOUTIQUES.b1, { stock: 0 });
  const comptes = {
    gerant: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }),
    gerantB2: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b2] }),
    vendeur: await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }),
  };
  for (const [nom, compte] of Object.entries(comptes)) cookies[nom] = await seConnecter(app, compte, "backoffice");
  const { rows } = await base.pool.query(`INSERT INTO fournisseurs (nom, boutique_id) VALUES ('Grossiste du port', $1) RETURNING id`, [BOUTIQUES.b1]);
  fournisseur = rows[0].id;
});
afterAll(async () => {
  await base.detruire();
});

function envoyer(qui: string, methode: "POST" | "PUT", url: string, payload?: unknown) {
  return app.inject({ method: methode, url, headers: ecriture("backoffice", cookies[qui]), payload: payload as never });
}

async function commandeAchat(quantite = 10) {
  const r = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/commandes-fournisseurs`, {
    fournisseur_id: fournisseur,
    lignes: [{ produit_id: produit, quantite, prix_unitaire: 3 }],
  });
  if (r.statusCode !== 201) throw new Error(r.body);
  const { rows } = await base.pool.query(
    `SELECT c.id, l.id AS ligne FROM commandes_fournisseur c JOIN lignes_cmd_fournisseur l ON l.commande_id = c.id WHERE c.reference_cmd = $1`,
    [r.json().reference]
  );
  return { id: rows[0].id as string, ligne: rows[0].ligne as string };
}

describe("fournisseurs", () => {
  it("crée, modifie et désactive un fournisseur de sa boutique", async () => {
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/fournisseurs`, { nom: "Brasserie" })).statusCode).toBe(201);
    const { rows } = await base.pool.query(`SELECT id FROM fournisseurs WHERE nom = 'Brasserie'`);
    const id = rows[0].id;
    expect((await envoyer("gerant", "PUT", `/boutiques/${BOUTIQUES.b1}/fournisseurs/${id}`, { nom: "Brasserie du Congo" })).statusCode).toBe(200);
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/fournisseurs/${id}/activation`)).statusCode).toBe(200);
    const { rows: apres } = await base.pool.query(`SELECT nom, actif FROM fournisseurs WHERE id = $1`, [id]);
    expect(apres[0]).toEqual({ nom: "Brasserie du Congo", actif: false });
  });

  it("refuse le vendeur, une autre boutique, un fournisseur d'une autre boutique, un nom vide", async () => {
    expect((await envoyer("vendeur", "POST", `/boutiques/${BOUTIQUES.b1}/fournisseurs`, { nom: "X" })).statusCode).toBe(403);
    expect((await envoyer("gerantB2", "POST", `/boutiques/${BOUTIQUES.b1}/fournisseurs`, { nom: "X" })).statusCode).toBe(403);
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/fournisseurs`, { nom: " " })).statusCode).toBe(400);
    const { rows } = await base.pool.query(`INSERT INTO fournisseurs (nom, boutique_id) VALUES ('Autre', $1) RETURNING id`, [BOUTIQUES.b2]);
    expect((await envoyer("gerant", "PUT", `/boutiques/${BOUTIQUES.b1}/fournisseurs/${rows[0].id}`, { nom: "Y" })).statusCode).toBe(404);
  });
});

describe("commandes d'achat", () => {
  it("réception partielle puis complète : stock, mouvements et statut", async () => {
    const { id, ligne } = await commandeAchat(10);
    const partielle = await envoyer("gerant", "POST", `/commandes-fournisseurs/${id}/reception`, { receptions: [{ ligne_id: ligne, quantite_recue: 4 }] });
    expect(partielle.statusCode).toBe(200);
    let { rows } = await base.pool.query(`SELECT statut FROM commandes_fournisseur WHERE id = $1`, [id]);
    expect(rows[0].statut).toBe("partielle");
    expect((await stock(base.pool, produit, BOUTIQUES.b1)).quantite).toBe(4);
    await envoyer("gerant", "POST", `/commandes-fournisseurs/${id}/reception`, { receptions: [{ ligne_id: ligne, quantite_recue: 6 }] });
    ({ rows } = await base.pool.query(`SELECT statut FROM commandes_fournisseur WHERE id = $1`, [id]));
    expect(rows[0].statut).toBe("recue");
    expect((await stock(base.pool, produit, BOUTIQUES.b1)).quantite).toBe(10);
  });

  it("refuse de recevoir plus que commandé, et une autre boutique", async () => {
    const { id, ligne } = await commandeAchat(2);
    const trop = await envoyer("gerant", "POST", `/commandes-fournisseurs/${id}/reception`, { receptions: [{ ligne_id: ligne, quantite_recue: 3 }] });
    expect(trop.statusCode).toBe(400);
    expect(trop.json().erreur).toBe("Quantité reçue supérieure à la quantité commandée");
    expect((await envoyer("gerantB2", "POST", `/commandes-fournisseurs/${id}/reception`, { receptions: [{ ligne_id: ligne, quantite_recue: 1 }] })).statusCode).toBe(403);
  });

  it("annulation : possible avant réception, refusée après", async () => {
    const libre = await commandeAchat(1);
    expect((await envoyer("gerant", "POST", `/commandes-fournisseurs/${libre.id}/annulation`)).statusCode).toBe(200);
    const recue = await commandeAchat(1);
    await envoyer("gerant", "POST", `/commandes-fournisseurs/${recue.id}/reception`, { receptions: [{ ligne_id: recue.ligne, quantite_recue: 1 }] });
    const refus = await envoyer("gerant", "POST", `/commandes-fournisseurs/${recue.id}/annulation`);
    expect(refus.statusCode).toBe(400);
    expect((await envoyer("gerant", "POST", "/commandes-fournisseurs/00000000-0000-0000-0000-000000000000/annulation")).statusCode).toBe(404);
  });

  it("refuse une commande d'achat sans article ou à prix nul", async () => {
    const url = `/boutiques/${BOUTIQUES.b1}/commandes-fournisseurs`;
    expect((await envoyer("gerant", "POST", url, { fournisseur_id: fournisseur, lignes: [] })).statusCode).toBe(400);
    expect((await envoyer("gerant", "POST", url, { fournisseur_id: fournisseur, lignes: [{ produit_id: produit, quantite: 1, prix_unitaire: 0 }] })).statusCode).toBe(400);
  });
});
