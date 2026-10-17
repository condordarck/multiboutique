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

// Produits, stock, prix. Les quantités et prix sont contrôlés par les services
// (messages métier) : le schéma n'exige ici que des nombres.
export const schemaProduit = z.object({
  reference: z.string().trim().min(1, "Référence requise"),
  nom: z.string().trim().min(1, "Nom requis"),
  description: z.string().optional(),
  // Chaîne libre : les formulaires envoient "" pour « sans catégorie ».
  categorie_id: z.string().optional(),
  image_url: z.string().optional(),
  code: z.string().optional(),
});

export const schemaCreationProduit = z.object({
  produit: schemaProduit,
  prix_vente: z.number(),
  cout_revient: z.number().optional(),
});

export const schemaMouvementStock = z.object({
  quantite: z.number().int(),
  motif: z.string().default(""),
});

export const schemaTransfert = z.object({
  boutique_destination_id: identifiant,
  produit_id: identifiant,
  quantite: z.number().int(),
  motif: z.string().default(""),
});

export const schemaPrix = z.object({
  prix_vente: z.number(),
  cout_revient: z.number().optional(),
});

export const schemaPrixReference = z.object({
  produit_id: identifiant,
  prix_vente: z.number(),
  cout_revient: z.number().nullable().optional(),
  actif: z.boolean().optional(),
});

export const schemaApplicationPrixConseilles = z.object({
  produit_ids: z.array(identifiant).optional(),
});

// Clients, crédit, codes promo.
export const schemaClient = z.object({
  nom: z.string(),
  telephone: z.string().optional(),
  email: z.string().optional(),
  adresse: z.string().optional(),
  type_client: z.enum(["grossiste", "detaillant"]),
  plafond_credit: z.number().optional(),
  est_vip: z.boolean().optional(),
});

export const schemaReglement = z.object({ montant: z.number() });

export const schemaCodePromo = z.object({
  code: z.string(),
  description: z.string().optional(),
  type_reduction: z.enum(["pourcentage", "montant"]),
  valeur_reduction: z.number(),
  max_utilisations: z.number().int().nullable().optional(),
  date_debut: z.string().nullable().optional(),
  date_fin: z.string().nullable().optional(),
});

// Commandes grossistes. Le service contrôle le client, les quantités et les prix.
export const schemaCommande = z.object({
  client_id: z.string(),
  terme_paiement: z.enum(["comptant", "credit"]),
  code_promo: z.string().optional(),
  note: z.string().optional(),
  lignes: z.array(z.object({ produit_id: identifiant, quantite: z.number(), prix_unitaire: z.number() })),
});
