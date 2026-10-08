import { query } from "@/lib/db";
import { GroupeForm } from "@/components/admin/GroupeForm";
import { RegionForm } from "@/components/admin/RegionForm";
import type { Groupe, Region } from "@/types";

interface RegionRow extends Region {
  groupe_nom: string;
  nb_boutiques: number;
  boutique_noms: string[];
}

export default async function OrganisationPage() {
  const groupes = await query<Groupe>(`SELECT * FROM groupes ORDER BY nom`);
  const regions = await query<RegionRow>(
    `SELECT r.*, g.nom AS groupe_nom,
            COUNT(b.id)::int AS nb_boutiques,
            COALESCE(ARRAY_AGG(b.nom ORDER BY b.nom) FILTER (WHERE b.id IS NOT NULL), '{}') AS boutique_noms
     FROM regions r
     LEFT JOIN groupes g ON g.id = r.groupe_id
     LEFT JOIN boutiques b ON b.region_id = r.id
     GROUP BY r.id, g.nom
     ORDER BY g.nom, r.nom`
  );
  const sansRegion = await query<{ nom: string }>(
    `SELECT nom FROM boutiques WHERE region_id IS NULL ORDER BY nom`
  );

  const groupesParId = new Map<
    string,
    { id: string; nom: string; nb_regions: number; nb_boutiques: number; region_noms: string[] }
  >(
    groupes.map((g) => [
      g.id,
      { id: g.id, nom: g.nom, nb_regions: 0, nb_boutiques: 0, region_noms: [] },
    ])
  );

  for (const region of regions) {
    const g = groupesParId.get(region.groupe_id);
    if (!g) continue;
    g.nb_regions += 1;
    g.nb_boutiques += Number(region.nb_boutiques) || 0;
    g.region_noms.push(region.nom);
  }

  const boutiquesSansRegion = sansRegion.length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Organisation</h1>
        <p className="text-gray-500">
          Structurez vos boutiques en groupes et régions. Les directeurs de
          groupe et de région pilotent la consolidation de leur périmètre.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Groupes</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{groupes.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Régions</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{regions.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Boutiques non rattachées</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{boutiquesSansRegion}</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GroupeForm />
        <RegionForm groupes={groupes} />
      </div>

      {/* Organigramme */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Organigramme
        </h2>

        {groupes.length === 0 && (
          <p className="py-8 text-center text-gray-400">
            Aucun groupe configuré. Commencez par créer un groupe.
          </p>
        )}

        <div className="space-y-6">
          {[...groupesParId.values()].map((g) => (
            <div key={g.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-gray-900">{g.nom}</p>
                  <p className="text-sm text-gray-500">
                    {g.nb_regions} région{g.nb_regions > 1 ? "s" : ""} ·{" "}
                    {g.nb_boutiques} boutique{g.nb_boutiques > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                  Groupe
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {regions
                  .filter((r) => r.groupe_id === g.id)
                  .map((r) => (
                    <div key={r.id} className="rounded-lg bg-gray-50 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">{r.nom}</p>
                        <span className="text-xs text-gray-500">
                          {r.nb_boutiques} boutique{r.nb_boutiques > 1 ? "s" : ""}
                        </span>
                      </div>
                      {r.boutique_noms.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {r.boutique_noms.map((n) => (
                            <span
                              key={n}
                              className="rounded bg-white px-2 py-0.5 text-xs text-gray-600 ring-1 ring-gray-200"
                            >
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                {g.nb_regions === 0 && (
                  <p className="text-sm text-gray-400">
                    Aucune région — créez-en une dans le formulaire ci-dessus.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {sansRegion.length > 0 && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              Boutiques sans région ({sansRegion.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {sansRegion.map((b) => (
                <span
                  key={b.nom}
                  className="rounded bg-white px-2 py-0.5 text-xs text-amber-700 ring-1 ring-amber-200"
                >
                  {b.nom}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-amber-700">
              Rattachez-les via la page Boutiques pour qu&apos;elles apparaissent
              dans la consolidation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}