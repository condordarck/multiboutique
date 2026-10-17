import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerProduit, ecriture, seConnecter, stock } from "../../test/fixtures";
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
    magasinier: await creerCompte(base.pool, "gerant_stock", { boutique_ids: [BOUTIQUES.b1] }),
    proprietaire: await creerCompte(base.pool, "proprietaire"),
  };
  for (const [nom, compte] of Object.entries(comptes)) cookies[nom] = await seConnecter(app, compte, "backoffice");
});
afterAll(async () => {
  await base.detruire();
});

function envoyer(qui: string, methode: "POST" | "PUT", url: string, payload: unknown) {
  return app.inject({ method: methode, url, headers: ecriture("backoffice", cookies[qui]), payload: payload as never });
}

describe("POST /boutiques/:boutiqueId/produits", () => {
  const nouveau = (ref: string, code?: string) => ({
    produit: { reference: ref, nom: `Produit ${ref}`, ...(code ? { code } : {}) },
    prix_vente: 12,
    cout_revient: 8,
  });

  it("crée le produit, son prix et sa ligne de stock au seuil par défaut", async () => {
    const r = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/produits`, nouveau("REF-A"));
    expect(r.statusCode).toBe(201);
    const id = r.json().produitId;
    const { rows: prix } = await base.pool.query(`SELECT prix_vente, cout_revient FROM prix_boutique WHERE produit_id = $1`, [id]);
    expect(prix.map((p) => [Number(p.prix_vente), Number(p.cout_revient)])).toEqual([[12, 8]]);
    const { rows: st } = await base.pool.query(`SELECT quantite, seuil_alerte FROM stocks WHERE produit_id = $1`, [id]);
    expect(st[0]).toEqual({ quantite: 0, seuil_alerte: 10 });
    const { rows: p } = await base.pool.query(`SELECT code FROM produits WHERE id = $1`, [id]);
    expect(p[0].code).toMatch(/^PRD-\d{4}$/);
  });

  it("refuse un code invalide ou déjà pris", async () => {
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/produits`, nouveau("REF-B", "a b"))).statusCode).toBe(400);
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/produits`, nouveau("REF-C", "CODE-1"))).statusCode).toBe(201);
    const doublon = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/produits`, nouveau("REF-D", "code-1"));
    expect(doublon.statusCode).toBe(400);
    expect(doublon.json().erreur).toBe("Ce code produit existe déjà");
  });

  it("refuse le magasinier (pas produits:gerer) et une boutique hors périmètre", async () => {
    expect((await envoyer("magasinier", "POST", `/boutiques/${BOUTIQUES.b1}/produits`, nouveau("REF-E"))).statusCode).toBe(403);
    expect((await envoyer("gerantB2", "POST", `/boutiques/${BOUTIQUES.b1}/produits`, nouveau("REF-F"))).statusCode).toBe(403);
  });
});

describe("stock", () => {
  it("entrée : ajoute la quantité et trace le mouvement", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1, { stock: 4 });
    const r = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/stock/${p}/entrees`, { quantite: 6, motif: "Livraison" });
    expect(r.statusCode).toBe(200);
    expect((await stock(base.pool, p, BOUTIQUES.b1)).quantite).toBe(10);
    const { rows } = await base.pool.query(`SELECT type, quantite_avant, quantite_apres, motif FROM mouvements_stock WHERE produit_id = $1`, [p]);
    expect(rows).toEqual([{ type: "entree", quantite_avant: 4, quantite_apres: 10, motif: "Livraison" }]);
  });

  it("entrée : refuse une quantité nulle, un produit inconnu, un profil sans stock:gerer", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1);
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/stock/${p}/entrees`, { quantite: 0 })).statusCode).toBe(400);
    expect((await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/stock/00000000-0000-0000-0000-000000000000/entrees`, { quantite: 1 })).statusCode).toBe(404);
    expect((await envoyer("vendeur", "POST", `/boutiques/${BOUTIQUES.b1}/stock/${p}/entrees`, { quantite: 1 })).statusCode).toBe(403);
    expect((await envoyer("gerantB2", "POST", `/boutiques/${BOUTIQUES.b1}/stock/${p}/entrees`, { quantite: 1 })).statusCode).toBe(403);
  });

  it("ajustement : fixe la quantité, mouvement avec l'écart absolu", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1, { stock: 10 });
    expect((await envoyer("gerant", "PUT", `/boutiques/${BOUTIQUES.b1}/stock/${p}`, { quantite: 7, motif: "Inventaire" })).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT type, quantite, quantite_avant, quantite_apres FROM mouvements_stock WHERE produit_id = $1`, [p]);
    expect(rows).toEqual([{ type: "ajustement", quantite: 3, quantite_avant: 10, quantite_apres: 7 }]);
  });

  it("ajustement : refuse une quantité négative ou sous le stock réservé", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1, { stock: 10 });
    await base.pool.query(`UPDATE stocks SET quantite_reservee = 4 WHERE produit_id = $1`, [p]);
    const negatif = await envoyer("gerant", "PUT", `/boutiques/${BOUTIQUES.b1}/stock/${p}`, { quantite: -1 });
    expect(negatif.statusCode, negatif.body).toBe(400);
    const r = await envoyer("gerant", "PUT", `/boutiques/${BOUTIQUES.b1}/stock/${p}`, { quantite: 3 });
    expect(r.statusCode, r.body).toBe(400);
    expect(r.json().erreur).toContain("inférieure au stock réservé");
  });

  it("transfert : déplace le stock et écrit deux mouvements", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1, { stock: 10 });
    await base.pool.query(`INSERT INTO stocks (produit_id, boutique_id, quantite) VALUES ($1, $2, 1)`, [p, BOUTIQUES.b2]);
    const r = await envoyer("proprietaire", "POST", `/boutiques/${BOUTIQUES.b1}/transferts`, {
      boutique_destination_id: BOUTIQUES.b2,
      produit_id: p,
      quantite: 4,
    });
    expect(r.statusCode).toBe(200);
    expect((await stock(base.pool, p, BOUTIQUES.b1)).quantite).toBe(6);
    expect((await stock(base.pool, p, BOUTIQUES.b2)).quantite).toBe(5);
    const { rows } = await base.pool.query(`SELECT count(*)::int AS n FROM mouvements_stock WHERE produit_id = $1 AND type = 'transfert'`, [p]);
    expect(rows[0].n).toBe(2);
  });

  it("transfert : refuse une destination hors périmètre, la même boutique, un stock insuffisant", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1, { stock: 2 });
    const corps = (dest: string, quantite: number) => ({ boutique_destination_id: dest, produit_id: p, quantite });
    const horsPerimetre = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/transferts`, corps(BOUTIQUES.b2, 1));
    expect(horsPerimetre.statusCode).toBe(403);
    expect(horsPerimetre.json().erreur).toBe("Accès refusé à la boutique de destination");
    expect((await envoyer("proprietaire", "POST", `/boutiques/${BOUTIQUES.b1}/transferts`, corps(BOUTIQUES.b1, 1))).statusCode).toBe(400);
    expect((await envoyer("proprietaire", "POST", `/boutiques/${BOUTIQUES.b1}/transferts`, corps(BOUTIQUES.b2, 5))).statusCode).toBe(409);
  });
});

describe("prix", () => {
  it("modifie le prix d'une boutique ; refuse un prix nul et le vendeur", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10 });
    expect((await envoyer("gerant", "PUT", `/boutiques/${BOUTIQUES.b1}/prix/${p}`, { prix_vente: 11.5, cout_revient: 7 })).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT prix_vente FROM prix_boutique WHERE produit_id = $1`, [p]);
    expect(Number(rows[0].prix_vente)).toBe(11.5);
    expect((await envoyer("gerant", "PUT", `/boutiques/${BOUTIQUES.b1}/prix/${p}`, { prix_vente: 0 })).statusCode).toBe(400);
    expect((await envoyer("vendeur", "PUT", `/boutiques/${BOUTIQUES.b1}/prix/${p}`, { prix_vente: 9 })).statusCode).toBe(403);
  });

  it("prix conseillés : publiés par le siège, appliqués par le gérant", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10 });
    expect((await envoyer("gerant", "POST", "/prix-reference", { produit_id: p, prix_vente: 15 })).statusCode).toBe(403);
    expect((await envoyer("proprietaire", "POST", "/prix-reference", { produit_id: p, prix_vente: 0 })).statusCode).toBe(400);
    expect((await envoyer("proprietaire", "POST", "/prix-reference", { produit_id: p, prix_vente: 15, cout_revient: 9 })).statusCode).toBe(200);

    expect((await envoyer("vendeur", "POST", `/boutiques/${BOUTIQUES.b1}/prix-conseilles/application`, { produit_ids: [p] })).statusCode).toBe(403);
    const r = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/prix-conseilles/application`, { produit_ids: [p] });
    expect(r.statusCode).toBe(200);
    expect(r.json().appliques).toBe(1);
    const { rows } = await base.pool.query(`SELECT prix_vente, cout_revient FROM prix_boutique WHERE produit_id = $1 AND boutique_id = $2`, [p, BOUTIQUES.b1]);
    expect([Number(rows[0].prix_vente), Number(rows[0].cout_revient)]).toEqual([15, 9]);
  });

  it("prix conseillés : rien à appliquer → 400", async () => {
    const p = await creerProduit(base.pool, BOUTIQUES.b1);
    const r = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/prix-conseilles/application`, { produit_ids: [p] });
    expect(r.statusCode).toBe(400);
  });
});
