import { describe, expect, it } from "vitest";
import { lireConfig } from "./config";

const VALIDE = {
  DATABASE_URL: "postgres://mb:x@db:5432/multiboutique",
  API_JWT_SECRET: "a".repeat(64),
  ORIGINE_WWW: "https://www.morpion.cloud",
  ORIGINE_BACKOFFICE: "https://backoffice.morpion.cloud",
  UPLOADS_DIR: "/donnees/uploads",
};

describe("lireConfig", () => {
  it("lit une configuration complète, port 4000 par défaut", () => {
    expect(lireConfig(VALIDE)).toEqual({
      port: 4000,
      databaseUrl: VALIDE.DATABASE_URL,
      jwtSecret: VALIDE.API_JWT_SECRET,
      origines: { www: VALIDE.ORIGINE_WWW, backoffice: VALIDE.ORIGINE_BACKOFFICE },
      uploadsDir: VALIDE.UPLOADS_DIR,
    });
  });

  it("lit le port fourni", () => {
    expect(lireConfig({ ...VALIDE, PORT: "4100" }).port).toBe(4100);
  });

  it.each(["DATABASE_URL", "API_JWT_SECRET", "ORIGINE_WWW", "ORIGINE_BACKOFFICE", "UPLOADS_DIR"])(
    "nomme la variable %s quand elle manque",
    (nom) => {
      const env: Record<string, string | undefined> = { ...VALIDE };
      delete env[nom];
      expect(() => lireConfig(env)).toThrow(nom);
    }
  );

  it("refuse un secret trop court ou la valeur d'exemple", () => {
    expect(() => lireConfig({ ...VALIDE, API_JWT_SECRET: "court" })).toThrow("API_JWT_SECRET");
    expect(() => lireConfig({ ...VALIDE, API_JWT_SECRET: "change-me-super-secret-please" })).toThrow("API_JWT_SECRET");
  });

  it("exige des origines https sans chemin", () => {
    expect(() => lireConfig({ ...VALIDE, ORIGINE_WWW: "http://www.morpion.cloud" })).toThrow("ORIGINE_WWW");
    expect(() => lireConfig({ ...VALIDE, ORIGINE_BACKOFFICE: "https://backoffice.morpion.cloud/x" })).toThrow(
      "ORIGINE_BACKOFFICE"
    );
  });

  it("refuse un port invalide", () => {
    expect(() => lireConfig({ ...VALIDE, PORT: "quatre" })).toThrow("PORT");
  });
});
