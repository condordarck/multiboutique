import { describe, expect, it } from "vitest";
import { DUREE_SESSION_S, signerJeton, verifierJeton } from "./jeton";

const SECRET = "s".repeat(64);
const MAINTENANT = Date.UTC(2026, 9, 17, 12, 0, 0);

describe("jetons de session", () => {
  it("fait l'aller-retour pour la bonne audience", () => {
    const jeton = signerJeton(SECRET, { id: "u1", audience: "backoffice" }, MAINTENANT);
    expect(verifierJeton(SECRET, jeton, "backoffice", MAINTENANT)).toEqual({ id: "u1" });
  });

  it("refuse un jeton présenté à l'autre front", () => {
    const jeton = signerJeton(SECRET, { id: "u1", audience: "www" }, MAINTENANT);
    expect(verifierJeton(SECRET, jeton, "backoffice", MAINTENANT)).toBeNull();
  });

  it("refuse un jeton expiré", () => {
    const jeton = signerJeton(SECRET, { id: "u1", audience: "www" }, MAINTENANT);
    expect(verifierJeton(SECRET, jeton, "www", MAINTENANT + (DUREE_SESSION_S + 1) * 1000)).toBeNull();
  });

  it("refuse un contenu modifié sans re-signature", () => {
    const [entete, , signature] = signerJeton(SECRET, { id: "u1", audience: "www" }, MAINTENANT).split(".");
    const contenu = Buffer.from(
      JSON.stringify({ sub: "admin", aud: "www", iat: 0, exp: 9999999999 })
    ).toString("base64url");
    expect(verifierJeton(SECRET, `${entete}.${contenu}.${signature}`, "www", MAINTENANT)).toBeNull();
  });

  it("refuse un jeton signé avec un autre secret, celui du monolithe par exemple", () => {
    const jeton = signerJeton("m".repeat(64), { id: "u1", audience: "www" }, MAINTENANT);
    expect(verifierJeton(SECRET, jeton, "www", MAINTENANT)).toBeNull();
  });

  it("refuse un jeton mal formé", () => {
    for (const jeton of ["", "a.b", "a.b.c.d", "!!!.!!!.!!!"]) {
      expect(verifierJeton(SECRET, jeton, "www", MAINTENANT)).toBeNull();
    }
  });
});
