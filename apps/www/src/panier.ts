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

const cle = (boutiqueId: string) => `mb-panier-${boutiqueId}`;

export function lirePanier(boutiqueId: string): LignePanier[] {
  try {
    const brut = sessionStorage.getItem(cle(boutiqueId));
    const lignes: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(lignes) ? (lignes as LignePanier[]) : [];
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
