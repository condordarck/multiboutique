import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { CONFIG_TEST, ORIGINES } from "../test/fixtures";
import { securite } from "./securite";

async function app() {
  const a = Fastify({ logger: false });
  await a.register(securite, { config: CONFIG_TEST });
  a.get("/lecture", async (requete) => ({ audience: requete.audience }));
  a.post("/ecriture", async () => ({ ok: true }));
  // En vrai, @fastify/multipart ; ici un analyseur muet suffit à isoler le contrôle d'origine.
  a.addContentTypeParser("multipart/form-data", (_requete, _flux, fini) => fini(null));
  a.post("/televersement", { config: { televersement: true } }, async () => ({ ok: true }));
  return a;
}

const JSON_ = { "content-type": "application/json" };

describe("CORS", () => {
  it.each([ORIGINES.www, ORIGINES.backoffice])("autorise le preflight de %s, avec cookies", async (origine) => {
    const r = await (await app()).inject({
      method: "OPTIONS",
      url: "/ecriture",
      headers: { origin: origine, "access-control-request-method": "POST" },
    });
    expect(r.headers["access-control-allow-origin"]).toBe(origine);
    expect(r.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("n'autorise pas une autre origine", async () => {
    const r = await (await app()).inject({
      method: "OPTIONS",
      url: "/ecriture",
      headers: { origin: "https://pirate.test", "access-control-request-method": "POST" },
    });
    expect(r.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("contrôle d'origine des écritures", () => {
  it("refuse une écriture sans Origin", async () => {
    const r = await (await app()).inject({ method: "POST", url: "/ecriture", headers: JSON_, payload: "{}" });
    expect(r.statusCode).toBe(403);
  });

  it("refuse une écriture d'une origine inconnue", async () => {
    const r = await (await app()).inject({
      method: "POST",
      url: "/ecriture",
      headers: { ...JSON_, origin: "https://pirate.test" },
      payload: "{}",
    });
    expect(r.statusCode).toBe(403);
  });

  it("refuse une écriture qui n'est pas du JSON (formulaire, text/plain)", async () => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data; boundary=x"]) {
      const r = await (await app()).inject({
        method: "POST",
        url: "/ecriture",
        headers: { "content-type": type, origin: ORIGINES.www },
        payload: "a=b",
      });
      expect(r.statusCode, type).toBe(415);
    }
  });

  it("accepte une écriture JSON d'un front, et une écriture sans corps", async () => {
    const a = await app();
    expect(
      (await a.inject({ method: "POST", url: "/ecriture", headers: { ...JSON_, origin: ORIGINES.backoffice }, payload: "{}" }))
        .statusCode
    ).toBe(200);
    expect((await a.inject({ method: "POST", url: "/ecriture", headers: { origin: ORIGINES.www } })).statusCode).toBe(200);
  });

  it("accepte le multipart sur la seule route de téléversement, avec une origine connue", async () => {
    const a = await app();
    const multipart = { "content-type": "multipart/form-data; boundary=x" };
    expect(
      (await a.inject({ method: "POST", url: "/televersement", headers: { ...multipart, origin: ORIGINES.backoffice }, payload: "" }))
        .statusCode
    ).not.toBe(415);
    expect((await a.inject({ method: "POST", url: "/televersement", headers: multipart, payload: "" })).statusCode).toBe(403);
  });

  it("laisse passer une lecture sans Origin (image, sonde)", async () => {
    const r = await (await app()).inject({ method: "GET", url: "/lecture" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ audience: null });
  });

  it("déduit l'audience de l'origine", async () => {
    const a = await app();
    expect((await a.inject({ url: "/lecture", headers: { origin: ORIGINES.www } })).json()).toEqual({ audience: "www" });
    expect((await a.inject({ url: "/lecture", headers: { origin: ORIGINES.backoffice } })).json()).toEqual({
      audience: "backoffice",
    });
  });
});
