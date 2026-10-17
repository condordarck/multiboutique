import { describe, expect, it, vi } from "vitest";
import { CONFIG_TEST } from "../test/fixtures";
import { construireApp } from "./app";

function poolFactice(query: () => Promise<unknown>) {
  return { query: vi.fn(query) };
}

describe("GET /health", () => {
  it("répond 200 quand la base répond", async () => {
    const app = await construireApp({ pool: poolFactice(async () => ({ rows: [] })) as never, config: CONFIG_TEST });
    const rep = await app.inject({ method: "GET", url: "/health" });
    expect(rep.statusCode).toBe(200);
    expect(rep.json()).toEqual({ status: "ok" });
  });

  it("répond 503 sans divulguer l'erreur quand la base est injoignable", async () => {
    const app = await construireApp({
      pool: poolFactice(async () => {
        throw new Error("ECONNREFUSED 10.0.0.5:5432");
      }) as never,
      config: CONFIG_TEST,
    });
    const rep = await app.inject({ method: "GET", url: "/health" });
    expect(rep.statusCode).toBe(503);
    expect(rep.json()).toEqual({ status: "degraded" });
    expect(rep.body).not.toContain("ECONNREFUSED");
  });

  it("n'interroge la base qu'une fois par fenêtre de 3 secondes", async () => {
    const pool = poolFactice(async () => ({ rows: [] }));
    const app = await construireApp({ pool: pool as never, config: CONFIG_TEST });
    await app.inject({ method: "GET", url: "/health" });
    await app.inject({ method: "GET", url: "/health" });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe("corps JSON", () => {
  async function app() {
    const a = await construireApp({ pool: poolFactice(async () => ({ rows: [] })) as never, config: CONFIG_TEST });
    a.post("/essai", async (r) => ({ corps: r.body ?? null }));
    return a;
  }
  const entetes = { origin: CONFIG_TEST.origines.backoffice, "content-type": "application/json" };

  it("accepte un corps vide avec l'en-tête JSON", async () => {
    const r = await (await app()).inject({ method: "POST", url: "/essai", headers: entetes, payload: "" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ corps: null });
  });

  it("refuse un JSON invalide ou une pollution de prototype", async () => {
    const a = await app();
    expect((await a.inject({ method: "POST", url: "/essai", headers: entetes, payload: "{" })).statusCode).toBe(400);
    expect((await a.inject({ method: "POST", url: "/essai", headers: entetes, payload: '{"__proto__":{"x":1}}' })).statusCode).toBe(400);
  });
});
