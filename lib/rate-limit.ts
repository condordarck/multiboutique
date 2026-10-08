// Rate limiting en mémoire (fenêtre glissante) pour les endpoints sensibles
// (authentification). Suffisant pour une instance locale/un seul conteneur.
// À remplacer par un store partagé (Redis) en cas d'horizontale scaling.

interface Fenetre {
  compteur: number;
  debut: number; // timestamp ms du début de la fenêtre
}

const REGISTRE = new Map<string, Fenetre>();

function nettoyerAnciennes(now: number) {
  for (const [cle, f] of REGISTRE) {
    if (now - f.debut > 15 * 60 * 1000) REGISTRE.delete(cle);
  }
}

export function autoriserTentative(
  cle: string,
  limite: number,
  fenetreMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  nettoyerAnciennes(now);

  const courante = REGISTRE.get(cle);
  if (!courante) {
    REGISTRE.set(cle, { compteur: 1, debut: now });
    return { ok: true, retryAfterSec: 0 };
  }

  if (now - courante.debut > fenetreMs) {
    REGISTRE.set(cle, { compteur: 1, debut: now });
    return { ok: true, retryAfterSec: 0 };
  }

  if (courante.compteur >= limite) {
    const retryAfterSec = Math.ceil(
      (courante.debut + fenetreMs - now) / 1000
    );
    return { ok: false, retryAfterSec };
  }

  courante.compteur += 1;
  return { ok: true, retryAfterSec: 0 };
}

// Clé d'identification du client : IP via proxies, sinon socket distante.
export function cleClient(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "inconnu";
  return ip;
}

export const LIMITE_LOGIN = { limite: 5, fenetreMs: 15 * 60 * 1000 };
export const LIMITE_REGISTER = { limite: 3, fenetreMs: 60 * 60 * 1000 };