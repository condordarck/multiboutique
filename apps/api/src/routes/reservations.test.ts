import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerProduit, ecriture, seConnecter, stock } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let produit: string;
let clientId: string;

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  produit = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 5, stock: 50 });
  const client = await creerCompte(base.pool, "client");
  clientId = client.id;
  cookies.client = await seConnecter(app, client, "www");
  cookies.gerant = await seConnecter(app, await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }), "backoffice");
  cookies.gerantB2 = await seConnecter(app, await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b2] }), "backoffice");
  cookies.vendeur = await seConnecter(app, await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }), "backoffice");
});
afterAll(async () => {
  await base.detruire();
});

const corps = (quantite = 2) => ({
  client_nom: "Awa",
  client_telephone: "+243 000 000 111",
  boutique_id: BOUTIQUES.b1,
  lignes: [{ produit_id: produit, quantite }],
});

function reserver(audience: "www" | "backoffice", cookie?: string, donnees = corps()) {
  return app.inject({ method: "POST", url: "/reservations", headers: ecriture(audience, cookie), payload: donnees });
}

async function nouvelleReservation(quantite = 2): Promise<string> {
  const r = await reserver("www", undefined, corps(quantite));
  return r.json().reservationId;
}

function agir(qui: string, id: string, action: string, payload?: unknown) {
  return app.inject({ method: "POST", url: `/reservations/${id}/${action}`, headers: ecriture("backoffice", cookies[qui]), payload: payload as never });
}

describe("POST /reservations", () => {
  it("accepte un visiteur anonyme de la vitrine et réserve le stock", async () => {
    const avant = await stock(base.pool, produit, BOUTIQUES.b1);
    const r = await reserver("www");
    expect(r.statusCode).toBe(201);
    expect((await stock(base.pool, produit, BOUTIQUES.b1)).reservee).toBe(avant.reservee + 2);
    const { rows } = await base.pool.query(`SELECT utilisateur_id, montant_total FROM reservations WHERE id = $1`, [r.json().reservationId]);
    expect(rows[0].utilisateur_id).toBeNull();
    expect(Number(rows[0].montant_total)).toBe(10);
  });

  it("rattache la réservation au client connecté", async () => {
    const r = await reserver("www", cookies.client);
    const { rows } = await base.pool.query(`SELECT utilisateur_id FROM reservations WHERE id = $1`, [r.json().reservationId]);
    expect(rows[0].utilisateur_id).toBe(clientId);
  });

  it("limite le personnel à son périmètre", async () => {
    expect((await reserver("backoffice", cookies.gerant)).statusCode).toBe(201);
    expect((await reserver("backoffice", cookies.gerantB2)).statusCode).toBe(403);
  });

  it("refuse une réservation sans article ou sans nom", async () => {
    expect((await reserver("www", undefined, { ...corps(), lignes: [] })).statusCode).toBe(400);
    expect((await reserver("www", undefined, { ...corps(), client_nom: "" })).statusCode).toBe(400);
  });

  it("limite les réservations anonymes à 20 par heure et par adresse", async () => {
    const depuis = { ...ecriture("www"), "cf-connecting-ip": "203.0.113.99" };
    for (let i = 0; i < 20; i++) {
      const r = await app.inject({ method: "POST", url: "/reservations", headers: depuis, payload: corps(1) });
      expect(r.statusCode, `réservation ${i + 1}`).toBe(201);
    }
    expect((await app.inject({ method: "POST", url: "/reservations", headers: depuis, payload: corps(1) })).statusCode).toBe(429);
  });

  it("refuse une quantité supérieure au stock disponible", async () => {
    expect((await reserver("www", undefined, corps(1000))).statusCode).toBe(409);
  });
});

describe("cycle de vie d'une réservation", () => {
  it("confirmation : en attente → prête, une seule fois", async () => {
    const id = await nouvelleReservation();
    expect((await agir("gerant", id, "confirmation")).statusCode).toBe(200);
    const deuxieme = await agir("gerant", id, "confirmation");
    expect(deuxieme.statusCode).toBe(400);
    expect(deuxieme.json().erreur).toBe("Seule une réservation en attente peut être confirmée");
  });

  it("annulation : libère le stock réservé", async () => {
    const id = await nouvelleReservation(3);
    const avant = await stock(base.pool, produit, BOUTIQUES.b1);
    expect((await agir("gerant", id, "annulation", { motif: "Client absent" })).statusCode).toBe(200);
    expect((await stock(base.pool, produit, BOUTIQUES.b1)).reservee).toBe(avant.reservee - 3);
    expect((await agir("gerant", id, "annulation", { motif: "x" })).statusCode).toBe(404);
  });

  it("encaissement : crée la vente, sort le stock, libère la réservation", async () => {
    const id = await nouvelleReservation(2);
    const avant = await stock(base.pool, produit, BOUTIQUES.b1);
    const r = await agir("gerant", id, "encaissement", { mode_paiement: "mobile_money" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ success: true, montantTotal: 10 });
    expect(await stock(base.pool, produit, BOUTIQUES.b1)).toEqual({ quantite: avant.quantite - 2, reservee: avant.reservee - 2 });
    const { rows } = await base.pool.query(`SELECT statut FROM reservations WHERE id = $1`, [id]);
    expect(rows[0].statut).toBe("retiree");
    const encore = await agir("gerant", id, "encaissement", { mode_paiement: "especes" });
    expect(encore.json().erreur).toBe("Cette réservation a déjà été encaissée");
  });

  it("validation : passe la réservation en payée", async () => {
    const id = await nouvelleReservation(1);
    expect((await agir("gerant", id, "validation")).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT statut FROM reservations WHERE id = $1`, [id]);
    expect(rows[0].statut).toBe("payee");
  });

  it.each(["validation", "confirmation", "annulation", "encaissement"])("%s : refusée au vendeur (pas reservations:gerer)", async (action) => {
    const id = await nouvelleReservation(1);
    expect((await agir("vendeur", id, action, { motif: "m", mode_paiement: "especes" })).statusCode).toBe(403);
  });

  it.each(["validation", "confirmation", "annulation", "encaissement"])("%s : refusée hors périmètre", async (action) => {
    const id = await nouvelleReservation(1);
    expect((await agir("gerantB2", id, action, { motif: "m", mode_paiement: "especes" })).statusCode).toBe(403);
  });
});
