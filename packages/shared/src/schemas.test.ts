import { describe, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { ModePaiement, ReservationFormData, VenteFormData } from "./types";
import type { schemaEncaissement, schemaReservation, schemaVente } from "./schemas";

// Les schémas décrivent les types existants : un champ ajouté d'un côté seulement
// casse ces tests à la compilation.
describe("schémas alignés sur les types", () => {
  it("vente (la boutique vient de l'URL)", () => {
    expectTypeOf<z.infer<typeof schemaVente>>().toEqualTypeOf<Omit<VenteFormData, "boutique_id">>();
  });
  it("réservation", () => {
    expectTypeOf<z.infer<typeof schemaReservation>>().toEqualTypeOf<ReservationFormData>();
  });
  it("mode de paiement", () => {
    expectTypeOf<z.infer<typeof schemaEncaissement>["mode_paiement"]>().toEqualTypeOf<ModePaiement>();
  });
});
