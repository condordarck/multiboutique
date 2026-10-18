import { Badge, Carte, EtatVide, ListeAdaptative, TuileChiffre } from "@multiboutique/ui";
import { Navigate } from "react-router";
import { useMonnaie } from "../../api/generales";
import { useConsolidation } from "../../api/tableaux";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { formatMontant, formatNombre } from "../../commun/formats";
import { Lecture } from "../../commun/Lecture";
import { LienBouton } from "../../commun/LienBouton";
import { useSession } from "../../session/Session";

/** Pilotage du siège (app/(dashboard)/dashboard/consolidation/page.tsx). */
export function Consolidation() {
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const consolidation = useConsolidation();
  if (!peut("consolidation:voir")) return <Navigate to="/" replace />;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Consolidation siège"
        sousTitre="Vue de pilotage : indicateurs du jour, agrégés par groupe et par région."
      />
      <Lecture requete={consolidation}>
        {({ totaux, groupes, regions, boutiques }) => (
          <>
            <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
              <TuileChiffre libelle="Ventes aujourd'hui" valeur={formatNombre(totaux.ventes)} />
              <TuileChiffre libelle="Chiffre d'affaires du jour" valeur={formatMontant(totaux.chiffre_affaires, monnaie)} />
              <TuileChiffre libelle="Encours clients (crédit)" valeur={formatMontant(totaux.encours, monnaie)} />
              <TuileChiffre libelle="Commandes grossistes à valider" valeur={formatNombre(totaux.commandes_attente)} />
            </div>
            <div className="grid grid-cols-1 gap-4 bureau:grid-cols-2">
              <Carte titre="Par groupe">
                <ListeAdaptative
                  legende="Par groupe"
                  lignes={groupes}
                  cleLigne={(g) => g.nom}
                  vide={<EtatVide message="Aucune donnée" />}
                  colonnes={[
                    { cle: "nom", libelle: "Groupe", rendu: (g) => g.nom, principale: true },
                    { cle: "boutiques", libelle: "Boutiques", rendu: (g) => g.boutiques.length, alignement: "fin" },
                    { cle: "ventes", libelle: "Ventes", rendu: (g) => formatNombre(g.ventes), alignement: "fin" },
                    { cle: "ca", libelle: "CA", rendu: (g) => formatMontant(g.ca, monnaie), alignement: "fin" },
                  ]}
                />
              </Carte>
              <Carte titre="Par région">
                <ListeAdaptative
                  legende="Par région"
                  lignes={regions}
                  cleLigne={(r) => r.nom}
                  vide={<EtatVide message="Aucune donnée" />}
                  colonnes={[
                    { cle: "nom", libelle: "Région", rendu: (r) => r.nom, principale: true },
                    { cle: "groupe", libelle: "Groupe", rendu: (r) => r.groupe ?? "—" },
                    { cle: "boutiques", libelle: "Boutiques", rendu: (r) => r.boutiques.length, alignement: "fin" },
                    { cle: "ventes", libelle: "Ventes", rendu: (r) => formatNombre(r.ventes), alignement: "fin" },
                    { cle: "ca", libelle: "CA", rendu: (r) => formatMontant(r.ca, monnaie), alignement: "fin" },
                  ]}
                />
              </Carte>
            </div>
            <Carte titre="Détail par boutique">
              <ListeAdaptative
                legende="Détail par boutique"
                lignes={boutiques}
                cleLigne={(b) => b.boutique_id}
                vide={<EtatVide message="Aucune boutique active" />}
                colonnes={[
                  { cle: "nom", libelle: "Boutique", rendu: (b) => b.boutique_nom, principale: true },
                  { cle: "groupe", libelle: "Groupe", rendu: (b) => b.groupe_nom || "—" },
                  { cle: "region", libelle: "Région", rendu: (b) => b.region_nom || "—" },
                  { cle: "ventes", libelle: "Ventes", rendu: (b) => formatNombre(b.nombre_ventes), alignement: "fin" },
                  { cle: "ca", libelle: "CA du jour", rendu: (b) => formatMontant(b.chiffre_affaires || 0, monnaie), alignement: "fin" },
                  {
                    cle: "encours",
                    libelle: "Encours",
                    rendu: (b) => (Number(b.encours_total) > 0 ? formatMontant(b.encours_total, monnaie) : "—"),
                    alignement: "fin",
                  },
                  {
                    cle: "commandes",
                    libelle: "Cmd. à valider",
                    rendu: (b) => (Number(b.commandes_attente) > 0 ? <Badge ton="alerte">{String(b.commandes_attente)}</Badge> : "—"),
                  },
                  {
                    cle: "alertes",
                    libelle: "Alertes",
                    rendu: (b) => (Number(b.alertes_stock) > 0 ? <Badge ton="danger">{String(b.alertes_stock)}</Badge> : "—"),
                  },
                ]}
                libelleAction="Ouvrir"
                action={(b) => (
                  <LienBouton to={`/b/${b.boutique_id}`} aria-label={`Ouvrir ${b.boutique_nom}`}>
                    Ouvrir
                  </LienBouton>
                )}
              />
            </Carte>
          </>
        )}
      </Lecture>
    </div>
  );
}
