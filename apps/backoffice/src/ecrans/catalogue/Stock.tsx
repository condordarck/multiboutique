import type { LigneStock } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, ChoixSegmente, Panneau, Selecteur, TuileChiffre } from "@multiboutique/ui";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ajusterStock, entrerStock, transfertStock, useMouvements, useStock } from "../../api/catalogue";
import { useMesBoutiques, useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { correspond, EnTeteEcran, formatMontant, formatNombre, Formulaire, lireEntier, ListeChargee, useEcriture, useSession } from "@multiboutique/front";

type Filtre = "tous" | "alerte" | "rupture";

const BADGES_STOCK = {
  rupture: <Badge ton="danger">Rupture</Badge>,
  alerte: <Badge ton="alerte">Stock bas</Badge>,
  ok: <Badge ton="succes">OK</Badge>,
};

const BADGES_MOUVEMENT: Record<string, React.ReactNode> = {
  entree: <Badge ton="succes">Entrée</Badge>,
  sortie: <Badge ton="danger">Sortie</Badge>,
  transfert: <Badge ton="info">Transfert</Badge>,
  ajustement: <Badge ton="alerte">Ajustement</Badge>,
};

const PERIODES = [
  { valeur: "", libelle: "Toute la période" },
  { valeur: "jour", libelle: "Aujourd'hui" },
  { valeur: "semaine", libelle: "Cette semaine" },
  { valeur: "mois", libelle: "Ce mois" },
  { valeur: "annee", libelle: "Cette année" },
];

const TYPES = [
  { valeur: "", libelle: "Tous les types" },
  { valeur: "entree", libelle: "Entrées" },
  { valeur: "sortie", libelle: "Sorties" },
  { valeur: "ajustement", libelle: "Ajustements" },
  { valeur: "transfert", libelle: "Transferts" },
];

/** Stock et mouvements (app/(dashboard)/dashboard/[boutiqueId]/stock/page.tsx), sur la maquette « Stock ». */
export function Stock() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const stock = useStock(boutiqueId);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [fiche, setFiche] = useState<LigneStock | null>(null);

  const lignes = stock.data ?? [];
  const nb = (s: LigneStock["statut_stock"]) => lignes.filter((l) => l.statut_stock === s).length;
  const visibles = {
    ...stock,
    data: stock.data?.filter(
      (l) => correspond(`${l.produit_nom} ${l.produit_reference}`, recherche) && (filtre === "tous" || l.statut_stock === filtre)
    ),
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran titre={`Stock — ${boutique.data?.nom ?? ""}`} sousTitre="Gestion des stocks et mouvements" />
      <div className="grid grid-cols-2 gap-3 tablette:grid-cols-3 tablette:gap-4">
        <TuileChiffre libelle="Produits en stock" valeur={formatNombre(lignes.length - nb("rupture"))} />
        <TuileChiffre libelle="Alertes stock" valeur={formatNombre(nb("alerte"))} />
        <TuileChiffre libelle="Ruptures" valeur={formatNombre(nb("rupture"))} miseEnAvant={nb("rupture") > 0} />
      </div>

      <Carte titre="État du stock">
        <div className="flex flex-col gap-4 tablette:flex-row tablette:items-end">
          <div className="tablette:flex-1">
            <Champ libelle="Rechercher un produit" type="recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          <ChoixSegmente<Filtre>
            legende="Afficher"
            options={[
              { valeur: "tous", libelle: `Tous (${lignes.length})` },
              { valeur: "alerte", libelle: `Sous le seuil (${nb("alerte")})` },
              { valeur: "rupture", libelle: `Rupture (${nb("rupture")})` },
            ]}
            valeur={filtre}
            onChange={setFiltre}
          />
        </div>
        <ListeChargee
          legende="État du stock"
          requete={visibles}
          cleLigne={(l) => l.id}
          vide={recherche || filtre !== "tous" ? "Aucun produit ne correspond à ces critères" : "Aucun produit en stock"}
          colonnes={[
            { cle: "produit", libelle: "Produit", rendu: (l) => l.produit_nom, principale: true },
            { cle: "ref", libelle: "Réf.", rendu: (l) => l.produit_reference },
            { cle: "total", libelle: "Stock total", rendu: (l) => formatNombre(l.quantite), alignement: "fin" },
            { cle: "reserve", libelle: "Réservé", rendu: (l) => formatNombre(l.quantite_reservee), alignement: "fin" },
            { cle: "disponible", libelle: "Disponible", rendu: (l) => formatNombre(l.disponible), alignement: "fin" },
            { cle: "seuil", libelle: "Seuil", rendu: (l) => formatNombre(l.seuil_alerte), alignement: "fin" },
            { cle: "statut", libelle: "Statut", rendu: (l) => BADGES_STOCK[l.statut_stock] },
            { cle: "prix", libelle: "Prix", rendu: (l) => formatMontant(l.prix_vente || 0, monnaie), alignement: "fin" },
          ]}
          libelleAction="Gérer"
          action={
            peut("stock:gerer")
              ? (l) => (
                  <Bouton variante="discret" aria-label={`Gérer le stock de ${l.produit_nom}`} onClick={() => setFiche(l)}>
                    Gérer
                  </Bouton>
                )
              : undefined
          }
        />
      </Carte>

      <Mouvements boutiqueId={boutiqueId} />
      {fiche && <FicheStock boutiqueId={boutiqueId} ligne={fiche} onFermer={() => setFiche(null)} />}
    </div>
  );
}

/** Historique filtré ; les filtres vivent dans l'adresse, comme MouvementsFiltres.tsx. */
function Mouvements({ boutiqueId }: { boutiqueId: string }) {
  const [parametres, setParametres] = useSearchParams();
  const filtres = {
    periode: parametres.get("periode") ?? "",
    type: parametres.get("type") ?? "",
    produit: parametres.get("produit") ?? "",
  };
  const mouvements = useMouvements(boutiqueId, filtres);
  const [saisie, setSaisie] = useState(filtres.produit);
  const total = mouvements.data?.length ?? 0;

  function maj(cle: string, valeur: string) {
    const p = new URLSearchParams(parametres);
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    setParametres(p, { replace: true, preventScrollReset: true });
  }

  return (
    <Carte
      titre="Historique des mouvements"
      action={
        <span className="text-libelle text-texte-discret">
          {total} mouvement{total > 1 ? "s" : ""}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 tablette:grid-cols-2 bureau:grid-cols-4">
        <Selecteur libelle="Période" options={PERIODES} value={filtres.periode} onChange={(e) => maj("periode", e.target.value)} />
        <Selecteur libelle="Type" options={TYPES} value={filtres.type} onChange={(e) => maj("type", e.target.value)} />
        <div className="flex items-end gap-2 tablette:col-span-2">
          <div className="flex-1">
            <Champ
              libelle="Produit (nom ou référence)"
              type="recherche"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && maj("produit", saisie)}
              onBlur={() => maj("produit", saisie)}
            />
          </div>
          {(filtres.periode || filtres.type || filtres.produit) && (
            <Bouton
              variante="secondaire"
              onClick={() => {
                setSaisie("");
                setParametres(new URLSearchParams(), { replace: true, preventScrollReset: true });
              }}
            >
              Réinitialiser
            </Bouton>
          )}
        </div>
      </div>
      <ListeChargee
        legende="Mouvements de stock"
        requete={mouvements}
        cleLigne={(m) => m.id}
        vide="Aucun mouvement pour les filtres sélectionnés"
        colonnes={[
          { cle: "produit", libelle: "Produit", rendu: (m) => m.produit_nom, principale: true },
          { cle: "date", libelle: "Date", rendu: (m) => new Date(m.created_at).toLocaleString("fr-FR") },
          { cle: "type", libelle: "Type", rendu: (m) => BADGES_MOUVEMENT[m.type] ?? m.type },
          { cle: "quantite", libelle: "Qté", rendu: (m) => formatNombre(m.quantite), alignement: "fin" },
          { cle: "avant-apres", libelle: "Avant → Après", rendu: (m) => `${m.quantite_avant} → ${m.quantite_apres}` },
          { cle: "auteur", libelle: "Auteur", rendu: (m) => m.auteur_nom || "—" },
          { cle: "motif", libelle: "Motif", rendu: (m) => m.motif || "—" },
        ]}
      />
    </Carte>
  );
}

type Operation = "entree" | "ajustement" | "transfert";

/** Entrée, ajustement (StockActions.tsx) et transfert vers une autre boutique. */
function FicheStock({ boutiqueId, ligne, onFermer }: { boutiqueId: string; ligne: LigneStock; onFermer: () => void }) {
  const autres = (useMesBoutiques().data ?? []).filter((b) => b.id !== boutiqueId);
  const [operation, setOperation] = useState<Operation>("entree");
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("");
  const [destination, setDestination] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const invalide = [["boutiques", boutiqueId]];
  const entree = useEcriture({ appel: entrerStock, invalide, succes: "Entrée enregistrée" });
  const ajustement = useEcriture({ appel: ajusterStock, invalide, succes: "Stock ajusté" });
  const transfert = useEcriture({
    appel: transfertStock,
    invalide: [...invalide, ["boutiques", destination]],
    succes: "Transfert effectué",
  });
  const ecriture = { entree, ajustement, transfert }[operation];

  async function envoyer() {
    // Entier : 0 accepté pour un ajustement (stock vidé), au moins 1 sinon.
    const q = lireEntier(quantite, operation === "ajustement" ? 0 : 1);
    if (Number.isNaN(q)) return setErreur("Quantité invalide (nombre entier)");
    if (operation === "transfert" && !destination) return setErreur("Choisissez la boutique de destination");
    setErreur(null);
    const commun = { boutiqueId, produitId: ligne.produit_id, quantite: q, motif };
    const ok =
      operation === "transfert"
        ? await transfert.envoyer({ ...commun, destinationId: destination })
        : operation === "entree"
          ? await entree.envoyer(commun)
          : await ajustement.envoyer(commun);
    if (ok) onFermer();
  }

  const operations: { valeur: Operation; libelle: string }[] = [
    { valeur: "entree", libelle: "Entrée" },
    { valeur: "ajustement", libelle: "Ajuster" },
    ...(autres.length ? [{ valeur: "transfert" as const, libelle: "Transférer" }] : []),
  ];

  return (
    <Panneau ouvert titre={ligne.produit_nom} onFermer={onFermer}>
      <div className="flex flex-col gap-5">
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
          {[
            ["Stock total", ligne.quantite],
            ["Réservé", ligne.quantite_reservee],
            ["Disponible", ligne.disponible],
            ["Seuil d'alerte", ligne.seuil_alerte],
          ].map(([libelle, valeur]) => (
            <div key={libelle}>
              <dt className="text-mention text-texte-discret">{libelle}</dt>
              <dd className="m-0 text-panneau font-bold tabular-nums">{formatNombre(valeur as number)}</dd>
            </div>
          ))}
        </dl>
        <ChoixSegmente<Operation>
          legende="Opération"
          legendeVisible
          options={operations}
          valeur={operation}
          onChange={(o) => {
            setOperation(o);
            setErreur(null);
            setQuantite("");
          }}
        />
        <Formulaire
          libelleEnvoyer={
            operation === "entree" ? "Enregistrer l'entrée" : operation === "ajustement" ? "Enregistrer l'ajustement" : "Transférer le stock"
          }
          onEnvoyer={() => void envoyer()}
          erreur={erreur ?? ecriture.erreur}
          enCours={ecriture.enCours}
          desactivee={ecriture.desactivee}
        >
          {operation === "transfert" && (
            <Selecteur
              libelle="Boutique de destination"
              optionVide="Choisir…"
              options={autres.map((b) => ({ valeur: b.id, libelle: b.nom }))}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          )}
          <Champ
            libelle={
              operation === "entree" ? "Quantité entrée" : operation === "ajustement" ? "Nouvelle quantité (total)" : "Quantité à transférer"
            }
            type="nombre"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            aide={operation === "ajustement" ? `Stock total actuel : ${formatNombre(ligne.quantite)}` : undefined}
          />
          <Champ libelle="Motif (optionnel)" value={motif} onChange={(e) => setMotif(e.target.value)} />
        </Formulaire>
      </div>
    </Panneau>
  );
}
