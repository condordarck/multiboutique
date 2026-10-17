import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import multipart from "@fastify/multipart";
import { ErreurMetier } from "@multiboutique/metier";
import type { FastifyPluginAsync } from "fastify";
import { route } from "./registre";

// Reprise de app/api/upload et app/uploads/[...path] : images de produits sur le
// volume du VPS, mêmes formats et même taille maximale.

const TAILLE_MAX = 5 * 1024 * 1024; // 5 Mo

// Le type est lu dans les premiers octets : le type déclaré par le navigateur
// n'engage que lui.
const SIGNATURES: { extension: string; mime: string; correspond: (o: Buffer) => boolean }[] = [
  { extension: "jpg", mime: "image/jpeg", correspond: (o) => o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff },
  {
    extension: "png",
    mime: "image/png",
    correspond: (o) => o.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  { extension: "gif", mime: "image/gif", correspond: (o) => ["GIF87a", "GIF89a"].includes(o.subarray(0, 6).toString("latin1")) },
  {
    extension: "webp",
    mime: "image/webp",
    correspond: (o) => o.subarray(0, 4).toString("latin1") === "RIFF" && o.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

const NOM_FICHIER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/;

export const routesUploads: FastifyPluginAsync<{ uploadsDir: string }> = async (app, { uploadsDir }) => {
  const dossier = join(uploadsDir, "produits");
  await app.register(multipart, { limits: { fileSize: TAILLE_MAX, files: 1 } });

  route(app, {
    methode: "POST",
    chemin: "/uploads",
    garde: "connexion",
    config: { televersement: true },
    gerer: async (requete) => {
      if (requete.audience !== "backoffice") {
        throw new ErreurMetier("L'envoi d'images se fait depuis le backoffice", 403);
      }
      const fichier = await requete.file();
      if (!fichier) throw new ErreurMetier("Fichier manquant");
      // toBuffer lève une erreur 413 au-delà de la taille maximale.
      const octets = await fichier.toBuffer();
      const format = SIGNATURES.find((s) => s.correspond(octets));
      if (!format) throw new ErreurMetier("Format non supporté (JPG, PNG, WebP ou GIF)");

      const nom = `${randomUUID()}.${format.extension}`;
      await mkdir(dossier, { recursive: true });
      await writeFile(join(dossier, nom), octets);
      return { url: `/uploads/produits/${nom}` };
    },
  });

  // Sans authentification : les images s'affichent dans la vitrine. Le nom est un
  // UUID, contrôlé strictement : aucun autre chemin n'est lisible.
  app.get<{ Params: { fichier: string } }>("/uploads/produits/:fichier", async (requete, reponse) => {
    const { fichier } = requete.params;
    if (!NOM_FICHIER.test(fichier)) return reponse.code(404).send({ erreur: "Image introuvable" });
    let octets: Buffer;
    try {
      octets = await readFile(join(dossier, fichier));
    } catch {
      return reponse.code(404).send({ erreur: "Image introuvable" });
    }
    const extension = fichier.split(".").pop()!;
    return reponse
      .header("content-type", SIGNATURES.find((s) => s.extension === extension)!.mime)
      // Nom unique par contenu : Cloudflare peut le garder indéfiniment.
      .header("cache-control", "public, max-age=31536000, immutable")
      .send(octets);
  });
};
