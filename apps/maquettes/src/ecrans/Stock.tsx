import { Badge, Bouton, Carte, ChoixSegmente, Champ, EtatVide, ListeAdaptative } from "@multiboutique/ui";
import { clsx } from "clsx";
import { useState } from "react";
import { CoqueBackoffice } from "../CoqueBackoffice";
import { etatStock, formatMontant, PRODUITS, type EtatStock, type Produit } from "../donnees";
import { correspond } from "../recherche";

type Filtre = "tous" | "bas" | "rupture";

const BADGES: Record<EtatStock, { ton: "succes" | "alerte" | "danger"; libelle: string }> = {
  ok: { ton: "succes", libelle: "En stock" },
  bas: { ton: "alerte", libelle: "Sous le seuil" },
  rupture: { ton: "danger", libelle: "Rupture" },
};

export function Stock() {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [selection, setSelection] = useState<Produit | null>(null);

  const nb = (etat: EtatStock) => PRODUITS.filter((p) => etatStock(p) === etat).length;
  const produits = PRODUITS.filter(
    (p) => correspond(p.nom, recherche) && (filtre === "tous" || etatStock(p) === filtre)
  );

  return (
    <CoqueBackoffice actif="stock">
      <div className="flex flex-col gap-5">
        <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Stock</h1>

        <div className="flex flex-col gap-4 tablette:flex-row tablette:items-end">
          <Champ
            libelle="Rechercher un produit"
            type="recherche"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
          <ChoixSegmente<Filtre>
            legende="Afficher"
            options={[
              { valeur: "tous", libelle: `Tous (${PRODUITS.length})` },
              { valeur: "bas", libelle: `Sous le seuil (${nb("bas")})` },
              { valeur: "rupture", libelle: `Rupture (${nb("rupture")})` },
            ]}
            valeur={filtre}
            onChange={setFiltre}
          />
        </div>

        {/* La colonne de la fiche n'existe que si une fiche est ouverte : sinon
            la liste prend toute la largeur. */}
        <div
          className={clsx(
            "grid gap-5",
            selection && "min-[60rem]:grid-cols-[minmax(0,1fr)_340px] min-[60rem]:items-start"
          )}
        >
          {selection && (
            <Carte
              titre={selection.nom}
              className="min-[60rem]:order-last min-[60rem]:sticky min-[60rem]:top-4"
              action={
                <Bouton variante="discret" onClick={() => setSelection(null)}>
                  Fermer
                </Bouton>
              }
            >
              <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-mention text-texte-discret">En stock</dt>
                  <dd className="m-0 text-chiffre font-bold tabular-nums">{selection.stock}</dd>
                </div>
                <div>
                  <dt className="text-mention text-texte-discret">Seuil d'alerte</dt>
                  <dd className="m-0 text-chiffre font-bold tabular-nums">{selection.seuil}</dd>
                </div>
                <div>
                  <dt className="text-mention text-texte-discret">Prix de vente</dt>
                  <dd className="m-0 font-semibold tabular-nums">{formatMontant(selection.prix)}</dd>
                </div>
                <div>
                  <dt className="text-mention text-texte-discret">Catégorie</dt>
                  <dd className="m-0 font-semibold">{selection.categorie}</dd>
                </div>
              </dl>
              <Badge ton={BADGES[etatStock(selection)].ton} className="self-start">
                {BADGES[etatStock(selection)].libelle}
              </Badge>
              <Bouton variante="secondaire">Entrée de stock</Bouton>
            </Carte>
          )}

          <Carte>
            <ListeAdaptative
              legende="Produits en stock"
              lignes={produits}
              cleLigne={(p) => p.id}
              vide={<EtatVide message="Aucun produit" description="Aucun produit ne correspond à ces critères." />}
              colonnes={[
                { cle: "nom", libelle: "Produit", rendu: (p) => p.nom, principale: true },
                { cle: "categorie", libelle: "Catégorie", rendu: (p) => p.categorie },
                { cle: "stock", libelle: "Stock / seuil", rendu: (p) => `${p.stock} / ${p.seuil}`, alignement: "fin" },
                {
                  cle: "etat",
                  libelle: "État",
                  rendu: (p) => <Badge ton={BADGES[etatStock(p)].ton}>{BADGES[etatStock(p)].libelle}</Badge>,
                },
              ]}
              libelleAction="Fiche"
              action={(p) => (
                <Bouton variante="discret" aria-label={`Voir la fiche de ${p.nom}`} onClick={() => setSelection(p)}>
                  Voir
                </Bouton>
              )}
            />
          </Carte>
        </div>
      </div>
    </CoqueBackoffice>
  );
}
