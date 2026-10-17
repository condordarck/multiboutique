// Données fictives des maquettes : plausibles, mais sans rapport avec une
// boutique réelle. Montants en dollars, comme le paramètre par défaut.

export interface Produit {
  id: string;
  nom: string;
  categorie: string;
  prix: number;
  stock: number;
  seuil: number;
}

export const BOUTIQUES = ["Boutique 1", "Boutique 2", "Boutique 3"] as const;

export const CATEGORIES = ["Céréales et farines", "Huiles", "Épicerie", "Boissons", "Hygiène"] as const;

export const PRODUITS: Produit[] = [
  { id: "riz-25", nom: "Riz 25 kg", categorie: "Céréales et farines", prix: 22, stock: 18, seuil: 8 },
  { id: "farine-mais-25", nom: "Farine de maïs 25 kg", categorie: "Céréales et farines", prix: 27, stock: 6, seuil: 5 },
  { id: "farine-ble-1", nom: "Farine de blé 1 kg", categorie: "Céréales et farines", prix: 1.6, stock: 40, seuil: 15 },
  { id: "huile-palme-5", nom: "Huile de palme 5 L", categorie: "Huiles", prix: 20.5, stock: 0, seuil: 10 },
  { id: "huile-arachide-1", nom: "Huile d'arachide 1 L", categorie: "Huiles", prix: 3.2, stock: 25, seuil: 10 },
  { id: "sucre-1", nom: "Sucre 1 kg", categorie: "Épicerie", prix: 1.5, stock: 60, seuil: 20 },
  { id: "lait-poudre-400", nom: "Lait en poudre 400 g", categorie: "Épicerie", prix: 4.75, stock: 3, seuil: 12 },
  { id: "sardines", nom: "Sardines, boîte", categorie: "Épicerie", prix: 1.25, stock: 8, seuil: 24 },
  { id: "sel-1", nom: "Sel 1 kg", categorie: "Épicerie", prix: 0.8, stock: 45, seuil: 10 },
  { id: "eau-pack", nom: "Eau 1,5 L, pack de 6", categorie: "Boissons", prix: 3.5, stock: 30, seuil: 12 },
  { id: "jus-mangue", nom: "Jus de mangue 1 L", categorie: "Boissons", prix: 2.2, stock: 14, seuil: 6 },
  { id: "savon", nom: "Savon de ménage", categorie: "Hygiène", prix: 1.5, stock: 9, seuil: 20 },
];

export type EtatStock = "ok" | "bas" | "rupture";

export function etatStock(produit: Produit): EtatStock {
  if (produit.stock === 0) return "rupture";
  return produit.stock <= produit.seuil ? "bas" : "ok";
}

const MONTANT = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 64,50 $ », avec une espace insécable avant le symbole. */
export function formatMontant(valeur: number): string {
  return `${MONTANT.format(valeur)}\u00a0$`;
}
