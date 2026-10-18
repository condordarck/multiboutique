import type { ResumeJour } from "@multiboutique/shared";
import { Badge, Carte, EtatVide, ListeAdaptative, TuileChiffre } from "@multiboutique/ui";
import { Navigate } from "react-router";
import { useMonnaie } from "../../api/generales";
import { useResumeGlobal } from "../../api/tableaux";
import { EnTeteEcran, formatMontant, formatNombre, Lecture, LienBouton, useUtilisateur } from "@multiboutique/front";

const somme = (lignes: ResumeJour[], champ: keyof ResumeJour) => lignes.reduce((a, r) => a + (Number(r[champ]) || 0), 0);

/** Vue consolidée du jour pour le propriétaire (app/(dashboard)/dashboard/page.tsx). */
export function TableauDeBord() {
  const utilisateur = useUtilisateur();
  const monnaie = useMonnaie();
  const resume = useResumeGlobal();
  if (utilisateur.role !== "proprietaire") return <Navigate to="/" replace />;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran titre="Tableau de bord" sousTitre="Vue consolidée de toutes vos boutiques" />
      <Lecture requete={resume}>
        {(lignes) => {
          const alertes = somme(lignes, "alertes_stock");
          return (
            <>
              <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
                <TuileChiffre libelle="Ventes aujourd'hui" valeur={formatNombre(somme(lignes, "nombre_ventes"))} />
                <TuileChiffre libelle="Chiffre d'affaires" valeur={formatMontant(somme(lignes, "chiffre_affaires"), monnaie)} />
                <TuileChiffre libelle="Réservations en attente" valeur={formatNombre(somme(lignes, "reservations_en_attente"))} />
                <TuileChiffre libelle="Alertes stock" valeur={formatNombre(alertes)} miseEnAvant={alertes > 0} />
              </div>
              <Carte titre="Résumé par boutique">
                <ListeAdaptative
                  legende="Résumé par boutique"
                  lignes={lignes}
                  cleLigne={(r) => r.boutique_id}
                  vide={<EtatVide message="Aucune boutique configurée" />}
                  colonnes={[
                    { cle: "nom", libelle: "Boutique", rendu: (r) => r.boutique_nom, principale: true },
                    { cle: "ventes", libelle: "Ventes", rendu: (r) => formatNombre(r.nombre_ventes), alignement: "fin" },
                    { cle: "ca", libelle: "CA du jour", rendu: (r) => formatMontant(r.chiffre_affaires || 0, monnaie), alignement: "fin" },
                    {
                      cle: "reservations",
                      libelle: "Réservations",
                      rendu: (r) =>
                        Number(r.reservations_en_attente) > 0 ? (
                          <Badge ton="alerte">{`${r.reservations_en_attente} en attente`}</Badge>
                        ) : (
                          "—"
                        ),
                    },
                    {
                      cle: "alertes",
                      libelle: "Alertes stock",
                      rendu: (r) =>
                        Number(r.alertes_stock) > 0 ? (
                          <Badge ton="danger">{`${r.alertes_stock} alertes`}</Badge>
                        ) : (
                          <Badge ton="succes">OK</Badge>
                        ),
                    },
                  ]}
                  libelleAction="Ouvrir"
                  action={(r) => (
                    <LienBouton to={`/b/${r.boutique_id}`} aria-label={`Voir ${r.boutique_nom}`}>
                      Voir
                    </LienBouton>
                  )}
                />
              </Carte>
            </>
          );
        }}
      </Lecture>
    </div>
  );
}
