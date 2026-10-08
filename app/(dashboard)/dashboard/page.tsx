import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import type { ResumeJour } from "@/types";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  if (user.role === "administrateur") redirect("/admin");
  if (user.role === "client") redirect("/client");

  // Les directeurs du siège ouvrent la consolidation
  if (
    user.role === "directeur_groupe" ||
    user.role === "directeur_region"
  ) {
    redirect("/dashboard/consolidation");
  }

  // Si ce n'est pas le propriétaire, rediriger vers sa première boutique
  if (user.role !== "proprietaire") {
    if (user.boutique_ids.length > 0) {
      redirect(`/dashboard/${user.boutique_ids[0]}`);
    }
    redirect("/login");
  }

  const resume = await query<ResumeJour>(`SELECT * FROM resume_jour ORDER BY boutique_nom`);

  const totalVentes = resume.reduce((acc, r) => acc + (Number(r.nombre_ventes) || 0), 0);
  const totalCA = resume.reduce((acc, r) => acc + (Number(r.chiffre_affaires) || 0), 0);
  const totalReservations = resume.reduce(
    (acc, r) => acc + (Number(r.reservations_en_attente) || 0),
    0
  );
  const totalAlertes = resume.reduce((acc, r) => acc + (Number(r.alertes_stock) || 0), 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500">Vue consolidée de toutes vos boutiques</p>
      </div>

      {/* Stats globales */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Ventes aujourd&apos;hui</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalVentes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Chiffre d&apos;affaires</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {totalCA.toLocaleString("fr-FR")} $
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Réservations en attente</p>
          <p className="mt-1 text-3xl font-bold text-orange-600">{totalReservations}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Alertes stock</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{totalAlertes}</p>
        </div>
      </div>

      {/* Tableau par boutique */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Résumé par boutique
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Boutique</th>
                <th className="pb-3 font-medium text-gray-500">Ventes</th>
                <th className="pb-3 font-medium text-gray-500">CA du jour</th>
                <th className="pb-3 font-medium text-gray-500">Réservations</th>
                <th className="pb-3 font-medium text-gray-500">Alertes stock</th>
                <th className="pb-3 font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resume.map((r) => (
                <tr key={r.boutique_id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{r.boutique_nom}</td>
                  <td className="py-3 text-gray-700">{Number(r.nombre_ventes)}</td>
                  <td className="py-3 font-medium text-green-600">
                    {Number(r.chiffre_affaires || 0).toLocaleString("fr-FR")} $
                  </td>
                  <td className="py-3">
                    {Number(r.reservations_en_attente) > 0 ? (
                      <span className="badge-warning">
                        {r.reservations_en_attente} en attente
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {Number(r.alertes_stock) > 0 ? (
                      <span className="badge-danger">{r.alertes_stock} alertes</span>
                    ) : (
                      <span className="badge-success">OK</span>
                    )}
                  </td>
                  <td className="py-3">
                    <a
                      href={`/dashboard/${r.boutique_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Voir →
                    </a>
                  </td>
                </tr>
              ))}
              {resume.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Aucune boutique configurée
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