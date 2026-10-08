import { query } from "@/lib/db";
import { NouvelleBoutiqueForm } from "@/components/admin/NouvelleBoutiqueForm";
import { BoutiqueActions } from "@/components/admin/BoutiqueActions";
import type { Boutique, Region } from "@/types";

interface BoutiqueRow extends Boutique {
  region_nom: string | null;
  groupe_nom: string | null;
}

export default async function BoutiquesPage() {
  const regions = await query<Region>(
    `SELECT * FROM regions ORDER BY nom`
  );

  const boutiques = await query<BoutiqueRow>(
    `SELECT b.*, r.nom AS region_nom, g.nom AS groupe_nom
     FROM boutiques b
     LEFT JOIN regions r ON r.id = b.region_id
     LEFT JOIN groupes g ON g.id = r.groupe_id
     ORDER BY b.nom`
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Boutiques</h1>
        <p className="text-gray-500">
          Ajoutez, modifiez ou activez / désactivez les boutiques de
          l&apos;application et rattachez-les à une région.
        </p>
      </div>

      <NouvelleBoutiqueForm regions={regions} />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Boutique</th>
                <th className="pb-3 font-medium text-gray-500">Contact</th>
                <th className="pb-3 font-medium text-gray-500">Région</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {boutiques.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{b.nom}</p>
                    <p className="text-xs text-gray-500">{b.adresse || "—"}</p>
                  </td>
                  <td className="py-3 text-gray-500">
                    <p>{b.telephone || "—"}</p>
                    <p className="text-xs">{b.email || ""}</p>
                  </td>
                  <td className="py-3">
                    {b.region_nom ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {b.region_nom}
                        {b.groupe_nom ? ` · ${b.groupe_nom}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600">Non rattachée</span>
                    )}
                  </td>
                  <td className="py-3">
                    {b.statut === "active" ? (
                      <span className="badge-success">Active</span>
                    ) : (
                      <span className="badge-danger">Inactive</span>
                    )}
                  </td>
                  <td className="py-3">
                    <BoutiqueActions
                      boutiqueId={b.id}
                      nom={b.nom}
                      adresse={b.adresse}
                      telephone={b.telephone}
                      email={b.email}
                      actif={b.statut === "active"}
                    />
                  </td>
                </tr>
              ))}
              {boutiques.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Aucune boutique
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