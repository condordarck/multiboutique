import { afterEach, describe, expect, it, vi } from "vitest";
import { fauxApi, type FauxApi } from "../../test/faux-api";
import { appeler, ErreurApi, EVENEMENT_SESSION_EXPIREE, televerser } from "./client";

let api: FauxApi;
afterEach(() => api.restaurer());

describe("client de l'API", () => {
  it("appelle l'API avec le cookie et renvoie le JSON", async () => {
    api = fauxApi();
    api.repondre("GET", "/me/boutiques", 200, [{ id: "b1" }]);
    expect(await appeler("GET", "/me/boutiques")).toEqual([{ id: "b1" }]);
    expect(api.appels()[0]).toMatchObject({ credentials: "include", contentType: null });
  });

  it("envoie toujours un corps JSON sur une écriture, même vide", async () => {
    api = fauxApi();
    api.repondre("POST", "/ventes/v1/annulation", 200, { ok: true });
    await appeler("POST", "/ventes/v1/annulation");
    expect(api.appels()[0]).toMatchObject({ corps: {}, contentType: "application/json" });
  });

  it("traduit une erreur de l'API, avec les erreurs de champ", async () => {
    api = fauxApi();
    api.repondre("POST", "/boutiques/b1/clients", 400, {
      erreur: "Données invalides",
      champs: [
        { chemin: "nom", message: "Nom requis" },
        { chemin: "lignes.0.quantite", message: "Trop petit" },
      ],
    });
    const erreur = await appeler("POST", "/boutiques/b1/clients", {}).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur).toMatchObject({
      statut: 400,
      message: "Données invalides",
      champs: { nom: "Nom requis", "lignes.0.quantite": "Trop petit" },
    });
  });

  it("signale une session expirée sur un 401 hors de /auth", async () => {
    api = fauxApi();
    api.repondre("GET", "/resume", 401, { erreur: "Non authentifié" });
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, ecouteur);
    await expect(appeler("GET", "/resume")).rejects.toMatchObject({ statut: 401 });
    window.removeEventListener(EVENEMENT_SESSION_EXPIREE, ecouteur);
    expect(ecouteur).toHaveBeenCalledOnce();
  });

  it("ne signale rien sur un 401 de /auth (identifiants refusés, pas de session)", async () => {
    api = fauxApi();
    api.repondre("POST", "/auth/connexion", 401, { erreur: "Email ou mot de passe incorrect" });
    api.repondre("GET", "/auth/session", 401, { erreur: "Non authentifié" });
    const ecouteur = vi.fn();
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, ecouteur);
    await expect(appeler("POST", "/auth/connexion", {})).rejects.toMatchObject({ message: "Email ou mot de passe incorrect" });
    await expect(appeler("GET", "/auth/session")).rejects.toMatchObject({ statut: 401 });
    window.removeEventListener(EVENEMENT_SESSION_EXPIREE, ecouteur);
    expect(ecouteur).not.toHaveBeenCalled();
  });

  it("réseau injoignable : statut 0 et message lisible", async () => {
    api = fauxApi();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(appeler("GET", "/resume")).rejects.toMatchObject({ statut: 0, message: "Connexion impossible. Vérifiez le réseau." });
  });

  it("téléverse un fichier en multipart, sans fixer le type de contenu", async () => {
    api = fauxApi();
    api.repondre("POST", "/uploads", 201, { url: "/uploads/produits/abc.png" });
    const fichier = new File(["x"], "photo.png", { type: "image/png" });
    expect(await televerser(fichier)).toEqual({ url: "/uploads/produits/abc.png" });
    const appel = api.appels()[0]!;
    expect(appel.corps).toBeInstanceOf(FormData);
    expect(appel.contentType).toBeNull();
  });
});
