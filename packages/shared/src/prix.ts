// Coût de revient détaillé : un seul calcul, pour l'écran (aperçu) et l'API
// (montant enregistré dans prix_boutique.cout_revient).

export type ModeFrais = "montant" | "pourcentage";

export interface FraisSaisi {
  mode: ModeFrais;
  valeur: number;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Montant par unité d'un frais : tel quel, ou pourcentage du prix d'achat. */
export function montantFrais(prixAchat: number, frais: FraisSaisi): number {
  return arrondi(frais.mode === "pourcentage" ? (prixAchat * frais.valeur) / 100 : frais.valeur);
}

/** Prix d'achat plus la somme des frais, arrondi au centime. */
export function calculerCoutRevient(prixAchat: number, frais: FraisSaisi[]): number {
  return arrondi(frais.reduce((total, f) => total + montantFrais(prixAchat, f), prixAchat));
}
