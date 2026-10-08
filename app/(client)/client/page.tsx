import Link from "next/link";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

interface ReservationRow {
  id: string;
  reference_reservation: string;
  boutique_nom: string;
  statut: string;
  montant_total: number;
  nombre_articles: number;
  created_at: string;
  date_retrait_prevue: string | null;
}

const LIBELLES_STATUT: Record<string, string> = {
  en_attente: "En attente",
  prete: "Prête",
  payee: "Payée",
  retiree: "Retirée",
  annulee: "Annulée",
};

export default async function ClientEspacePage() {
  const user = await getSession();
  if (!user) return null;

  const reservations = await query<ReservationRow>(
    `SELECT r.id, r.reference_reservation, b.nom AS boutique_nom,
            r.statut, r.montant_total, r.created_at, r.date_retrait_prevue,
            COALESCE((SELECT SUM(lr.quantite) FROM lignes_reservation lr WHERE lr.reservation_id = r.id), 0) AS nombre_articles
     FROM reservations r
     JOIN boutiques b ON b.id = r.boutique_id
     WHERE r.utilisateur_id = $1
     ORDER BY r.created_at DESC
     LIMIT 20`,
    [user.id]
  );

  const enAttente = reservations.filter((r) => r.statut === "en_attente").length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Bonjour {user.nom_complet}
        </h1>
        <p className="text-gray-500">
          Retrouvez ici le suivi de vos réservations en ligne.
        </p>
      </div>

      {enAttente > 0 && (
        <div className="mb-6 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
          Vous avez {enAttente} réservation{enAttente > 1 ? "s" : ""} en attente
          de retrait.
        </div>
      )}

      <div className="card mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Mes réservations
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Référence</th>
                <th className="pb-3 font-medium text-gray-500">Boutique</th>
                <th className="pb-3 font-medium text-gray-500">Articles</th>
                <th className="pb-3 font-medium text-gray-500">Montant</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">
                    {r.reference_reservation}
                  </td>
                  <td className="py-3 text-gray-700">{r.boutique_nom}</td>
                  <td className="py-3 text-gray-700">{r.nombre_articles}</td>
                  <td className="py-3 font-medium text-green-600">
                    {Number(r.montant_total).toLocaleString("fr-FR")} $
                  </td>
                  <td className="py-3">
                    {r.statut === "en_attente" ? (
                      <span className="badge-warning">{LIBELLES_STATUT[r.statut]}</span>
                    ) : r.statut === "payee" || r.statut === "retiree" ? (
                      <span className="badge-success">{LIBELLES_STATUT[r.statut]}</span>
                    ) : r.statut === "annulee" ? (
                      <span className="badge-danger">{LIBELLES_STATUT[r.statut]}</span>
                    ) : (
                      <span className="badge-info">{LIBELLES_STATUT[r.statut]}</span>
                    )}
                  </td>
                  <td className="py-3 text-gray-500">
                    {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Aucune réservation pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Réserver en ligne
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          Parcourez le catalogue des boutiques, choisissez vos produits et
          réservez pour venir les retirer.
        </p>
        <Link href="/boutique" className="btn-primary">
          Voir les boutiques
        </Link>
      </div>
    </div>
  );
}