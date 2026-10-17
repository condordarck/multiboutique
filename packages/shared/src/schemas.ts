import { z } from "zod";

// Schémas des corps de requête de l'API, alignés sur les types *FormData. Les
// règles métier (stock, plafond, promo…) restent dans packages/metier : ces
// schémas ne garantissent que la forme.

// z.guid() et non z.uuid() : les identifiants du seed (1111…) ne respectent pas
// les bits de version RFC 9562 que z.uuid() exige.
export const identifiant = z.guid();

export const modePaiement = z.enum(["especes", "mobile_money", "carte", "autre"]);

const quantite = z.number().int().positive();
const montant = z.number().nonnegative();

export const schemaVente = z.object({
  mode_paiement: modePaiement,
  code_promo: z.string().optional(),
  client_id: identifiant.optional(),
  montant_paye: montant.optional(),
  lignes: z
    .array(z.object({ produit_id: identifiant, quantite, prix_unitaire: montant }))
    .min(1, "La vente doit contenir au moins un article"),
});

export const schemaReservation = z.object({
  client_nom: z.string().trim().min(1, "Nom requis"),
  client_telephone: z.string().trim().min(1, "Téléphone requis"),
  client_email: z.string().optional(),
  boutique_id: identifiant,
  date_retrait_prevue: z.string().optional(),
  lignes: z
    .array(z.object({ produit_id: identifiant, quantite }))
    .min(1, "La réservation doit contenir au moins un article"),
});

export const schemaMotif = z.object({ motif: z.string() });

export const schemaEncaissement = z.object({ mode_paiement: modePaiement });
