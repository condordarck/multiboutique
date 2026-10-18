import { Badge, Carte, TuileChiffre } from "@multiboutique/ui";
import { useParams } from "react-router";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { LIBELLES_PAIEMENT, useStatistiquesVentes, useVentes } from "../../api/ventes";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { formatMontant, formatNombre } from "../../commun/formats";
import { ListeChargee } from "../../commun/ListeChargee";
import { LienBouton } from "../../commun/LienBouton";
import { useSession } from "../../session/Session";

export const BADGES_VENTE = {
  validee: <Badge ton="succes">Validée</Badge>,
  annulee: <Badge ton="danger">Annulée</Badge>,
  corrigee: <Badge ton="alerte">Corrigée</Badge>,
};

/** Historique des ventes (app/(dashboard)/dashboard/[boutiqueId]/ventes/page.tsx). */
export function Ventes() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const ventes = useVentes(boutiqueId);
  const stats = useStatistiquesVentes(boutiqueId).data;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre={`Ventes — ${boutique.data?.nom ?? ""}`}
        sousTitre="Encaissement et historique des ventes"
        actions={
          peut("ventes:creer") && (
            <LienBouton to={`/b/${boutiqueId}/ventes/nouvelle`} variante="primaire">
              Nouvelle vente
            </LienBouton>
          )
        }
      />
      {/* Calculés par l'API sur toutes les ventes validées (le monolithe filtrait
          les 50 dernières sur une date qui ne correspondait jamais). */}
      <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
        <TuileChiffre libelle="Ventes aujourd'hui" valeur={formatNombre(stats?.ventes_jour ?? 0)} />
        <TuileChiffre libelle="Ventes du mois" valeur={formatNombre(stats?.ventes_mois ?? 0)} />
        <TuileChiffre libelle="CA du jour" valeur={formatMontant(stats?.ca_jour ?? 0, monnaie)} />
        <TuileChiffre libelle="CA du mois" valeur={formatMontant(stats?.ca_mois ?? 0, monnaie)} />
      </div>
      <Carte>
        <ListeChargee
          legende="Historique des ventes"
          requete={ventes}
          cleLigne={(v) => v.id}
          vide="Aucune vente enregistrée"
          colonnes={[
            { cle: "reference", libelle: "Référence", rendu: (v) => v.reference_vente, principale: true },
            { cle: "date", libelle: "Date", rendu: (v) => new Date(v.created_at).toLocaleString("fr-FR") },
            { cle: "vendeur", libelle: "Vendeur", rendu: (v) => v.vendeur_nom },
            { cle: "montant", libelle: "Montant", rendu: (v) => formatMontant(v.montant_total, monnaie), alignement: "fin" },
            { cle: "paiement", libelle: "Paiement", rendu: (v) => LIBELLES_PAIEMENT[v.mode_paiement] ?? v.mode_paiement },
            { cle: "statut", libelle: "Statut", rendu: (v) => BADGES_VENTE[v.statut] },
          ]}
          libelleAction="Reçu"
          action={(v) => (
            <LienBouton to={`/b/${boutiqueId}/ventes/${v.id}`} aria-label={`Reçu de ${v.reference_vente}`}>
              Reçu
            </LienBouton>
          )}
        />
      </Carte>
    </div>
  );
}
