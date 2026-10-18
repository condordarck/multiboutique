import { afterEach, describe, expect, it, vi } from "vitest";
import { ecrirePanier, lirePanier, viderPanier, type LignePanier } from "./panier";

const RIZ: LignePanier = { produit_id: "p-riz", produit_nom: "Riz 25 kg", quantite: 2, disponible: 18, prix_vente: 22 };

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("panier", () => {
  it("un panier par boutique, conservé dans la session de l'onglet", () => {
    ecrirePanier("b1", [RIZ]);
    expect(lirePanier("b1")).toEqual([RIZ]);
    expect(lirePanier("b2")).toEqual([]);
    viderPanier("b1");
    expect(lirePanier("b1")).toEqual([]);
  });

  it("un contenu illisible donne un panier vide", () => {
    sessionStorage.setItem("mb-panier-b1", "{pas du json");
    expect(lirePanier("b1")).toEqual([]);
  });

  it("sans stockage (navigation privée), rien ne casse", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    expect(() => ecrirePanier("b1", [RIZ])).not.toThrow();
  });
});
