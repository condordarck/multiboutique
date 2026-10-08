import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { ClientForm } from "@/components/dashboard/ClientForm";
import { ClientActions } from "@/components/dashboard/ClientActions";
import type { Boutique, Client } from "@/types";

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();
  if (!aPermission(user, "clients:voir")) notFound();
  const peutGerer = aPermission(user, "clients:gerer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const clients = await query<Client>(
    `SELECT * FROM clients
     WHERE boutique_id = $1
     ORDER BY actif DESC, nom`,
    [boutiqueId]
  );

  const totalEncours = clients.reduce(
    (acc, c) => acc + (Number(c.encours) || 0),
    0
  );
  const totalPlafond = clients.reduce(
    (acc, c) => acc + (Number(c.plafond_credit) || 0),
    0
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Clients — {boutique.nom}
        </h1>
        <p className="text-gray-500">
          Grossistes et détaillants : dossiers, crédit et encours
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Clients</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{clients.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Encours total</p>
          <p className="mt-1 text-3xl font-bold text-orange-600">
            {totalEncours.toLocaleString("fr-FR")} {monnaie}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Crédit plafonné alloué</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">
            {totalPlafond.toLocaleString("fr-FR")} {monnaie}
          </p>
        </div>
      </div>

      {peutGerer && <ClientForm boutiqueId={boutiqueId} />}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Dossiers clients</h2>
        {!peutGerer && (
          <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
            Lecture seule — modification réservée au gérant et au propriétaire.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Client</th>
                <th className="pb-3 font-medium text-gray-500">Type</th>
                <th className="pb-3 font-medium text-gray-500">Plafond</th>
                <th className="pb-3 font-medium text-gray-500">Encours</th>
                <th className="pb-3 font-medium text-gray-500">Disponible</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => {
                const encours = Number(c.encours) || 0;
                const plafond = Number(c.plafond_credit) || 0;
                const disponible = Math.max(0, plafond - encours);
                const risque =
                  plafond > 0 && encours >= plafond * 0.9;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 align-top">
                    <td className="py-3">
                      <p className="font-medium text-gray-900">{c.nom}</p>
                      <p className="text-xs text-gray-500">
                        {c.telephone || ""}
                        {c.email ? ` · ${c.email}` : ""}
                      </p>
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {c.type_client === "grossiste" ? "Grossiste" : "Détaillant"}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">
                      {plafond.toLocaleString("fr-FR")} {monnaie}
                    </td>
                    <td className="py-3">
                      {encours > 0 ? (
                        <span className={`font-medium ${risque ? "text-red-600" : "text-orange-600"}`}>
                          {encours.toLocaleString("fr-FR")} {monnaie}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600">
                      {plafond > 0
                        ? `${disponible.toLocaleString("fr-FR")} ${monnaie}`
                        : "Comptant"}
                    </td>
                    <td className="py-3">
                      {c.actif ? (
                        <span className="badge-success">Actif</span>
                      ) : (
                        <span className="badge-danger">Bloqué</span>
                      )}
                    </td>
                    <td className="py-3">
                      {peutGerer ? (
                        <ClientActions client={c} boutiqueId={boutiqueId} />
                      ) : (
                        <span className="text-gray-400">Lecture seule</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Aucun client, utilisez « Nouveau client » pour en créer un
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