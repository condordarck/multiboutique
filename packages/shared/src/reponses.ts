// Formes des réponses de l'API, telles que les fronts les reçoivent. Types
// seuls : l'API renvoie les lignes PostgreSQL, montants et comptages en nombres.
// Les champs listés sont ceux que les écrans lisent ; une ligne peut en porter d'autres.
import type { Reservation, ResumeJour, RoleUtilisateur, StockDisponible, Vente } from "./types";

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
