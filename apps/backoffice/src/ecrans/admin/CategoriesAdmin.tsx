import type { CategorieAdmin } from "@multiboutique/shared";
import { Bouton, Carte, Champ, Dialogue, Panneau } from "@multiboutique/ui";
import { useState } from "react";
import { creerCategorie, INVALIDE_ADMIN, modifierCategorie, supprimerCategorie, useCategoriesAdmin } from "../../api/administration";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { formatNombre } from "../../commun/formats";
import { Formulaire } from "../../commun/Formulaire";
import { ListeChargee } from "../../commun/ListeChargee";
import { useEcriture } from "../../commun/useEcriture";

/** app/(admin)/admin/categories/page.tsx */
export function CategoriesAdmin() {
  const categories = useCategoriesAdmin();
  // Les catégories servent aussi aux écrans produits (GET /categories).
  const invalide = [...INVALIDE_ADMIN, ["categories"]];
  const suppression = useEcriture({ appel: supprimerCategorie, invalide, succes: "Catégorie supprimée" });
  const [fiche, setFiche] = useState<CategorieAdmin | "nouvelle" | null>(null);
  const [aSupprimer, setASupprimer] = useState<CategorieAdmin | null>(null);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Catégories"
        sousTitre="Organisez les produits en rayons. Une catégorie ne peut être supprimée que si aucun produit n'y est rattaché."
        actions={<Bouton onClick={() => setFiche("nouvelle")}>Créer une catégorie</Bouton>}
      />
      {suppression.erreur && (
        <p role="alert" className="m-0 font-semibold text-danger">
          {suppression.erreur}
        </p>
      )}
      <Carte>
        <ListeChargee
          legende="Catégories"
          requete={categories}
          cleLigne={(c) => c.id}
          vide="Aucune catégorie"
          colonnes={[
            { cle: "nom", libelle: "Catégorie", rendu: (c) => c.nom, principale: true },
            { cle: "description", libelle: "Description", rendu: (c) => c.description || "—" },
            { cle: "produits", libelle: "Produits", rendu: (c) => formatNombre(c.nb_produits), alignement: "fin" },
          ]}
          libelleAction="Actions"
          action={(c) => (
            <span className="flex flex-wrap justify-end gap-1">
              <Bouton variante="discret" aria-label={`Modifier ${c.nom}`} onClick={() => setFiche(c)}>
                Modifier
              </Bouton>
              <Bouton
                variante="discret"
                aria-label={`Supprimer ${c.nom}`}
                title={c.nb_produits > 0 ? "Déplacez d'abord les produits rattachés" : undefined}
                disabled={c.nb_produits > 0}
                onClick={() => setASupprimer(c)}
              >
                Supprimer
              </Bouton>
            </span>
          )}
        />
      </Carte>
      {fiche && <FicheCategorie categorie={fiche === "nouvelle" ? null : fiche} invalide={invalide} onFermer={() => setFiche(null)} />}
      <Dialogue
        ouvert={!!aSupprimer}
        titre={`Supprimer la catégorie « ${aSupprimer?.nom ?? ""} » ?`}
        libelleConfirmer="Supprimer"
        variante="danger"
        chargement={suppression.enCours}
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          if (aSupprimer) await suppression.envoyer({ id: aSupprimer.id });
          setASupprimer(null);
        }}
      />
    </div>
  );
}

function FicheCategorie({ categorie, invalide, onFermer }: { categorie: CategorieAdmin | null; invalide: (readonly string[])[]; onFermer: () => void }) {
  const creation = useEcriture({ appel: creerCategorie, invalide, succes: "Catégorie créée" });
  const modification = useEcriture({ appel: modifierCategorie, invalide, succes: "Catégorie modifiée" });
  const ecriture = categorie ? modification : creation;
  const [nom, setNom] = useState(categorie?.nom ?? "");
  const [description, setDescription] = useState(categorie?.description ?? "");

  async function envoyer() {
    const saisie = { nom, ...(description ? { description } : {}) };
    const ok = categorie ? await modification.envoyer({ ...saisie, id: categorie.id }) : await creation.envoyer(saisie);
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={categorie ? categorie.nom : "Créer une catégorie"} onFermer={onFermer}>
      <Formulaire libelleEnvoyer={categorie ? "Enregistrer" : "Créer la catégorie"} onEnvoyer={() => void envoyer()} erreur={ecriture.erreur} enCours={ecriture.enCours} desactivee={ecriture.desactivee}>
        <Champ libelle="Nom de la catégorie" placeholder="Ex : Boissons" required value={nom} onChange={(e) => setNom(e.target.value)} />
        <Champ libelle="Description" placeholder="À quoi correspond ce rayon" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Formulaire>
    </Panneau>
  );
}
