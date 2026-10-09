import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;
  if (!segments?.length) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (segments.some((s) => s.includes("..") || s.includes("/"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const fichier = path.join(process.cwd(), "public", "uploads", ...segments);
  const dossierRacine = path.normalize(
    path.join(process.cwd(), "public", "uploads")
  );
  if (!fichier.startsWith(dossierRacine)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const buffer = await readFile(fichier);
    const ext = path.extname(fichier).slice(1);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=2592000",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}