import { Badge, Carte, ListeAdaptative, TuileChiffre } from "@multiboutique/ui";
import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Link, useParams } from "react-router";
import { useMonnaie } from "../../api/generales";
import { useBoutique, useResumeBoutique } from "../../api/tableaux";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { formatMontant, formatNombre } from "../../commun/formats";
import { Lecture } from "../../commun/Lecture";
import { LienBouton } from "../../commun/LienBouton";
import { IconeReservations, IconeStock, IconeVentes } from "../../icones";
import { useSession } from "../../session/Session";

function Raccourci({ to, icone, titre, texte }: { to: string; icone: ReactNode; titre: string; texte: string }) {
  return (
    <Link
      to={to}
      className={clsx(
        "flex min-h-20 min-w-0 items-center gap-4 rounded-carte bg-surface px-5 py-4 text-texte no-underline shadow-carte hover:bg-surface-relevee",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-bouton bg-primaire-fond text-primaire">{icone}</span>
      <span className="flex flex-col">
        <span className="font-bold">{titre}</span>
        <span className="text-libelle text-texte-discret">{texte}</span>
      </span>
    </Link>
  );
}

/** Vue d'ensemble d'une boutique (app/(dashboard)/dashboard/[boutiqueId]/page.tsx). */
export function VueBoutique() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const resume = useResumeBoutique(boutiqueId);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <Lecture requete={boutique}>
        {(b) => <EnTeteEcran titre={b.nom} sousTitre={b.adresse ?? undefined} />}
      </Lecture>
      <Lecture requete={resume}>
        {({ resume: r, dernieres_ventes, reservations_en_attente, alertes_stock }) => (
          <>
            <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
              <TuileChiffre libelle="Ventes aujourd'hui" valeur={formatNombre(r?.nombre_ventes ?? 0)} />
              <TuileChiffre libelle="Chiffre d'affaires" valeur={formatMontant(r?.chiffre_affaires ?? 0, monnaie)} />
              <TuileChiffre libelle="Réservations en attente" valeur={formatNombre(r?.reservations_en_attente ?? 0)} />
              <TuileChiffre
                libelle="Alertes stock"
                valeur={formatNombre(r?.alertes_stock ?? 0)}
                miseEnAvant={Number(r?.alertes_stock) > 0}
              />
            </div>

            {/* Raccourcis du monolithe, limités à ce que le profil peut ouvrir. */}
            <div className="grid grid-cols-1 gap-4 tablette:grid-cols-3">
              {peut("ventes:creer") && (
                <Raccourci
                  to={`/b/${boutiqueId}/ventes/nouvelle`}
                  icone={<IconeVentes />}
                  titre="Nouvelle vente"
                  texte="Enregistrer une vente au comptoir"
                />
              )}
              {peut("stock:voir") && (
                <Raccourci
                  to={`/b/${boutiqueId}/stock`}
                  icone={<IconeStock />}
                  titre="Réception stock"
                  texte="Enregistrer une entrée de marchandise"
                />
              )}
              {peut("reservations:voir") && (
                <Raccourci
                  to={`/b/${boutiqueId}/reservations`}
                  icone={<IconeReservations />}
                  titre="Réservations"
                  texte="Voir les commandes en attente"
                />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 bureau:grid-cols-2">
              <Carte
                titre="Dernières ventes"
                action={peut("ventes:voir") && <LienBouton to={`/b/${boutiqueId}/ventes`}>Tout voir</LienBouton>}
              >
                {dernieres_ventes.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {dernieres_ventes.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 rounded-bouton bg-surface-relevee px-4 py-3">
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">{v.reference_vente}</span>
                          <span className="text-mention text-texte-discret">
                            {new Date(v.created_at).toLocaleString("fr-FR")} — {v.vendeur_nom}
                          </span>
                        </span>
                        <span className="font-bold tabular-nums text-succes">{formatMontant(v.montant_total, monnaie)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 py-4 text-center text-texte-discret">Aucune vente aujourd'hui</p>
                )}
              </Carte>
              <Carte
                titre="Réservations en attente"
                action={peut("reservations:voir") && <LienBouton to={`/b/${boutiqueId}/reservations`}>Tout voir</LienBouton>}
              >
                {reservations_en_attente.length > 0 ? (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {reservations_en_attente.map((res) => (
                      <li key={res.id} className="flex items-center justify-between gap-3 rounded-bouton bg-alerte-fond px-4 py-3">
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">{res.reference_reservation}</span>
                          <span className="text-mention text-texte-discret">
                            {res.client_nom} — {res.client_telephone}
                          </span>
                        </span>
                        <span className="font-bold tabular-nums text-alerte">{formatMontant(res.montant_total, monnaie)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="m-0 py-4 text-center text-texte-discret">Aucune réservation en attente</p>
                )}
              </Carte>
            </div>

            {alertes_stock.length > 0 && (
              <Carte titre="Alertes stock">
                <ListeAdaptative
                  legende="Alertes stock"
                  lignes={alertes_stock}
                  cleLigne={(a) => a.id}
                  vide={null}
                  colonnes={[
                    { cle: "produit", libelle: "Produit", rendu: (a) => a.produit_nom, principale: true },
                    { cle: "ref", libelle: "Réf.", rendu: (a) => a.produit_reference },
                    { cle: "disponible", libelle: "Disponible", rendu: (a) => formatNombre(a.disponible), alignement: "fin" },
                    { cle: "seuil", libelle: "Seuil", rendu: (a) => formatNombre(a.seuil_alerte), alignement: "fin" },
                    {
                      cle: "statut",
                      libelle: "Statut",
                      rendu: (a) =>
                        a.statut_stock === "rupture" ? <Badge ton="danger">Rupture</Badge> : <Badge ton="alerte">Stock bas</Badge>,
                    },
                  ]}
                />
              </Carte>
            )}
          </>
        )}
      </Lecture>
    </div>
  );
}
