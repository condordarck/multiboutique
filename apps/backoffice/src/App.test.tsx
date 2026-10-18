import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, it } from "vitest";
import { routes } from "./App";

it("une adresse inconnue affiche « Page introuvable » et ramène à l'accueil", () => {
  const routeur = createMemoryRouter(routes, { initialEntries: ["/inconnu"] });
  render(<RouterProvider router={routeur} />);
  expect(screen.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Retour à l'accueil" }).getAttribute("href")).toBe("/");
});
