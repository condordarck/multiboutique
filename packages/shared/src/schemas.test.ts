import { describe, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import type { BoutiqueFormData, ClientFormData, GroupeFormData, NouvelUtilisateurData, RegionFormData, RoleUtilisateur, CodePromoFormData, CommandeFormData, CommandeFournisseurFormData, FournisseurFormData, ModePaiement, ProduitFormData, ReservationFormData, VenteFormData } from "./types";
import type { role, schemaBoutique, schemaGroupe, schemaNouvelUtilisateur, schemaRegion, schemaClient, schemaCodePromo, schemaCommande, schemaCommandeFournisseur, schemaFournisseur, schemaEncaissement, schemaProduit, schemaReservation, schemaVente } from "./schemas";

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
  it("produit", () => {
    expectTypeOf<z.infer<typeof schemaProduit>>().toEqualTypeOf<ProduitFormData>();
  });
  it("client", () => {
    expectTypeOf<z.infer<typeof schemaClient>>().toEqualTypeOf<ClientFormData>();
  });
  it("code promo", () => {
    expectTypeOf<z.infer<typeof schemaCodePromo>>().toEqualTypeOf<CodePromoFormData>();
  });
  it("commande", () => {
    expectTypeOf<z.infer<typeof schemaCommande>>().toEqualTypeOf<CommandeFormData>();
  });
  it("fournisseur et commande d'achat", () => {
    expectTypeOf<z.infer<typeof schemaFournisseur>>().toEqualTypeOf<FournisseurFormData>();
    expectTypeOf<z.infer<typeof schemaCommandeFournisseur>>().toEqualTypeOf<CommandeFournisseurFormData>();
  });
  it("administration", () => {
    expectTypeOf<z.infer<typeof role>>().toEqualTypeOf<RoleUtilisateur>();
    expectTypeOf<z.infer<typeof schemaNouvelUtilisateur>>().toEqualTypeOf<NouvelUtilisateurData>();
    expectTypeOf<z.infer<typeof schemaBoutique>>().toEqualTypeOf<BoutiqueFormData>();
    expectTypeOf<z.infer<typeof schemaGroupe>>().toEqualTypeOf<GroupeFormData>();
    expectTypeOf<z.infer<typeof schemaRegion>>().toEqualTypeOf<RegionFormData>();
  });
});
