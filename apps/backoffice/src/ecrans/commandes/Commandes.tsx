import type { CommandeListee, StatutCommande, TermePaiement } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, ChoixSegmente, Dialogue, Panneau, Selecteur, type TonBadge } from "@multiboutique/ui";
import { LignesArticles, lignesInvalides, type LigneSaisie } from "../../commun/LignesArticles";
import { useState } from "react";
import { useParams } from "react-router";
import { useProduits } from "../../api/catalogue";
import { useClientsActifs } from "../../api/clients";
import { annulerCommande, confirmerCommande, creerCommande, livrerCommande, useCommandes } from "../../api/commandes";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { EnTeteEcran, formatDate, formatMontant, Formulaire, lireNombre, ListeChargee, useEcriture, useSession } from "@multiboutique/front";

const STATUTS: Record<StatutCommande, { libelle: string; ton: TonBadge }> = {
  en_attente: { libelle: "En attente", ton: "alerte" },
  confirmee: { libelle: "Confirmée", ton: "info" },
  livree: { libelle: "Livrée", ton: "succes" },
  annulee: { libelle: "Annulée", ton: "danger" },
};

type Demande = { commande: CommandeListee; action: "livrer" | "annuler" };

/** Bons de commande grossistes (app/(dashboard)/dashboard/[boutiqueId]/commandes/page.tsx). */
export function Commandes() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const commandes = useCommandes(boutiqueId);
  const peutGerer = peut("commandes:gerer");
  const invalide = [["boutiques", boutiqueId]];
  const confirmation = useEcriture({ appel: confirmerCommande, invalide, succes: "Commande confirmée" });
  const livraison = useEcriture({ appel: livrerCommande, invalide, succes: "Commande livrée, stock déduit" });
  const annulation = useEcriture({ appel: annulerCommande, invalide, succes: "Commande annulée" });
  const [creation, setCreation] = useState(false);
  const [demande, setDemande] = useState<Demande | null>(null);
  const erreur = confirmation.erreur ?? livraison.erreur ?? annulation.erreur;
  const ecritureDemande = demande?.action === "livrer" ? livraison : annulation;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre={`Commandes B2B — ${boutique.data?.nom ?? ""}`}
        sousTitre="Bons de commande grossistes : confirmation, livraison (déduction du stock) et suivi de l'encours"
        actions={peutGerer && <Bouton onClick={() => setCreation(true)}>Nouvelle commande grossiste</Bouton>}
      />
      <Carte titre="Commandes en cours">
        {!peutGerer && (
          <p className="m-0 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle text-texte-discret">
            Lecture seule — la gestion des commandes est réservée au gérant et au propriétaire.
          </p>
        )}
        {erreur && (
          <p role="alert" className="m-0 font-semibold text-danger">
            {erreur}
          </p>
        )}
        <ListeChargee
          legende="Commandes en cours"
          requete={commandes}
          cleLigne={(c) => c.id}
          vide="Aucune commande. Créez un client dans Clients, puis une commande."
          colonnes={[
            {
              cle: "reference",
              libelle: "Référence",
              principale: true,
              rendu: (c) => (
                <span className="flex flex-col">
                  <span>{c.reference_commande}</span>
                  <span className="text-mention font-normal text-texte-discret">{`${c.nb_lignes} article${c.nb_lignes > 1 ? "s" : ""}`}</span>
                </span>
              ),
            },
            {
              cle: "client",
              libelle: "Client",
              rendu: (c) => (
                <span className="flex flex-col">
                  <span>{c.client_nom}</span>
                  <span className="text-mention text-texte-discret uppercase">{c.client_type}</span>
                </span>
              ),
            },
            { cle: "brut", libelle: "Total", rendu: (c) => formatMontant(c.montant_brut, monnaie), alignement: "fin" },
            {
              cle: "remise",
              libelle: "Remise",
              alignement: "fin",
              rendu: (c) => (Number(c.remise) > 0 ? <span className="text-succes">{`−${formatMontant(c.remise, monnaie)}`}</span> : "—"),
            },
            { cle: "net", libelle: "Net", rendu: (c) => formatMontant(c.montant_total, monnaie), alignement: "fin" },
            {
              cle: "paiement",
              libelle: "Paiement",
              rendu: (c) => (
                <span className="flex flex-col">
                  <span>{c.terme_paiement === "credit" ? "À crédit" : "Comptant"}</span>
                  {c.code_promo && <span className="text-mention text-info uppercase">{c.code_promo}</span>}
                </span>
              ),
            },
            { cle: "date", libelle: "Date", rendu: (c) => formatDate(c.created_at) },
            { cle: "statut", libelle: "Statut", rendu: (c) => <Badge ton={STATUTS[c.statut].ton}>{STATUTS[c.statut].libelle}</Badge> },
          ]}
          libelleAction="Actions"
          action={
            peutGerer
              ? (c) =>
                  c.statut === "en_attente" || c.statut === "confirmee" ? (
                    <span className="flex flex-wrap justify-end gap-1">
                      {c.statut === "en_attente" && (
                        <Bouton
                          variante="discret"
                          aria-label={`Confirmer ${c.reference_commande}`}
                          disabled={confirmation.desactivee}
                          chargement={confirmation.enCours}
                          onClick={() => void confirmation.envoyer({ id: c.id })}
                        >
                          Confirmer
                        </Bouton>
                      )}
                      {c.statut === "confirmee" && (
                        <Bouton variante="discret" aria-label={`Livrer ${c.reference_commande}`} onClick={() => setDemande({ commande: c, action: "livrer" })}>
                          Livrer
                        </Bouton>
                      )}
                      <Bouton variante="discret" aria-label={`Annuler ${c.reference_commande}`} onClick={() => setDemande({ commande: c, action: "annuler" })}>
                        Annuler
                      </Bouton>
                    </span>
                  ) : null
              : undefined
          }
        />
      </Carte>
      {creation && <NouvelleCommande boutiqueId={boutiqueId} onFermer={() => setCreation(false)} />}
      <Dialogue
        ouvert={!!demande}
        titre={demande ? `${demande.action === "livrer" ? "Livrer" : "Annuler"} ${demande.commande.reference_commande} ?` : ""}
        message={demande?.action === "livrer" ? "Le stock sera déduit de la boutique." : "La commande ne pourra plus être livrée."}
        libelleConfirmer={demande?.action === "livrer" ? "Livrer" : "Annuler la commande"}
        libelleAnnuler="Revenir"
        variante={demande?.action === "annuler" ? "danger" : "primaire"}
        chargement={ecritureDemande.enCours}
        onAnnuler={() => setDemande(null)}
        onConfirmer={async () => {
          if (!demande) return;
          await ecritureDemande.envoyer({ id: demande.commande.id });
          setDemande(null);
        }}
      />
    </div>
  );
}

/** components/dashboard/CommandeForm.tsx, dans un panneau. */
function NouvelleCommande({ boutiqueId, onFermer }: { boutiqueId: string; onFermer: () => void }) {
  const monnaie = useMonnaie();
  const clients = useClientsActifs(boutiqueId);
  const produits = useProduits(boutiqueId);
  const creation = useEcriture({ appel: creerCommande, invalide: [["boutiques", boutiqueId]] });
  const [clientId, setClientId] = useState("");
  const [terme, setTerme] = useState<TermePaiement>("comptant");
  const [codePromo, setCodePromo] = useState("");
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const totalBrut = lignes.reduce((s, l) => s + (lireNombre(l.quantite) || 0) * (lireNombre(l.prix) || 0), 0);

  async function envoyer() {
    if (!clientId) return setErreur("Choisissez un client");
    if (!lignes.length || lignes.some((l) => !l.produit_id)) return setErreur("Ajoutez au moins une ligne avec un produit");
    const invalide = lignesInvalides(lignes);
    if (invalide) return setErreur(invalide);
    setErreur(null);
    const resultat = await creation.envoyer({
      boutiqueId,
      client_id: clientId,
      terme_paiement: terme,
      ...(codePromo ? { code_promo: codePromo } : {}),
      ...(note ? { note } : {}),
      lignes: lignes.map((l) => ({ produit_id: l.produit_id, quantite: lireNombre(l.quantite), prix_unitaire: lireNombre(l.prix) })),
    });
    if (resultat) {
      setMessage(`Commande ${resultat.reference} enregistrée (${formatMontant(resultat.montantTotal, monnaie)})`);
      setClientId("");
      setTerme("comptant");
      setCodePromo("");
      setNote("");
      setLignes([]);
    }
  }

  return (
    <Panneau ouvert titre="Nouvelle commande grossiste" onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer="Créer la commande"
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? creation.erreur}
        enCours={creation.enCours}
        desactivee={creation.desactivee}
      >
        {message && <p className="m-0 rounded-bouton bg-succes-fond px-4 py-3 font-semibold text-succes">{message}</p>}
        <Selecteur
          libelle="Client"
          optionVide="— Choisir un client —"
          options={(clients.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <ChoixSegmente<TermePaiement>
          legende="Modalité de paiement"
          legendeVisible
          options={[
            { valeur: "comptant", libelle: "Comptant" },
            { valeur: "credit", libelle: "À crédit (encours)" },
          ]}
          valeur={terme}
          onChange={setTerme}
        />
        <Champ
          libelle="Code promo (facultatif)"
          placeholder="Ex. GROSSISTE25"
          value={codePromo}
          onChange={(e) => setCodePromo(e.target.value.toUpperCase())}
        />
        <LignesArticles
          lignes={lignes}
          onChange={setLignes}
          produits={(produits.data ?? []).map((p) => ({ produit_id: p.produit_id, nom: p.produit_nom }))}
          // Prix officiel de la boutique, modifiable.
          prixPropose={(id) => produits.data?.find((p) => p.produit_id === id)?.prix_vente}
          libellePrix="Prix unitaire"
        />
        <Champ libelle="Note (facultatif)" placeholder="Conditions de livraison, référence client…" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="m-0 text-courant">
          Total brut : <strong className="tabular-nums">{formatMontant(totalBrut, monnaie)}</strong>
        </p>
      </Formulaire>
    </Panneau>
  );
}
