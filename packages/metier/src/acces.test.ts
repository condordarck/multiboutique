import { describe, expect, it } from "vitest";
import { exigerAccesBoutique, exigerAdministrateur, peutAccederBoutique } from "./acces";
import type { Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";

const B1 = "11111111-1111-1111-1111-111111111111";
const B2 = "22222222-2222-2222-2222-222222222222";

function utilisateur(role: Utilisateur["role"], boutique_ids: string[] = [], permissions: string[] = []): Utilisateur {
  return { id: "u", email: "u@x", nom_complet: "U", role, boutique_ids, permissions };
}

describe("peutAccederBoutique", () => {
  it("refuse l'administrateur, qui ne voit pas les données commerciales", () => {
    expect(peutAccederBoutique(utilisateur("administrateur", [B1]), B1)).toBe(false);
  });
  it("ouvre toutes les boutiques au propriétaire", () => {
    expect(peutAccederBoutique(utilisateur("proprietaire"), B2)).toBe(true);
  });
  it("limite les autres rôles à leurs boutiques", () => {
    expect(peutAccederBoutique(utilisateur("gerant", [B1]), B1)).toBe(true);
    expect(peutAccederBoutique(utilisateur("gerant", [B1]), B2)).toBe(false);
  });
  it("refuse sans utilisateur", () => {
    expect(peutAccederBoutique(null, B1)).toBe(false);
  });
});

describe("exigerAccesBoutique", () => {
  it("lève une erreur 403 hors périmètre, avec le message du monolithe", () => {
    const appel = () => exigerAccesBoutique(utilisateur("vendeur", [B1]), B2);
    expect(appel).toThrow(ErreurMetier);
    expect(appel).toThrow("Accès refusé à cette boutique");
    try {
      appel();
    } catch (e) {
      expect((e as ErreurMetier).statut).toBe(403);
    }
  });

  it("lève une erreur 403 quand une permission manque", () => {
    expect(() => exigerAccesBoutique(utilisateur("vendeur", [B1]), B1, ["stock:gerer"])).toThrow(
      "Votre profil n'a pas les droits pour cette action"
    );
  });

  it("applique les permissions chargées de roles_permissions plutôt que la matrice", () => {
    const vendeur = utilisateur("vendeur", [B1], ["stock:gerer"]);
    expect(exigerAccesBoutique(vendeur, B1, ["stock:gerer"])).toBe(vendeur);
  });

  it("laisse passer sans permission demandée", () => {
    const gerant = utilisateur("gerant", [B1]);
    expect(exigerAccesBoutique(gerant, B1)).toBe(gerant);
  });
});

describe("exigerAdministrateur", () => {
  it("refuse tout autre rôle, propriétaire compris", () => {
    expect(() => exigerAdministrateur(utilisateur("proprietaire"))).toThrow("Réservé à l'administrateur");
  });
  it("laisse passer l'administrateur", () => {
    const admin = utilisateur("administrateur");
    expect(exigerAdministrateur(admin)).toBe(admin);
  });
});

describe("ErreurMetier", () => {
  it("reste une Error, pour que le monolithe affiche son message comme avant", () => {
    const e = new ErreurMetier("Stock insuffisant", 409);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("Stock insuffisant");
    expect(new ErreurMetier("x").statut).toBe(400);
  });
});
