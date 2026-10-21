import type { TypeFraisAdmin } from "@multiboutique/shared";
import { Badge, Bouton, CaseACocher, Carte, Champ, Dialogue, Panneau } from "@multiboutique/ui";
import { useState } from "react";
import { creerTypeFrais, INVALIDE_ADMIN, modifierTypeFrais, supprimerTypeFrais, useTypesFraisAdmin } from "../../api/administration";
import { EnTeteEcran, formatNombre, Formulaire, ListeChargee, useEcriture } from "@multiboutique/front";

/** Types de frais du coût de revient (transport, douane, stockage…). */
export function TypesFraisAdmin() {
  const types = useTypesFraisAdmin();
  // Les types servent aussi aux panneaux de prix (GET /types-frais).
  const invalide = [...INVALIDE_ADMIN, ["types-frais"]];
  const suppression = useEcriture({ appel: supprimerTypeFrais, invalide, succes: "Type de frais supprimé" });
  const [fiche, setFiche] = useState<TypeFraisAdmin | "nouveau" | null>(null);
  const [aSupprimer, setASupprimer] = useState<TypeFraisAdmin | null>(null);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Types de frais"
        sousTitre="Frais ajoutés au prix d'achat pour obtenir le coût de revient. Un type utilisé par des prix ne peut être que désactivé."
        actions={<Bouton onClick={() => setFiche("nouveau")}>Créer un type de frais</Bouton>}
      />
      {suppression.erreur && (
        <p role="alert" className="m-0 font-semibold text-danger">
          {suppression.erreur}
        </p>
      )}
      <Carte>
        <ListeChargee
          legende="Types de frais"
          requete={types}
          cleLigne={(t) => t.id}
          vide="Aucun type de frais"
          colonnes={[
            { cle: "libelle", libelle: "Frais", rendu: (t) => t.libelle, principale: true },
            { cle: "statut", libelle: "Statut", rendu: (t) => (t.actif ? <Badge ton="succes">Actif</Badge> : <Badge ton="neutre">Désactivé</Badge>) },
            { cle: "prix", libelle: "Prix qui l'utilisent", rendu: (t) => formatNombre(t.nb_utilisations), alignement: "fin" },
          ]}
          libelleAction="Actions"
          action={(t) => (
            <span className="flex flex-wrap justify-end gap-1">
              <Bouton variante="discret" aria-label={`Modifier ${t.libelle}`} onClick={() => setFiche(t)}>
                Modifier
              </Bouton>
              <Bouton
                variante="discret"
                aria-label={`Supprimer ${t.libelle}`}
                title={t.nb_utilisations > 0 ? "Utilisé par des prix : désactivez-le plutôt" : undefined}
                disabled={t.nb_utilisations > 0}
                onClick={() => setASupprimer(t)}
              >
                Supprimer
              </Bouton>
            </span>
          )}
        />
      </Carte>
      {fiche && <FicheTypeFrais type={fiche === "nouveau" ? null : fiche} invalide={invalide} onFermer={() => setFiche(null)} />}
      <Dialogue
        ouvert={!!aSupprimer}
        titre={`Supprimer le type de frais « ${aSupprimer?.libelle ?? ""} » ?`}
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

function FicheTypeFrais({ type, invalide, onFermer }: { type: TypeFraisAdmin | null; invalide: (readonly string[])[]; onFermer: () => void }) {
  const creation = useEcriture({ appel: creerTypeFrais, invalide, succes: "Type de frais créé" });
  const modification = useEcriture({ appel: modifierTypeFrais, invalide, succes: "Type de frais modifié" });
  const ecriture = type ? modification : creation;
  const [libelle, setLibelle] = useState(type?.libelle ?? "");
  const [actif, setActif] = useState(type?.actif ?? true);

  async function envoyer() {
    const ok = type ? await modification.envoyer({ id: type.id, libelle, actif }) : await creation.envoyer({ libelle });
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={type ? type.libelle : "Créer un type de frais"} onFermer={onFermer}>
      <Formulaire libelleEnvoyer={type ? "Enregistrer" : "Créer le type de frais"} onEnvoyer={() => void envoyer()} erreur={ecriture.erreur} enCours={ecriture.enCours} desactivee={ecriture.desactivee}>
        <Champ libelle="Libellé" placeholder="Ex : Transport" required value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        {type && (
          <CaseACocher
            libelle="Proposé dans les prix"
            aide="Décoché : n'est plus proposé, mais reste sur les prix qui l'utilisent déjà."
            checked={actif}
            onChange={(e) => setActif(e.target.checked)}
          />
        )}
      </Formulaire>
    </Panneau>
  );
}
