import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Jamais mise en cache : la sonde doit refléter l'état courant.
export const dynamic = "force-dynamic";

// La route est publique et interroge la base : sans ce cache, une requête
// répétée épuiserait le pool (max 10) et mettrait l'application à terre.
// Trois secondes suffisent pour une sonde qui tourne toutes les 30 secondes.
const DUREE_CACHE_MS = 3000;
let dernierResultat: { ok: boolean; instant: number } | null = null;

export async function GET() {
  const maintenant = Date.now();

  if (dernierResultat && maintenant - dernierResultat.instant < DUREE_CACHE_MS) {
    return reponse(dernierResultat.ok);
  }

  let ok = false;
  try {
    await pool.query("SELECT 1");
    ok = true;
  } catch (erreur) {
    // Le détail reste hors de la réponse — publique — mais doit apparaître
    // dans les journaux : sans lui, une erreur de configuration ressemble à
    // une base en panne et envoie l'exploitant chercher au mauvais endroit.
    console.error("[health] sonde en échec :", erreur);
  }

  dernierResultat = { ok, instant: maintenant };
  return reponse(ok);
}

function reponse(ok: boolean) {
  return ok
    ? NextResponse.json({ status: "ok" }, { status: 200 })
    : NextResponse.json({ status: "degraded" }, { status: 503 });
}
