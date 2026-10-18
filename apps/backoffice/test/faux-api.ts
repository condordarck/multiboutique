import { vi } from "vitest";

interface Reponse {
  statut: number;
  corps: unknown;
}

export interface Appel {
  methode: string;
  chemin: string;
  corps: unknown;
  credentials: RequestCredentials | undefined;
  contentType: string | null;
}

const BASE = "https://api.test";

/**
 * Remplace fetch par un serveur en mémoire. Les réponses se déclarent par
 * méthode et chemin (chaîne de requête comprise) ; un appel imprévu répond 404
 * et reste visible dans appels().
 */
export function fauxApi() {
  const reponses = new Map<string, Reponse | ((corps: unknown) => Reponse)>();
  const journal: Appel[] = [];

  const faux = vi.fn(async (entree: RequestInfo | URL, options: RequestInit = {}) => {
    const url = new URL(String(entree));
    const chemin = url.href.slice(BASE.length);
    const methode = (options.method ?? "GET").toUpperCase();
    const brut = options.body;
    const corps = typeof brut === "string" ? JSON.parse(brut) : brut instanceof FormData ? brut : undefined;
    const entetes = new Headers(options.headers);
    journal.push({ methode, chemin, corps, credentials: options.credentials, contentType: entetes.get("content-type") });

    const prevue = reponses.get(`${methode} ${chemin}`);
    const reponse = typeof prevue === "function" ? prevue(corps) : (prevue ?? { statut: 404, corps: { erreur: "Introuvable" } });
    return new Response(reponse.statut === 204 ? null : JSON.stringify(reponse.corps), {
      status: reponse.statut,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", faux);

  return {
    repondre(methode: string, chemin: string, statut: number, corps: unknown = {}) {
      reponses.set(`${methode} ${chemin}`, { statut, corps });
    },
    /** Réponse calculée à partir du corps reçu. */
    repondreAvec(methode: string, chemin: string, calcul: (corps: unknown) => Reponse) {
      reponses.set(`${methode} ${chemin}`, calcul);
    },
    appels: () => journal,
    ecritures: () => journal.filter((a) => a.methode !== "GET"),
    restaurer: () => vi.unstubAllGlobals(),
  };
}

export type FauxApi = ReturnType<typeof fauxApi>;
