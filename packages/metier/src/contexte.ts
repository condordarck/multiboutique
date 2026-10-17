import type { RoleUtilisateur } from "@multiboutique/shared";
import type { Pool } from "pg";

/** Accès base dont les services ont besoin : un pool, ou ce qui s'en comporte comme un. */
export type Db = Pick<Pool, "query" | "connect">;

/**
 * L'utilisateur au nom duquel un service agit, déjà chargé et vérifié par l'appelant
 * (session du monolithe, cookie de l'API). Les permissions sont celles de
 * roles_permissions ; vides, c'est la matrice par défaut du rôle qui s'applique.
 */
export interface Utilisateur {
  id: string;
  email: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id?: string | null;
  groupe_id?: string | null;
  permissions: string[];
}
