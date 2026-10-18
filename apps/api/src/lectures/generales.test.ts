import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerProduit, creerRegion, ecriture, ORIGINES, seConnecter } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let produit: string;
let reservationId: string;

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  produit = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 5, stock: 10, nom: "Sucre 1 kg" });
  await creerProduit(base.pool, BOUTIQUES.b1, { prix: 5, stock: 0, nom: "Épuisé" });
  const { region } = await creerRegion(base.pool, [BOUTIQUES.b2]);
  const client = await creerCompte(base.pool, "client");
  const comptes = {
    admin: await creerCompte(base.pool, "administrateur"),
    proprietaire: await creerCompte(base.pool, "proprietaire"),
    gerant: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }),
    vendeur: await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }),
    directeur: await creerCompte(base.pool, "directeur_region", { region_id: region }),
    // Un comptable sans boutique : le monolithe lui montrait toute la consolidation.
    comptableSansBoutique: await creerCompte(base.pool, "comptable", { boutique_ids: [] }),
  };
  for (const [nom, compte] of Object.entries(comptes)) cookies[nom] = await seConnecter(app, compte, "backoffice");
  cookies.client = await seConnecter(app, client, "www");
  const r = await app.inject({ method: "POST", url: "/reservations", headers: ecriture("www", cookies.client), payload: { client_nom: "Awa", client_telephone: "+243 999", client_email: "awa@test.local", boutique_id: BOUTIQUES.b1, lignes: [{ produit_id: produit, quantite: 2 }] } });
  reservationId = r.json().reservationId;
});
afterAll(async () => {
  await base.detruire();
});

const lire = (qui: string | null, url: string, audience: "www" | "backoffice" = "backoffice") =>
  app.inject({ url, headers: { origin: ORIGINES[audience], ...(qui ? { cookie: cookies[qui] } : {}) } });

describe("lectures générales", () => {
  it("paramètres : valeurs par défaut fusionnées, lisibles par la vitrine anonyme", async () => {
    const r = (await lire("vendeur", "/parametres")).json();
    expect(r).toMatchObject({ monnaie: "$", nom_application: "MultiBoutique", seuil_alerte_defaut: "10" });
    expect((await app.inject({ url: "/parametres" })).json().monnaie).toBe("$");
  });

  it("mes boutiques : tout pour le propriétaire, son périmètre pour les autres, refus à l'admin", async () => {
    expect((await lire("proprietaire", "/me/boutiques")).json()).toHaveLength(3);
    expect((await lire("gerant", "/me/boutiques")).json().map((b: { id: string }) => b.id)).toEqual([BOUTIQUES.b1]);
    expect((await lire("admin", "/me/boutiques")).statusCode).toBe(403);
  });

  it("résumé de toutes les boutiques : réservé au propriétaire", async () => {
    expect((await lire("proprietaire", "/resume")).json()).toHaveLength(3);
    expect((await lire("gerant", "/resume")).statusCode).toBe(403);
  });

  it("consolidation : périmètre du directeur, et rien pour un périmètre vide (écart volontaire)", async () => {
    const directeur = (await lire("directeur", "/consolidation")).json();
    expect(directeur.boutiques.map((b: { boutique_id: string }) => b.boutique_id)).toEqual([BOUTIQUES.b2]);
    expect(directeur.regions).toHaveLength(1);
    expect((await lire("proprietaire", "/consolidation")).json().boutiques).toHaveLength(3);
    expect((await lire("comptableSansBoutique", "/consolidation")).json().boutiques).toEqual([]);
    expect((await lire("vendeur", "/consolidation")).statusCode).toBe(403);
  });

  it("catégories : liste pour tout connecté", async () => {
    expect((await lire("vendeur", "/categories")).statusCode).toBe(200);
  });

  it("mes réservations : réservé au client", async () => {
    const r = (await lire("client", "/me/reservations", "www")).json();
    expect(r).toEqual([expect.objectContaining({ id: reservationId, nombre_articles: 2, boutique_nom: expect.any(String) })]);
    expect((await lire("vendeur", "/me/reservations")).statusCode).toBe(403);
  });
});

describe("vitrine publique", () => {
  it("boutiques : colonnes publiques seulement", async () => {
    const r = await app.inject({ url: "/public/boutiques" });
    expect(r.statusCode).toBe(200);
    expect(Object.keys(r.json()[0]).sort()).toEqual(["adresse", "email", "id", "nom", "telephone"]);
  });

  it("catalogue : produits disponibles et catégories ; 404 pour une boutique inactive", async () => {
    const r = (await app.inject({ url: `/public/boutiques/${BOUTIQUES.b1}/catalogue` })).json();
    expect(r.boutique.nom).toBeTruthy();
    expect(r.produits.map((p: { produit_nom: string }) => p.produit_nom)).toEqual(["Sucre 1 kg"]);
    expect(Array.isArray(r.categories)).toBe(true);
    await base.pool.query(`UPDATE boutiques SET statut = 'inactive' WHERE id = $1`, [BOUTIQUES.b3]);
    expect((await app.inject({ url: `/public/boutiques/${BOUTIQUES.b3}/catalogue` })).statusCode).toBe(404);
  });

  it("réservation : ni téléphone ni e-mail du client (écart volontaire)", async () => {
    const r = await app.inject({ url: `/public/reservations/${reservationId}` });
    expect(r.statusCode).toBe(200);
    expect(r.body).not.toContain("+243 999");
    expect(r.body).not.toContain("awa@test.local");
    expect(r.json().lignes).toHaveLength(1);
    expect(r.json().boutique.nom).toBeTruthy();
    expect((await app.inject({ url: "/public/reservations/00000000-0000-0000-0000-000000000000" })).statusCode).toBe(404);
  });
});
