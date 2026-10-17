import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import {
  BOUTIQUES,
  compter,
  CONFIG_TEST,
  creerClient,
  creerCodePromo,
  creerCompte,
  creerProduit,
  ecriture,
  seConnecter,
  stock,
} from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let p1: string; // 10 $, 100 en stock
let p2: string; // 4 $, 1 en stock

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  p1 = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10, stock: 100 });
  p2 = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 4, stock: 1 });
  const comptes = {
    vendeur: await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }),
    magasinier: await creerCompte(base.pool, "gerant_stock", { boutique_ids: [BOUTIQUES.b1] }),
    gerant: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }),
    gerantB2: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b2] }),
  };
  for (const [nom, compte] of Object.entries(comptes)) cookies[nom] = await seConnecter(app, compte, "backoffice");
});
afterAll(async () => {
  await base.detruire();
});

function vendre(qui: string, corps: Record<string, unknown>, boutique: string = BOUTIQUES.b1) {
  return app.inject({ method: "POST", url: `/boutiques/${boutique}/ventes`, headers: ecriture("backoffice", cookies[qui]), payload: corps });
}

describe("POST /boutiques/:boutiqueId/ventes", () => {
  it("enregistre la vente, décrémente le stock et trace le mouvement", async () => {
    const avant = await stock(base.pool, p1, BOUTIQUES.b1);
    const r = await vendre("vendeur", { mode_paiement: "especes", lignes: [{ produit_id: p1, quantite: 2, prix_unitaire: 999 }] });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ success: true, montantTotal: 20 });
    const { rows } = await base.pool.query(`SELECT * FROM ventes WHERE reference_vente = $1`, [r.json().reference]);
    // Le prix vient de la base, pas du corps de la requête.
    expect(Number(rows[0].montant_total)).toBe(20);
    expect(Number(rows[0].montant_paye)).toBe(20);
    expect((await stock(base.pool, p1, BOUTIQUES.b1)).quantite).toBe(avant.quantite - 2);
    const { rows: mvt } = await base.pool.query(`SELECT * FROM mouvements_stock WHERE motif = $1`, [`Vente ${r.json().reference}`]);
    expect(mvt[0]).toMatchObject({ type: "sortie", quantite: 2, quantite_avant: avant.quantite, quantite_apres: avant.quantite - 2 });
  });

  it("refuse un profil sans ventes:creer", async () => {
    const r = await vendre("magasinier", { mode_paiement: "especes", lignes: [{ produit_id: p1, quantite: 1, prix_unitaire: 10 }] });
    expect(r.statusCode).toBe(403);
  });

  it("refuse une boutique hors du périmètre", async () => {
    const r = await vendre("gerantB2", { mode_paiement: "especes", lignes: [{ produit_id: p1, quantite: 1, prix_unitaire: 10 }] });
    expect(r.statusCode).toBe(403);
  });

  it("refuse sans session", async () => {
    const r = await app.inject({ method: "POST", url: `/boutiques/${BOUTIQUES.b1}/ventes`, headers: ecriture("backoffice"), payload: { mode_paiement: "especes", lignes: [{ produit_id: p1, quantite: 1, prix_unitaire: 1 }] } });
    expect(r.statusCode).toBe(401);
  });

  it("répond 409 avec le message de la base quand le stock manque", async () => {
    const r = await vendre("vendeur", { mode_paiement: "especes", lignes: [{ produit_id: p2, quantite: 3, prix_unitaire: 4 }] });
    expect(r.statusCode).toBe(409);
    expect(r.json().erreur).toContain("Stock insuffisant");
  });

  it("n'écrit rien quand la deuxième ligne échoue", async () => {
    const avant = {
      ventes: await compter(base.pool, "ventes"),
      lignes: await compter(base.pool, "lignes_vente"),
      mouvements: await compter(base.pool, "mouvements_stock"),
      stock: await stock(base.pool, p1, BOUTIQUES.b1),
    };
    const r = await vendre("vendeur", {
      mode_paiement: "especes",
      lignes: [
        { produit_id: p1, quantite: 1, prix_unitaire: 10 },
        { produit_id: p2, quantite: 5, prix_unitaire: 4 },
      ],
    });
    expect(r.statusCode).toBe(409);
    expect(await compter(base.pool, "ventes")).toBe(avant.ventes);
    expect(await compter(base.pool, "lignes_vente")).toBe(avant.lignes);
    expect(await compter(base.pool, "mouvements_stock")).toBe(avant.mouvements);
    expect(await stock(base.pool, p1, BOUTIQUES.b1)).toEqual(avant.stock);
  });

  it("applique un code promo valide et compte son utilisation", async () => {
    const code = await creerCodePromo(base.pool, BOUTIQUES.b1, { pourcentage: 10 });
    const r = await vendre("vendeur", { mode_paiement: "carte", code_promo: code.toLowerCase(), lignes: [{ produit_id: p1, quantite: 1, prix_unitaire: 10 }] });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ montantTotal: 9, remise: 1 });
    const { rows } = await base.pool.query(`SELECT nombre_utilisations FROM codes_promo WHERE code = $1`, [code]);
    expect(rows[0].nombre_utilisations).toBe(1);
  });

  it("refuse un code promo expiré ou épuisé", async () => {
    const expire = await creerCodePromo(base.pool, BOUTIQUES.b1, { dateFin: "2020-01-01" });
    const epuise = await creerCodePromo(base.pool, BOUTIQUES.b1, { max: 1, utilisations: 1 });
    const ligne = [{ produit_id: p1, quantite: 1, prix_unitaire: 10 }];
    const r1 = await vendre("vendeur", { mode_paiement: "especes", code_promo: expire, lignes: ligne });
    expect(r1.statusCode).toBe(400);
    expect(r1.json().erreur).toBe("Ce code promo est inactif ou expiré");
    const r2 = await vendre("vendeur", { mode_paiement: "especes", code_promo: epuise, lignes: ligne });
    expect(r2.json().erreur).toBe("Ce code promo a atteint sa limite d'utilisation");
  });

  it("vend à crédit dans la limite du plafond et inscrit la créance", async () => {
    const client = await creerClient(base.pool, BOUTIQUES.b1, { plafond: 15 });
    const ligne = [{ produit_id: p1, quantite: 2, prix_unitaire: 10 }];
    const trop = await vendre("vendeur", { mode_paiement: "especes", client_id: client, montant_paye: 2, lignes: ligne });
    expect(trop.statusCode).toBe(400);
    expect(trop.json().erreur).toContain("dépasserait le plafond");
    const ok = await vendre("vendeur", { mode_paiement: "especes", client_id: client, montant_paye: 10, lignes: ligne });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().reste).toBe(10);
    const { rows } = await base.pool.query(`SELECT encours FROM clients WHERE id = $1`, [client]);
    expect(Number(rows[0].encours)).toBe(10);
    const { rows: registre } = await base.pool.query(`SELECT type, montant FROM registre_credits WHERE client_id = $1`, [client]);
    expect(registre).toHaveLength(1);
    expect(registre[0].type).toBe("vente");
    expect(Number(registre[0].montant)).toBe(10);
  });

  it("refuse un corps invalide (quantité négative, aucune ligne)", async () => {
    expect((await vendre("vendeur", { mode_paiement: "especes", lignes: [{ produit_id: p1, quantite: -1, prix_unitaire: 10 }] })).statusCode).toBe(400);
    expect((await vendre("vendeur", { mode_paiement: "especes", lignes: [] })).statusCode).toBe(400);
    expect((await vendre("vendeur", { mode_paiement: "troc", lignes: [{ produit_id: p1, quantite: 1, prix_unitaire: 10 }] })).statusCode).toBe(400);
  });
});

describe("POST /ventes/:id/annulation", () => {
  async function venteDe(quantite: number) {
    const r = await vendre("vendeur", { mode_paiement: "especes", lignes: [{ produit_id: p1, quantite, prix_unitaire: 10 }] });
    const { rows } = await base.pool.query(`SELECT id FROM ventes WHERE reference_vente = $1`, [r.json().reference]);
    return rows[0].id as string;
  }
  function annuler(qui: string, id: string, motif = "Erreur de saisie") {
    return app.inject({ method: "POST", url: `/ventes/${id}/annulation`, headers: ecriture("backoffice", cookies[qui]), payload: { motif } });
  }

  it("annule la vente et rétablit le stock", async () => {
    const id = await venteDe(1);
    const avant = await stock(base.pool, p1, BOUTIQUES.b1);
    const r = await annuler("gerant", id);
    expect(r.statusCode).toBe(200);
    expect((await stock(base.pool, p1, BOUTIQUES.b1)).quantite).toBe(avant.quantite + 1);
    const { rows } = await base.pool.query(`SELECT statut, motif_annulation FROM ventes WHERE id = $1`, [id]);
    expect(rows[0]).toEqual({ statut: "annulee", motif_annulation: "Erreur de saisie" });
  });

  it("refuse le vendeur, qui n'a pas ventes:annuler", async () => {
    expect((await annuler("vendeur", await venteDe(1))).statusCode).toBe(403);
  });

  it("refuse un gérant d'une autre boutique", async () => {
    expect((await annuler("gerantB2", await venteDe(1))).statusCode).toBe(403);
  });

  it("exige un motif et refuse une vente déjà annulée", async () => {
    const id = await venteDe(1);
    expect((await annuler("gerant", id, "  ")).statusCode).toBe(400);
    expect((await annuler("gerant", id)).statusCode).toBe(200);
    expect((await annuler("gerant", id)).statusCode).toBe(404);
  });

  it("répond 400 à un identifiant mal formé", async () => {
    expect((await annuler("gerant", "pas-un-uuid")).statusCode).toBe(400);
  });
});
