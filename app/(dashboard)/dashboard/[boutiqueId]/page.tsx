import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { query } from "@/lib/db";
import type { Boutique, ResumeJour, Vente, Reservation } from "@/types";

interface VenteAvecVendeur extends Vente {
  vendeur_nom: string;
}

export default async function BoutiqueDashboardPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const user = await getSession();
  if (!user) notFound();

  if (!canAccessBoutique(user, boutiqueId)) {
    notFound();
  }

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const resumes = await query<ResumeJour>(
    `SELECT * FROM resume_jour WHERE boutique_id = $1`,
    [boutiqueId]
  );
  const resume = resumes[0] || null;

  const dernieresVentes = await query<VenteAvecVendeur>(
    `SELECT v.*, u.nom_complet AS vendeur_nom
     FROM ventes v
     JOIN utilisateurs u ON u.id = v.vendeur_id
     WHERE v.boutique_id = $1 AND v.statut = 'validee'
     ORDER BY v.created_at DESC
     LIMIT 5`,
    [boutiqueId]
  );

  const reservationsEnAttente = await query<Reservation>(
    `SELECT * FROM reservations
     WHERE boutique_id = $1 AND statut = 'en_attente'
     ORDER BY created_at DESC
     LIMIT 5`,
    [boutiqueId]
  );

  const alertesStock = await query<any>(
    `SELECT * FROM stock_disponible
     WHERE boutique_id = $1 AND statut_stock IN ('alerte', 'rupture')
     ORDER BY disponible`,
    [boutiqueId]
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{boutique.nom}</h1>
        <p className="text-gray-500">{boutique.adresse}</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Ventes aujourd&apos;hui</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {resume ? Number(resume.nombre_ventes) : 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Chiffre d&apos;affaires</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {(resume ? Number(resume.chiffre_affaires) : 0).toLocaleString("fr-FR")} $
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Réservations en attente</p>
          <p className="mt-1 text-3xl font-bold text-orange-600">
            {resume ? Number(resume.reservations_en_attente) : 0}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Alertes stock</p>
          <p className="mt-1 text-3xl font-bold text-red-600">
            {resume ? Number(resume.alertes_stock) : 0}
          </p>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href={`/dashboard/${boutiqueId}/ventes`}
          className="card flex items-center gap-4 transition-colors hover:bg-blue-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Nouvelle vente</p>
            <p className="text-sm text-gray-500">Enregistrer une vente au comptoir</p>
          </div>
        </Link>
        <Link
          href={`/dashboard/${boutiqueId}/stock`}
          className="card flex items-center gap-4 transition-colors hover:bg-green-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Réception stock</p>
            <p className="text-sm text-gray-500">Enregistrer une entrée de marchandise</p>
          </div>
        </Link>
        <Link
          href={`/dashboard/${boutiqueId}/reservations`}
          className="card flex items-center gap-4 transition-colors hover:bg-orange-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Réservations</p>
            <p className="text-sm text-gray-500">Voir les commandes en attente</p>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dernières ventes */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Dernières ventes</h2>
            <Link
              href={`/dashboard/${boutiqueId}/ventes`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          {dernieresVentes.length > 0 ? (
            <div className="space-y-3">
              {dernieresVentes.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {v.reference_vente}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(v.created_at).toLocaleString("fr-FR")} — {v.vendeur_nom}
                    </p>
                  </div>
                  <p className="font-semibold text-green-600">
                    {Number(v.montant_total).toLocaleString("fr-FR")} $
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">
              Aucune vente aujourd&apos;hui
            </p>
          )}
        </div>

        {/* Réservations en attente */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Réservations en attente</h2>
            <Link
              href={`/dashboard/${boutiqueId}/reservations`}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          {reservationsEnAttente.length > 0 ? (
            <div className="space-y-3">
              {reservationsEnAttente.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-orange-50 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {r.reference_reservation}
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.client_nom} — {r.client_telephone}
                    </p>
                  </div>
                  <p className="font-semibold text-orange-600">
                    {Number(r.montant_total).toLocaleString("fr-FR")} $
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">
              Aucune réservation en attente
            </p>
          )}
        </div>

        {/* Alertes stock */}
        {alertesStock.length > 0 && (
          <div className="card lg:col-span-2">
            <h2 className="mb-4 font-semibold text-gray-900">Alertes stock</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-2 font-medium text-gray-500">Produit</th>
                    <th className="pb-2 font-medium text-gray-500">Réf.</th>
                    <th className="pb-2 font-medium text-gray-500">Disponible</th>
                    <th className="pb-2 font-medium text-gray-500">Seuil</th>
                    <th className="pb-2 font-medium text-gray-500">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {alertesStock.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 font-medium text-gray-900">{a.produit_nom}</td>
                      <td className="py-2 text-gray-500">{a.produit_reference}</td>
                      <td className="py-2 font-bold text-red-600">{a.disponible}</td>
                      <td className="py-2 text-gray-500">{a.seuil_alerte}</td>
                      <td className="py-2">
                        {a.statut_stock === "rupture" ? (
                          <span className="badge-danger">Rupture</span>
                        ) : (
                          <span className="badge-warning">Stock bas</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}