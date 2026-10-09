import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Jamais mise en cache : la sonde doit refléter l'état courant.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    // Aucun détail d'erreur : la route est publique.
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
