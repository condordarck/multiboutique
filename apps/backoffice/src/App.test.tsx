import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";

it("affiche le nom de l'application", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("MultiBoutique");
});
