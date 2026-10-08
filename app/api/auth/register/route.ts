import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { autoriserTentative, cleClient, LIMITE_REGISTER } from "@/lib/rate-limit";
import type { RoleUtilisateur } from "@/types";

export async function POST(request: NextRequest) {
  try {
    // Anti-création de comptes en masse
    const quota = autoriserTentative(
      `register:${cleClient(request)}`,
      LIMITE_REGISTER.limite,
      LIMITE_REGISTER.fenetreMs
    );
    if (!quota.ok) {
      return NextResponse.json(
        { error: "Trop d'inscriptions depuis cette adresse. Réessayez plus tard." },
        { status: 429 }
      );
    }

    const { nom_complet, email, password, telephone } = await request.json();

    if (!nom_complet || !email || !password) {
      return NextResponse.json(
        { error: "Nom, email et mot de passe requis" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }
    if (password.length > 72) {
      return NextResponse.json(
        { error: "Le mot de passe ne doit pas dépasser 72 caractères" },
        { status: 400 }
      );
    }

    // Role fixe : les inscriptions publiques créent uniquement des comptes client
    const role: RoleUtilisateur = "client";

    // Hachage bcrypt via pgcrypto directement en base (coût 10)
    const result = await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, telephone, actif)
       VALUES ($1, crypt($2, gen_salt('bf', 10)), $3, $4, '{}', $5, true)
       RETURNING id`,
      [email.toLowerCase(), password, nom_complet, role, telephone || null]
    );

    return NextResponse.json(
      { success: true, id: result.rows[0].id },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé" },
        { status: 409 }
      );
    }
    console.error("Erreur inscription :", err);
    return NextResponse.json(
      { error: "Erreur serveur, réessayez" },
      { status: 500 }
    );
  }
}