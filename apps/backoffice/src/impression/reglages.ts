import { useCallback, useSyncExternalStore } from "react";

export type ModeImpression = "navigateur" | "usb" | "bluetooth" | "serie";
export type JeuCaracteres = "cp858" | "cp850" | "cp437" | "ascii";
export type LargeurPapier = 58 | 80;

/** Imprimante associée à ce poste : de quoi la retrouver sans redemander. */
export interface ImprimanteAssociee {
  nom: string;
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
}

export interface ReglagesImpression {
  mode: ModeImpression;
  largeur: LargeurPapier;
  jeu: JeuCaracteres;
  couper: boolean;
  tiroir: boolean;
  exemplaires: number;
  /** Impression dès l'encaissement, sans clic. */
  automatique: boolean;
  /** Port série : vitesse en bauds. */
  vitesse: number;
  /** Une imprimante par mode direct : changer de mode ne perd pas les autres. */
  imprimantes: Partial<Record<Exclude<ModeImpression, "navigateur">, ImprimanteAssociee>>;
}

export const REGLAGES_DEFAUT: ReglagesImpression = {
  mode: "navigateur",
  largeur: 80,
  jeu: "cp858",
  couper: true,
  tiroir: false,
  exemplaires: 1,
  automatique: false,
  vitesse: 9600,
  imprimantes: {},
};

export const VITESSES = [9600, 19200, 38400, 57600, 115200];

const CLE = "mb-impression";
const MODES: ModeImpression[] = ["navigateur", "usb", "bluetooth", "serie"];
const JEUX: JeuCaracteres[] = ["cp858", "cp850", "cp437", "ascii"];

/** Valeurs lues du stockage : tout champ inconnu ou abîmé reprend sa valeur par défaut. */
function valider(brut: unknown): ReglagesImpression {
  const r = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const d = REGLAGES_DEFAUT;
  const booleen = (v: unknown, defaut: boolean) => (typeof v === "boolean" ? v : defaut);
  const imprimantes: ReglagesImpression["imprimantes"] = {};
  if (r.imprimantes && typeof r.imprimantes === "object") {
    for (const [mode, valeur] of Object.entries(r.imprimantes as Record<string, unknown>)) {
      if (mode !== "navigateur" && MODES.includes(mode as ModeImpression) && valeur && typeof (valeur as ImprimanteAssociee).nom === "string") {
        imprimantes[mode as keyof ReglagesImpression["imprimantes"]] = valeur as ImprimanteAssociee;
      }
    }
  }
  return {
    mode: MODES.includes(r.mode as ModeImpression) ? (r.mode as ModeImpression) : d.mode,
    largeur: r.largeur === 58 || r.largeur === 80 ? r.largeur : d.largeur,
    jeu: JEUX.includes(r.jeu as JeuCaracteres) ? (r.jeu as JeuCaracteres) : d.jeu,
    couper: booleen(r.couper, d.couper),
    tiroir: booleen(r.tiroir, d.tiroir),
    exemplaires: Number.isInteger(r.exemplaires) && (r.exemplaires as number) >= 1 && (r.exemplaires as number) <= 3 ? (r.exemplaires as number) : d.exemplaires,
    automatique: booleen(r.automatique, d.automatique),
    vitesse: VITESSES.includes(r.vitesse as number) ? (r.vitesse as number) : d.vitesse,
    imprimantes,
  };
}

let courant: ReglagesImpression | null = null;
const abonnes = new Set<() => void>();

/** Réglages de ce poste ; sans stockage (navigation privée…), les valeurs par défaut. */
export function lireReglages(): ReglagesImpression {
  if (courant) return courant;
  try {
    const texte = localStorage.getItem(CLE);
    courant = valider(texte ? JSON.parse(texte) : null);
  } catch {
    courant = valider(null);
  }
  return courant;
}

export function enregistrerReglages(reglages: ReglagesImpression): void {
  courant = valider(reglages);
  try {
    localStorage.setItem(CLE, JSON.stringify(courant));
  } catch {
    // Sans stockage, les réglages valent jusqu'au rechargement de la page.
  }
  for (const abonne of abonnes) abonne();
}

/** Pour les tests : relit le stockage au prochain accès. */
export function oublierReglages(): void {
  courant = null;
}

function abonner(rappel: () => void) {
  abonnes.add(rappel);
  return () => abonnes.delete(rappel);
}

export function useReglagesImpression() {
  const reglages = useSyncExternalStore(abonner, lireReglages, lireReglages);
  const modifier = useCallback((changement: Partial<ReglagesImpression>) => enregistrerReglages({ ...lireReglages(), ...changement }), []);
  return { reglages, modifier };
}
