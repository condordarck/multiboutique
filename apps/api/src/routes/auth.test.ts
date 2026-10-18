import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerRegion, ORIGINES, seConnecter, type Compte } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
let gerant: Compte;
let client: Compte;

beforeAll(async () => {
  base = await creerBaseDeTest();
  gerant = await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] });
  client = await creerCompte(base.pool, "client");
});
afterAll(async () => {
  await base.detruire();
});
beforeEach(async () => {
  // Une app par test : le compteur anti force brute repart de zéro.
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
});

function connexion(audience: keyof typeof ORIGINES, email: string, mot_de_passe: string) {
  return app.inject({
    method: "POST",
    url: "/auth/connexion",
    headers: { origin: ORIGINES[audience], "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
    payload: { email, mot_de_passe },
  });
}

describe("POST /auth/connexion", () => {
  it("connecte le personnel au backoffice, avec un cookie HttpOnly propre à ce front", async () => {
    const r = await connexion("backoffice", gerant.email, gerant.motDePasse);
    expect(r.statusCode).toBe(200);
    expect(r.json().utilisateur).toMatchObject({ id: gerant.id, role: "gerant", boutique_ids: [BOUTIQUES.b1] });
    const cookie = r.cookies[0]!;
    // __Host- : le navigateur refuse qu'un sous-domaine voisin impose ce cookie.
    expect(cookie.name).toBe("__Host-mb_session_bo");
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    expect(cookie.domain).toBeUndefined();
    expect(cookie.maxAge).toBe(7 * 24 * 3600);
  });

  it("connecte un client à la vitrine, avec le cookie de la vitrine", async () => {
    const r = await connexion("www", client.email, client.motDePasse);
    expect(r.statusCode).toBe(200);
    expect(r.cookies[0]!.name).toBe("__Host-mb_session_www");
  });

  it("refuse un client sur le backoffice et le personnel sur la vitrine", async () => {
    expect((await connexion("backoffice", client.email, client.motDePasse)).statusCode).toBe(403);
    expect((await connexion("www", gerant.email, gerant.motDePasse)).statusCode).toBe(403);
  });

  it("refuse un mauvais mot de passe sans dire lequel des deux est faux", async () => {
    const r = await connexion("backoffice", gerant.email, "faux");
    expect(r.statusCode).toBe(401);
    expect(r.json().erreur).toBe("Email ou mot de passe incorrect");
    expect(r.cookies).toHaveLength(0);
  });

  it("refuse un compte désactivé", async () => {
    const inactif = await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1], actif: false });
    expect((await connexion("backoffice", inactif.email, inactif.motDePasse)).statusCode).toBe(401);
  });

  it("bloque la 6e tentative en 15 minutes depuis la même adresse", async () => {
    for (let i = 0; i < 5; i++) expect((await connexion("backoffice", gerant.email, "faux")).statusCode).toBe(401);
    expect((await connexion("backoffice", gerant.email, gerant.motDePasse)).statusCode).toBe(429);
  });

  it("refuse un corps incomplet", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/auth/connexion",
      headers: { origin: ORIGINES.backoffice, "content-type": "application/json" },
      payload: { email: gerant.email },
    });
    expect(r.statusCode).toBe(400);
  });

  it("résout le périmètre d'un directeur de région à la connexion", async () => {
    const { region } = await creerRegion(base.pool, [BOUTIQUES.b2, BOUTIQUES.b3]);
    const directeur = await creerCompte(base.pool, "directeur_region", { region_id: region });
    const r = await connexion("backoffice", directeur.email, directeur.motDePasse);
    expect([...r.json().utilisateur.boutique_ids].sort()).toEqual([BOUTIQUES.b2, BOUTIQUES.b3].sort());
  });
});

describe("POST /auth/inscription", () => {
  function inscription(audience: keyof typeof ORIGINES, corps: Record<string, unknown>) {
    return app.inject({
      method: "POST",
      url: "/auth/inscription",
      headers: { origin: ORIGINES[audience], "content-type": "application/json" },
      payload: corps,
    });
  }

  it("crée un compte client, email en minuscules, utilisable aussitôt", async () => {
    const r = await inscription("www", { nom_complet: "Awa", email: "Awa.Client@Test.local", mot_de_passe: "secret123" });
    expect(r.statusCode).toBe(201);
    const { rows } = await base.pool.query(`SELECT email, role FROM utilisateurs WHERE id = $1`, [r.json().id]);
    expect(rows[0]).toEqual({ email: "awa.client@test.local", role: "client" });
    expect((await connexion("www", "awa.client@test.local", "secret123")).statusCode).toBe(200);
  });

  it("impose le rôle client, même si le corps en demande un autre", async () => {
    const r = await inscription("www", { nom_complet: "X", email: "x@test.local", mot_de_passe: "secret123", role: "proprietaire" });
    const { rows } = await base.pool.query(`SELECT role FROM utilisateurs WHERE id = $1`, [r.json().id]);
    expect(rows[0].role).toBe("client");
  });

  it("refuse un email déjà utilisé", async () => {
    expect((await inscription("www", { nom_complet: "Y", email: gerant.email, mot_de_passe: "secret123" })).statusCode).toBe(409);
  });

  it("refuse un mot de passe de moins de 6 ou de plus de 72 caractères", async () => {
    expect((await inscription("www", { nom_complet: "Z", email: "z1@test.local", mot_de_passe: "court" })).statusCode).toBe(400);
    expect((await inscription("www", { nom_complet: "Z", email: "z2@test.local", mot_de_passe: "x".repeat(73) })).statusCode).toBe(400);
  });

  it("n'est ouverte que depuis la vitrine", async () => {
    expect((await inscription("backoffice", { nom_complet: "W", email: "w@test.local", mot_de_passe: "secret123" })).statusCode).toBe(403);
  });
});

describe("session et déconnexion", () => {
  it("renvoie l'utilisateur courant et ses permissions effectives", async () => {
    const cookie = await seConnecter(app, gerant, "backoffice");
    const r = await app.inject({ url: "/auth/session", headers: { origin: ORIGINES.backoffice, cookie } });
    expect(r.statusCode).toBe(200);
    expect(r.json().utilisateur).toMatchObject({ id: gerant.id, role: "gerant" });
    expect(Array.isArray(r.json().utilisateur.permissions)).toBe(true);
  });

  it("répond 401 sans cookie", async () => {
    expect((await app.inject({ url: "/auth/session", headers: { origin: ORIGINES.backoffice } })).statusCode).toBe(401);
  });

  it("efface le cookie à la déconnexion", async () => {
    const cookie = await seConnecter(app, gerant, "backoffice");
    const r = await app.inject({ method: "POST", url: "/auth/deconnexion", headers: { origin: ORIGINES.backoffice, cookie } });
    expect(r.statusCode).toBe(200);
    expect(r.cookies[0]).toMatchObject({ name: "__Host-mb_session_bo", value: "", maxAge: 0 });
  });
});
