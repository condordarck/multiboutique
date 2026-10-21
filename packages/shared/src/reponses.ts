// Formes des réponses de l'API, telles que les fronts les reçoivent. Types
// seuls : l'API renvoie les lignes PostgreSQL, montants et comptages en nombres.
// Les champs listés sont ceux que les écrans lisent ; une ligne peut en porter d'autres.
import type { Client, Commande, CommandeFournisseur, Groupe, PrixReference, Region, Reservation, ResumeJour, RoleUtilisateur, StatutReservation, StockDisponible, Vente } from "./types";

/** GET /auth/session, POST /auth/connexion → { utilisateur } */
export interface SessionUtilisateur {
  id: string;
  email: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id?: string | null;
  groupe_id?: string | null;
  permissions: string[];
}

/** Corps de toute réponse d'erreur. */
export interface ReponseErreur {
  erreur: string;
  champs?: { chemin: string; message: string }[];
}

/** GET /parametres (public) : clé → valeur, avec les valeurs par défaut. */
export type Parametres = Record<string, string> & { monnaie: string; nom_application: string };

/** GET /me/boutiques : boutiques actives du périmètre (lignes de `boutiques`). */
export interface BoutiqueResumee {
  id: string;
  nom: string;
  statut: string;
  adresse?: string | null;
  telephone?: string | null;
  email?: string | null;
  region_id?: string | null;
}


export type VenteAvecVendeur = Vente & { vendeur_nom: string };

/** Ligne de stock_disponible ; cout_revient absent sans prix:gerer. */
export type LigneStock = Omit<StockDisponible, "cout_revient"> & { cout_revient?: number | null };

/** GET /boutiques/:id/resume */
export interface ResumeBoutique {
  resume: ResumeJour | null;
  dernieres_ventes: VenteAvecVendeur[];
  reservations_en_attente: Reservation[];
  alertes_stock: LigneStock[];
}

export interface SyntheseBoutique {
  boutique_id: string;
  boutique_nom: string;
  region_nom: string | null;
  groupe_nom: string | null;
  nombre_ventes: number;
  chiffre_affaires: number;
  reservations_en_attente: number;
  alertes_stock: number;
  encours_total: number;
  commandes_attente: number;
}

export interface CumulConsolidation {
  nom: string;
  groupe?: string;
  ca: number;
  ventes: number;
  boutiques: string[];
}

/** GET /consolidation */
export interface Consolidation {
  boutiques: SyntheseBoutique[];
  totaux: { ventes: number; chiffre_affaires: number; encours: number; commandes_attente: number };
  regions: CumulConsolidation[];
  groupes: CumulConsolidation[];
}

/** GET /boutiques/:id/produits : produits à prix actif dans la boutique. */
export interface ProduitBoutique {
  id: string;
  produit_id: string;
  produit_nom: string;
  produit_reference: string;
  produit_code: string | null;
  produit_image: string | null;
  produit_description: string | null;
  produit_actif: boolean;
  categorie_id: string | null;
  categorie_nom: string | null;
  prix_vente: number;
  /** Absent sans prix:gerer. */
  cout_revient?: number | null;
  quantite: number | null;
  quantite_reservee: number | null;
  seuil_alerte: number | null;
}

/** GET /boutiques/:id/clients?actifs=1 */
export interface ClientActif {
  id: string;
  nom: string;
  telephone: string | null;
  type_client: string;
  encours: number;
  plafond_credit: number;
  est_vip: boolean;
}

/** GET /boutiques/:id/ventes/statistiques */
export interface StatistiquesVentes {
  ventes_jour: number;
  ca_jour: number;
  ventes_mois: number;
  ca_mois: number;
}

export interface LigneRecu {
  produit_nom: string;
  produit_reference: string;
  produit_code: string | null;
  quantite: number;
  prix_unitaire: number;
}

/** GET /boutiques/:id/ventes/:venteId */
export interface DetailVente {
  vente: VenteAvecVendeur & { client_nom: string | null };
  lignes: LigneRecu[];
}

/** POST /boutiques/:id/ventes */
export interface ResultatVente {
  success: true;
  reference: string;
  montantTotal: number;
  remise: number;
  reste: number;
}

/** GET /categories */
export interface CategorieResumee {
  id: string;
  nom: string;
  code: string | null;
}

/** GET /boutiques/:id/mouvements-stock */
export interface Mouvement {
  id: string;
  type: "entree" | "sortie" | "ajustement" | "transfert";
  produit_nom: string;
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  auteur_nom: string | null;
  motif: string | null;
  created_at: string;
}

/** GET /boutiques/:id/clients */
export interface DossiersClients {
  clients: Client[];
  relances: { client_id: string; jours: number }[];
  delai_relance: number;
}

/** GET /boutiques/:id/clients/:clientId/registre */
export interface LigneRegistre {
  id: string;
  type: "vente" | "versement" | "annulation";
  libelle: string;
  montant: number;
  soldeApres: number;
  auteurNom: string | null;
  createdAt: string;
}

/** GET /boutiques/:id/commandes */
export interface CommandeListee extends Commande {
  client_nom: string;
  client_type: string;
  code_promo: string | null;
  nb_lignes: number;
}

/** GET /boutiques/:id/reservations : lignes renseignées pour celles à traiter. */
export interface ReservationDetaillee extends Reservation {
  lignes: { id: string; reservation_id: string; produit_nom: string; quantite: number; prix_unitaire: number }[];
}

/** GET /boutiques/:id/commandes-fournisseurs */
export interface CommandeFournisseurListee extends CommandeFournisseur {
  fournisseur_nom: string;
  nb_lignes: number;
  lignes: { commande_id: string; ligne_id: string; produit_nom: string; quantite_commandee: number; quantite_recue: number }[];
}

/** GET /boutiques/:id/prix-conseilles */
export interface GrillePrixConseilles {
  prix: (PrixReference & { produit_nom: string; applique: boolean })[];
  produits: { produit_id: string; nom: string; prix_vente: number | null }[];
}

/** GET /boutiques/:id/rapports?periode=…&debut=…&fin=…&vendeur=…&produit=… (fin exclue). */
export interface Rapport {
  periode: "jour" | "semaine" | "mois" | "annee" | "personnalisee";
  debut: string;
  fin: string;
  /** Filtres retenus (null : tous). */
  vendeur: string | null;
  produit: string | null;
  totaux: { nb_ventes: number; ca: number; remises: number; nb_promos: number; panier_moyen: number };
  par_jour: { jour: string; nb: number; ca: number }[];
  par_mode: { mode_paiement: string; nb: number; ca: number }[];
  top_produits: { nom: string; qte: number; ca: number }[];
  reservations: { nb: number; montant: number };
  /** Choix des filtres : vendeurs ayant vendu, produits vendus dans la boutique. */
  vendeurs: { id: string; nom: string }[];
  produits: { id: string; nom: string }[];
}

/** GET /admin/statistiques */
export interface StatistiquesAdmin {
  utilisateurs: number;
  boutiques: number;
  boutiques_actives: number;
  produits: number;
}

export interface UtilisateurAdmin {
  id: string;
  email: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id: string | null;
  groupe_id: string | null;
  telephone: string | null;
  actif: boolean;
  created_at: string;
  boutique_noms: string[];
  region_nom: string | null;
  groupe_nom: string | null;
}

/** GET /admin/utilisateurs */
export interface ComptesAdmin {
  utilisateurs: UtilisateurAdmin[];
  boutiques: BoutiqueResumee[];
  groupes: Groupe[];
  regions: Region[];
}

/** GET /admin/boutiques */
export interface BoutiquesAdmin {
  boutiques: (BoutiqueResumee & { region_nom: string | null; groupe_nom: string | null })[];
  regions: Region[];
}

/** GET /admin/organisation */
export interface Organisation {
  groupes: (Groupe & { adresse?: string | null; telephone?: string | null; email?: string | null })[];
  regions: (Region & { groupe_nom: string | null; nb_boutiques: number; boutique_noms: string[] })[];
  sans_region: { nom: string }[];
}

/** GET /admin/categories */
export interface CategorieAdmin {
  id: string;
  nom: string;
  description: string | null;
  nb_produits: number;
}

/** Comptes par défaut créés avec une boutique : mot de passe en clair, montré une fois. */
export interface CompteCree {
  role: string;
  label: string;
  email: string;
  password: string;
}

/** Vitrine : colonnes publiques d'une boutique (jamais SELECT *). */
export interface BoutiquePublique {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
}

/** GET /public/boutiques/:id/catalogue */
export interface CataloguePublic {
  boutique: BoutiquePublique;
  produits: {
    id: string;
    produit_id: string;
    produit_nom: string;
    produit_reference: string;
    produit_code: string | null;
    produit_image: string | null;
    disponible: number;
    prix_vente: number;
    categorie_id: string | null;
    categorie_nom: string | null;
  }[];
  categories: { id: string; nom: string; nb_produits: number }[];
}

/** GET /public/reservations/:id : ni téléphone ni e-mail du client. */
export interface ReservationPublique {
  id: string;
  reference_reservation: string;
  client_nom: string;
  boutique_id: string;
  statut: StatutReservation;
  montant_total: number;
  date_retrait_prevue: string | null;
  created_at: string;
  boutique: BoutiquePublique | null;
  lignes: { id: string; produit_nom: string; produit_reference: string; quantite: number; prix_unitaire: number }[];
}

/** GET /me/reservations */
export interface ReservationClient {
  id: string;
  reference_reservation: string;
  boutique_nom: string;
  statut: StatutReservation;
  montant_total: number;
  nombre_articles: number;
  created_at: string;
  date_retrait_prevue: string | null;
}
