import type { ProduitBoutique } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, Panneau, Selecteur } from "@multiboutique/ui";
import { clsx } from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { creerProduit, disponible, entrerStock, modifierPrix, modifierProduit, useCategories, useProduits } from "../../api/catalogue";
import { correspond, EnTeteEcran, ErreurApi, formatMontant, formatNombre, Formulaire, lireEntier, lireNombre, ListeChargee, televerser, urlImage, useEcriture, useSession } from "@multiboutique/front";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";

/** Catalogue et prix de la boutique (app/(dashboard)/dashboard/[boutiqueId]/produits/page.tsx). */
export function Produits() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const produits = useProduits(boutiqueId);
  const [recherche, setRecherche] = useState("");
  const [creation, setCreation] = useState(false);
  const [prixDe, setPrixDe] = useState<ProduitBoutique | null>(null);
  const [aModifier, setAModifier] = useState<ProduitBoutique | null>(null);
  const voitCout = peut("prix:gerer");
  const gereProduits = peut("produits:gerer");

  const filtres = {
    ...produits,
    data: produits.data?.filter((p) => correspond(`${p.produit_nom} ${p.produit_reference} ${p.produit_code ?? ""}`, recherche)),
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre={`Produits — ${boutique.data?.nom ?? ""}`}
        sousTitre="Catalogue et prix de la boutique"
        actions={peut("produits:gerer") && <Bouton onClick={() => setCreation(true)}>Nouveau produit</Bouton>}
      />
      <Carte>
        <Champ libelle="Rechercher un produit" type="recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <ListeChargee
          legende="Produits de la boutique"
          requete={filtres}
          cleLigne={(p) => p.id}
          vide={recherche ? "Aucun produit ne correspond" : "Aucun produit dans cette boutique, utilisez « Nouveau produit » pour commencer"}
          colonnes={[
            {
              cle: "produit",
              libelle: "Produit",
              principale: true,
              rendu: (p) => (
                <span className="flex items-center gap-3">
                  {p.produit_image && (
                    <img src={urlImage(p.produit_image)} alt="" className="size-10 shrink-0 rounded-bouton object-cover" />
                  )}
                  <span className="flex flex-col">
                    <span>{p.produit_nom}</span>
                    {p.produit_description && (
                      <span className="text-mention font-normal text-texte-discret">{p.produit_description.substring(0, 60)}</span>
                    )}
                  </span>
                </span>
              ),
            },
            { cle: "code", libelle: "Code", rendu: (p) => (p.produit_code ? <Badge ton="info">{p.produit_code}</Badge> : "—") },
            { cle: "reference", libelle: "Référence", rendu: (p) => p.produit_reference },
            { cle: "categorie", libelle: "Catégorie", rendu: (p) => p.categorie_nom ?? "—" },
            { cle: "prix", libelle: "Prix de vente", rendu: (p) => formatMontant(p.prix_vente, monnaie), alignement: "fin" },
            ...(voitCout
              ? [
                  {
                    cle: "cout",
                    libelle: "Coût revient",
                    rendu: (p: ProduitBoutique) => (p.cout_revient ? formatMontant(p.cout_revient, monnaie) : "—"),
                    alignement: "fin" as const,
                  },
                  {
                    cle: "marge",
                    libelle: "Marge",
                    rendu: (p: ProduitBoutique) =>
                      p.cout_revient
                        ? `${(((Number(p.prix_vente) - Number(p.cout_revient)) / Number(p.cout_revient)) * 100).toFixed(1)}%`
                        : "—",
                    alignement: "fin" as const,
                  },
                ]
              : []),
            {
              cle: "stock",
              libelle: "Stock",
              alignement: "fin",
              rendu: (p) => {
                const d = disponible(p);
                return (
                  <span className={clsx(d <= 0 ? "font-bold text-danger" : d <= (p.seuil_alerte || 10) && "font-bold text-alerte")}>
                    {formatNombre(d)}
                  </span>
                );
              },
            },
            {
              cle: "statut",
              libelle: "Statut",
              rendu: (p) => (p.produit_actif ? <Badge ton="succes">Actif</Badge> : <Badge ton="danger">Inactif</Badge>),
            },
          ]}
          libelleAction="Actions"
          action={
            gereProduits || voitCout
              ? (p) => (
                  <span className="flex flex-wrap justify-end gap-1">
                    {gereProduits && (
                      <Bouton variante="discret" aria-label={`Modifier ${p.produit_nom}`} onClick={() => setAModifier(p)}>
                        Modifier
                      </Bouton>
                    )}
                    {voitCout && (
                      <Bouton variante="discret" aria-label={`Modifier le prix de ${p.produit_nom}`} onClick={() => setPrixDe(p)}>
                        Prix
                      </Bouton>
                    )}
                  </span>
                )
              : undefined
          }
        />
      </Carte>
      {creation && <NouveauProduit boutiqueId={boutiqueId} onFermer={() => setCreation(false)} />}
      {aModifier && <ModifierProduit boutiqueId={boutiqueId} produit={aModifier} onFermer={() => setAModifier(null)} />}
      {prixDe && <PrixProduit boutiqueId={boutiqueId} produit={prixDe} onFermer={() => setPrixDe(null)} />}
    </div>
  );
}

/** Formulaire de components/dashboard/ProduitForm.tsx, dans un panneau. */
function NouveauProduit({ boutiqueId, onFermer }: { boutiqueId: string; onFermer: () => void }) {
  const categories = useCategories();
  const [champs, setChamps] = useState({ nom: "", reference: "", code: "", description: "", categorie: "", prix: "", cout: "", quantite: "" });
  const [image, setImage] = useState("");
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const client = useQueryClient();
  const creation = useEcriture({
    appel: async () => {
      const prix = lireNombre(champs.prix);
      const cout = lireNombre(champs.cout);
      const quantite = champs.quantite.trim() ? lireEntier(champs.quantite, 0) : 0;
      const { produitId } = await creerProduit({
        boutiqueId,
        produit: {
          nom: champs.nom,
          reference: champs.reference || champs.nom.replace(/\s+/g, "-").toUpperCase(),
          ...(champs.description ? { description: champs.description } : {}),
          ...(champs.categorie ? { categorie_id: champs.categorie } : {}),
          ...(image ? { image_url: image } : {}),
          ...(champs.code ? { code: champs.code } : {}),
        },
        prix_vente: prix,
        ...(Number.isNaN(cout) ? {} : { cout_revient: cout }),
      });
      // Entrée de stock initiale facultative, comme le monolithe. Le produit existe
      // déjà : en cas d'échec, la liste le montre, et le message le dit.
      if (quantite > 0) {
        try {
          await entrerStock({ boutiqueId, produitId, quantite, motif: "Stock initial" });
        } catch (e) {
          await client.invalidateQueries({ queryKey: ["boutiques", boutiqueId] });
          const raison = e instanceof ErreurApi ? e.message : "erreur inattendue";
          throw new ErreurApi(e instanceof ErreurApi ? e.statut : 0, `Produit créé, mais l'entrée de stock initiale a échoué : ${raison}. Faites-la depuis Stock.`);
        }
      }
      return produitId;
    },
    invalide: [["boutiques", boutiqueId]],
    succes: "Produit ajouté",
  });
  const maj = (cle: keyof typeof champs) => (e: { target: { value: string } }) => setChamps((c) => ({ ...c, [cle]: e.target.value }));
  const categorie = categories.data?.find((c) => c.id === champs.categorie);
  const apercuCode = champs.code.trim()
    ? champs.code.trim().toUpperCase()
    : `${categorie?.code || "PRD"}-000${(categories.data?.length || 0) + 1}`;

  async function envoyer() {
    const prix = lireNombre(champs.prix);
    if (!(prix > 0)) return setErreur("Le prix de vente doit être un nombre positif");
    if (champs.cout.trim() && !(lireNombre(champs.cout) >= 0)) return setErreur("Le coût de revient doit être un nombre positif ou nul");
    if (champs.quantite.trim() && Number.isNaN(lireEntier(champs.quantite, 0))) {
      return setErreur("La quantité initiale doit être un nombre entier");
    }
    setErreur(null);
    if (await creation.envoyer(undefined)) onFermer();
  }

  return (
    <Panneau ouvert titre="Nouveau produit" onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer="Ajouter le produit"
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? creation.erreur}
        enCours={creation.enCours || envoiPhoto}
        desactivee={creation.desactivee}
      >
        <Champ libelle="Nom du produit" required value={champs.nom} onChange={maj("nom")} erreur={creation.champs["produit.nom"]} />
        <Champ libelle="Référence (optionnel)" placeholder="auto si vide" value={champs.reference} onChange={maj("reference")} />
        <ChampPhoto image={image} onImage={setImage} enCours={envoiPhoto} onEnCours={setEnvoiPhoto} onErreur={setErreur} />
        <Champ
          libelle="Code produit (nomenclature)"
          placeholder={apercuCode}
          value={champs.code}
          onChange={maj("code")}
          aide={`Vide = généré automatiquement (ex. ${apercuCode}).`}
        />
        <Champ libelle="Description" value={champs.description} onChange={maj("description")} />
        <Selecteur
          libelle="Catégorie (rayon)"
          optionVide="Aucune"
          options={(categories.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))}
          value={champs.categorie}
          onChange={maj("categorie")}
        />
        <Champ libelle="Prix de vente" type="montant" required value={champs.prix} onChange={maj("prix")} />
        <Champ libelle="Coût de revient" type="montant" value={champs.cout} onChange={maj("cout")} />
        <Champ libelle="Quantité initiale en stock" type="nombre" placeholder="0" value={champs.quantite} onChange={maj("quantite")} />
      </Formulaire>
    </Panneau>
  );
}

/**
 * Photo d'un produit : envoyée dès le choix, l'adresse rendue par l'API part
 * ensuite avec le formulaire. Chaîne vide : pas de photo.
 */
function ChampPhoto({
  image,
  onImage,
  enCours,
  onEnCours,
  onErreur,
}: {
  image: string;
  onImage: (url: string) => void;
  enCours: boolean;
  onEnCours: (enCours: boolean) => void;
  onErreur: (erreur: string | null) => void;
}) {
  const photo = useRef<HTMLInputElement>(null);

  async function choisir(fichier: File | undefined) {
    if (!fichier) return;
    onEnCours(true);
    onErreur(null);
    try {
      onImage((await televerser(fichier)).url);
    } catch (e) {
      onErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'envoi de la photo");
    } finally {
      onEnCours(false);
      if (photo.current) photo.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="photo-produit" className="text-libelle font-semibold">
        Photo du produit
      </label>
      <div className="flex items-center gap-3">
        {image ? (
          <img src={urlImage(image)} alt="Aperçu du produit" className="size-14 rounded-bouton object-cover" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-bouton border border-dashed border-bordure-forte text-mention text-texte-discret">
            {enCours ? "…" : "Aucune"}
          </span>
        )}
        <input
          id="photo-produit"
          ref={photo}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={enCours}
          onChange={(e) => void choisir(e.target.files?.[0])}
          className="min-w-0 text-libelle file:mr-3 file:min-h-11 file:rounded-bouton file:border-0 file:bg-primaire-fond file:px-4 file:font-semibold file:text-primaire"
        />
      </div>
      {image && (
        <Bouton variante="discret" className="self-start" onClick={() => onImage("")}>
          Retirer la photo
        </Bouton>
      )}
    </div>
  );
}

/** Informations du produit (communes à toutes les boutiques), dans un panneau. */
function ModifierProduit({ boutiqueId, produit, onFermer }: { boutiqueId: string; produit: ProduitBoutique; onFermer: () => void }) {
  const categories = useCategories();
  const [champs, setChamps] = useState({
    nom: produit.produit_nom,
    code: produit.produit_code ?? "",
    description: produit.produit_description ?? "",
    categorie: produit.categorie_id ?? "",
  });
  const [image, setImage] = useState(produit.produit_image ?? "");
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const modification = useEcriture({ appel: modifierProduit, invalide: [["boutiques"]], succes: "Produit modifié" });
  const maj = (cle: keyof typeof champs) => (e: { target: { value: string } }) => setChamps((c) => ({ ...c, [cle]: e.target.value }));

  async function envoyer() {
    if (!champs.nom.trim()) return setErreur("Le nom du produit est requis");
    setErreur(null);
    const ok = await modification.envoyer({
      boutiqueId,
      produitId: produit.produit_id,
      produit: {
        nom: champs.nom.trim(),
        description: champs.description,
        categorie_id: champs.categorie,
        image_url: image,
        ...(champs.code.trim() ? { code: champs.code } : {}),
      },
    });
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={`Modifier ${produit.produit_nom}`} onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer="Enregistrer"
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? modification.erreur}
        enCours={modification.enCours || envoiPhoto}
        desactivee={modification.desactivee}
        actions={
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
        }
      >
        <p className="m-0 text-mention text-texte-discret">
          Réf. {produit.produit_reference}. Ces informations sont communes à toutes les boutiques qui vendent le produit.
        </p>
        <Champ libelle="Nom du produit" required value={champs.nom} onChange={maj("nom")} erreur={modification.champs["nom"]} />
        <ChampPhoto image={image} onImage={setImage} enCours={envoiPhoto} onEnCours={setEnvoiPhoto} onErreur={setErreur} />
        <Champ libelle="Code produit (nomenclature)" value={champs.code} onChange={maj("code")} aide="Vide = code actuel conservé." />
        <Champ libelle="Description" value={champs.description} onChange={maj("description")} />
        <Selecteur
          libelle="Catégorie (rayon)"
          optionVide="Aucune"
          options={(categories.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))}
          value={champs.categorie}
          onChange={maj("categorie")}
        />
      </Formulaire>
    </Panneau>
  );
}

/** components/dashboard/PrixForm.tsx, dans un panneau. */
function PrixProduit({ boutiqueId, produit, onFermer }: { boutiqueId: string; produit: ProduitBoutique; onFermer: () => void }) {
  const [prix, setPrix] = useState(String(produit.prix_vente));
  const [cout, setCout] = useState(produit.cout_revient != null ? String(produit.cout_revient) : "");
  const [erreur, setErreur] = useState<string | null>(null);
  const modification = useEcriture({ appel: modifierPrix, invalide: [["boutiques", boutiqueId]], succes: "Prix enregistré" });

  async function envoyer() {
    const p = lireNombre(prix);
    if (!(p > 0)) return setErreur("Le prix de vente doit être positif");
    const c = lireNombre(cout);
    // Un coût mal saisi ne doit pas effacer le coût enregistré.
    if (cout.trim() && !(c >= 0)) return setErreur("Le coût de revient doit être un nombre positif ou nul");
    setErreur(null);
    const ok = await modification.envoyer({
      boutiqueId,
      produitId: produit.produit_id,
      prix_vente: p,
      ...(Number.isNaN(c) ? {} : { cout_revient: c }),
    });
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={`Prix de ${produit.produit_nom}`} onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer="Enregistrer"
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? modification.erreur}
        enCours={modification.enCours}
        desactivee={modification.desactivee}
        actions={
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
        }
      >
        <Champ libelle="Prix de vente" type="montant" value={prix} onChange={(e) => setPrix(e.target.value)} />
        <Champ libelle="Coût de revient" type="montant" value={cout} onChange={(e) => setCout(e.target.value)} />
      </Formulaire>
    </Panneau>
  );
}
