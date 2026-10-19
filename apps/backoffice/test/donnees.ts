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
    categorie_id: "cat-1",
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

export function ligneStock(surcharge: Partial<import("@multiboutique/shared").LigneStock> = {}): import("@multiboutique/shared").LigneStock {
  return {
    ...RESUME_BOUTIQUE.alertes_stock[0]!,
    id: "s-riz",
    produit_id: "p-riz",
    produit_nom: "Riz 25 kg",
    produit_reference: "RIZ-25",
    quantite: 18,
    quantite_reservee: 2,
    disponible: 16,
    seuil_alerte: 8,
    statut_stock: "ok",
    prix_vente: 22,
    ...surcharge,
  };
}

export const STOCK = [
  ligneStock(),
  ligneStock({ id: "s-huile", produit_id: "p-huile", produit_nom: "Huile de palme 5 L", produit_reference: "HUI-5", quantite: 0, quantite_reservee: 0, disponible: 0, statut_stock: "rupture" }),
  ligneStock({ id: "s-lait", produit_id: "p-lait", produit_nom: "Lait en poudre 400 g", produit_reference: "LAI-400", quantite: 3, quantite_reservee: 0, disponible: 3, seuil_alerte: 12, statut_stock: "alerte" }),
];

export const MOUVEMENTS: import("@multiboutique/shared").Mouvement[] = [
  { id: "m1", type: "entree", produit_nom: "Riz 25 kg", quantite: 20, quantite_avant: 0, quantite_apres: 20, auteur_nom: "Awa Gérante", motif: "Stock initial", created_at: "2026-10-17T07:00:00Z" },
  { id: "m2", type: "sortie", produit_nom: "Riz 25 kg", quantite: 2, quantite_avant: 20, quantite_apres: 18, auteur_nom: null, motif: null, created_at: "2026-10-17T09:00:00Z" },
];

export function client(surcharge: Partial<import("@multiboutique/shared").Client> = {}): import("@multiboutique/shared").Client {
  return {
    id: "c1",
    nom: "Quincaillerie Ade",
    telephone: "+243 900 000 002",
    email: null,
    adresse: null,
    boutique_id: BOUTIQUE_1,
    type_client: "grossiste",
    plafond_credit: 500,
    encours: 460,
    est_vip: true,
    actif: true,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...surcharge,
  };
}

export const DOSSIERS = {
  clients: [client(), client({ id: "c2", nom: "Mme Bola", type_client: "detaillant" as const, plafond_credit: 0, encours: 0, est_vip: false, actif: false })],
  relances: [{ client_id: "c1", jours: 45 }],
  delai_relance: 30,
};

export function codePromo(surcharge: Partial<import("@multiboutique/shared").CodePromo> = {}): import("@multiboutique/shared").CodePromo {
  return {
    id: "cp1",
    code: "GROSSISTE10",
    description: "Remise grossiste",
    type_reduction: "pourcentage",
    valeur_reduction: 10,
    boutique_id: BOUTIQUE_1,
    max_utilisations: 100,
    nombre_utilisations: 4,
    date_debut: "2026-10-01",
    date_fin: null,
    actif: true,
    created_by: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...surcharge,
  };
}

export function commande(surcharge: Partial<import("@multiboutique/shared").CommandeListee> = {}): import("@multiboutique/shared").CommandeListee {
  return {
    id: "cmd1",
    reference_commande: "CMD-0001",
    boutique_id: BOUTIQUE_1,
    client_id: "c1",
    statut: "en_attente",
    montant_brut: 440,
    remise: 44,
    montant_total: 396,
    code_promo_id: "cp1",
    terme_paiement: "credit",
    note: null,
    validee_par: null,
    client_nom: "Quincaillerie Ade",
    client_type: "grossiste",
    code_promo: "GROSSISTE10",
    nb_lignes: 2,
    date_livraison: null,
    created_at: "2026-10-17T08:00:00Z",
    updated_at: "2026-10-17T08:00:00Z",
    ...surcharge,
  };
}

export function reservation(
  surcharge: Partial<import("@multiboutique/shared").ReservationDetaillee> = {}
): import("@multiboutique/shared").ReservationDetaillee {
  return {
    ...RESUME_BOUTIQUE.reservations_en_attente[0]!,
    lignes: [{ id: "lr1", reservation_id: "r1", produit_nom: "Riz 25 kg", quantite: 1, prix_unitaire: 22 }, { id: "lr2", reservation_id: "r1", produit_nom: "Sucre 1 kg", quantite: 4, prix_unitaire: 2 }],
    ...surcharge,
  };
}

export const FOURNISSEURS: import("@multiboutique/shared").Fournisseur[] = [
  { id: "f1", nom: "Minoterie du Fleuve", telephone: "+243 811 000 000", email: null, adresse: "Matadi", boutique_id: BOUTIQUE_1, actif: true, created_at: "", updated_at: "" },
  { id: "f2", nom: "Ancien grossiste", telephone: null, email: null, adresse: null, boutique_id: BOUTIQUE_1, actif: false, created_at: "", updated_at: "" },
];

export function commandeFournisseur(
  surcharge: Partial<import("@multiboutique/shared").CommandeFournisseurListee> = {}
): import("@multiboutique/shared").CommandeFournisseurListee {
  return {
    id: "cf1",
    reference_cmd: "CF-0001",
    boutique_id: BOUTIQUE_1,
    fournisseur_id: "f1",
    fournisseur_nom: "Minoterie du Fleuve",
    statut: "partielle",
    total_attendu: 720,
    note: null,
    nb_lignes: 1,
    lignes: [{ commande_id: "cf1", ligne_id: "l1", produit_nom: "Riz 25 kg", quantite_commandee: 40, quantite_recue: 10 }],
    created_at: "2026-10-10T00:00:00Z",
    updated_at: "2026-10-10T00:00:00Z",
    ...surcharge,
  };
}
