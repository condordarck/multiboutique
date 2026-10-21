import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, compter, CONFIG_TEST, creerClient, creerCodePromo, creerCompte, creerProduit, ecriture, ORIGINES, seConnecter, stock } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let produit: string;

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  produit = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10, stock: 100, nom: "Riz 25 kg" });
  const comptes = {
    gerant: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }),
    gerantB2: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b2] }),
    vendeur: await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }),
    proprietaire: await creerCompte(base.pool, "proprietaire"),
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

describe("PUT /commandes/:id (modification avant livraison)", () => {
  const modifier = (qui: string, id: string, payload: unknown) =>
    app.inject({ method: "PUT", url: `/commandes/${id}`, headers: ecriture("backoffice", cookies[qui]), payload: payload as never });
  const lire = async (id: string) =>
    (await base.pool.query(`SELECT statut, terme_paiement, note, montant_brut, remise, montant_total FROM commandes WHERE id = $1`, [id])).rows[0];

  it("remplace les lignes, le paiement et la note ; garde le statut ; trace l'avant/après", async () => {
    const autre = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 5, stock: 10, nom: "Huile 1 L" });
    const { id } = await commande({ quantite: 3 });
    expect((await envoyer("gerant", `/commandes/${id}/confirmation`)).statusCode).toBe(200);
    const r = await modifier("gerant", id, {
      terme_paiement: "credit",
      note: "  Livrer le matin  ",
      lignes: [
        { produit_id: produit, quantite: 5, prix_unitaire: 9 },
        { produit_id: autre, quantite: 2, prix_unitaire: 4.5 },
      ],
    });
    expect(r.statusCode).toBe(200);
    expect(await lire(id)).toMatchObject({ statut: "confirmee", terme_paiement: "credit", note: "Livrer le matin", montant_brut: 54, remise: 0, montant_total: 54 });
    const { rows: lignes } = await base.pool.query(`SELECT produit_id, quantite FROM lignes_commandes WHERE commande_id = $1 ORDER BY quantite`, [id]);
    expect(lignes).toEqual([{ produit_id: autre, quantite: 2 }, { produit_id: produit, quantite: 5 }]);
    const { rows: trace } = await base.pool.query(`SELECT action, entite, valeur_avant, valeur_apres FROM journal_audit WHERE entite_id = $1`, [id]);
    expect(trace).toHaveLength(1);
    expect(trace[0].valeur_avant).toMatchObject({ terme_paiement: "comptant", montant_total: 27, lignes: [{ produit_id: produit, quantite: 3, prix_unitaire: 9 }] });
    expect(trace[0].valeur_apres).toMatchObject({ terme_paiement: "credit", montant_total: 54 });

    // La liste rend les lignes pour rouvrir la commande (même date : triées par nom).
    const lignesListees = async () =>
      (await app.inject({ url: `/boutiques/${BOUTIQUES.b1}/commandes`, headers: { origin: ORIGINES.backoffice, cookie: cookies.gerant } }))
        .json()
        .find((c: { id: string }) => c.id === id).lignes;
    expect(await lignesListees()).toEqual([
      { produit_id: autre, produit_nom: "Huile 1 L", quantite: 2, prix_unitaire: 4.5 },
      { produit_id: produit, produit_nom: "Riz 25 kg", quantite: 5, prix_unitaire: 9 },
    ]);
    // La livraison se fait sur le nouveau contenu ; une commande livrée ne renvoie plus ses lignes.
    const avant = await stock(base.pool, autre, BOUTIQUES.b1);
    expect((await envoyer("gerant", `/commandes/${id}/livraison`)).statusCode).toBe(200);
    expect((await stock(base.pool, autre, BOUTIQUES.b1)).quantite).toBe(avant.quantite - 2);
    expect(await lignesListees()).toEqual([]);
  });

  it("recalcule la remise du code promo d'origine sans compter une utilisation de plus", async () => {
    await creerCodePromo(base.pool, BOUTIQUES.b1, { code: "GROS10", pourcentage: 10, max: 1 });
    const client = await creerClient(base.pool, BOUTIQUES.b1, { plafond: 1000 });
    const r = await envoyer("gerant", `/boutiques/${BOUTIQUES.b1}/commandes`, {
      client_id: client,
      terme_paiement: "comptant",
      code_promo: "GROS10",
      lignes: [{ produit_id: produit, quantite: 10, prix_unitaire: 10 }],
    });
    expect(r.statusCode).toBe(201);
    const { rows } = await base.pool.query(`SELECT id FROM commandes WHERE reference_commande = $1`, [r.json().reference]);
    // Le code a atteint sa limite (1) : la modification ne doit pas le redemander.
    const m = await modifier("gerant", rows[0].id, { terme_paiement: "comptant", lignes: [{ produit_id: produit, quantite: 20, prix_unitaire: 10 }] });
    expect(m.statusCode).toBe(200);
    expect(await lire(rows[0].id)).toMatchObject({ montant_brut: 200, remise: 20, montant_total: 180, note: null });
    const { rows: p } = await base.pool.query(`SELECT nombre_utilisations FROM codes_promo WHERE code = 'GROS10'`);
    expect(p[0].nombre_utilisations).toBe(1);
  });

  it("la remise garde les conditions de la création, même si le code est changé ou supprimé depuis", async () => {
    await creerCodePromo(base.pool, BOUTIQUES.b1, { code: "FIGE10", pourcentage: 10 });
    const client = await creerClient(base.pool, BOUTIQUES.b1, { plafond: 1000 });
    const r = await envoyer("gerant", `/boutiques/${BOUTIQUES.b1}/commandes`, {
      client_id: client,
      terme_paiement: "comptant",
      code_promo: "FIGE10",
      lignes: [{ produit_id: produit, quantite: 10, prix_unitaire: 10 }],
    });
    const { rows } = await base.pool.query(`SELECT id FROM commandes WHERE reference_commande = $1`, [r.json().reference]);
    const id = rows[0].id;
    const corps = (quantite: number) => ({ terme_paiement: "comptant", lignes: [{ produit_id: produit, quantite, prix_unitaire: 10 }] });

    await base.pool.query(`UPDATE codes_promo SET valeur_reduction = 50 WHERE code = 'FIGE10'`);
    expect((await modifier("gerant", id, corps(20))).statusCode).toBe(200);
    expect(await lire(id)).toMatchObject({ montant_brut: 200, remise: 20, montant_total: 180 });

    await base.pool.query(`DELETE FROM codes_promo WHERE code = 'FIGE10'`);
    expect((await modifier("gerant", id, corps(30))).statusCode).toBe(200);
    expect(await lire(id)).toMatchObject({ montant_brut: 300, remise: 30, montant_total: 270 });
  });

  it("un produit retiré de la vente depuis reste modifiable sur la commande, mais ne peut pas y être ajouté", async () => {
    const retire = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10, stock: 10 });
    const ailleurs = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10, stock: 10 });
    const { id } = await commande({ prod: retire, quantite: 2 });
    await base.pool.query(`UPDATE prix_boutique SET actif = false WHERE produit_id = ANY($1::uuid[])`, [[retire, ailleurs]]);
    const garde = await modifier("gerant", id, { terme_paiement: "comptant", note: "Juste la note", lignes: [{ produit_id: retire, quantite: 2, prix_unitaire: 9 }] });
    expect(garde.statusCode).toBe(200);
    const ajout = await modifier("gerant", id, {
      terme_paiement: "comptant",
      lignes: [
        { produit_id: retire, quantite: 2, prix_unitaire: 9 },
        { produit_id: ailleurs, quantite: 1, prix_unitaire: 9 },
      ],
    });
    expect(ajout.statusCode).toBe(400);
    expect(ajout.json().erreur).toBe("Produit non configuré dans cette boutique");
  });

  it("refuse une commande livrée ou annulée, sans article, à quantité décimale ; 404 si inconnue", async () => {
    const corps = { terme_paiement: "comptant", lignes: [{ produit_id: produit, quantite: 1, prix_unitaire: 9 }] };
    const livree = await commande();
    await envoyer("gerant", `/commandes/${livree.id}/confirmation`);
    await envoyer("gerant", `/commandes/${livree.id}/livraison`);
    const refus = await modifier("gerant", livree.id, corps);
    expect(refus.statusCode).toBe(400);
    expect(refus.json().erreur).toBe("Seule une commande en attente ou confirmée peut être modifiée");
    const annulee = await commande();
    await envoyer("gerant", `/commandes/${annulee.id}/annulation`);
    expect((await modifier("gerant", annulee.id, corps)).statusCode).toBe(400);

    const { id } = await commande();
    expect((await modifier("gerant", id, { ...corps, lignes: [] })).statusCode).toBe(400);
    expect((await modifier("gerant", id, { ...corps, lignes: [{ produit_id: produit, quantite: 1.5, prix_unitaire: 9 }] })).statusCode).toBe(400);
    expect((await modifier("gerant", "99999999-9999-9999-9999-999999999999", corps)).statusCode).toBe(404);
    expect(await lire(id)).toMatchObject({ montant_total: 27 });
  });

  it("réservée au gérant : refusée au propriétaire (pour le moment), au vendeur et à une autre boutique", async () => {
    const { id } = await commande();
    const corps = { terme_paiement: "comptant", lignes: [{ produit_id: produit, quantite: 1, prix_unitaire: 9 }] };
    expect((await modifier("proprietaire", id, corps)).statusCode).toBe(403);
    expect((await modifier("vendeur", id, corps)).statusCode).toBe(403);
    expect((await modifier("gerantB2", id, corps)).statusCode).toBe(403);
    expect(await lire(id)).toMatchObject({ montant_total: 27 });
  });
});
