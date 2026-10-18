// Le panier de la vitrine : par boutique, dans sessionStorage. Il survit à un
// rechargement ou à un passage par la connexion, et ne quitte jamais l'appareil
// (ni l'API ni le cache IndexedDB).

export interface LignePanier {
  produit_id: string;
  produit_nom: string;
  quantite: number;
  disponible: number;
  prix_vente: number;
}

const PREFIXE = "mb-panier-";
const cle = (boutiqueId: string) => `${PREFIXE}${boutiqueId}`;

function estLigne(l: unknown): l is LignePanier {
  const x = l as Partial<LignePanier> | null;
  return (
    !!x &&
    typeof x.produit_id === "string" &&
    typeof x.produit_nom === "string" &&
    Number.isInteger(x.quantite) &&
    (x.quantite ?? 0) > 0 &&
    typeof x.disponible === "number" &&
    typeof x.prix_vente === "number"
  );
}

/** À la déconnexion : l'onglet peut servir à quelqu'un d'autre. */
export function viderTousLesPaniers() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIXE)) sessionStorage.removeItem(k);
  } catch {
    // Stockage indisponible : rien à vider.
  }
}

export function lirePanier(boutiqueId: string): LignePanier[] {
  try {
    const brut = sessionStorage.getItem(cle(boutiqueId));
    const lignes: unknown = brut ? JSON.parse(brut) : [];
    // Seules les lignes bien formées sont gardées : le stockage peut avoir été altéré.
    return Array.isArray(lignes) ? lignes.filter(estLigne) : [];
  } catch {
    return [];
  }
}

export function ecrirePanier(boutiqueId: string, lignes: LignePanier[]) {
  try {
    if (lignes.length) sessionStorage.setItem(cle(boutiqueId), JSON.stringify(lignes));
    else sessionStorage.removeItem(cle(boutiqueId));
  } catch {
    // Stockage indisponible : le panier ne vit qu'en mémoire.
  }
}

export function viderPanier(boutiqueId: string) {
  ecrirePanier(boutiqueId, []);
}
