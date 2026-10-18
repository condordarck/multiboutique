import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sansViolation } from "../test/axe";
import { FournisseurNotifications, useNotifier } from "./Notification";

function Declencheur() {
  const notifier = useNotifier();
  return (
    <>
      <button onClick={() => notifier.succes("Vente enregistrée")}>Succès</button>
      <button onClick={() => notifier.erreur("Stock insuffisant")}>Erreur</button>
    </>
  );
}

afterEach(() => vi.useRealTimers());

describe("Notification", () => {
  it("annonce le succès dans une région polie, puis l'efface après 4 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <FournisseurNotifications>
        <Declencheur />
      </FournisseurNotifications>
    );
    await userEvent.click(screen.getByRole("button", { name: "Succès" }));
    const region = screen.getByRole("status");
    expect(region.textContent).toContain("Vente enregistrée");
    act(() => vi.advanceTimersByTime(4100));
    expect(region.textContent).not.toContain("Vente enregistrée");
  });

  it("garde l'erreur jusqu'à ce qu'on la ferme", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <FournisseurNotifications>
        <Declencheur />
      </FournisseurNotifications>
    );
    await userEvent.click(screen.getByRole("button", { name: "Erreur" }));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("Stock insuffisant")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Fermer la notification" }));
    expect(screen.queryByText("Stock insuffisant")).toBeNull();
  });

  it("sans violation d'accessibilité", async () => {
    const { container } = render(
      <FournisseurNotifications>
        <Declencheur />
      </FournisseurNotifications>
    );
    await userEvent.click(screen.getByRole("button", { name: "Erreur" }));
    await sansViolation(container);
  });
});
