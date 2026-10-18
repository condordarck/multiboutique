// @vitest-environment node
import { describe, expect, it } from "vitest";
import { enTetes, origineApi, origineExigee } from "./en-tetes";

describe("en-têtes du backoffice", () => {
  it("une seule CSP, l'API seule autorisée en connect-src et img-src", () => {
    const texte = enTetes("https://api.morpion.cloud");
    expect(texte.match(/Content-Security-Policy:/g)).toHaveLength(1);
    const csp = /Content-Security-Policy: (.*)/.exec(texte)![1]!;
    const directive = (nom: string) => csp.split("; ").find((d) => d.startsWith(`${nom} `));
    expect(directive("connect-src")).toBe("connect-src 'self' https://api.morpion.cloud");
    expect(directive("img-src")).toBe("img-src 'self' data: https://api.morpion.cloud");
    expect(directive("script-src")).toBe("script-src 'self'");
    expect(directive("worker-src")).toBe("worker-src 'self'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("le shell et le service worker ne sont jamais mis en cache ; les fichiers versionnés, si", () => {
    const texte = enTetes("https://api.morpion.cloud");
    expect(texte).toMatch(/\/index\.html\n {2}Cache-Control: no-cache/);
    expect(texte).toMatch(/\/sw\.js\n {2}Cache-Control: no-cache/);
    expect(texte).toMatch(/\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
  });

  it("refuse un build sans API, ou vers une API en http hors localhost", () => {
    expect(() => origineApi(undefined)).toThrow("VITE_API_URL");
    expect(() => origineApi("http://api.morpion.cloud")).toThrow("VITE_API_URL");
    expect(() => origineApi("pas une url")).toThrow("VITE_API_URL");
    expect(origineApi("http://localhost:4100")).toBe("http://localhost:4100");
    expect(origineApi("https://api.morpion.cloud/")).toBe("https://api.morpion.cloud");
  });

  it("une autre adresse exigée (lien vers le backoffice) suit la même règle, en la nommant", () => {
    expect(() => origineExigee("VITE_BACKOFFICE_URL", undefined)).toThrow("VITE_BACKOFFICE_URL");
    expect(() => origineExigee("VITE_BACKOFFICE_URL", "http://backoffice.morpion.cloud")).toThrow("VITE_BACKOFFICE_URL");
    expect(origineExigee("VITE_BACKOFFICE_URL", "https://backoffice.morpion.cloud")).toBe("https://backoffice.morpion.cloud");
  });
});
