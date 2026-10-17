import Fastify from "fastify";
import { ErreurMetier } from "@multiboutique/metier";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { gestionnaireErreurs } from "./erreurs";

function app() {
  const a = Fastify({ logger: false });
  a.setErrorHandler(gestionnaireErreurs);
  a.get("/metier", async () => {
    throw new ErreurMetier("Code promo expiré", 400);
  });
  a.get("/acces", async () => {
    throw new ErreurMetier("Accès refusé à cette boutique", 403);
  });
  a.get("/plpgsql", async () => {
    throw Object.assign(new Error("Stock insuffisant. Disponible: 2, Demandé: 5"), { code: "P0001" });
  });
  a.get("/doublon", async () => {
    throw Object.assign(new Error('duplicate key value violates unique constraint "utilisateurs_email_key"'), {
      code: "23505",
    });
  });
  a.get("/syntaxe", async () => {
    throw Object.assign(new Error('invalid input syntax for type uuid: "abc"'), { code: "22P02" });
  });
  a.get("/zod", async () => {
    z.object({ quantite: z.number() }).parse({ quantite: "deux" });
  });
  a.get("/panne", async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.5:5432");
  });
  return a;
}

describe("gestionnaireErreurs", () => {
  it("renvoie le statut et le message d'une ErreurMetier", async () => {
    const r = await app().inject({ url: "/metier" });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ erreur: "Code promo expiré" });
    expect((await app().inject({ url: "/acces" })).statusCode).toBe(403);
  });

  it("traduit une exception PL/pgSQL en 409 avec son message", async () => {
    const r = await app().inject({ url: "/plpgsql" });
    expect(r.statusCode).toBe(409);
    expect(r.json().erreur).toBe("Stock insuffisant. Disponible: 2, Demandé: 5");
  });

  it("traduit un doublon en 409 sans exposer la contrainte", async () => {
    const r = await app().inject({ url: "/doublon" });
    expect(r.statusCode).toBe(409);
    expect(r.body).not.toContain("utilisateurs_email_key");
  });

  it("traduit un identifiant mal formé en 400 sans détail SQL", async () => {
    const r = await app().inject({ url: "/syntaxe" });
    expect(r.statusCode).toBe(400);
    expect(r.body).not.toContain("uuid");
  });

  it("traduit une erreur de validation en 400 avec le détail des champs", async () => {
    const r = await app().inject({ url: "/zod" });
    expect(r.statusCode).toBe(400);
    expect(r.json().champs[0].chemin).toBe("quantite");
  });

  it("masque le message d'une erreur inattendue", async () => {
    const r = await app().inject({ url: "/panne" });
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("ECONNREFUSED");
  });

  it("garde le statut des erreurs de Fastify (JSON invalide)", async () => {
    const a = app();
    a.post("/json", async () => ({}));
    const r = await a.inject({ method: "POST", url: "/json", headers: { "content-type": "application/json" }, payload: "{" });
    expect(r.statusCode).toBe(400);
  });
});
