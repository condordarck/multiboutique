import type { Rapport } from "@multiboutique/shared";
import { Bouton, Carte, Champ, ListeAdaptative, EtatVide, Selecteur, TuileChiffre } from "@multiboutique/ui";
import { useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router";
import { useMonnaie } from "../../api/generales";
import { useRapport } from "../../api/rapports";
import { useBoutique } from "../../api/tableaux";
import { LIBELLES_PAIEMENT } from "../../api/ventes";
import { EnTeteEcran, formatMontant, formatNombre, Lecture } from "@multiboutique/front";

const PERIODES = [
  { valeur: "jour", libelle: "Journalier" },
  { valeur: "semaine", libelle: "Hebdomadaire" },
  { valeur: "mois", libelle: "Mensuel" },
  { valeur: "annee", libelle: "Annuel" },
  { valeur: "personnalisee", libelle: "Personnalisée" },
];

const jj = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** Titre du rapport, comme etiquettes() du monolithe ; la fin renvoyée par l'API est exclue. */
function titre(r: Rapport): string {
  const debut = new Date(r.debut);
  const dernier = new Date(new Date(r.fin).getTime() - 86_400_000);
  switch (r.periode) {
    case "jour":
      return `Rapport journalier — ${jj(debut)}`;
    case "semaine":
      return `Rapport hebdomadaire — ${jj(debut)} au ${jj(dernier)}`;
    case "mois":
      return `Rapport mensuel — ${jj(debut)} au ${jj(dernier)}`;
    case "annee":
      return `Rapport annuel — ${debut.getFullYear()}`;
    default:
      return `Rapport personnalisé — ${jj(debut)} au ${jj(dernier)}`;
  }
}

/** Rapports de période (app/(dashboard)/dashboard/[boutiqueId]/rapports/page.tsx). */
export function Rapports() {
  const { boutiqueId = "" } = useParams();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const [parametres, setParametres] = useSearchParams();
  const periode = parametres.get("periode") ?? "mois";
  const debut = parametres.get("debut") ?? "";
  const fin = parametres.get("fin") ?? "";
  const rapport = useRapport(boutiqueId, { periode, debut, fin });
  const [saisie, setSaisie] = useState({ periode, debut, fin });

  function generer(evenement: FormEvent) {
    evenement.preventDefault();
    const p = new URLSearchParams({ periode: saisie.periode });
    if (saisie.debut) p.set("debut", saisie.debut);
    if (saisie.fin) p.set("fin", saisie.fin);
    setParametres(p, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran titre={`Rapports — ${boutique.data?.nom ?? ""}`} sousTitre="Choisissez la période puis « Générer le rapport »" />
      <Carte>
        <form onSubmit={generer} className="grid grid-cols-1 gap-4 tablette:grid-cols-3 tablette:items-end">
          <Selecteur libelle="Période" options={PERIODES} value={saisie.periode} onChange={(e) => setSaisie((s) => ({ ...s, periode: e.target.value }))} />
          <Champ libelle="Du" type="date" value={saisie.debut} onChange={(e) => setSaisie((s) => ({ ...s, debut: e.target.value }))} />
          <Champ libelle="Au" type="date" value={saisie.fin} onChange={(e) => setSaisie((s) => ({ ...s, fin: e.target.value }))} />
          <div className="flex flex-wrap gap-3 tablette:col-span-3">
            <Bouton type="submit">Générer le rapport</Bouton>
            <Bouton variante="secondaire" onClick={() => window.print()}>
              Imprimer / PDF
            </Bouton>
          </div>
        </form>
        <p className="m-0 text-mention text-texte-discret">
          Astuce : pour une période précise, choisissez « Personnalisée » et renseignez les dates « Du » / « Au ».
        </p>
      </Carte>

      <Lecture requete={rapport}>
        {(r) => {
          const ca = Number(r.totaux.ca) || 0;
          return (
            <div className="zone-impression flex flex-col gap-5">
              <div>
                <h2 className="m-0 font-titre text-panneau font-bold">{titre(r)}</h2>
                <p className="m-0 text-libelle text-texte-discret">Boutique : {boutique.data?.nom}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
                <TuileChiffre libelle="Ventes validées" valeur={formatNombre(r.totaux.nb_ventes)} />
                <TuileChiffre libelle="Chiffre d'affaires" valeur={formatMontant(ca, monnaie)} />
                <TuileChiffre
                  libelle="Panier moyen"
                  valeur={`${Number(r.totaux.panier_moyen).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${monnaie}`}
                />
                <TuileChiffre libelle="Remises accordées" valeur={formatMontant(r.totaux.remises, monnaie)} />
              </div>
              <Carte titre="Ventes par jour" niveauTitre={3}>
                <ListeAdaptative
                  legende="Ventes par jour"
                  lignes={r.par_jour}
                  cleLigne={(j) => j.jour}
                  vide={<EtatVide message="Aucune vente sur cette période" />}
                  colonnes={[
                    { cle: "date", libelle: "Date", rendu: (j) => j.jour, principale: true },
                    { cle: "ventes", libelle: "Ventes", rendu: (j) => formatNombre(j.nb), alignement: "fin" },
                    { cle: "ca", libelle: "Chiffre d'affaires", rendu: (j) => formatMontant(j.ca, monnaie), alignement: "fin" },
                  ]}
                />
              </Carte>
              <div className="grid grid-cols-1 gap-4 bureau:grid-cols-2">
                <Carte titre="Modes de paiement" niveauTitre={3}>
                  {r.par_mode.length === 0 ? (
                    <p className="m-0 text-texte-discret">Aucun paiement sur cette période</p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-3 p-0">
                      {r.par_mode.map((m) => {
                        const part = ca > 0 ? (Number(m.ca) / ca) * 100 : 0;
                        const libelle = LIBELLES_PAIEMENT[m.mode_paiement] ?? (m.mode_paiement === "autre" ? "Autre" : m.mode_paiement);
                        return (
                          <li key={m.mode_paiement} className="flex flex-col gap-1">
                            <span className="flex justify-between gap-3 text-libelle">
                              <span className="font-semibold">{libelle}</span>
                              <span className="tabular-nums">{formatMontant(m.ca, monnaie)}</span>
                            </span>
                            <div
                              role="meter"
                              aria-label={libelle}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(part)}
                              aria-valuetext={`${Math.round(part)} % du chiffre d'affaires`}
                              className="h-2.5 overflow-hidden rounded-full bg-neutre-fond"
                            >
                              <div className="h-full rounded-full bg-primaire" style={{ width: `${part}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Carte>
                <Carte titre="Top produits (CA)" niveauTitre={3}>
                  <ListeAdaptative
                    legende="Top produits (CA)"
                    lignes={r.top_produits}
                    cleLigne={(p) => p.nom}
                    vide={<EtatVide message="Aucune vente sur cette période" />}
                    colonnes={[
                      { cle: "produit", libelle: "Produit", rendu: (p) => p.nom, principale: true },
                      { cle: "qte", libelle: "Qté", rendu: (p) => formatNombre(p.qte), alignement: "fin" },
                      { cle: "ca", libelle: "CA", rendu: (p) => formatMontant(p.ca, monnaie), alignement: "fin" },
                    ]}
                  />
                </Carte>
              </div>
              <Carte titre="Réservations" niveauTitre={3}>
                <div className="grid grid-cols-2 gap-3">
                  <TuileChiffre libelle="Réservations créées" valeur={formatNombre(r.reservations.nb)} />
                  <TuileChiffre libelle="Montant réservé" valeur={formatMontant(r.reservations.montant, monnaie)} />
                </div>
              </Carte>
            </div>
          );
        }}
      </Lecture>
    </div>
  );
}
