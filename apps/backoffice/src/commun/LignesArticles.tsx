import { Bouton, Champ, Selecteur } from "@multiboutique/ui";
import { lireEntier, lireNombre } from "@multiboutique/front";

export interface LigneSaisie {
  produit_id: string;
  quantite: string;
  prix: string;
}

/** Message pour la première ligne dont la quantité ou le prix est invalide ; null sinon. */
export function lignesInvalides(lignes: LigneSaisie[]): string | null {
  const i = lignes.findIndex((l) => Number.isNaN(lireEntier(l.quantite, 1)) || !(lireNombre(l.prix) >= 0));
  return i < 0 ? null : `Article ${i + 1} : quantité entière d'au moins 1 et prix positif ou nul requis`;
}

interface Props {
  lignes: LigneSaisie[];
  onChange: (lignes: LigneSaisie[]) => void;
  produits: { produit_id: string; nom: string }[];
  /** Prix proposé quand on choisit un produit (modifiable ensuite). */
  prixPropose: (produitId: string) => number | null | undefined;
  libellePrix: string;
}

/** Lignes d'une commande (client ou fournisseur) : produit, quantité, prix. */
export function LignesArticles({ lignes, onChange, produits, prixPropose, libellePrix }: Props) {
  const maj = (i: number, patch: Partial<LigneSaisie>) => onChange(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <legend className="mb-1 text-libelle font-semibold">Articles</legend>
      {lignes.length === 0 && <p className="m-0 text-texte-discret">Aucun article</p>}
      {lignes.map((l, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-bouton bg-surface-relevee p-3">
          <Selecteur
            libelle={`Produit de l'article ${i + 1}`}
            optionVide="— Produit —"
            options={produits.map((p) => ({ valeur: p.produit_id, libelle: p.nom }))}
            value={l.produit_id}
            onChange={(e) => {
              const prix = prixPropose(e.target.value);
              maj(i, { produit_id: e.target.value, prix: prix ? String(prix) : "" });
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Champ libelle={`Quantité de l'article ${i + 1}`} type="nombre" value={l.quantite} onChange={(e) => maj(i, { quantite: e.target.value })} />
            <Champ libelle={`${libellePrix} de l'article ${i + 1}`} type="montant" value={l.prix} onChange={(e) => maj(i, { prix: e.target.value })} />
          </div>
          <Bouton variante="discret" className="self-end" onClick={() => onChange(lignes.filter((_, j) => j !== i))}>
            Retirer l'article
          </Bouton>
        </div>
      ))}
      <Bouton variante="secondaire" className="self-start" onClick={() => onChange([...lignes, { produit_id: "", quantite: "1", prix: "" }])}>
        Ajouter un article
      </Bouton>
    </fieldset>
  );
}
