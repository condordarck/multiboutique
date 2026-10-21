import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, creerProduit, ecriture, ORIGINES, seConnecter, type Compte } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
const cookies: Record<string, string> = {};
let admin: Compte;

beforeAll(async () => {
  base = await creerBaseDeTest();
  app = await construireApp({ pool: base.pool, config: CONFIG_TEST });
  admin = await creerCompte(base.pool, "administrateur");
  cookies.admin = await seConnecter(app, admin, "backoffice");
  cookies.proprietaire = await seConnecter(app, await creerCompte(base.pool, "proprietaire"), "backoffice");
});
afterAll(async () => {
  await base.detruire();
});

function envoyer(qui: string, methode: "POST" | "PUT" | "DELETE", url: string, payload?: unknown) {
  return app.inject({ method: methode, url, headers: ecriture("backoffice", cookies[qui]), payload: payload as never });
}

describe("toute route /admin est refusée au propriétaire", () => {
  it.each([
    ["POST", "/admin/utilisateurs"],
    ["POST", "/admin/boutiques"],
    ["PUT", "/admin/parametres"],
    ["POST", "/admin/groupes"],
    ["POST", "/admin/regions"],
    ["POST", "/admin/categories"],
    ["POST", "/admin/types-frais"],
    ["PUT", "/admin/permissions/vendeur/ventes%3Avoir"],
  ] as const)("%s %s", async (methode, url) => {
    expect((await envoyer("proprietaire", methode, url, {})).statusCode).toBe(403);
  });
});

describe("utilisateurs", () => {
  const nouveau = (email: string, extra: Record<string, unknown> = {}) => ({
    nom_complet: "Agent test",
    email,
    password: "secret123",
    role: "vendeur",
    boutique_ids: [BOUTIQUES.b1],
    ...extra,
  });

  it("crée un compte qui peut se connecter, et trace l'auteur", async () => {
    expect((await envoyer("admin", "POST", "/admin/utilisateurs", nouveau("Agent.Un@Test.local"))).statusCode).toBe(201);
    const r = await app.inject({
      method: "POST",
      url: "/auth/connexion",
      headers: ecriture("backoffice"),
      payload: { email: "agent.un@test.local", mot_de_passe: "secret123" },
    });
    expect(r.statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT auteur_id FROM journal_audit WHERE entite = 'utilisateur' AND valeur_apres->>'email' = 'agent.un@test.local'`);
    expect(rows[0].auteur_id).toBe(admin.id);
  });

  it("refuse un doublon, un email invalide, un vendeur sans boutique", async () => {
    await envoyer("admin", "POST", "/admin/utilisateurs", nouveau("doublon@test.local"));
    const doublon = await envoyer("admin", "POST", "/admin/utilisateurs", nouveau("doublon@test.local"));
    expect(doublon.statusCode).toBe(400);
    expect(doublon.json().erreur).toContain("Un compte existe déjà");
    expect((await envoyer("admin", "POST", "/admin/utilisateurs", nouveau("pas-un-email"))).statusCode).toBe(400);
    expect((await envoyer("admin", "POST", "/admin/utilisateurs", nouveau("x@test.local", { boutique_ids: [] }))).statusCode).toBe(400);
  });

  it("désactive un compte, mais pas le sien", async () => {
    const cible = await creerCompte(base.pool, "vendeur", { boutique_ids: [BOUTIQUES.b1] });
    expect((await envoyer("admin", "POST", `/admin/utilisateurs/${cible.id}/activation`)).statusCode).toBe(200);
    expect((await envoyer("admin", "POST", `/admin/utilisateurs/${admin.id}/activation`)).statusCode).toBe(400);
  });

  it("le mot de passe réinitialisé est utilisable à la connexion", async () => {
    const cible = await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] });
    expect((await envoyer("admin", "PUT", `/admin/utilisateurs/${cible.id}/mot-de-passe`, { mot_de_passe: "court" })).statusCode).toBe(400);
    expect((await envoyer("admin", "PUT", `/admin/utilisateurs/${cible.id}/mot-de-passe`, { mot_de_passe: "nouveau-mdp" })).statusCode).toBe(200);
    expect(await seConnecter(app, { ...cible, motDePasse: "nouveau-mdp" }, "backoffice")).toContain("mb_session_bo=");
  });
});

describe("boutiques", () => {
  it("crée une boutique avec ses quatre comptes par défaut, une seule fois", async () => {
    const r = await envoyer("admin", "POST", "/admin/boutiques", { nom: "Boutique Test", statut: "active" });
    expect(r.statusCode).toBe(201);
    const { boutiqueId, comptes } = r.json();
    expect(comptes.map((c: { role: string }) => c.role).sort()).toEqual(["comptable", "gerant", "gerant_stock", "vendeur"]);
    const encore = await envoyer("admin", "POST", `/admin/boutiques/${boutiqueId}/comptes-par-defaut`);
    expect(encore.json().comptes).toEqual([]);
    const liste = await app.inject({ url: `/admin/boutiques/${boutiqueId}/comptes`, headers: { origin: ORIGINES.backoffice, cookie: cookies.admin } });
    expect(liste.json()).toHaveLength(4);
  });

  it("modifie une boutique ; refuse un nom vide ; comptes par défaut d'une boutique inconnue → 404", async () => {
    expect((await envoyer("admin", "PUT", `/admin/boutiques/${BOUTIQUES.b3}`, { nom: "Boutique Trois", statut: "inactive" })).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT nom, statut FROM boutiques WHERE id = $1`, [BOUTIQUES.b3]);
    expect(rows[0]).toEqual({ nom: "Boutique Trois", statut: "inactive" });
    expect((await envoyer("admin", "PUT", `/admin/boutiques/${BOUTIQUES.b3}`, { nom: "", statut: "active" })).statusCode).toBe(400);
    expect((await envoyer("admin", "POST", "/admin/boutiques/00000000-0000-0000-0000-000000000000/comptes-par-defaut")).statusCode).toBe(404);
  });
});

describe("paramètres, organisation, catégories, habilitations", () => {
  it("met à jour les paramètres", async () => {
    expect((await envoyer("admin", "PUT", "/admin/parametres", { parametres: [{ cle: "monnaie", valeur: " FC " }] })).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT valeur FROM parametres WHERE cle = 'monnaie'`);
    expect(rows[0].valeur).toBe("FC");
  });

  it("crée un groupe, puis une région de ce groupe ; une région sans groupe est refusée", async () => {
    expect((await envoyer("admin", "POST", "/admin/groupes", { nom: "Groupe Kinshasa" })).statusCode).toBe(201);
    const { rows } = await base.pool.query(`SELECT id FROM groupes WHERE nom = 'Groupe Kinshasa'`);
    expect((await envoyer("admin", "PUT", `/admin/groupes/${rows[0].id}`, { nom: "Groupe Kinshasa-Ouest" })).statusCode).toBe(200);
    expect((await envoyer("admin", "POST", "/admin/regions", { nom: "Gombe", groupe_id: rows[0].id })).statusCode).toBe(201);
    const { rows: reg } = await base.pool.query(`SELECT id FROM regions WHERE nom = 'Gombe'`);
    expect((await envoyer("admin", "PUT", `/admin/regions/${reg[0].id}`, { nom: "Gombe-Nord", groupe_id: rows[0].id })).statusCode).toBe(200);
    expect((await envoyer("admin", "POST", "/admin/regions", { nom: "Sans groupe", groupe_id: "" })).statusCode).toBe(400);
  });

  it("catégories : création, modification, suppression refusée si des produits y sont rattachés", async () => {
    const r = await envoyer("admin", "POST", "/admin/categories", { nom: "Conserves" });
    expect(r.statusCode).toBe(201);
    const id = r.json().id;
    expect((await envoyer("admin", "PUT", `/admin/categories/${id}`, { nom: "Conserves et bocaux" })).statusCode).toBe(200);
    const p = await creerProduit(base.pool, BOUTIQUES.b1);
    await base.pool.query(`UPDATE produits SET categorie_id = $1 WHERE id = $2`, [id, p]);
    const refus = await envoyer("admin", "DELETE", `/admin/categories/${id}`);
    expect(refus.statusCode).toBe(400);
    await base.pool.query(`UPDATE produits SET categorie_id = NULL WHERE id = $1`, [p]);
    expect((await envoyer("admin", "DELETE", `/admin/categories/${id}`)).statusCode).toBe(200);
  });

  it("types de frais : création, doublon, désactivation, suppression refusée s'ils servent à un prix", async () => {
    const lire = async (url: string) => (await app.inject({ url, headers: { origin: ORIGINES.backoffice, cookie: cookies.admin } })).json();
    expect((await lire("/admin/types-frais")).map((t: { libelle: string }) => t.libelle)).toEqual(["Douane", "Manutention", "Stockage", "Transport"]);
    const r = await envoyer("admin", "POST", "/admin/types-frais", { libelle: " Assurance " });
    expect(r.statusCode).toBe(201);
    const id = r.json().id;
    expect((await envoyer("admin", "POST", "/admin/types-frais", { libelle: "Assurance" })).json().erreur).toBe("Ce type de frais existe déjà");
    expect((await envoyer("admin", "POST", "/admin/types-frais", { libelle: "  " })).statusCode).toBe(400);

    const p = await creerProduit(base.pool, BOUTIQUES.b1);
    await base.pool.query(`INSERT INTO frais_prix (produit_id, boutique_id, type_frais_id, mode, valeur) VALUES ($1, $2, $3, 'montant', 5)`, [p, BOUTIQUES.b1, id]);
    expect((await envoyer("admin", "PUT", `/admin/types-frais/${id}`, { libelle: "Assurance transport", actif: false })).statusCode).toBe(200);
    expect((await lire("/admin/types-frais")).at(-1)).toEqual({ id, libelle: "Assurance transport", actif: false, nb_utilisations: 1 });
    expect((await lire("/types-frais")).find((t: { id: string }) => t.id === id)).toEqual({ id, libelle: "Assurance transport", actif: false });
    const refus = await envoyer("admin", "DELETE", `/admin/types-frais/${id}`);
    expect(refus.statusCode).toBe(400);
    await base.pool.query(`DELETE FROM frais_prix WHERE type_frais_id = $1`, [id]);
    expect((await envoyer("admin", "DELETE", `/admin/types-frais/${id}`)).statusCode).toBe(200);
    expect((await envoyer("admin", "PUT", `/admin/types-frais/${id}`, { libelle: "X", actif: true })).statusCode).toBe(404);
  });

  it("habilitations : active une permission, refuse un rôle inconnu", async () => {
    const url = `/admin/permissions/vendeur/${encodeURIComponent("rapports:voir")}`;
    expect((await envoyer("admin", "PUT", url, { active: true })).statusCode).toBe(200);
    const { rows } = await base.pool.query(`SELECT active FROM roles_permissions WHERE role = 'vendeur' AND permission = 'rapports:voir'`);
    expect(rows[0].active).toBe(true);
    expect((await envoyer("admin", "PUT", `/admin/permissions/pirate/${encodeURIComponent("ventes:voir")}`, { active: true })).statusCode).toBe(400);
  });
});
