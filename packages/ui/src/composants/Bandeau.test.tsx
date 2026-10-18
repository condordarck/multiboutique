import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sansViolation } from "../test/axe";
import { Bandeau } from "./Bandeau";

describe("Bandeau", () => {
  it("annonce son message et propose son action", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <Bandeau ton="info" action={{ libelle: "Recharger", onClick }}>
        Nouvelle version disponible
      </Bandeau>
    );
    expect(screen.getByRole("status").textContent).toContain("Nouvelle version disponible");
    await userEvent.click(screen.getByRole("button", { name: "Recharger" }));
    expect(onClick).toHaveBeenCalledOnce();
    await sansViolation(container);
  });
});
