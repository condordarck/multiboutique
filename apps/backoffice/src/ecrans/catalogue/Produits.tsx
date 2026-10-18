import type { ProduitBoutique } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, Panneau, Selecteur } from "@multiboutique/ui";
import { clsx } from "clsx";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { creerProduit, disponible, entrerStock, modifierPrix, useCategories, useProduits } from "../../api/catalogue";
import { ErreurApi, televerser, urlImage } from "../../api/client";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { formatMontant, formatNombre } from "../../commun/formats";
import { Formulaire } from "../../commun/Formulaire";
import { ListeChargee } from "../../commun/ListeChargee";
import { correspond } from "../../commun/recherche";
import { lireNombre } from "../../commun/saisie";
import { useEcriture } from "../../commun/useEcriture";
import { useSession } from "../../session/Session";

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
  const voitCout = peut("prix:gerer");

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
          libelleAction="Prix"
          action={
            voitCout
              ? (p) => (
                  <Bouton variante="discret" aria-label={`Modifier le prix de ${p.produit_nom}`} onClick={() => setPrixDe(p)}>
                    Modifier le prix
                  </Bouton>
                )
              : undefined
          }
        />
      </Carte>
      {creation && <NouveauProduit boutiqueId={boutiqueId} onFermer={() => setCreation(false)} />}
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
  const photo = useRef<HTMLInputElement>(null);
  const creation = useEcriture({
    appel: async () => {
      const prix = lireNombre(champs.prix);
      const cout = lireNombre(champs.cout);
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
      // Entrée de stock initiale facultative, comme le monolithe.
      const quantite = lireNombre(champs.quantite);
      if (quantite > 0) await entrerStock({ boutiqueId, produitId, quantite, motif: "Stock initial" });
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

  async function choisirPhoto(fichier: File | undefined) {
    if (!fichier) return;
    setEnvoiPhoto(true);
    setErreur(null);
    try {
      setImage((await televerser(fichier)).url);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'envoi de la photo");
    } finally {
      setEnvoiPhoto(false);
      if (photo.current) photo.current.value = "";
    }
  }

  async function envoyer() {
    const prix = lireNombre(champs.prix);
    if (!prix || prix <= 0) return setErreur("Le prix de vente doit être un nombre positif");
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="photo-produit" className="text-libelle font-semibold">
            Photo du produit
          </label>
          <div className="flex items-center gap-3">
            {image ? (
              <img src={urlImage(image)} alt="Aperçu du produit" className="size-14 rounded-bouton object-cover" />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-bouton border border-dashed border-bordure-forte text-mention text-texte-discret">
                {envoiPhoto ? "…" : "Aucune"}
              </span>
            )}
            <input
              id="photo-produit"
              ref={photo}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={envoiPhoto}
              onChange={(e) => void choisirPhoto(e.target.files?.[0])}
              className="min-w-0 text-libelle file:mr-3 file:min-h-11 file:rounded-bouton file:border-0 file:bg-primaire-fond file:px-4 file:font-semibold file:text-primaire"
            />
          </div>
          {image && (
            <Bouton variante="discret" className="self-start" onClick={() => setImage("")}>
              Retirer la photo
            </Bouton>
          )}
        </div>
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

/** components/dashboard/PrixForm.tsx, dans un panneau. */
function PrixProduit({ boutiqueId, produit, onFermer }: { boutiqueId: string; produit: ProduitBoutique; onFermer: () => void }) {
  const [prix, setPrix] = useState(String(produit.prix_vente));
  const [cout, setCout] = useState(produit.cout_revient != null ? String(produit.cout_revient) : "");
  const [erreur, setErreur] = useState<string | null>(null);
  const modification = useEcriture({ appel: modifierPrix, invalide: [["boutiques", boutiqueId]], succes: "Prix enregistré" });

  async function envoyer() {
    const p = lireNombre(prix);
    if (!p || p <= 0) return setErreur("Le prix de vente doit être positif");
    setErreur(null);
    const c = lireNombre(cout);
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
