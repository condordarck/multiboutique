import { describe, expect, it } from "vitest";
import { aPermission, permissionsDuRole } from "./index";

describe("matrice de permissions", () => {
  it("l'administrateur n'a aucune permission commerciale", () => {
    expect(aPermission({ role: "administrateur" }, "ventes:voir")).toBe(false);
    expect(
      aPermission({ role: "administrateur", permissions: ["ventes:voir"] }, "ventes:voir")
    ).toBe(false);
  });

  it("le gérant a tout sauf la publication des prix conseillés", () => {
    expect(permissionsDuRole("gerant")).toContain("stock:gerer");
    expect(permissionsDuRole("gerant")).not.toContain("prix_conseilles:gerer");
  });

  it("la modification des commandes passées est réservée au gérant", () => {
    expect(permissionsDuRole("gerant")).toEqual(expect.arrayContaining(["commandes:modifier", "achats:modifier"]));
    expect(permissionsDuRole("proprietaire")).not.toContain("commandes:modifier");
    expect(permissionsDuRole("proprietaire")).not.toContain("achats:modifier");
    expect(permissionsDuRole("proprietaire")).toContain("commandes:gerer");
  });

  it("le magasinier consulte le stock sans le modifier", () => {
    expect(permissionsDuRole("gerant_stock")).toEqual(["stock:voir", "produits:voir"]);
  });

  it("le vendeur encaisse sans gérer le stock", () => {
    expect(aPermission({ role: "vendeur" }, "ventes:creer")).toBe(true);
    expect(aPermission({ role: "vendeur" }, "stock:gerer")).toBe(false);
  });

  it("les permissions explicites de la session priment sur le rôle", () => {
    expect(aPermission({ role: "vendeur", permissions: ["rapports:voir"] }, "ventes:creer")).toBe(false);
    expect(aPermission({ role: "vendeur", permissions: ["rapports:voir"] }, "rapports:voir")).toBe(true);
  });

  it("une liste explicite vide retombe sur le rôle", () => {
    expect(aPermission({ role: "vendeur", permissions: [] }, "ventes:creer")).toBe(true);
  });

  it("sans session, rien n'est permis", () => {
    expect(aPermission(null, "ventes:voir")).toBe(false);
  });
});
