import { afterEach, describe, expect, it, vi } from "vitest";
import { enregistrerReglages, lireReglages, oublierReglages, REGLAGES_DEFAUT } from "./reglages";

afterEach(() => {
  localStorage.clear();
  oublierReglages();
  vi.restoreAllMocks();
});

describe("réglages d'impression", () => {
  it("par défaut : navigateur, 80 mm", () => {
    expect(lireReglages()).toEqual(REGLAGES_DEFAUT);
  });

  it("enregistrés dans ce navigateur, relus après rechargement", () => {
    enregistrerReglages({ ...REGLAGES_DEFAUT, mode: "usb", largeur: 58, imprimantes: { usb: { nom: "POS-80", vendorId: 1, productId: 2 } } });
    oublierReglages();
    expect(lireReglages()).toMatchObject({ mode: "usb", largeur: 58, imprimantes: { usb: { nom: "POS-80" } } });
  });

  it("valeurs abîmées : chacune reprend sa valeur par défaut", () => {
    localStorage.setItem("mb-impression", JSON.stringify({ mode: "fax", largeur: 70, jeu: "cp858", exemplaires: 9, couper: "oui", vitesse: 1, imprimantes: { usb: 3, navigateur: { nom: "x" } } }));
    expect(lireReglages()).toEqual({ ...REGLAGES_DEFAUT, jeu: "cp858" });
    oublierReglages();
    localStorage.setItem("mb-impression", "{pas du json");
    expect(lireReglages()).toEqual(REGLAGES_DEFAUT);
  });

  it("sans stockage (navigation privée) : défauts, et les réglages valent pour la session", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("refusé");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("refusé");
    });
    expect(lireReglages()).toEqual(REGLAGES_DEFAUT);
    enregistrerReglages({ ...REGLAGES_DEFAUT, automatique: true });
    expect(lireReglages().automatique).toBe(true);
  });
});
