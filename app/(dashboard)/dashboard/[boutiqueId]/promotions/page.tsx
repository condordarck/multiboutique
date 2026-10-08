import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { CodePromoForm } from "@/components/dashboard/CodePromoForm";
import { CodePromoActions } from "@/components/dashboard/CodePromoActions";
import type { Boutique, CodePromo } from "@/types";

export default async function PromotionsPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();
  if (!aPermission(user, "promos:voir")) notFound();

  const peutGerer = aPermission(user, "promos:gerer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const codes = await query<CodePromo>(
    `SELECT * FROM codes_promo
     WHERE boutique_id = $1
     ORDER BY actif DESC, created_at DESC`,
    [boutiqueId]
  );

  const expirant = new Date();
  expirant.setHours(0, 0, 0, 0);

  const fmtDate = (d: string | Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR") : null;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Promotions — {boutique.nom}
          </h1>
          <p className="text-gray-500">
            Codes promo pour les grossistes et lancement des campagnes
          </p>
        </div>
      </div>

      {peutGerer && <CodePromoForm boutiqueId={boutiqueId} />}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Codes promo</h2>
        {!peutGerer && (
          <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
            Lecture seule — seuls le propriétaire et le gérant peuvent créer ou
            lancer des codes promo.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Code</th>
                <th className="pb-3 font-medium text-gray-500">Réduction</th>
                <th className="pb-3 font-medium text-gray-500">Validité</th>
                <th className="pb-3 font-medium text-gray-500">Utilisations</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c) => {
                const expire =
                  (c.date_fin && new Date(c.date_fin) < expirant) ||
                  (c.max_utilisations !== null &&
                    Number(c.nombre_utilisations) >= Number(c.max_utilisations));
                const enCours = c.actif && !expire;
                return (
                  <tr key={c.id} className="hover:bg-gray-50 align-top">
                    <td className="py-3">
                      <p className="font-medium text-gray-900">{c.code}</p>
                      {c.description && (
                        <p className="text-xs text-gray-500">{c.description}</p>
                      )}
                    </td>
                    <td className="py-3 font-medium text-blue-600">
                      {c.type_reduction === "pourcentage"
                        ? `${Number(c.valeur_reduction).toLocaleString("fr-FR")}%`
                        : `${Number(c.valeur_reduction).toLocaleString("fr-FR")} ${monnaie}`}
                    </td>
                    <td className="py-3 text-gray-600">
                      {fmtDate(c.date_debut) || "—"} →{" "}
                      {fmtDate(c.date_fin) ?? "∞"}
                    </td>
                    <td className="py-3 text-gray-600">
                      {Number(c.nombre_utilisations).toLocaleString("fr-FR")}
                      {c.max_utilisations !== null
                        ? ` / ${Number(c.max_utilisations).toLocaleString("fr-FR")}`
                        : ""}
                    </td>
                    <td className="py-3">
                      {enCours ? (
                        <span className="badge-success">Active</span>
                      ) : expire ? (
                        <span className="badge-danger">Expirée</span>
                      ) : (
                        <span className="badge-warning">Inactive</span>
                      )}
                    </td>
                    <td className="py-3">
                      {peutGerer ? (
                        <CodePromoActions code={c} />
                      ) : (
                        <span className="text-gray-400">Lecture seule</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {codes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    Aucun code promo, utilisez « Nouveau code » pour en créer un
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