import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { ReservationActions } from "@/components/dashboard/ReservationActions";
import type { Boutique, Reservation } from "@/types";

interface LigneAvecProduit {
  reservation_id: string;
  id: string;
  produit_nom: string;
  quantite: number;
  prix_unitaire: number;
}

export default async function ReservationsPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();

  const peutGerer = aPermission(user, "reservations:gerer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const reservations = await query<Reservation>(
    `SELECT * FROM reservations
     WHERE boutique_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [boutiqueId]
  );

  const enAttenteIds = reservations
    .filter((r) => r.statut === "en_attente" || r.statut === "prete")
    .map((r) => r.id);

  // Lignes des réservations en attente (pour afficher les articles)
  const lignes: LigneAvecProduit[] =
    enAttenteIds.length > 0
      ? await query<LigneAvecProduit>(
          `SELECT lr.reservation_id, lr.id, p.nom AS produit_nom, lr.quantite, lr.prix_unitaire
           FROM lignes_reservation lr
           JOIN produits p ON p.id = lr.produit_id
           WHERE lr.reservation_id = ANY($1::uuid[])
           ORDER BY lr.created_at`,
          [enAttenteIds]
        )
      : [];

  const lignesParReservation = new Map<string, LigneAvecProduit[]>();
  for (const l of lignes) {
    const liste = lignesParReservation.get(l.reservation_id) || [];
    liste.push(l);
    lignesParReservation.set(l.reservation_id, liste);
  }

  const enAttente = reservations.filter(
    (r) => r.statut === "en_attente" || r.statut === "prete"
  );
  const pretes = reservations.filter((r) => r.statut === "prete");
  const payees = reservations.filter(
    (r) => r.statut === "payee" || r.statut === "retiree"
  );
  const annulees = reservations.filter((r) => r.statut === "annulee");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Réservations — {boutique.nom}
        </h1>
        <p className="text-gray-500">Gestion des réservations en ligne</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">En attente</p>
          <p className="mt-1 text-3xl font-bold text-orange-600">
            {enAttente.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Prêtes</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{pretes.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Payées / Retirées</p>
          <p className="mt-1 text-3xl font-bold text-green-600">{payees.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Annulées</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{annulees.length}</p>
        </div>
      </div>

      {/* Réservations en attente */}
      {enAttente.length > 0 && (
        <div className="card mb-8">
          <h2 className="mb-4 text-lg font-semibold text-orange-600">
            En attente de retrait
          </h2>
          <div className="space-y-4">
            {enAttente.map((r) => {
              const lignesRes = lignesParReservation.get(r.id) || [];
              return (
                <div
                  key={r.id}
                  className="rounded-lg border border-orange-200 bg-orange-50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {r.reference_reservation}
                      </p>
                      <p className="text-sm text-gray-600">
                        {r.client_nom} — {r.client_telephone}
                      </p>
                      {r.client_email && (
                        <p className="text-sm text-gray-500">{r.client_email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-orange-600">
                        {Number(r.montant_total).toLocaleString("fr-FR")} {monnaie}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(r.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </div>

                  {/* Articles réservés */}
                  <div className="mt-3 border-t border-orange-200 pt-3">
                    <p className="mb-1 text-xs font-medium text-gray-500">Articles :</p>
                    {lignesRes.map((l) => (
                      <div key={l.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {l.produit_nom} × {l.quantite}
                        </span>
                        <span className="text-gray-900">
                          {(l.prix_unitaire * l.quantite).toLocaleString("fr-FR")} {monnaie}
                        </span>
                      </div>
                    ))}
                  </div>

                  {r.date_retrait_prevue && (
                    <p className="mt-2 text-sm text-gray-500">
                      Retrait prévu le :{" "}
                      {new Date(r.date_retrait_prevue).toLocaleDateString("fr-FR")}
                    </p>
                  )}

                  {peutGerer && (
                    <ReservationActions
                      reservation={r}
                      lignes={lignesRes}
                      monnaie={monnaie}
                      boutiqueNom={boutique.nom}
                      boutiqueAdresse={boutique.adresse}
                      boutiqueTelephone={boutique.telephone}
                      vendeurNom={user.nom_complet}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toutes les réservations */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Historique des réservations
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Référence</th>
                <th className="pb-3 font-medium text-gray-500">Client</th>
                <th className="pb-3 font-medium text-gray-500">Montant</th>
                <th className="pb-3 font-medium text-gray-500">Date</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">
                    {r.reference_reservation}
                  </td>
                  <td className="py-3">
                    <p className="text-gray-900">{r.client_nom}</p>
                    <p className="text-xs text-gray-500">{r.client_telephone}</p>
                  </td>
                  <td className="py-3 font-medium text-gray-900">
                    {Number(r.montant_total).toLocaleString("fr-FR")} {monnaie}
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(r.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-3">
                    {r.statut === "en_attente" ? (
                      <span className="badge-warning">En attente</span>
                    ) : r.statut === "prete" ? (
                      <span className="badge-info">Prête</span>
                    ) : r.statut === "payee" ? (
                      <span className="badge-success">Payée</span>
                    ) : r.statut === "retiree" ? (
                      <span className="badge-success">Retirée</span>
                    ) : (
                      <span className="badge-danger">Annulée</span>
                    )}
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Aucune réservation
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}