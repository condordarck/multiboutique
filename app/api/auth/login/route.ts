import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { signToken, SESSION_COOKIE } from "@/lib/session";
import { autoriserTentative, cleClient, LIMITE_LOGIN } from "@/lib/rate-limit";
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

async function resoudrePerimetre(user: UtilisateurRow): Promise<{
  boutique_ids: string[];
}> {
  if (user.role === "directeur_groupe" && user.groupe_id) {
    const scope = await pool.query<{ id: string }>(
      `SELECT b.id FROM boutiques b
       JOIN regions r ON r.id = b.region_id
       WHERE r.groupe_id = $1 AND b.statut = 'active'`,
      [user.groupe_id]
    );
    return { boutique_ids: scope.rows.map((s) => s.id) };
  }
  if (user.role === "directeur_region" && user.region_id) {
    const scope = await pool.query<{ id: string }>(
      `SELECT id FROM boutiques WHERE region_id = $1 AND statut = 'active'`,
      [user.region_id]
    );
    return { boutique_ids: scope.rows.map((s) => s.id) };
  }
  return { boutique_ids: user.boutique_ids || [] };
}

export async function POST(request: NextRequest) {
  try {
    const ip = cleClient(request);

    // Anti force brute : plafond par IP avant même de vérifier les identifiants
    const quota = autoriserTentative(
      `login:${ip}`,
      LIMITE_LOGIN.limite,
      LIMITE_LOGIN.fenetreMs
    );
    if (!quota.ok) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans quelques minutes." },
        {
          status: 429,
          headers: { "Retry-After": String(quota.retryAfterSec) },
        }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    // Vérification du mot de passe directement dans PostgreSQL (pgcrypto / bcrypt)
    const result = await pool.query<UtilisateurRow>(
      `SELECT id, email, nom_complet, role, boutique_ids, region_id, groupe_id, actif
       FROM utilisateurs
       WHERE email = $1 AND actif = true
         AND crypt($2, password_hash) = password_hash`,
      [email, password]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const perimetre = await resoudrePerimetre(user);
    const token = await signToken({
      id: user.id,
      email: user.email,
      nom_complet: user.nom_complet,
      role: user.role,
      boutique_ids: perimetre.boutique_ids,
      region_id: user.region_id,
      groupe_id: user.groupe_id,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        nom_complet: user.nom_complet,
        role: user.role,
        boutique_ids: perimetre.boutique_ids,
        region_id: user.region_id,
        groupe_id: user.groupe_id,
      },
    });

    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 jours
    });

    return res;
  } catch (err) {
    console.error("Erreur login :", err);
    return NextResponse.json(
      { error: "Erreur serveur, réessayez" },
      { status: 500 }
    );
  }
}