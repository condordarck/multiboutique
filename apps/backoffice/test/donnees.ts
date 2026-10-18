// Données fictives des tests d'écran, typées comme les réponses de l'API.
import type { ClientActif, Consolidation, DetailVente, ProduitBoutique, ResumeBoutique, ResumeJour } from "@multiboutique/shared";
import { BOUTIQUE_1, BOUTIQUE_2 } from "./rendu";

export function resumeJour(surcharge: Partial<ResumeJour> = {}): ResumeJour {
  return {
    boutique_id: BOUTIQUE_1,
    boutique_nom: "Boutique 1",
    nombre_ventes: 12,
    chiffre_affaires: 1240.5,
    nombre_reservations: 3,
    montant_reservations: 80,
    alertes_stock: 2,
    reservations_en_attente: 1,
    ...surcharge,
  };
}

export const BOUTIQUE_DETAIL = {
  id: BOUTIQUE_1,
  nom: "Boutique 1",
  adresse: "Adresse boutique 1",
  statut: "active",
};

export const RESUME_BOUTIQUE: ResumeBoutique = {
  resume: resumeJour(),
  dernieres_ventes: [
    {
      id: "v1",
      reference_vente: "V-0001",
      boutique_id: BOUTIQUE_1,
      vendeur_id: "u2",
      vendeur_nom: "Koffi Vendeur",
      mode_paiement: "especes",
      montant_total: 44,
      statut: "validee",
      motif_annulation: null,
      code_promo_id: null,
      remise: 0,
      client_id: null,
      montant_paye: 50,
      created_at: "2026-10-17T09:05:00Z",
      updated_at: "2026-10-17T09:05:00Z",
    },
  ],
  reservations_en_attente: [
    {
      id: "r1",
      reference_reservation: "R-0007",
      client_nom: "Mme Ade",
      client_telephone: "+243 900 000 001",
      client_email: null,
      boutique_id: BOUTIQUE_1,
      statut: "en_attente",
      montant_total: 30,
      date_retrait_prevue: null,
      date_retrait_reelle: null,
      validee_par: null,
      motif_annulation: null,
      created_at: "2026-10-17T08:00:00Z",
      updated_at: "2026-10-17T08:00:00Z",
    },
  ],
  alertes_stock: [
    {
      id: "s1",
      produit_id: "p1",
      boutique_id: BOUTIQUE_1,
      quantite: 0,
      quantite_reservee: 0,
      seuil_alerte: 10,
      created_at: "",
      updated_at: "",
      produit_nom: "Huile de palme 5 L",
      produit_reference: "HUI-5",
      boutique_nom: "Boutique 1",
      disponible: 0,
      statut_stock: "rupture",
      prix_vente: 20.5,
    },
    {
      id: "s2",
      produit_id: "p2",
      boutique_id: BOUTIQUE_1,
      quantite: 3,
      quantite_reservee: 0,
      seuil_alerte: 12,
      created_at: "",
      updated_at: "",
      produit_nom: "Lait en poudre 400 g",
      produit_reference: "LAI-400",
      boutique_nom: "Boutique 1",
      disponible: 3,
      statut_stock: "alerte",
      prix_vente: 4.75,
    },
  ],
};

export const CONSOLIDATION: Consolidation = {
  boutiques: [
    {
      boutique_id: BOUTIQUE_1,
      boutique_nom: "Boutique 1",
      region_nom: "Kinshasa",
      groupe_nom: "Groupe Ouest",
      nombre_ventes: 12,
      chiffre_affaires: 1240.5,
      reservations_en_attente: 1,
      alertes_stock: 2,
      encours_total: 300,
      commandes_attente: 2,
    },
    {
      boutique_id: BOUTIQUE_2,
      boutique_nom: "Boutique 2",
      region_nom: null,
      groupe_nom: null,
      nombre_ventes: 0,
      chiffre_affaires: 0,
      reservations_en_attente: 0,
      alertes_stock: 0,
      encours_total: 0,
      commandes_attente: 0,
    },
  ],
  totaux: { ventes: 12, chiffre_affaires: 1240.5, encours: 300, commandes_attente: 2 },
  regions: [
    { nom: "Kinshasa", groupe: "Groupe Ouest", ca: 1240.5, ventes: 12, boutiques: ["Boutique 1"] },
    { nom: "Sans région", groupe: "—", ca: 0, ventes: 0, boutiques: ["Boutique 2"] },
  ],
  groupes: [
    { nom: "Groupe Ouest", ca: 1240.5, ventes: 12, boutiques: ["Boutique 1"] },
    { nom: "Sans groupe", ca: 0, ventes: 0, boutiques: ["Boutique 2"] },
  ],
};


export function produit(surcharge: Partial<ProduitBoutique> = {}): ProduitBoutique {
  return {
    id: "pb-riz",
    produit_id: "p-riz",
    produit_nom: "Riz 25 kg",
    produit_reference: "RIZ-25",
    produit_code: "CER-0001",
    produit_image: null,
    produit_description: null,
    produit_actif: true,
    categorie_nom: "Céréales",
    prix_vente: 22,
    cout_revient: 18,
    quantite: 18,
    quantite_reservee: 0,
    seuil_alerte: 8,
    ...surcharge,
  };
}

export const PRODUITS = [
  produit(),
  produit({ id: "pb-sucre", produit_id: "p-sucre", produit_nom: "Sucre 1 kg", produit_reference: "SUC-1", prix_vente: 1.5, quantite: 60 }),
  produit({ id: "pb-huile", produit_id: "p-huile", produit_nom: "Huile de palme 5 L", produit_reference: "HUI-5", prix_vente: 20.5, quantite: 2, quantite_reservee: 2 }),
];

export const CLIENTS_ACTIFS: ClientActif[] = [
  { id: "c1", nom: "Quincaillerie Ade", telephone: null, type_client: "grossiste", encours: 120, plafond_credit: 500, est_vip: false },
];

export const DETAIL_VENTE: DetailVente = {
  vente: { ...RESUME_BOUTIQUE.dernieres_ventes[0]!, remise: 0, montant_paye: 44, client_nom: null },
  lignes: [
    { produit_nom: "Riz 25 kg", produit_reference: "RIZ-25", produit_code: "CER-0001", quantite: 2, prix_unitaire: 22 },
  ],
};
