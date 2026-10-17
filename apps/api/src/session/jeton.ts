import { createHmac, timingSafeEqual } from "node:crypto";

export type Audience = "www" | "backoffice";

export const DUREE_SESSION_S = 7 * 24 * 60 * 60; // 7 jours, comme le monolithe

interface Contenu {
  sub: string;
  aud: Audience;
  iat: number;
  exp: number;
}

const ENTETE = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

function signature(secret: string, donnees: string): Buffer {
  return createHmac("sha256", secret).update(donnees).digest();
}

/**
 * Jeton HS256 au format JWT. Il ne porte que l'identifiant et l'audience : le
 * reste (rôle, périmètre, permissions) est relu en base à chaque requête, pour
 * qu'une désactivation ou un retrait de droit prenne effet immédiatement.
 */
export function signerJeton(
  secret: string,
  { id, audience }: { id: string; audience: Audience },
  maintenant = Date.now()
): string {
  const iat = Math.floor(maintenant / 1000);
  const contenu: Contenu = { sub: id, aud: audience, iat, exp: iat + DUREE_SESSION_S };
  const corps = `${ENTETE}.${Buffer.from(JSON.stringify(contenu)).toString("base64url")}`;
  return `${corps}.${signature(secret, corps).toString("base64url")}`;
}

/** L'identifiant si le jeton est intact, non expiré et destiné à cette audience. */
export function verifierJeton(
  secret: string,
  jeton: string,
  audienceAttendue: Audience,
  maintenant = Date.now()
): { id: string } | null {
  const parties = jeton.split(".");
  if (parties.length !== 3) return null;
  const [entete, contenuB64, signatureB64] = parties as [string, string, string];

  // Signature d'abord, comparée à temps constant : rien du contenu n'est lu avant.
  const attendue = signature(secret, `${entete}.${contenuB64}`);
  const recue = Buffer.from(signatureB64, "base64url");
  if (recue.length !== attendue.length || !timingSafeEqual(recue, attendue)) return null;

  let contenu: Partial<Contenu>;
  try {
    contenu = JSON.parse(Buffer.from(contenuB64, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof contenu.sub !== "string" || !contenu.sub) return null;
  if (contenu.aud !== audienceAttendue) return null;
  if (typeof contenu.exp !== "number" || contenu.exp <= Math.floor(maintenant / 1000)) return null;
  return { id: contenu.sub };
}
