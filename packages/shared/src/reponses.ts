// Formes des réponses de l'API, telles que les fronts les reçoivent. Types
// seuls : l'API renvoie les lignes PostgreSQL, montants et comptages en nombres.
// Les champs listés sont ceux que les écrans lisent ; une ligne peut en porter d'autres.
import type { RoleUtilisateur } from "./types";

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
