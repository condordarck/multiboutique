import type { ReponseErreur } from "@multiboutique/shared";

/** Origine de l'API, injectée au build (une valeur par environnement). */
export const URL_API = import.meta.env.VITE_API_URL as string;

/** Émis sur window quand l'API ne reconnaît plus la session. */
export const EVENEMENT_SESSION_EXPIREE = "mb:session-expiree";

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
    /** Message par champ (chemin zod : « nom », « lignes.0.quantite »). */
    readonly champs: Record<string, string> = {}
  ) {
    super(message);
    this.name = "ErreurApi";
  }
}

export type Methode = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function envoyer(chemin: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(URL_API + chemin, { ...init, credentials: "include" });
  } catch {
    throw new ErreurApi(0, "Connexion impossible. Vérifiez le réseau.");
  }
}

async function lire<T>(chemin: string, reponse: Response): Promise<T> {
  const texte = await reponse.text();
  const corps: unknown = texte ? JSON.parse(texte) : undefined;
  if (reponse.ok) return corps as T;

  const erreur = (corps ?? {}) as Partial<ReponseErreur>;
  const champs: Record<string, string> = {};
  for (const champ of erreur.champs ?? []) champs[champ.chemin] ??= champ.message;
  // Un 401 de /auth/* veut dire « pas connecté » ou « identifiants refusés » :
  // c'est l'écran de connexion qui le traite, pas une expiration.
  if (reponse.status === 401 && !chemin.startsWith("/auth/")) {
    window.dispatchEvent(new Event(EVENEMENT_SESSION_EXPIREE));
  }
  throw new ErreurApi(reponse.status, erreur.erreur ?? `Erreur ${reponse.status}`, champs);
}

/**
 * Seul point d'accès à l'API. Une écriture porte toujours un corps JSON, même
 * vide : l'API refuse toute écriture qui n'est pas en application/json (CSRF).
 */
export async function appeler<T>(methode: Methode, chemin: string, corps?: unknown): Promise<T> {
  const ecriture = methode !== "GET";
  const reponse = await envoyer(chemin, {
    method: methode,
    headers: ecriture ? { "content-type": "application/json" } : undefined,
    body: ecriture ? JSON.stringify(corps ?? {}) : undefined,
  });
  return lire<T>(chemin, reponse);
}

/** Envoie une image ; le navigateur fixe lui-même le type multipart et sa frontière. */
export async function televerser(fichier: File): Promise<{ url: string }> {
  const donnees = new FormData();
  donnees.append("fichier", fichier);
  const reponse = await envoyer("/uploads", { method: "POST", body: donnees });
  return lire("/uploads", reponse);
}

/** Les images enregistrées sont des chemins de l'API (« /uploads/produits/… »). */
export function urlImage(chemin: string | null | undefined): string | undefined {
  if (!chemin) return undefined;
  return /^https?:\/\//.test(chemin) ? chemin : URL_API + chemin;
}
