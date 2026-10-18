import { Badge, Bouton, Carte, Champ, Panneau, Selecteur } from "@multiboutique/ui";
import { useState } from "react";
import { useParams } from "react-router";
import { appliquerPrixConseilles, publierPrixReference, usePrixConseilles } from "../../api/achats";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { EnTeteEcran, formatMontant, Formulaire, lireNombre, ListeChargee, useEcriture, useSession } from "@multiboutique/front";

/** Grille de prix du siège (app/(dashboard)/dashboard/[boutiqueId]/prix-conseilles/page.tsx). */
export function PrixConseilles() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const grille = usePrixConseilles(boutiqueId);
  const peutPublier = peut("prix_conseilles:gerer");
  const peutAppliquer = peut("prix:gerer");
  const application = useEcriture({ appel: appliquerPrixConseilles, invalide: [["boutiques", boutiqueId]] });
  const [publication, setPublication] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function appliquer(produit_ids?: string[]) {
    const resultat = await application.envoyer({ boutiqueId, ...(produit_ids ? { produit_ids } : {}) });
    if (resultat) setMessage(`${resultat.appliques} prix appliqué${resultat.appliques > 1 ? "s" : ""}`);
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre={`Prix conseillés — ${boutique.data?.nom ?? ""}`}
        sousTitre="Grille de prix publiée par le siège. Appliquez-la aux produits de cette boutique en un clic."
        actions={peutPublier && <Bouton onClick={() => setPublication(true)}>Publier un prix conseillé</Bouton>}
      />
      <Carte
        titre="Grille publiée"
        action={
          peutAppliquer &&
          !!grille.data?.prix.length && (
            <Bouton variante="secondaire" chargement={application.enCours} disabled={application.desactivee} onClick={() => void appliquer()}>
              Appliquer toute la grille ici
            </Bouton>
          )
        }
      >
        {!peutAppliquer && (
          <p className="m-0 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle text-texte-discret">
            La grille est en lecture seule — seule la boutique peut décider de l'appliquer.
          </p>
        )}
        {message && <p className="m-0 rounded-bouton bg-succes-fond px-4 py-3 font-semibold text-succes">{message}</p>}
        {application.erreur && (
          <p role="alert" className="m-0 font-semibold text-danger">
            {application.erreur}
          </p>
        )}
        <ListeChargee
          legende="Grille publiée"
          requete={{ ...grille, data: grille.data?.prix }}
          cleLigne={(p) => p.produit_id}
          vide="Aucun prix conseillé publié par le siège"
          colonnes={[
            { cle: "produit", libelle: "Produit", rendu: (p) => p.produit_nom, principale: true },
            { cle: "prix", libelle: "Prix conseillé", rendu: (p) => formatMontant(p.prix_vente, monnaie), alignement: "fin" },
            { cle: "cout", libelle: "Coût revient", rendu: (p) => (p.cout_revient != null ? formatMontant(p.cout_revient, monnaie) : "—"), alignement: "fin" },
            {
              cle: "etat",
              libelle: "État boutique",
              rendu: (p) => (p.applique ? <Badge ton="succes">Appliqué</Badge> : <Badge ton="alerte">Non appliqué</Badge>),
            },
          ]}
          libelleAction="Appliquer"
          action={
            peutAppliquer
              ? (p) => (
                  <Bouton
                    variante="discret"
                    aria-label={`Appliquer ${p.produit_nom} ici`}
                    disabled={application.desactivee}
                    onClick={() => void appliquer([p.produit_id])}
                  >
                    Appliquer ici
                  </Bouton>
                )
              : undefined
          }
        />
      </Carte>
      {publication && (
        <Publication boutiqueId={boutiqueId} produits={grille.data?.produits ?? []} onFermer={() => setPublication(false)} />
      )}
    </div>
  );
}

/** components/dashboard/PrixConseillesPublisher.tsx, dans un panneau. */
function Publication({
  boutiqueId,
  produits,
  onFermer,
}: {
  boutiqueId: string;
  produits: { produit_id: string; nom: string; prix_vente: number | null }[];
  onFermer: () => void;
}) {
  const publication = useEcriture({
    appel: publierPrixReference,
    // La grille est commune à toutes les boutiques.
    invalide: [["boutiques"]],
    succes: "Prix conseillé publié — les boutiques peuvent l'appliquer",
  });
  const [produitId, setProduitId] = useState("");
  const [prix, setPrix] = useState("");
  const [cout, setCout] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    const p = lireNombre(prix);
    if (!produitId) return setErreur("Choisissez un produit");
    if (!p || p <= 0) return setErreur("Le prix de vente conseillé doit être positif");
    setErreur(null);
    const c = lireNombre(cout);
    if (await publication.envoyer({ produit_id: produitId, prix_vente: p, cout_revient: Number.isNaN(c) ? null : c, actif: true })) {
      onFermer();
    }
  }

  return (
    <Panneau ouvert titre="Publier un prix conseillé" onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer="Publier"
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? publication.erreur}
        enCours={publication.enCours}
        desactivee={publication.desactivee}
      >
        <Selecteur
          libelle="Produit"
          optionVide="— Produit —"
          options={produits.map((p) => ({ valeur: p.produit_id, libelle: p.nom }))}
          value={produitId}
          onChange={(e) => {
            setProduitId(e.target.value);
            const p = produits.find((x) => x.produit_id === e.target.value);
            setPrix(p?.prix_vente ? String(p.prix_vente) : "");
            setCout("");
          }}
        />
        <Champ libelle="Prix de vente conseillé" type="montant" value={prix} onChange={(e) => setPrix(e.target.value)} />
        <Champ libelle="Coût de revient conseillé" type="montant" value={cout} onChange={(e) => setCout(e.target.value)} />
      </Formulaire>
    </Panneau>
  );
}
