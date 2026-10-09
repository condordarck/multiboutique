import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { SESSION_COOKIE, verifyToken, type SessionUser } from "@/lib/session";
import type { RoleUtilisateur } from "@/types";

interface UtilisateurRow {
  id: string;
  email: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id: string | null;
  groupe_id: string | null;
  actif: boolean;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const decoded = await verifyToken(token);
  if (!decoded) return null;

  // Vérifier que l'utilisateur existe toujours et est actif
  const rows = await query<UtilisateurRow>(
    `SELECT id, email, nom_complet, role, boutique_ids, region_id, groupe_id, actif
     FROM utilisateurs WHERE id = $1 AND actif = true`,
    [decoded.id]
  );

  if (rows.length === 0) return null;

  const row = rows[0];

  // Périmètre effectif : un directeur groupe/région voit toutes les
  // boutiques de son périmètre (indépendamment du tableau boutique_ids)
  let boutiqueIds = row.boutique_ids || [];
  if (row.role === "directeur_groupe" && row.groupe_id) {
    const scope = await query<{ id: string }>(
      `SELECT b.id FROM boutiques b
       JOIN regions r ON r.id = b.region_id
       WHERE r.groupe_id = $1 AND b.statut = 'active'`,
      [row.groupe_id]
    );
    boutiqueIds = scope.map((s) => s.id);
  } else if (row.role === "directeur_region" && row.region_id) {
    const scope = await query<{ id: string }>(
      `SELECT id FROM boutiques WHERE region_id = $1 AND statut = 'active'`,
      [row.region_id]
    );
    boutiqueIds = scope.map((s) => s.id);
  }

  return {
    id: row.id,
    email: row.email,
    nom_complet: row.nom_complet,
    role: row.role,
    boutique_ids: boutiqueIds,
    region_id: row.region_id,
    groupe_id: row.groupe_id,
    permissions: (await chargerPermissions(row.role)) as string[],
  };
}

async function chargerPermissions(role: RoleUtilisateur): Promise<string[]> {
  const rows = await query<{ permission: string }>(
    `SELECT permission FROM roles_permissions WHERE role = $1 AND active = true`,
    [role]
  );
  return rows.map((r) => r.permission);
}

export function isProprietaire(user: SessionUser | null): boolean {
  return user?.role === "proprietaire";
}

export function isAdministrateur(user: SessionUser | null): boolean {
  return user?.role === "administrateur";
}

export function canAccessBoutique(
  user: SessionUser | null,
  boutiqueId: string
): boolean {
  if (!user) return false;
  // L'administrateur gère la configuration, pas les données commerciales
  if (user.role === "administrateur") return false;
  if (user.role === "proprietaire") return true;
  return user.boutique_ids.includes(boutiqueId);
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdministrateur(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "administrateur") {
    redirect("/dashboard");
  }
  return user;
}

export async function requireProprietaire(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "proprietaire") {
    redirect("/dashboard");
  }
  return user;
}

export async function requireBoutique(boutiqueId: string): Promise<SessionUser> {
  const user = await requireAuth();
  if (!canAccessBoutique(user, boutiqueId)) {
    redirect("/dashboard");
  }
  return user;
}