import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { sansViolation } from "@multiboutique/front/test/axe";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { client, rendreApp, visiteur } from "../../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());

async function remplirConnexion(email = "ade@exemple.org", mdp = "secret123") {
  await userEvent.type(await screen.findByLabelText("E-mail"), email);
  await userEvent.type(screen.getByLabelText("Mot de passe"), mdp);
  await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("connexion des clients", () => {
  it("connecte puis mène à l'espace", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("POST", "/auth/connexion", 200, { utilisateur: client() });
    api.repondre("GET", "/me/reservations", 200, []);
    const app = rendreApp("/connexion");
    expect((await screen.findByRole("link", { name: "Créer un compte" })).getAttribute("href")).toBe("/inscription");
    await sansViolation(app.container);
    await remplirConnexion();
    await waitFor(() => expect(app.adresse()).toBe("/espace"));
  });

  it("revient à l'adresse retenue, jamais vers un autre site", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("POST", "/auth/connexion", 200, { utilisateur: client() });
    let app = rendreApp("/connexion?retour=%2Fboutiques%2Fb1");
    await remplirConnexion();
    await waitFor(() => expect(app.adresse()).toBe("/boutiques/b1"));
    app.unmount();
    app = rendreApp("/connexion?retour=%2F%2Fevil.example");
    await remplirConnexion();
    await waitFor(() => expect(app.adresse()).toBe("/espace"));
  });

  it("un compte du personnel est refusé, avec le lien vers l'espace professionnel", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("POST", "/auth/connexion", 403, { erreur: "Ce compte ne se connecte pas ici" });
    rendreApp("/connexion");
    await remplirConnexion("gerant@exemple.org");
    const alerte = await screen.findByRole("alert");
    expect(alerte.textContent).toContain("Ce compte ne se connecte pas ici");
    expect(screen.getByRole("link", { name: "Aller à l'espace professionnel" }).getAttribute("href")).toBe("https://backoffice.test");
  });

  it("sans session, /espace mène à la connexion en retenant l'adresse", async () => {
    api = fauxApi();
    visiteur(api);
    const app = rendreApp("/espace");
    await screen.findByRole("heading", { level: 1, name: "Connexion" });
    expect(app.adresse()).toBe("/connexion?retour=%2Fespace");
  });
});

describe("inscription", () => {
  async function remplir(motDePasse = "secret123") {
    await userEvent.type(await screen.findByLabelText("Nom complet"), "Mme Ade");
    await userEvent.type(screen.getByLabelText("Téléphone (facultatif)"), "+243 900 000 001");
    await userEvent.type(screen.getByLabelText("E-mail"), "ade@exemple.org");
    await userEvent.type(screen.getByLabelText("Mot de passe"), motDePasse);
    await userEvent.click(screen.getByRole("button", { name: "Créer mon compte" }));
  }

  it("crée le compte puis propose de se connecter, adresse pré-remplie", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("POST", "/auth/inscription", 201, { id: "c-9" });
    const app = rendreApp("/inscription");
    await remplir();
    await waitFor(() => expect(app.adresse()).toBe("/connexion"));
    expect(api.ecritures()[0]!.corps).toEqual({
      nom_complet: "Mme Ade",
      email: "ade@exemple.org",
      mot_de_passe: "secret123",
      telephone: "+243 900 000 001",
    });
    expect(await screen.findByText("Compte créé, connectez-vous.")).toBeTruthy();
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("ade@exemple.org");
  });

  it("refuse un mot de passe trop court sans appeler l'API", async () => {
    api = fauxApi();
    visiteur(api);
    rendreApp("/inscription");
    await remplir("court");
    expect((await screen.findByRole("alert")).textContent).toBe("Le mot de passe doit contenir au moins 6 caractères");
    expect(api.ecritures()).toEqual([]);
  });

  it("un e-mail déjà utilisé le dit (comme le monolithe)", async () => {
    api = fauxApi();
    visiteur(api);
    api.repondre("POST", "/auth/inscription", 409, { erreur: "Cet élément existe déjà" });
    const { container } = rendreApp("/inscription");
    await remplir();
    expect((await screen.findByRole("alert")).textContent).toBe("Cet e-mail est déjà utilisé");
    await sansViolation(container);
  });
});
