import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";

const MIMES_AUTORISES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const TAILLE_MAX = 5 * 1024 * 1024; // 5 Mo

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await req.formData();
  const fichier = formData.get("file");
  if (!(fichier instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  if (!MIMES_AUTORISES.has(fichier.type)) {
    return NextResponse.json(
      { error: "Format non supporté (JPG, PNG, WebP ou GIF)" },
      { status: 400 }
    );
  }
  if (fichier.size > TAILLE_MAX) {
    return NextResponse.json({ error: "Image trop lourde (maximum 5 Mo)" }, { status: 400 });
  }

  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[fichier.type];
  const nom = `${randomUUID()}.${extension}`;

  const dossier = path.join(process.cwd(), "public", "uploads", "produits");
  await mkdir(dossier, { recursive: true });
  await writeFile(path.join(dossier, nom), Buffer.from(await fichier.arrayBuffer()));

  return NextResponse.json({ url: `/uploads/produits/${nom}` });
}