import type { CommandeFournisseurListee, Fournisseur, StatutCmdFournisseur } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, Dialogue, Panneau, Selecteur, TuileChiffre, type TonBadge } from "@multiboutique/ui";
import { useState } from "react";
import { useParams } from "react-router";
import {
  annulerCommandeFournisseur,
  creerCommandeFournisseur,
  creerFournisseur,
  modifierCommandeFournisseur,
  modifierFournisseur,
  recevoirCommandeFournisseur,
  toggleActifFournisseur,
  useCommandesFournisseurs,
  useFournisseurs,
  type FournisseurSaisi,
} from "../../api/achats";
import { useProduits } from "../../api/catalogue";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { EnTeteEcran, formatMontant, formatNombre, Formulaire, lireEntier, lireNombre, ListeChargee, useEcriture, useSession } from "@multiboutique/front";
import { avecProduitsCommandes, LignesArticles, lignesInvalides, type LigneSaisie } from "../../commun/LignesArticles";

const STATUTS: Record<StatutCmdFournisseur, { libelle: string; ton: TonBadge }> = {
  en_attente: { libelle: "En attente", ton: "alerte" },
  partielle: { libelle: "Partielle", ton: "info" },
  recue: { libelle: "Réceptionnée", ton: "succes" },
  annulee: { libelle: "Annulée", ton: "danger" },
};

/** Fournisseurs, commandes d'achat et réceptions (app/(dashboard)/dashboard/[boutiqueId]/achats/page.tsx). */
export function Achats() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const fournisseurs = useFournisseurs(boutiqueId);
  const commandes = useCommandesFournisseurs(boutiqueId);
  const peutGerer = peut("achats:gerer");
  const peutModifier = peut("achats:modifier");
  const invalide = [["boutiques", boutiqueId]];
  const annulation = useEcriture({ appel: annulerCommandeFournisseur, invalide, succes: "Commande fournisseur annulée" });
  const activation = useEcriture({ appel: toggleActifFournisseur, invalide });
  const [reception, setReception] = useState<CommandeFournisseurListee | null>(null);
  const [aAnnuler, setAAnnuler] = useState<CommandeFournisseurListee | null>(null);
  const [fiche, setFiche] = useState<Fournisseur | "nouveau" | null>(null);
  const [ficheCommande, setFicheCommande] = useState<CommandeFournisseurListee | "nouvelle" | null>(null);

  const liste = commandes.data ?? [];
  const enCours = liste.filter((c) => c.statut === "en_attente" || c.statut === "partielle");
  const engage = enCours.reduce((s, c) => s + (Number(c.total_attendu) || 0), 0);
  const erreur = annulation.erreur ?? activation.erreur;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre={`Achats — ${boutique.data?.nom ?? ""}`}
        sousTitre="Fournisseurs, commandes d'achat et réceptions (entrée de stock)"
        actions={
          peutGerer && (
            <>
              <Bouton onClick={() => setFicheCommande("nouvelle")}>Nouvelle commande fournisseur</Bouton>
              <Bouton variante="secondaire" onClick={() => setFiche("nouveau")}>
                Nouveau fournisseur
              </Bouton>
            </>
          )
        }
      />
      <div className="grid grid-cols-2 gap-3 tablette:grid-cols-3 tablette:gap-4">
        <TuileChiffre libelle="Fournisseurs" valeur={formatNombre(fournisseurs.data?.length ?? 0)} />
        <TuileChiffre libelle="Commandes en cours" valeur={formatNombre(liste.filter((c) => c.statut !== "annulee" && c.statut !== "recue").length)} />
        <TuileChiffre libelle="Engagé (en cours)" valeur={formatMontant(engage, monnaie)} />
      </div>
      {erreur && (
        <p role="alert" className="m-0 font-semibold text-danger">
          {erreur}
        </p>
      )}

      <Carte titre="Commandes fournisseur">
        {!peutGerer && !peutModifier && (
          <p className="m-0 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle text-texte-discret">
            Lecture seule — la gestion des achats est réservée au gérant et au propriétaire.
          </p>
        )}
        <ListeChargee
          legende="Commandes fournisseur"
          requete={commandes}
          cleLigne={(c) => c.id}
          vide="Aucune commande fournisseur"
          colonnes={[
            { cle: "reference", libelle: "Référence", rendu: (c) => c.reference_cmd, principale: true },
            { cle: "fournisseur", libelle: "Fournisseur", rendu: (c) => c.fournisseur_nom },
            { cle: "articles", libelle: "Articles", rendu: (c) => `${c.nb_lignes} ligne${c.nb_lignes > 1 ? "s" : ""}` },
            { cle: "total", libelle: "Total attendu", rendu: (c) => formatMontant(c.total_attendu, monnaie), alignement: "fin" },
            {
              cle: "reception",
              libelle: "Réception",
              rendu: (c) => {
                const recu = c.lignes.reduce((s, l) => s + Number(l.quantite_recue), 0);
                const commande = c.lignes.reduce((s, l) => s + Number(l.quantite_commandee), 0);
                return `${recu} / ${commande} unité${commande > 1 ? "s" : ""}`;
              },
            },
            { cle: "statut", libelle: "Statut", rendu: (c) => <Badge ton={STATUTS[c.statut].ton}>{STATUTS[c.statut].libelle}</Badge> },
          ]}
          libelleAction="Actions"
          action={
            peutGerer || peutModifier
              ? (c) => (
                  <span className="flex flex-wrap justify-end gap-1">
                    {/* Modification tant que rien n'est reçu, comme l'annulation. */}
                    {peutModifier && c.statut === "en_attente" && (
                      <Bouton variante="discret" aria-label={`Modifier ${c.reference_cmd}`} onClick={() => setFicheCommande(c)}>
                        Modifier
                      </Bouton>
                    )}
                    {/* Comme le monolithe : réception tant que la commande est ouverte, annulation tant que rien n'est reçu. */}
                    {peutGerer && (c.statut === "en_attente" || c.statut === "partielle") && (
                      <Bouton variante="discret" aria-label={`Réceptionner ${c.reference_cmd}`} onClick={() => setReception(c)}>
                        Réceptionner
                      </Bouton>
                    )}
                    {peutGerer && c.statut === "en_attente" && (
                      <Bouton variante="discret" aria-label={`Annuler ${c.reference_cmd}`} onClick={() => setAAnnuler(c)}>
                        Annuler
                      </Bouton>
                    )}
                  </span>
                )
              : undefined
          }
        />
      </Carte>

      <Carte titre="Fournisseurs">
        <ListeChargee
          legende="Fournisseurs"
          requete={fournisseurs}
          cleLigne={(f) => f.id}
          vide="Aucun fournisseur"
          colonnes={[
            {
              cle: "nom",
              libelle: "Fournisseur",
              principale: true,
              rendu: (f) => (
                <span className="flex flex-col">
                  <span>{f.nom}</span>
                  {f.adresse && <span className="text-mention font-normal text-texte-discret">{f.adresse}</span>}
                </span>
              ),
            },
            { cle: "contact", libelle: "Contact", rendu: (f) => [f.telephone, f.email].filter(Boolean).join(" · ") || "—" },
            { cle: "statut", libelle: "Statut", rendu: (f) => (f.actif ? <Badge ton="succes">Actif</Badge> : <Badge ton="danger">Inactif</Badge>) },
          ]}
          libelleAction="Actions"
          action={
            peutGerer
              ? (f) => (
                  <span className="flex flex-wrap justify-end gap-1">
                    <Bouton variante="discret" aria-label={`Modifier ${f.nom}`} onClick={() => setFiche(f)}>
                      Modifier
                    </Bouton>
                    <Bouton
                      variante="discret"
                      aria-label={`${f.actif ? "Désactiver" : "Réactiver"} ${f.nom}`}
                      disabled={activation.desactivee}
                      // Le service inverse l'état : un double appui l'annulerait.
                      chargement={activation.enCours}
                      onClick={() => void activation.envoyer({ boutiqueId, fournisseurId: f.id })}
                    >
                      {f.actif ? "Désactiver" : "Réactiver"}
                    </Bouton>
                  </span>
                )
              : undefined
          }
        />
      </Carte>

      {reception && <Reception commande={reception} boutiqueId={boutiqueId} onFermer={() => setReception(null)} />}
      {fiche && <FicheFournisseur boutiqueId={boutiqueId} fournisseur={fiche === "nouveau" ? null : fiche} onFermer={() => setFiche(null)} />}
      {ficheCommande && (
        <FicheCommandeFournisseur
          boutiqueId={boutiqueId}
          commande={ficheCommande === "nouvelle" ? null : ficheCommande}
          fournisseurs={(fournisseurs.data ?? []).filter((f) => f.actif)}
          onFermer={() => setFicheCommande(null)}
        />
      )}
      <Dialogue
        ouvert={!!aAnnuler}
        titre={`Annuler la commande fournisseur ${aAnnuler?.reference_cmd ?? ""} ?`}
        libelleConfirmer="Annuler la commande"
        libelleAnnuler="Revenir"
        variante="danger"
        chargement={annulation.enCours}
        onAnnuler={() => setAAnnuler(null)}
        onConfirmer={async () => {
          if (aAnnuler) await annulation.envoyer({ id: aAnnuler.id });
          setAAnnuler(null);
        }}
      />
    </div>
  );
}

/** components/dashboard/CommandeFournisseurActions.tsx (réception), dans un panneau. */
function Reception({ commande, boutiqueId, onFermer }: { commande: CommandeFournisseurListee; boutiqueId: string; onFermer: () => void }) {
  const reception = useEcriture({ appel: recevoirCommandeFournisseur, invalide: [["boutiques", boutiqueId]], succes: "Réception enregistrée, stock à jour" });
  const [saisies, setSaisies] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    const remplies = Object.entries(saisies).filter(([, q]) => q.trim());
    for (const [ligne_id, q] of remplies) {
      const ligne = commande.lignes.find((l) => l.ligne_id === ligne_id)!;
      const restant = Number(ligne.quantite_commandee) - Number(ligne.quantite_recue);
      const n = lireEntier(q, 0);
      if (Number.isNaN(n) || n > restant) return setErreur(`${ligne.produit_nom} : entre 0 et ${restant} unités`);
    }
    const receptions = remplies
      .map(([ligne_id, q]) => ({ ligne_id, quantite_recue: lireEntier(q, 0) }))
      .filter((r) => r.quantite_recue > 0);
    if (!receptions.length) return setErreur("Entrez au moins une quantité reçue");
    setErreur(null);
    if (await reception.envoyer({ id: commande.id, receptions })) onFermer();
  }

  return (
    <Panneau ouvert titre={`Réception — ${commande.reference_cmd}`} onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer="Valider la réception"
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? reception.erreur}
        enCours={reception.enCours}
        desactivee={reception.desactivee}
      >
        {commande.lignes.map((l) => {
          const restant = Number(l.quantite_commandee) - Number(l.quantite_recue);
          return (
            <Champ
              key={l.ligne_id}
              libelle={`${l.produit_nom} — reçu ${l.quantite_recue} / ${l.quantite_commandee}`}
              type="nombre"
              placeholder={`Max ${restant}`}
              disabled={restant <= 0}
              value={saisies[l.ligne_id] ?? ""}
              onChange={(e) => setSaisies((s) => ({ ...s, [l.ligne_id]: e.target.value }))}
            />
          );
        })}
      </Formulaire>
    </Panneau>
  );
}

/** FournisseurForm.tsx et l'édition de FournisseurActions.tsx. */
function FicheFournisseur({ boutiqueId, fournisseur, onFermer }: { boutiqueId: string; fournisseur: Fournisseur | null; onFermer: () => void }) {
  const invalide = [["boutiques", boutiqueId]];
  const creation = useEcriture({ appel: creerFournisseur, invalide, succes: "Fournisseur ajouté" });
  const modification = useEcriture({ appel: modifierFournisseur, invalide, succes: "Fournisseur modifié" });
  const ecriture = fournisseur ? modification : creation;
  const [f, setF] = useState({
    nom: fournisseur?.nom ?? "",
    telephone: fournisseur?.telephone ?? "",
    email: fournisseur?.email ?? "",
    adresse: fournisseur?.adresse ?? "",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  async function envoyer() {
    if (!f.nom.trim()) return setErreur("Le nom est requis");
    setErreur(null);
    const donnees: FournisseurSaisi = {
      nom: f.nom,
      ...(f.telephone ? { telephone: f.telephone } : {}),
      ...(f.email ? { email: f.email } : {}),
      ...(f.adresse ? { adresse: f.adresse } : {}),
    };
    const ok = fournisseur
      ? await modification.envoyer({ ...donnees, boutiqueId, fournisseurId: fournisseur.id })
      : await creation.envoyer({ ...donnees, boutiqueId });
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={fournisseur ? fournisseur.nom : "Nouveau fournisseur"} onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer={fournisseur ? "Enregistrer" : "Ajouter le fournisseur"}
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? ecriture.erreur}
        enCours={ecriture.enCours}
        desactivee={ecriture.desactivee}
      >
        <Champ libelle="Nom" required value={f.nom} onChange={maj("nom")} />
        <Champ libelle="Téléphone" inputMode="tel" value={f.telephone} onChange={maj("telephone")} />
        <Champ libelle="E-mail" type="email" value={f.email} onChange={maj("email")} />
        <Champ libelle="Adresse" value={f.adresse} onChange={maj("adresse")} />
      </Formulaire>
    </Panneau>
  );
}

/** Nouvelle commande d'achat ; avec une commande, sa modification tant que rien n'est reçu (fournisseur inchangé). */
function FicheCommandeFournisseur({
  boutiqueId,
  commande,
  fournisseurs,
  onFermer,
}: {
  boutiqueId: string;
  commande: CommandeFournisseurListee | null;
  fournisseurs: Fournisseur[];
  onFermer: () => void;
}) {
  const monnaie = useMonnaie();
  const produits = useProduits(boutiqueId);
  const invalide = [["boutiques", boutiqueId]];
  const creation = useEcriture({ appel: creerCommandeFournisseur, invalide });
  const modification = useEcriture({ appel: modifierCommandeFournisseur, invalide, succes: `Commande fournisseur ${commande?.reference_cmd ?? ""} modifiée` });
  const ecriture = commande ? modification : creation;
  const [fournisseurId, setFournisseurId] = useState("");
  const [note, setNote] = useState(commande?.note ?? "");
  const [lignes, setLignes] = useState<LigneSaisie[]>(
    (commande?.lignes ?? []).map((l) => ({ produit_id: l.produit_id, quantite: String(l.quantite_commandee), prix: String(l.prix_unitaire ?? "") }))
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const total = lignes.reduce((s, l) => s + (lireNombre(l.quantite) || 0) * (lireNombre(l.prix) || 0), 0);
  const titre = commande ? `Modifier ${commande.reference_cmd}` : "Nouvelle commande fournisseur";

  if (!commande && (!fournisseurs.length || !produits.data?.length)) {
    return (
      <Panneau ouvert titre={titre} onFermer={onFermer}>
        <p className="m-0 text-texte-discret">
          Ajoutez d'abord un fournisseur et configurez le prix des produits dans Produits pour pouvoir commander.
        </p>
      </Panneau>
    );
  }

  async function envoyer() {
    if (!commande && !fournisseurId) return setErreur("Choisissez un fournisseur");
    if (!lignes.length || lignes.some((l) => !l.produit_id)) return setErreur("Ajoutez au moins une ligne avec un produit");
    const invalide = lignesInvalides(lignes);
    if (invalide) return setErreur(invalide);
    setErreur(null);
    const lignesEnvoyees = lignes.map((l) => ({ produit_id: l.produit_id, quantite: lireNombre(l.quantite), prix_unitaire: lireNombre(l.prix) || 0 }));
    if (commande) {
      if (await modification.envoyer({ id: commande.id, note, lignes: lignesEnvoyees })) onFermer();
      return;
    }
    const resultat = await creation.envoyer({
      boutiqueId,
      fournisseur_id: fournisseurId,
      ...(note ? { note } : {}),
      lignes: lignesEnvoyees,
    });
    if (resultat) {
      setMessage(`Commande fournisseur ${resultat.reference} enregistrée`);
      setFournisseurId("");
      setNote("");
      setLignes([]);
    }
  }

  return (
    <Panneau ouvert titre={titre} onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer={commande ? "Enregistrer les modifications" : "Créer la commande"}
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? ecriture.erreur}
        enCours={ecriture.enCours}
        desactivee={ecriture.desactivee}
      >
        {message && <p className="m-0 rounded-bouton bg-succes-fond px-4 py-3 font-semibold text-succes">{message}</p>}
        {commande ? (
          <p className="m-0 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle">
            Fournisseur : <strong>{commande.fournisseur_nom}</strong>
          </p>
        ) : (
          <Selecteur
            libelle="Fournisseur"
            optionVide="— Choisir un fournisseur —"
            options={fournisseurs.map((f) => ({ valeur: f.id, libelle: f.nom }))}
            value={fournisseurId}
            onChange={(e) => setFournisseurId(e.target.value)}
          />
        )}
        <LignesArticles
          lignes={lignes}
          onChange={setLignes}
          produits={avecProduitsCommandes(
            (produits.data ?? []).map((p) => ({ produit_id: p.produit_id, nom: p.produit_nom })),
            commande?.lignes ?? []
          )}
          // Prix d'achat détaillé, sinon le coût de revient connu, comme prix d'achat proposé.
          prixPropose={(id) => {
            const p = produits.data?.find((l) => l.produit_id === id);
            return p?.prix_achat ?? p?.cout_revient;
          }}
          libellePrix="Prix d'achat"
        />
        <Champ libelle="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="m-0 text-courant">
          Total attendu : <strong className="tabular-nums">{formatMontant(total, monnaie)}</strong>
        </p>
      </Formulaire>
    </Panneau>
  );
}
