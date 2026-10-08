import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";

interface SyntheseBoutique {
  boutique_id: string;
  boutique_nom: string;
  region_nom: string | null;
  groupe_nom: string | null;
  nombre_ventes: number;
  chiffre_affaires: number;
  reservations_en_attente: number;
  alertes_stock: number;
  encours_total: number;
  commandes_attente: number;
}

export default async function ConsolidationPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (!aPermission(user, "consolidation:voir")) redirect("/dashboard");

  const monnaie = await getMonnaie();

  // La consolidation n'est intégrale que pour le propriétaire.
  // Les directions (groupe/région) et les profils opérationnels ne voient
  // que les boutiques de leur périmètre (anti-fuite de données).
  const scopeProprietaire = user.role === "proprietaire";
  let filtrePerimetre = "";
  const params: unknown[] = [];
  if (!scopeProprietaire && user.boutique_ids.length > 0) {
    filtrePerimetre = ` AND b.id = ANY($1::uuid[])`;
    params.push(user.boutique_ids);
  }

  const boutiques = await query<SyntheseBoutique>(
    `SELECT b.id AS boutique_id, b.nom AS boutique_nom,
            r.nom AS region_nom, g.nom AS groupe_nom,
            COALESCE(rj.nombre_ventes, 0)::int AS nombre_ventes,
            COALESCE(rj.chiffre_affaires, 0) AS chiffre_affaires,
            COALESCE(rj.reservations_en_attente, 0)::int AS reservations_en_attente,
            COALESCE(rj.alertes_stock, 0)::int AS alertes_stock,
            COALESCE((SELECT SUM(c.encours) FROM clients c WHERE c.boutique_id = b.id), 0) AS encours_total,
            (SELECT COUNT(*)::int FROM commandes cmd
             WHERE cmd.boutique_id = b.id AND cmd.statut = 'en_attente') AS commandes_attente
     FROM boutiques b
     LEFT JOIN regions r ON r.id = b.region_id
     LEFT JOIN groupes g ON g.id = r.groupe_id
     LEFT JOIN resume_jour rj ON rj.boutique_id = b.id
     WHERE b.statut = 'active'${filtrePerimetre}
     ORDER BY g.nom, r.nom, b.nom`,
    params
  );

  const totalVentes = boutiques.reduce((a, b) => a + (b.nombre_ventes || 0), 0);
  const totalCA = boutiques.reduce((a, b) => a + (Number(b.chiffre_affaires) || 0), 0);
  const totalEncours = boutiques.reduce((a, b) => a + (Number(b.encours_total) || 0), 0);
  const totalCommandesAttente = boutiques.reduce(
    (a, b) => a + (b.commandes_attente || 0),
    0
  );

  // Agrége par région (petite structure)
  const parRegion = new Map<string, { nom: string; groupe: string; ca: number; ventes: number; boutiques: Set<string> }>();
  const parGroupe = new Map<string, { nom: string; ca: number; ventes: number; boutiques: Set<string> }>();

  for (const b of boutiques) {
    const regionKey = b.region_nom || "Sans région";
    const r = parRegion.get(regionKey) || {
      nom: regionKey,
      groupe: b.groupe_nom || "—",
      ca: 0,
      ventes: 0,
      boutiques: new Set(),
    };
    r.ca += Number(b.chiffre_affaires) || 0;
    r.ventes += b.nombre_ventes || 0;
    r.boutiques.add(b.boutique_nom);
    parRegion.set(regionKey, r);

    const groupeKey = b.groupe_nom || "Sans groupe";
    const g = parGroupe.get(groupeKey) || { nom: groupeKey, ca: 0, ventes: 0, boutiques: new Set() };
    g.ca += Number(b.chiffre_affaires) || 0;
    g.ventes += b.nombre_ventes || 0;
    g.boutiques.add(b.boutique_nom);
    parGroupe.set(groupeKey, g);
  }

  const regionsList = [...parRegion.values()].sort((a, b) => b.ca - a.ca);
  const groupesList = [...parGroupe.values()].sort((a, b) => b.ca - a.ca);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Consolidation siège</h1>
        <p className="text-gray-500">
          Vue de pilotage : indicateurs du jour, agrégés par groupe et par
          région.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Ventes aujourd&apos;hui</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{totalVentes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Chiffre d&apos;affaires du jour</p>
          <p className="mt-1 text-3xl font-bold text-green-600">
            {totalCA.toLocaleString("fr-FR")} {monnaie}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Encours clients (crédit)</p>
          <p className="mt-1 text-3xl font-bold text-orange-600">
            {totalEncours.toLocaleString("fr-FR")} {monnaie}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Commandes grossistes à valider</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">
            {totalCommandesAttente}
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Par groupe
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 font-medium text-gray-500">Groupe</th>
                  <th className="pb-3 font-medium text-gray-500">Boutiques</th>
                  <th className="pb-3 font-medium text-gray-500">Ventes</th>
                  <th className="pb-3 font-medium text-gray-500">CA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupesList.map((g) => (
                  <tr key={g.nom} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{g.nom}</td>
                    <td className="py-3 text-gray-600">{g.boutiques.size}</td>
                    <td className="py-3 text-gray-600">{g.ventes}</td>
                    <td className="py-3 font-medium text-green-600">
                      {g.ca.toLocaleString("fr-FR")} {monnaie}
                    </td>
                  </tr>
                ))}
                {groupesList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400">
                      Aucune donnée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Par région
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 font-medium text-gray-500">Région</th>
                  <th className="pb-3 font-medium text-gray-500">Groupe</th>
                  <th className="pb-3 font-medium text-gray-500">Boutiques</th>
                  <th className="pb-3 font-medium text-gray-500">Ventes</th>
                  <th className="pb-3 font-medium text-gray-500">CA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {regionsList.map((r) => (
                  <tr key={r.nom} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{r.nom}</td>
                    <td className="py-3 text-gray-500">{r.groupe}</td>
                    <td className="py-3 text-gray-600">{r.boutiques.size}</td>
                    <td className="py-3 text-gray-600">{r.ventes}</td>
                    <td className="py-3 font-medium text-green-600">
                      {r.ca.toLocaleString("fr-FR")} {monnaie}
                    </td>
                  </tr>
                ))}
                {regionsList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400">
                      Aucune donnée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Détail par boutique
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Boutique</th>
                <th className="pb-3 font-medium text-gray-500">Groupe</th>
                <th className="pb-3 font-medium text-gray-500">Région</th>
                <th className="pb-3 font-medium text-gray-500">Ventes</th>
                <th className="pb-3 font-medium text-gray-500">CA du jour</th>
                <th className="pb-3 font-medium text-gray-500">Encours</th>
                <th className="pb-3 font-medium text-gray-500">Cmd. à valider</th>
                <th className="pb-3 font-medium text-gray-500">Alertes</th>
                <th className="pb-3 font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {boutiques.map((b) => (
                <tr key={b.boutique_id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{b.boutique_nom}</td>
                  <td className="py-3 text-gray-500">{b.groupe_nom || "—"}</td>
                  <td className="py-3 text-gray-500">{b.region_nom || "—"}</td>
                  <td className="py-3 text-gray-600">{b.nombre_ventes}</td>
                  <td className="py-3 font-medium text-green-600">
                    {Number(b.chiffre_affaires || 0).toLocaleString("fr-FR")} {monnaie}
                  </td>
                  <td className="py-3 text-gray-600">
                    {Number(b.encours_total || 0) > 0
                      ? `${Number(b.encours_total).toLocaleString("fr-FR")} ${monnaie}`
                      : "—"}
                  </td>
                  <td className="py-3">
                    {Number(b.commandes_attente) > 0 ? (
                      <span className="badge-warning">{b.commandes_attente}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {Number(b.alertes_stock) > 0 ? (
                      <span className="badge-danger">{b.alertes_stock}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <a
                      href={`/dashboard/${b.boutique_id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Ouvrir →
                    </a>
                  </td>
                </tr>
              ))}
              {boutiques.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Aucune boutique active
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