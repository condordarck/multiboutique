import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { StockActions } from "@/components/dashboard/StockActions";
import type { Boutique } from "@/types";

interface StockRow {
  id: string;
  produit_id: string;
  produit_nom: string;
  produit_reference: string;
  quantite: number;
  quantite_reservee: number;
  disponible: number;
  seuil_alerte: number;
  statut_stock: "ok" | "alerte" | "rupture";
  prix_vente: number;
}

interface MouvementRow {
  id: string;
  type: string;
  produit_nom: string;
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  auteur_nom: string;
  motif: string | null;
  created_at: string;
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  const peutGererStock = aPermission(user, "stock:gerer");
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const stocks = await query<StockRow>(
    `SELECT * FROM stock_disponible WHERE boutique_id = $1 ORDER BY produit_nom`,
    [boutiqueId]
  );

  const mouvements = await query<MouvementRow>(
    `SELECT m.*, p.nom AS produit_nom, u.nom_complet AS auteur_nom
     FROM mouvements_stock m
     JOIN produits p ON p.id = m.produit_id
     LEFT JOIN utilisateurs u ON u.id = m.auteur_id
     WHERE m.boutique_id = $1
     ORDER BY m.created_at DESC
     LIMIT 20`,
    [boutiqueId]
  );

  const enStock = stocks.filter((s) => s.statut_stock !== "rupture").length;
  const alertes = stocks.filter((s) => s.statut_stock === "alerte").length;
  const ruptures = stocks.filter((s) => s.statut_stock === "rupture").length;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock — {boutique.nom}</h1>
          <p className="text-gray-500">Gestion des stocks et mouvements</p>
        </div>
      </div>

      {/* Résumé */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Produits en stock</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{enStock}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Alertes stock</p>
          <p className="mt-1 text-3xl font-bold text-yellow-600">{alertes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Ruptures</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{ruptures}</p>
        </div>
      </div>

      {/* Tableau de stock */}
      <div className="card mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">État du stock</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Produit</th>
                <th className="pb-3 font-medium text-gray-500">Réf.</th>
                <th className="pb-3 font-medium text-gray-500">Stock total</th>
                <th className="pb-3 font-medium text-gray-500">Réservé</th>
                <th className="pb-3 font-medium text-gray-500">Disponible</th>
                <th className="pb-3 font-medium text-gray-500">Seuil</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Prix</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stocks.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{s.produit_nom}</td>
                  <td className="py-3 text-gray-500">{s.produit_reference}</td>
                  <td className="py-3 text-gray-700">{s.quantite}</td>
                  <td className="py-3 text-orange-600">{s.quantite_reservee}</td>
                  <td className="py-3 font-bold text-gray-900">{s.disponible}</td>
                  <td className="py-3 text-gray-500">{s.seuil_alerte}</td>
                  <td className="py-3">
                    {s.statut_stock === "rupture" ? (
                      <span className="badge-danger">Rupture</span>
                    ) : s.statut_stock === "alerte" ? (
                      <span className="badge-warning">Stock bas</span>
                    ) : (
                      <span className="badge-success">OK</span>
                    )}
                  </td>
                  <td className="py-3 text-green-600">
                    {Number(s.prix_vente || 0).toLocaleString("fr-FR")} {monnaie}
                  </td>
                  <td className="py-3">
                    {peutGererStock ? (
                      <StockActions
                        boutiqueId={boutiqueId}
                        produitId={s.produit_id}
                        quantite={s.quantite}
                      />
                    ) : (
                      <span className="text-gray-400">Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))}
              {stocks.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Aucun produit en stock
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Derniers mouvements */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Derniers mouvements
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Date</th>
                <th className="pb-3 font-medium text-gray-500">Type</th>
                <th className="pb-3 font-medium text-gray-500">Produit</th>
                <th className="pb-3 font-medium text-gray-500">Qté</th>
                <th className="pb-3 font-medium text-gray-500">Avant → Après</th>
                <th className="pb-3 font-medium text-gray-500">Auteur</th>
                <th className="pb-3 font-medium text-gray-500">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mouvements.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="py-2 text-gray-500">
                    {new Date(m.created_at).toLocaleString("fr-FR")}
                  </td>
                  <td className="py-2">
                    {m.type === "entree" ? (
                      <span className="badge-success">Entrée</span>
                    ) : m.type === "sortie" ? (
                      <span className="badge-danger">Sortie</span>
                    ) : m.type === "transfert" ? (
                      <span className="badge-info">Transfert</span>
                    ) : (
                      <span className="badge-warning">Ajustement</span>
                    )}
                  </td>
                  <td className="py-2 text-gray-900">{m.produit_nom}</td>
                  <td className="py-2 font-medium">{m.quantite}</td>
                  <td className="py-2 text-gray-500">
                    {m.quantite_avant} → {m.quantite_apres}
                  </td>
                  <td className="py-2 text-gray-500">{m.auteur_nom || "—"}</td>
                  <td className="py-2 text-gray-500 max-w-xs truncate">
                    {m.motif || "—"}
                  </td>
                </tr>
              ))}
              {mouvements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Aucun mouvement enregistré
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