import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sansViolation } from "../test/axe";
import { CaseACocher } from "./CaseACocher";

describe("CaseACocher", () => {
  it("se coche par son libellé et décrit son effet", async () => {
    const onChange = vi.fn();
    const { container } = render(<CaseACocher libelle="Client VIP" aide="Paiement partiel autorisé" checked={false} onChange={(e) => onChange(e.target.checked)} />);
    const caseVip = screen.getByRole("checkbox", { name: "Client VIP" });
    expect(caseVip.getAttribute("aria-describedby")).toBe(screen.getByText("Paiement partiel autorisé").id);
    await userEvent.click(screen.getByText("Client VIP"));
    expect(onChange).toHaveBeenCalledWith(true);
    await sansViolation(container);
  });
});
