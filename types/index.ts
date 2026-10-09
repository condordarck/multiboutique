// ============================================================
// Types TypeScript — Application Multi-Boutiques
// ============================================================

export type RoleUtilisateur =
  | "administrateur"
  | "proprietaire"
  | "directeur_groupe"
  | "directeur_region"
  | "gerant"
  | "gerant_stock"
  | "comptable"
  | "vendeur"
  | "client";

export type TypeMouvementStock =
  | "entree"
  | "sortie"
  | "ajustement"
  | "transfert";

export type StatutReservation =
  | "en_attente"
  | "prete"
  | "payee"
  | "retiree"
  | "annulee";

export type StatutVente = "validee" | "annulee" | "corrigee";

export type ModePaiement =
  | "especes"
  | "mobile_money"
  | "carte"
  | "autre";

export interface Boutique {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  region_id: string | null;
  statut: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface Groupe {
  id: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Region {
  id: string;
  nom: string;
  groupe_id: string;
  created_at: string;
  updated_at: string;
}

export interface Utilisateur {
  id: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id: string | null;
  groupe_id: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Categorie {
  id: string;
  nom: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface Produit {
  id: string;
  reference: string;
  nom: string;
  description: string | null;
  categorie_id: string | null;
  image_url: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface PrixBoutique {
  id: string;
  produit_id: string;
  boutique_id: string;
  prix_vente: number;
  cout_revient: number | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stock {
  id: string;
  produit_id: string;
  boutique_id: string;
  quantite: number;
  quantite_reservee: number;
  seuil_alerte: number;
  created_at: string;
  updated_at: string;
}

export interface StockDisponible extends Stock {
  produit_nom: string;
  produit_reference: string;
  boutique_nom: string;
  disponible: number;
  statut_stock: "ok" | "alerte" | "rupture";
  prix_vente: number;
  cout_revient: number | null;
}

export interface MouvementStock {
  id: string;
  produit_id: string;
  boutique_id: string;
  type: TypeMouvementStock;
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  motif: string | null;
  boutique_destination_id: string | null;
  auteur_id: string;
  created_at: string;
}

export interface Vente {
  id: string;
  reference_vente: string;
  boutique_id: string;
  vendeur_id: string;
  mode_paiement: ModePaiement;
  montant_total: number;
  statut: StatutVente;
  motif_annulation: string | null;
  code_promo_id: string | null;
  remise: number;
  client_id: string | null;
  montant_paye: number;
  created_at: string;
  updated_at: string;
}

export interface LigneVente {
  id: string;
  vente_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  cout_unitaire: number | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  reference_reservation: string;
  client_nom: string;
  client_telephone: string;
  client_email: string | null;
  boutique_id: string;
  statut: StatutReservation;
  montant_total: number;
  date_retrait_prevue: string | null;
  date_retrait_reelle: string | null;
  validee_par: string | null;
  motif_annulation: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneReservation {
  id: string;
  reservation_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  created_at: string;
}

export interface JournalAudit {
  id: string;
  auteur_id: string;
  boutique_id: string | null;
  action: string;
  entite: string;
  entite_id: string | null;
  valeur_avant: Record<string, unknown> | null;
  valeur_apres: Record<string, unknown> | null;
  created_at: string;
}

export interface ResumeJour {
  boutique_id: string;
  boutique_nom: string;
  nombre_ventes: number;
  chiffre_affaires: number;
  nombre_reservations: number;
  montant_reservations: number;
  alertes_stock: number;
  reservations_en_attente: number;
}

export interface Parametre {
  cle: string;
  valeur: string;
  description: string | null;
  updated_at: string;
}

export interface UtilisateurComplet extends Utilisateur {
  email: string;
  telephone: string | null;
  boutique_noms: string[];
}

// Types pour les formulaires
export interface VenteFormData {
  boutique_id: string;
  mode_paiement: ModePaiement;
  code_promo?: string;
  client_id?: string;
  montant_paye?: number;
  lignes: {
    produit_id: string;
    quantite: number;
    prix_unitaire: number;
  }[];
}

export interface ReservationFormData {
  client_nom: string;
  client_telephone: string;
  client_email?: string;
  boutique_id: string;
  date_retrait_prevue?: string;
  lignes: {
    produit_id: string;
    quantite: number;
  }[];
}

export interface ProduitFormData {
  reference: string;
  nom: string;
  description?: string;
  categorie_id?: string;
  image_url?: string;
  code?: string;
}

export interface NouvelUtilisateurData {
  nom_complet: string;
  email: string;
  password: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id?: string | null;
  groupe_id?: string | null;
  telephone?: string;
}

export interface BoutiqueFormData {
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  region_id?: string | null;
  statut: "active" | "inactive";
}

export type TypeReduction = "pourcentage" | "montant";

export interface CodePromo {
  id: string;
  code: string;
  description: string | null;
  type_reduction: TypeReduction;
  valeur_reduction: number;
  boutique_id: string;
  max_utilisations: number | null;
  nombre_utilisations: number;
  date_debut: string | null;
  date_fin: string | null;
  actif: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodePromoFormData {
  code: string;
  description?: string;
  type_reduction: TypeReduction;
  valeur_reduction: number;
  max_utilisations?: number | null;
  date_debut?: string | null;
  date_fin?: string | null;
}

// ============================================================
// CLIENTS GROSSISTES, COMMANDES B2B, ACHATS, PRIX CONSEILLÉS
// ============================================================

export type TypeClient = "grossiste" | "detaillant";
export type StatutCommande = "en_attente" | "confirmee" | "livree" | "annulee";
export type TermePaiement = "comptant" | "credit";
export type StatutCmdFournisseur =
  | "en_attente"
  | "partielle"
  | "recue"
  | "annulee";

export interface Client {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  boutique_id: string;
  type_client: TypeClient;
  plafond_credit: number;
  encours: number;
  est_vip: boolean;
  derniere_activite?: string | null;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Commande {
  id: string;
  reference_commande: string;
  boutique_id: string;
  client_id: string;
  statut: StatutCommande;
  montant_brut: number;
  remise: number;
  montant_total: number;
  code_promo_id: string | null;
  terme_paiement: TermePaiement;
  note: string | null;
  validee_par: string | null;
  date_livraison: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneCommande {
  id: string;
  commande_id: string;
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
  created_at: string;
}

export interface Fournisseur {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  boutique_id: string;
  actif: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommandeFournisseur {
  id: string;
  reference_cmd: string;
  boutique_id: string;
  fournisseur_id: string;
  statut: StatutCmdFournisseur;
  total_attendu: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LigneCmdFournisseur {
  id: string;
  commande_id: string;
  produit_id: string;
  quantite_commandee: number;
  quantite_recue: number;
  prix_unitaire: number;
  created_at: string;
}

export interface PrixReference {
  produit_id: string;
  prix_vente: number;
  cout_revient: number | null;
  actif: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  type_client: TypeClient;
  plafond_credit?: number;
  est_vip?: boolean;
}

export interface CommandeFormData {
  client_id: string;
  terme_paiement: TermePaiement;
  code_promo?: string;
  note?: string;
  lignes: {
    produit_id: string;
    quantite: number;
    prix_unitaire: number;
  }[];
}

export interface FournisseurFormData {
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
}

export interface CommandeFournisseurFormData {
  fournisseur_id: string;
  note?: string;
  lignes: {
    produit_id: string;
    quantite: number;
    prix_unitaire: number;
  }[];
}

export interface GroupeFormData {
  nom: string;
  adresse?: string;
  telephone?: string;
  email?: string;
}

export interface RegionFormData {
  nom: string;
  groupe_id: string;
}
