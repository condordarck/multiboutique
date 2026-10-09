import type { RoleUtilisateur } from "@/types";

// Module partagé (importable dans les pages, actions, routes ET le middleware).
// Signature HMAC-SHA256 implémentée avec WebCrypto (crypto.subtle),
// disponible à la fois côté Node (server components/actions) et Edge (middleware).

export const SESSION_COOKIE = "mb_session";

export const JWT_SECRET = (process.env.JWT_SECRET || "").trim();

// Fail-closed : sans secret de production, on refuse de traiter les sessions
// plutôt que de retomber silencieusement sur une clé connue de tous.
function verifierSecret(): string {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT_SECRET n'est pas défini. Générez-en un (ex. : openssl rand -hex 32) et définissez-le dans l'environnement. Traitement des sessions désactivé par sécurité."
    );
  }
  if (JWT_SECRET === "change-me-super-secret-please") {
    throw new Error(
      "JWT_SECRET doit être changé : la valeur par défaut 'change-me-super-secret-please' est interdite."
    );
  }
  if (JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET est trop court (minimum 32 caractères). Sessions désactivées par sécurité."
    );
  }
  return JWT_SECRET;
}

export interface SessionUser {
  id: string;
  email: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id?: string | null;
  groupe_id?: string | null;
  permissions?: string[];
}

const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 jours

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlEncodeBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return base64UrlEncodeBuffer(sig);
}

function signaturesEgal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signToken(user: SessionUser): Promise<string> {
  const secret = verifierSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    JSON.stringify({
      id: user.id,
      email: user.email,
      nom_complet: user.nom_complet,
      role: user.role,
      boutique_ids: user.boutique_ids,
      iat: now,
      exp: now + SESSION_DURATION_SECONDS,
    })
  );
  const signature = await hmacSha256(secret, `${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  const secret = verifierSecret();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  let decoded: any;
  try {
    decoded = JSON.parse(base64UrlDecode(payload));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!decoded.exp || decoded.exp < now) return null;

  const expected = await hmacSha256(secret, `${header}.${payload}`);
  if (!signaturesEgal(signature, expected)) return null;

  if (
    !decoded.id ||
    !decoded.role ||
    typeof decoded.nom_complet !== "string"
  ) {
    return null;
  }

  return {
    id: decoded.id,
    email: decoded.email || "",
    nom_complet: decoded.nom_complet,
    role: decoded.role,
    boutique_ids: Array.isArray(decoded.boutique_ids)
      ? decoded.boutique_ids
      : [],
    region_id: decoded.region_id || null,
    groupe_id: decoded.groupe_id || null,
  };
}

export async function getUserFromRequest(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  return verifyToken(token);
}