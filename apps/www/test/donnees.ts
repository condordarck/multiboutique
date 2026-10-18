import type { CataloguePublic } from "@multiboutique/shared";
import { BOUTIQUE_1 } from "./rendu";

function produit(nom: string, ref: string, prix: number, disponible: number, categorie: [string, string] | null, id = `p-${ref.toLowerCase()}`) {
  return {
    id: `s-${id}`,
    produit_id: id,
    produit_nom: nom,
    produit_reference: ref,
    produit_code: null,
    produit_image: null,
    disponible,
    prix_vente: prix,
    categorie_id: categorie?.[0] ?? null,
    categorie_nom: categorie?.[1] ?? null,
  };
}

const EPICERIE: [string, string] = ["cat-epi", "Épicerie"];
const HUILES: [string, string] = ["cat-hui", "Huiles"];

export const CATALOGUE: CataloguePublic = {
  boutique: { id: BOUTIQUE_1, nom: "Boutique 1", adresse: "Avenue du Commerce 12", telephone: null, email: null },
  produits: [
    produit("Riz 25 kg", "RIZ-25", 22, 40, EPICERIE),
    produit("Sucre 1 kg", "SUC-1", 1.5, 3, EPICERIE),
    produit("Huile d'arachide 1 L", "HUI-1", 3.2, 12, HUILES),
  ],
  categories: [
    { id: "cat-boi", nom: "Boissons", nb_produits: 0 },
    { id: "cat-epi", nom: "Épicerie", nb_produits: 2 },
    { id: "cat-hui", nom: "Huiles", nb_produits: 1 },
  ],
};
