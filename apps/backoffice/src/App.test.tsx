import { screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { fauxApi, type FauxApi } from "@multiboutique/front/test/faux-api";
import { rendreApp } from "../test/rendu";

let api: FauxApi;
afterEach(() => api.restaurer());

it("une adresse inconnue affiche « Page introuvable » et ramène à l'accueil", async () => {
  api = fauxApi();
  api.repondre("GET", "/auth/session", 401, { erreur: "Non authentifié" });
  rendreApp("/inconnu");
  expect(await screen.findByRole("heading", { level: 1, name: "Page introuvable" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Retour à l'accueil" }).getAttribute("href")).toBe("/");
});
