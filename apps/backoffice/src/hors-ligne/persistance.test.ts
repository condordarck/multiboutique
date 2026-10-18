import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClientSave } from "@tanstack/react-query-persist-client";
import { get } from "idb-keyval";
import { describe, expect, it } from "vitest";
import { CLE_CACHE, CLE_PROPRIETAIRE, creerPersistance, DUREE_CACHE_MS, verifierProprietaire } from "./persistance";

describe("persistance du cache", () => {
  it("écrit le cache dans IndexedDB ; purger l'efface entièrement", async () => {
    const client = new QueryClient();
    client.setQueryData(["boutiques", "b1", "stock"], [{ id: "s1" }]);
    const { persister, purger } = creerPersistance();
    await persistQueryClientSave({ queryClient: client, persister, buster: "v1" });
    expect(await get(CLE_CACHE)).toBeTruthy();
    await purger();
    expect(await get(CLE_CACHE)).toBeUndefined();
    expect(await get(CLE_PROPRIETAIRE)).toBeUndefined();
  });

  it("garde 24 h de données", () => {
    expect(DUREE_CACHE_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("un autre utilisateur que le propriétaire du cache le vide (tablette partagée)", async () => {
    const client = new QueryClient();
    const { purger } = creerPersistance();
    client.setQueryData(["boutiques", "b1", "ventes"], [{ id: "v1" }]);
    client.setQueryData(["session"], { id: "u1" });
    await verifierProprietaire(client, "u1", purger);
    expect(client.getQueryData(["boutiques", "b1", "ventes"])).toBeTruthy();

    await verifierProprietaire(client, "u2", purger);
    expect(client.getQueryData(["boutiques", "b1", "ventes"])).toBeUndefined();
    expect(client.getQueryData(["session"])).toEqual({ id: "u1" });
    expect(await get(CLE_PROPRIETAIRE)).toBe("u2");
  });
});
