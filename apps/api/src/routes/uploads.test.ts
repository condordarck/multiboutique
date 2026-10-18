import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { creerBaseDeTest, type BaseDeTest } from "../../test/base";
import { BOUTIQUES, CONFIG_TEST, creerCompte, ORIGINES, seConnecter } from "../../test/fixtures";
import { construireApp } from "../app";

let base: BaseDeTest;
let app: FastifyInstance;
let dossier: string;
const cookies: Record<string, string> = {};

// En-têtes réels de chaque format, suivis d'octets quelconques.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);

function multipart(contenu: Buffer, type: string, nom = "image") {
  const frontiere = "----essai";
  const corps = Buffer.concat([
    Buffer.from(`--${frontiere}\r\nContent-Disposition: form-data; name="file"; filename="${nom}"\r\nContent-Type: ${type}\r\n\r\n`),
    contenu,
    Buffer.from(`\r\n--${frontiere}--\r\n`),
  ]);
  return { corps, type: `multipart/form-data; boundary=${frontiere}` };
}

beforeAll(async () => {
  base = await creerBaseDeTest();
  dossier = mkdtempSync(join(tmpdir(), "mb-uploads-"));
  app = await construireApp({ pool: base.pool, config: { ...CONFIG_TEST, uploadsDir: dossier } });
  cookies.gerant = await seConnecter(app, await creerCompte(base.pool, "gerant", { boutique_ids: [BOUTIQUES.b1] }), "backoffice");
  cookies.client = await seConnecter(app, await creerCompte(base.pool, "client"), "www");
});
afterAll(async () => {
  await base.detruire();
  rmSync(dossier, { recursive: true, force: true });
});

function envoyer(contenu: Buffer, type: string, entetes: Record<string, string | undefined>) {
  const { corps, type: typeMultipart } = multipart(contenu, type);
  return app.inject({ method: "POST", url: "/uploads", headers: { "content-type": typeMultipart, ...entetes }, payload: corps });
}

describe("POST /uploads", () => {
  it("enregistre une image et la relit à l'identique, avec un cache immuable", async () => {
    const r = await envoyer(PNG, "image/png", { origin: ORIGINES.backoffice, cookie: cookies.gerant });
    expect(r.statusCode).toBe(200);
    expect(r.json().url).toMatch(/^\/uploads\/produits\/[0-9a-f-]{36}\.png$/);
    const lu = await app.inject({ url: r.json().url });
    expect(lu.statusCode).toBe(200);
    expect(lu.headers["content-type"]).toBe("image/png");
    expect(lu.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(lu.rawPayload.equals(PNG)).toBe(true);
  });

  it("se fie au contenu, pas au type déclaré : un texte déguisé en PNG est refusé", async () => {
    const r = await envoyer(Buffer.from("ceci n'est pas une image"), "image/png", { origin: ORIGINES.backoffice, cookie: cookies.gerant });
    expect(r.statusCode).toBe(400);
  });

  it("nomme le fichier d'après son contenu réel", async () => {
    const r = await envoyer(JPEG, "image/png", { origin: ORIGINES.backoffice, cookie: cookies.gerant });
    expect(r.json().url).toMatch(/\.jpg$/);
  });

  it("refuse des champs texte glissés avant le fichier (mémoire)", async () => {
    const frontiere = "----essai";
    const corps = Buffer.concat([
      Buffer.from(`--${frontiere}\r\nContent-Disposition: form-data; name="bourrage"\r\n\r\n${"x".repeat(1000)}\r\n`),
      Buffer.from(`--${frontiere}\r\nContent-Disposition: form-data; name="file"; filename="i"\r\nContent-Type: image/png\r\n\r\n`),
      PNG,
      Buffer.from(`\r\n--${frontiere}--\r\n`),
    ]);
    const r = await app.inject({
      method: "POST",
      url: "/uploads",
      headers: { "content-type": `multipart/form-data; boundary=${frontiere}`, origin: ORIGINES.backoffice, cookie: cookies.gerant },
      payload: corps,
    });
    expect(r.statusCode).toBe(413);
  });

  it("refuse une image de plus de 5 Mo", async () => {
    const lourd = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 1)]);
    expect((await envoyer(lourd, "image/png", { origin: ORIGINES.backoffice, cookie: cookies.gerant })).statusCode).toBe(413);
  });

  it("refuse sans session, depuis la vitrine, et sans Origin", async () => {
    expect((await envoyer(PNG, "image/png", { origin: ORIGINES.backoffice })).statusCode).toBe(401);
    expect((await envoyer(PNG, "image/png", { origin: ORIGINES.www, cookie: cookies.client })).statusCode).toBe(403);
    expect((await envoyer(PNG, "image/png", { cookie: cookies.gerant })).statusCode).toBe(403);
  });
});

describe("GET /uploads/produits/:fichier", () => {
  it.each(["..%2F..%2Fetc%2Fpasswd", "inconnu.png", "00000000-0000-0000-0000-000000000000.exe", "%2E%2E"])("404 pour %s", async (nom) => {
    expect((await app.inject({ url: `/uploads/produits/${nom}` })).statusCode).toBe(404);
  });
});
