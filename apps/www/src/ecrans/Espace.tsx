import { formatMontant, ListeChargee, LienBouton, useMonnaie, useUtilisateur } from "@multiboutique/front";
import { Badge, Carte, type TonBadge } from "@multiboutique/ui";
import { useMesReservations } from "../api/vitrine";

// Libellés courts de l'espace client du monolithe (client/page.tsx).
const STATUTS: Record<string, { libelle: string; ton: TonBadge }> = {
  en_attente: { libelle: "En attente", ton: "alerte" },
  prete: { libelle: "Prête", ton: "info" },
  payee: { libelle: "Payée", ton: "succes" },
  retiree: { libelle: "Retirée", ton: "succes" },
  annulee: { libelle: "Annulée", ton: "danger" },
};

/** app/(client)/client/page.tsx : le suivi des réservations du client connecté. */
export function Espace() {
  const utilisateur = useUtilisateur();
  const monnaie = useMonnaie();
  const reservations = useMesReservations();
  const enAttente = (reservations.data ?? []).filter((r) => r.statut === "en_attente").length;

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="m-0 font-titre text-[1.875rem] font-extrabold tracking-[-0.02em] tablette:text-ecran">{`Bonjour ${utilisateur.nom_complet}`}</h1>
        <p className="m-0 mt-1 text-courant text-texte-discret">Retrouvez ici le suivi de vos réservations en ligne.</p>
      </div>
      {enAttente > 0 && (
        <p className="m-0 rounded-bouton bg-alerte-fond px-4 py-3 font-semibold text-alerte">
          {`Vous avez ${enAttente} réservation${enAttente > 1 ? "s" : ""} en attente de retrait.`}
        </p>
      )}
      <Carte titre="Mes réservations">
        <ListeChargee
          legende="Mes réservations"
          requete={reservations}
          cleLigne={(r) => r.id}
          vide="Aucune réservation pour le moment"
          colonnes={[
            { cle: "reference", libelle: "Référence", rendu: (r) => r.reference_reservation, principale: true },
            { cle: "boutique", libelle: "Boutique", rendu: (r) => r.boutique_nom },
            { cle: "articles", libelle: "Articles", rendu: (r) => String(r.nombre_articles), alignement: "fin" },
            { cle: "montant", libelle: "Montant", rendu: (r) => formatMontant(r.montant_total, monnaie), alignement: "fin" },
            {
              cle: "statut",
              libelle: "Statut",
              rendu: (r) => <Badge ton={STATUTS[r.statut]?.ton ?? "neutre"}>{STATUTS[r.statut]?.libelle ?? r.statut}</Badge>,
            },
            { cle: "date", libelle: "Date", rendu: (r) => new Date(r.created_at).toLocaleDateString("fr-FR") },
          ]}
          libelleAction="Suivi"
          action={(r) => (
            <LienBouton to={`/reservations/${r.id}`} aria-label={`Suivre ${r.reference_reservation}`}>
              Suivre
            </LienBouton>
          )}
        />
      </Carte>
      <Carte titre="Réserver en ligne">
        <p className="m-0 text-texte-discret">
          Parcourez le catalogue des boutiques, choisissez vos produits et réservez pour venir les retirer.
        </p>
        <LienBouton to="/" variante="primaire" className="self-start">
          Voir les boutiques
        </LienBouton>
      </Carte>
    </div>
  );
}
