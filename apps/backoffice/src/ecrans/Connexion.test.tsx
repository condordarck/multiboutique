import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EVENEMENT_SESSION_EXPIREE } from "../api/client";
import { fauxApi, type FauxApi } from "../../test/faux-api";
import { BOUTIQUE_1, connecte, rendreApp, utilisateur } from "../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());

async function seConnecter(email = "gerant@exemple.org", mdp = "secret123") {
  await userEvent.type(await screen.findByLabelText("E-mail"), email);
  await userEvent.type(screen.getByLabelText("Mot de passe"), mdp);
  await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("connexion", () => {
  it("sans session, un écran protégé renvoie à la connexion en retenant l'adresse", async () => {
    api = fauxApi();
    api.repondre("GET", "/auth/session", 401, { erreur: "Non authentifié" });
    const app = rendreApp("/b/x/stock?q=riz");
    await screen.findByRole("heading", { name: "Connexion" });
    expect(app.adresse()).toBe("/connexion?retour=%2Fb%2Fx%2Fstock%3Fq%3Driz");
  });

  it("connecte, envoie l'e-mail et le mot de passe, puis mène à l'écran du rôle", async () => {
    api = fauxApi();
    api.repondre("GET", "/auth/session", 401, { erreur: "Non authentifié" });
    api.repondre("POST", "/auth/connexion", 200, { utilisateur: utilisateur() });
    const app = rendreApp("/connexion");
    await seConnecter();
    await waitFor(() => expect(app.adresse()).toBe(`/b/${BOUTIQUE_1}`));
    expect(api.ecritures()[0]).toMatchObject({
      chemin: "/auth/connexion",
      corps: { email: "gerant@exemple.org", mot_de_passe: "secret123" },
    });
  });

  it("revient à l'adresse retenue, mais jamais vers un autre site", async () => {
    api = fauxApi();
    api.repondre("GET", "/auth/session", 401, { erreur: "Non authentifié" });
    api.repondre("POST", "/auth/connexion", 200, { utilisateur: utilisateur() });
    let app = rendreApp("/connexion?retour=%2Fb%2Fx%2Fstock");
    await seConnecter();
    await waitFor(() => expect(app.adresse()).toBe("/b/x/stock"));
    app.unmount();

    app = rendreApp("/connexion?retour=%2F%2Fevil.example");
    await seConnecter();
    await waitFor(() => expect(app.adresse()).toBe(`/b/${BOUTIQUE_1}`));
  });

  it("affiche le refus de l'API (identifiants, compte client)", async () => {
    api = fauxApi();
    api.repondre("GET", "/auth/session", 401, { erreur: "Non authentifié" });
    api.repondre("POST", "/auth/connexion", 403, { erreur: "Ce compte ne se connecte pas ici" });
    rendreApp("/connexion");
    await seConnecter();
    expect((await screen.findByRole("alert")).textContent).toBe("Ce compte ne se connecte pas ici");
    expect(screen.getByRole("button", { name: "Se connecter" }).hasAttribute("disabled")).toBe(false);
  });

  it.each([
    ["administrateur", [], "/admin"],
    ["proprietaire", [], "/tableau-de-bord"],
    ["directeur_groupe", [BOUTIQUE_1], "/consolidation"],
    ["directeur_region", [BOUTIQUE_1], "/consolidation"],
    ["vendeur", [BOUTIQUE_1], `/b/${BOUTIQUE_1}`],
  ] as const)("la racine mène le rôle %s vers %s", async (role, boutiques, cible) => {
    api = fauxApi();
    connecte(api, utilisateur({ role, boutique_ids: [...boutiques] }));
    const app = rendreApp("/");
    await waitFor(() => expect(app.adresse()).toBe(cible));
  });

  it("sans boutique, explique au lieu de boucler", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur", boutique_ids: [] }));
    const app = rendreApp("/");
    expect(await screen.findByText("Aucune boutique")).toBeTruthy();
    expect(app.adresse()).toBe("/");
  });

  it("une session expirée renvoie une seule fois à la connexion", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur", boutique_ids: [] }));
    const app = rendreApp("/");
    await screen.findByText("Aucune boutique");
    const naviguer = vi.spyOn(app.routeur, "navigate");
    window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
    window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
    await screen.findByRole("heading", { name: "Connexion" });
    expect(naviguer).toHaveBeenCalledTimes(1);
    expect(app.adresse()).toBe("/connexion?retour=%2F");
  });

  it("la déconnexion appelle l'API et vide le cache", async () => {
    api = fauxApi();
    connecte(api, utilisateur({ role: "vendeur", boutique_ids: [] }));
    api.repondre("POST", "/auth/deconnexion", 200, { ok: true });
    const app = rendreApp("/");
    app.client.setQueryData(["quelque-chose"], 42);
    await userEvent.click(await screen.findByRole("button", { name: "Se déconnecter" }));
    await screen.findByRole("heading", { name: "Connexion" });
    expect(api.ecritures().map((a) => a.chemin)).toEqual(["/auth/deconnexion"]);
    expect(app.client.getQueryData(["quelque-chose"])).toBeUndefined();
  });
});
