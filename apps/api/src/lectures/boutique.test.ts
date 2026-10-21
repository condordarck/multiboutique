import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerClient, creerCompte, creerProduit, ecriture, ORIGINES, seConnecter } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let produit: string;

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  produit = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 10, cout: 6, stock: 3, seuil: 5, nom: "Riz 25 kg" });
  const comptes = {
    gerant: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }),
    vendeur: await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] }),
    magasinier: await creerCompte(base.pool, "gerant_stock", { boutique_ids: [BOUTIQUES.b1] }),
    gerantB2: await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b2] }),
  };
  for (const [nom, compte] of Object.entries(comptes)) cookies[nom] = await seConnecter(app, compte, "backoffice");
  // Une vente et une réservation pour peupler les lectures.
  await app.inject({ method: "POST", url: `/boutiques/${BOUTIQUES.b1}/ventes`, headers: ecriture("backoffice", cookies.vendeur), payload: { mode_paiement: "especes", lignes: [{ produit_id: produit, quantite: 1, prix_unitaire: 10 }] } });
  await app.inject({ method: "POST", url: "/reservations", headers: ecriture("www"), payload: { client_nom: "Awa", client_telephone: "1", boutique_id: BOUTIQUES.b1, lignes: [{ produit_id: produit, quantite: 1 }] } });
});
afterAll(async () => {
  await base.detruire();
});

function lire(qui: string, url: string) {
  return app.inject({ url, headers: { origin: ORIGINES.backoffice, cookie: cookies[qui] } });
}
const b1 = (chemin = "") => `/boutiques/${BOUTIQUES.b1}${chemin}`;

describe("lectures par boutique : accès", () => {
  it.each(["", "/resume", "/ventes", "/ventes/statistiques", "/reservations", "/stock", "/mouvements-stock", "/produits"])(
    "%s : 403 hors périmètre, 200 dans le périmètre",
    async (chemin) => {
      expect((await lire("gerantB2", b1(chemin))).statusCode).toBe(403);
      expect((await lire("vendeur", b1(chemin))).statusCode).toBe(200);
    }
  );

  it("404 pour une boutique inactive", async () => {
    await base.pool.query(`UPDATE boutiques SET statut = 'inactive' WHERE id = $1`, [BOUTIQUES.b1]);
    try {
      expect((await lire("gerant", b1())).statusCode).toBe(404);
    } finally {
      await base.pool.query(`UPDATE boutiques SET statut = 'active' WHERE id = $1`, [BOUTIQUES.b1]);
    }
  });

  it.each([
    ["/clients", "vendeur"],
    ["/commandes", "vendeur"],
    ["/fournisseurs", "vendeur"],
    ["/commandes-fournisseurs", "vendeur"],
    ["/prix-conseilles", "vendeur"],
    ["/codes-promo", "vendeur"],
    ["/rapports", "magasinier"],
  ])("%s : refusé sans la permission de lecture (%s)", async (chemin, qui) => {
    expect((await lire(qui, b1(chemin))).statusCode).toBe(403);
    expect((await lire("gerant", b1(chemin))).statusCode).toBe(200);
  });
});

describe("lectures par boutique : contenu", () => {
  it("résumé : compteurs du jour, dernières ventes, réservations en attente, alertes", async () => {
    const r = (await lire("gerant", b1("/resume"))).json();
    expect(r.resume.nombre_ventes).toBe(1);
    expect(r.dernieres_ventes).toHaveLength(1);
    expect(r.reservations_en_attente).toHaveLength(1);
    expect(r.alertes_stock.map((a: { produit_id: string }) => a.produit_id)).toContain(produit);
  });

  it("statistiques des ventes agrégées en SQL, en nombres", async () => {
    const r = (await lire("gerant", b1("/ventes/statistiques"))).json();
    expect(r).toEqual({ ventes_jour: 1, ca_jour: 10, ventes_mois: 1, ca_mois: 10 });
  });

  it("reçu d'une vente : la vente et ses lignes ; 404 pour une autre boutique", async () => {
    const [vente] = (await lire("gerant", b1("/ventes"))).json();
    const recu = (await lire("gerant", b1(`/ventes/${vente.id}`))).json();
    expect(recu.vente.vendeur_nom).toBeTruthy();
    expect(recu.lignes).toEqual([expect.objectContaining({ produit_nom: "Riz 25 kg", quantite: 1, prix_unitaire: 10 })]);
    const proprio = await seConnecter(app, await creerCompte(base.pool, "proprietaire"), "backoffice");
    const autre = await app.inject({ url: `/boutiques/${BOUTIQUES.b2}/ventes/${vente.id}`, headers: { origin: ORIGINES.backoffice, cookie: proprio } });
    expect(autre.statusCode).toBe(404);
  });

  it("réservations : avec leurs lignes quand elles sont à traiter", async () => {
    const [res] = (await lire("gerant", b1("/reservations"))).json();
    expect(res.statut).toBe("en_attente");
    expect(res.lignes).toEqual([expect.objectContaining({ produit_nom: "Riz 25 kg", quantite: 1 })]);
  });

  it("produits : coût de revient visible avec prix:gerer seulement", async () => {
    const [vu] = (await lire("gerant", b1("/produits"))).json();
    expect(vu.cout_revient).toBe(6);
    const [masque] = (await lire("vendeur", b1("/produits"))).json();
    expect(masque).not.toHaveProperty("cout_revient");
    expect(masque.prix_vente).toBe(10);
  });

  it("stock et alertes : coût de revient masqué sans prix:gerer, comme /produits", async () => {
    const stockVendeur = (await lire("vendeur", b1("/stock"))).json();
    expect(stockVendeur[0]).not.toHaveProperty("cout_revient");
    expect((await lire("vendeur", b1("/resume"))).json().alertes_stock[0]).not.toHaveProperty("cout_revient");
    expect((await lire("gerant", b1("/stock"))).json()[0].cout_revient).toBe(6);
  });

  it("mouvements de stock : filtres par type, produit et période", async () => {
    const tous = (await lire("gerant", b1("/mouvements-stock"))).json();
    expect(tous.length).toBeGreaterThan(0);
    expect((await lire("gerant", b1("/mouvements-stock?type=entree"))).json()).toEqual([]);
    expect((await lire("gerant", b1("/mouvements-stock?type=sortie&produit=riz"))).json()).toHaveLength(1);
    expect((await lire("gerant", b1("/mouvements-stock?produit=inexistant"))).json()).toEqual([]);
    for (const periode of ["jour", "semaine", "mois", "annee"]) {
      expect((await lire("gerant", b1(`/mouvements-stock?periode=${periode}`))).json(), periode).toHaveLength(tous.length);
    }
  });

  it("clients : liste complète et relances, ou liste réduite pour la caisse", async () => {
    await creerClient(base.pool, BOUTIQUES.b1, { encours: 40 });
    const complet = (await lire("gerant", b1("/clients"))).json();
    expect(complet.clients.length).toBeGreaterThan(0);
    expect(complet.delai_relance).toBe(30);
    const reduit = await lire("vendeur", b1("/clients?actifs=1"));
    expect(reduit.statusCode).toBe(200);
    expect(Object.keys(reduit.json()[0]).sort()).toEqual(["encours", "est_vip", "id", "nom", "plafond_credit", "telephone", "type_client"]);
    expect((await lire("magasinier", b1("/clients?actifs=1"))).statusCode).toBe(403);
  });

  it("rapports : cinq agrégats, quatre périodes, personnalisée invalide ramenée à l'année", async () => {
    const mois = (await lire("gerant", b1("/rapports"))).json();
    expect(mois.periode).toBe("mois");
    expect(mois.totaux).toMatchObject({ nb_ventes: 1, ca: 10 });
    expect(mois.par_mode).toEqual([{ mode_paiement: "especes", nb: 1, ca: 10 }]);
    expect(mois.top_produits).toEqual([{ nom: "Riz 25 kg", qte: 1, ca: 10 }]);
    expect(mois.reservations).toEqual({ nb: 1, montant: 10 });
    expect(mois.par_jour).toHaveLength(1);
    for (const periode of ["jour", "semaine", "annee"]) {
      expect((await lire("gerant", b1(`/rapports?periode=${periode}`))).json().totaux.nb_ventes, periode).toBe(1);
    }
    const inversee = (await lire("gerant", b1("/rapports?periode=personnalisee&debut=2026-12-31&fin=2026-01-01"))).json();
    expect(new Date(inversee.debut).getMonth()).toBe(0);
    const passee = (await lire("gerant", b1("/rapports?periode=personnalisee&debut=2020-01-01&fin=2020-12-31"))).json();
    expect(passee.totaux.nb_ventes).toBe(0);
  });

  it("rapports : la date « Du » choisit le jour, la semaine, le mois ou l'année", async () => {
    const jour = (await lire("gerant", b1("/rapports?periode=jour&debut=2020-03-15"))).json();
    expect(jour.periode).toBe("jour");
    expect(new Date(jour.fin).getTime() - new Date(jour.debut).getTime()).toBe(86_400_000);
    expect(jour.totaux.nb_ventes).toBe(0);
    const { rows } = await base.pool.query(`SELECT to_char(now(), 'YYYY-MM-DD') AS aujourdhui`);
    for (const periode of ["jour", "semaine", "mois", "annee"]) {
      const r = (await lire("gerant", b1(`/rapports?periode=${periode}&debut=${rows[0].aujourdhui}`))).json();
      expect(r.totaux.nb_ventes, periode).toBe(1);
    }
    const annee = (await lire("gerant", b1("/rapports?periode=annee&debut=2020-03-15"))).json();
    expect(new Date(annee.debut).getTime()).toBe((await base.pool.query(`SELECT '2020-01-01'::timestamptz AS d`)).rows[0].d.getTime());
  });

  it("rapports : filtres vendeur et produit", async () => {
    const autre = await creerProduit(base.pool, BOUTIQUES.b1, { prix: 5, stock: 10, nom: "Huile 1 L" });
    const vente = await app.inject({
      method: "POST",
      url: b1("/ventes"),
      headers: ecriture("backoffice", cookies.gerant),
      payload: { mode_paiement: "carte", lignes: [{ produit_id: autre, quantite: 2, prix_unitaire: 5 }, { produit_id: produit, quantite: 1, prix_unitaire: 10 }] },
    });
    expect(vente.statusCode).toBe(201);
    const tout = (await lire("gerant", b1("/rapports"))).json();
    expect(tout.totaux).toMatchObject({ nb_ventes: 2, ca: 30 });
    expect(tout.vendeurs).toHaveLength(2);
    expect(tout.produits.map((p: { nom: string }) => p.nom)).toEqual(["Huile 1 L", "Riz 25 kg"]);

    const parVendeur = await Promise.all(
      tout.vendeurs.map(async (v: { id: string }) => (await lire("gerant", b1(`/rapports?vendeur=${v.id}`))).json())
    );
    expect(parVendeur.map((r) => r.totaux.nb_ventes)).toEqual([1, 1]);
    expect(parVendeur.map((r) => r.totaux.ca).sort()).toEqual([10, 20]);
    expect(parVendeur[0].vendeur).toBe(tout.vendeurs[0].id);

    const huile = (await lire("gerant", b1(`/rapports?produit=${autre}`))).json();
    expect(huile.totaux).toMatchObject({ nb_ventes: 1, ca: 10, remises: 0 });
    expect(huile.top_produits).toEqual([{ nom: "Huile 1 L", qte: 2, ca: 10 }]);
    expect(huile.par_mode).toEqual([{ mode_paiement: "carte", nb: 1, ca: 10 }]);
    expect(huile.reservations).toEqual({ nb: 0, montant: 0 });
    const riz = (await lire("gerant", b1(`/rapports?produit=${produit}`))).json();
    expect(riz.totaux).toMatchObject({ nb_ventes: 2, ca: 20 });
    expect(riz.reservations).toEqual({ nb: 1, montant: 10 });

    const invalide = (await lire("gerant", b1("/rapports?vendeur=pas-un-id&produit=x"))).json();
    expect(invalide).toMatchObject({ vendeur: null, produit: null, totaux: { nb_ventes: 2 } });
  });
});
