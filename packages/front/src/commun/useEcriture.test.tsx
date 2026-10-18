import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FournisseurNotifications } from "@multiboutique/ui";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErreurApi } from "../api/client";
import { useEcriture } from "./useEcriture";

function environnement() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const enveloppe = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <FournisseurNotifications>{children}</FournisseurNotifications>
    </QueryClientProvider>
  );
  return { client, enveloppe };
}

function horsLigne(valeur: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(!valeur);
  window.dispatchEvent(new Event(valeur ? "offline" : "online"));
}

afterEach(() => vi.restoreAllMocks());

describe("useEcriture", () => {
  it("appelle, invalide les lectures listées et annonce le succès", async () => {
    const { client, enveloppe } = environnement();
    const invalider = vi.spyOn(client, "invalidateQueries");
    const appel = vi.fn().mockResolvedValue({ id: "v1" });
    const { result } = renderHook(
      () => useEcriture({ appel, invalide: [["ventes"], ["stock"]], succes: "Vente enregistrée" }),
      { wrapper: enveloppe }
    );
    let retour: unknown;
    await act(async () => {
      retour = await result.current.envoyer({ total: 5 });
    });
    expect(appel.mock.calls).toEqual([[{ total: 5 }]]);
    expect(retour).toEqual({ id: "v1" });
    expect(invalider.mock.calls.map((c) => c[0]?.queryKey)).toEqual([["ventes"], ["stock"]]);
    expect(await screen.findByText("Vente enregistrée")).toBeTruthy();
  });

  it("remonte le message et les erreurs de champ, sans lever", async () => {
    const { enveloppe } = environnement();
    const appel = vi.fn().mockRejectedValue(new ErreurApi(400, "Données invalides", { nom: "Nom requis" }));
    const { result } = renderHook(() => useEcriture({ appel, invalide: [] }), { wrapper: enveloppe });
    let retour: unknown = "pas encore";
    await act(async () => {
      retour = await result.current.envoyer({});
    });
    expect(retour).toBeUndefined();
    await waitFor(() => expect(result.current.erreur).toBe("Données invalides"));
    expect(result.current.champs).toEqual({ nom: "Nom requis" });
  });

  it("hors ligne, n'appelle pas l'API et se déclare désactivée", async () => {
    const { enveloppe } = environnement();
    horsLigne(true);
    const appel = vi.fn();
    const { result } = renderHook(() => useEcriture({ appel, invalide: [] }), { wrapper: enveloppe });
    expect(result.current.desactivee).toBe(true);
    await act(async () => {
      await result.current.envoyer({});
    });
    expect(appel).not.toHaveBeenCalled();
    expect(result.current.erreur).toBe("Hors ligne : les modifications reprendront avec la connexion.");
    horsLigne(false);
    await waitFor(() => expect(result.current.desactivee).toBe(false));
  });
});
