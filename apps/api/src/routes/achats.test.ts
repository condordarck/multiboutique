import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerProduit, ecriture, ORIGINES, seConnecter, stock } from "../../test/fixtures";
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
    proprietaire: await creerCompte(base.pool, "proprietaire"),
    comptable: await creerCompte(base.pool, "comptable", { boutique_ids: [BOUTIQUES.b1] }),
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

describe("PUT /commandes-fournisseurs/:id (modification avant réception)", () => {
  const lire = async (id: string) => (await base.pool.query(`SELECT statut, total_attendu, note FROM commandes_fournisseur WHERE id = $1`, [id])).rows[0];

  it("remplace les lignes et la note, recalcule le total, trace l'avant/après", async () => {
    const autre = await creerProduit(base.pool, BOUTIQUES.b1, { stock: 0 });
    const { id } = await commandeAchat(10);
    const r = await envoyer("gerant", "PUT", `/commandes-fournisseurs/${id}`, {
      note: "Livraison quai 2",
      lignes: [
        { produit_id: produit, quantite: 4, prix_unitaire: 3 },
        { produit_id: autre, quantite: 6, prix_unitaire: 2.5 },
      ],
    });
    expect(r.statusCode).toBe(200);
    expect(await lire(id)).toEqual({ statut: "en_attente", total_attendu: 27, note: "Livraison quai 2" });
    const { rows } = await base.pool.query(
      `SELECT produit_id, quantite_commandee, quantite_recue FROM lignes_cmd_fournisseur WHERE commande_id = $1 ORDER BY quantite_commandee`,
      [id]
    );
    expect(rows).toEqual([
      { produit_id: produit, quantite_commandee: 4, quantite_recue: 0 },
      { produit_id: autre, quantite_commandee: 6, quantite_recue: 0 },
    ]);
    const { rows: trace } = await base.pool.query(`SELECT entite, valeur_avant FROM journal_audit WHERE entite_id = $1`, [id]);
    expect(trace).toEqual([{ entite: "commande_fournisseur", valeur_avant: { note: null, total_attendu: 30, lignes: [{ produit_id: produit, quantite: 10, prix_unitaire: 3 }] } }]);
  });

  it("refuse après une première réception, une commande annulée, un produit inconnu ; 403 hors gérant", async () => {
    const corps = { lignes: [{ produit_id: produit, quantite: 2, prix_unitaire: 3 }] };
    const recue = await commandeAchat(10);
    await envoyer("gerant", "POST", `/commandes-fournisseurs/${recue.id}/reception`, { receptions: [{ ligne_id: recue.ligne, quantite_recue: 1 }] });
    const refus = await envoyer("gerant", "PUT", `/commandes-fournisseurs/${recue.id}`, corps);
    expect(refus.statusCode).toBe(400);
    expect(refus.json().erreur).toBe("Seule une commande fournisseur sans aucune réception peut être modifiée");
    const annulee = await commandeAchat();
    await envoyer("gerant", "POST", `/commandes-fournisseurs/${annulee.id}/annulation`);
    expect((await envoyer("gerant", "PUT", `/commandes-fournisseurs/${annulee.id}`, corps)).statusCode).toBe(400);

    const { id } = await commandeAchat();
    const inconnu = await envoyer("gerant", "PUT", `/commandes-fournisseurs/${id}`, { lignes: [{ produit_id: "99999999-9999-9999-9999-999999999999", quantite: 1, prix_unitaire: 3 }] });
    expect(inconnu.statusCode).toBe(400);
    for (const qui of ["proprietaire", "vendeur", "gerantB2"]) {
      expect((await envoyer(qui, "PUT", `/commandes-fournisseurs/${id}`, corps)).statusCode, qui).toBe(403);
    }
    expect(await lire(id)).toMatchObject({ total_attendu: 30 });
  });

  it("prix d'achat des lignes réservé à qui peut modifier ; quantité décimale refusée dès la création", async () => {
    const { id } = await commandeAchat(10);
    const lignes = async (qui: string) =>
      (await app.inject({ url: `/boutiques/${BOUTIQUES.b1}/commandes-fournisseurs`, headers: { origin: ORIGINES.backoffice, cookie: cookies[qui] } }))
        .json()
        .find((c: { id: string }) => c.id === id).lignes;
    expect((await lignes("gerant"))[0]).toMatchObject({ produit_id: produit, quantite_commandee: 10, prix_unitaire: 3 });
    expect((await lignes("comptable"))[0].prix_unitaire).toBeUndefined();

    const decimale = await envoyer("gerant", "POST", `/boutiques/${BOUTIQUES.b1}/commandes-fournisseurs`, {
      fournisseur_id: fournisseur,
      lignes: [{ produit_id: produit, quantite: 1.5, prix_unitaire: 3 }],
    });
    expect(decimale.statusCode).toBe(400);
    expect(decimale.json().erreur).toBe("Quantité invalide");
  });
});
