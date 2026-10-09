import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { ProduitForm } from "@/components/dashboard/ProduitForm";
import { PrixForm } from "@/components/dashboard/PrixForm";
import type { Boutique } from "@/types";

interface ProduitRow {
  id: string;
  produit_id: string;
  produit_nom: string;
  produit_reference: string;
  produit_code: string | null;
  produit_image: string | null;
  produit_description: string | null;
  produit_actif: boolean;
  categorie_nom: string | null;
  prix_vente: number;
  cout_revient: number | null;
  quantite: number | null;
  quantite_reservee: number | null;
  seuil_alerte: number | null;
}

export default async function ProduitsPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();

  const peutGererProduits = aPermission(user, "produits:gerer");
  const peutModifierPrix = aPermission(user, "prix:gerer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const produits = await query<ProduitRow>(
    `SELECT pb.id, pb.produit_id, p.nom AS produit_nom, p.reference AS produit_reference,
            p.code AS produit_code, p.image_url AS produit_image,
            p.description AS produit_description, p.actif AS produit_actif,
            c.nom AS categorie_nom,
            pb.prix_vente, pb.cout_revient,
            s.quantite, s.quantite_reservee, s.seuil_alerte
     FROM prix_boutique pb
     JOIN produits p ON p.id = pb.produit_id
     LEFT JOIN categories c ON c.id = p.categorie_id
     LEFT JOIN stocks s ON s.produit_id = pb.produit_id AND s.boutique_id = pb.boutique_id
     WHERE pb.boutique_id = $1 AND pb.actif = true
     ORDER BY c.nom, p.nom`,
    [boutiqueId]
  );

  const categories = await query<{ id: string; nom: string; code: string | null }>(
    `SELECT id, nom, code FROM categories ORDER BY nom`
  );

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Produits — {boutique.nom}
          </h1>
          <p className="text-gray-500">Catalogue et prix de la boutique</p>
        </div>
      </div>

      {peutGererProduits && (
        <ProduitForm boutiqueId={boutiqueId} categories={categories} />
      )}

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Produit</th>
                <th className="pb-3 font-medium text-gray-500">Code</th>
                <th className="pb-3 font-medium text-gray-500">Référence</th>
                <th className="pb-3 font-medium text-gray-500">Catégorie</th>
                <th className="pb-3 font-medium text-gray-500">Prix de vente</th>
                <th className="pb-3 font-medium text-gray-500">Coût revient</th>
                <th className="pb-3 font-medium text-gray-500">Marge</th>
                <th className="pb-3 font-medium text-gray-500">Stock</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {produits.map((p) => {
                const disponible = (p.quantite || 0) - (p.quantite_reservee || 0);
                const marge = p.cout_revient
                  ? ((p.prix_vente - p.cout_revient) / p.cout_revient) * 100
                  : null;

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {p.produit_image && (
                          <img
                            src={p.produit_image}
                            alt={p.produit_nom}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{p.produit_nom}</p>
                          <p className="text-xs text-gray-500">
                            {p.produit_description?.substring(0, 60)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      {p.produit_code ? (
                        <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-blue-700">
                          {p.produit_code}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-500">{p.produit_reference}</td>
                    <td className="py-3">
                      {p.categorie_nom ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {p.categorie_nom}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 font-medium text-green-600">
                      {Number(p.prix_vente).toLocaleString("fr-FR")} {monnaie}
                    </td>
                    <td className="py-3 text-gray-500">
                      {p.cout_revient
                        ? `${Number(p.cout_revient).toLocaleString("fr-FR")} ${monnaie}`
                        : "—"}
                    </td>
                    <td className="py-3 text-gray-700">
                      {marge !== null ? `${marge.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-3">
                      <span
                        className={
                          disponible <= 0
                            ? "text-red-600 font-bold"
                            : disponible <= (p.seuil_alerte || 10)
                            ? "text-yellow-600 font-bold"
                            : "text-gray-700"
                        }
                      >
                        {disponible}
                      </span>
                    </td>
                    <td className="py-3">
                      {p.produit_actif ? (
                        <span className="badge-success">Actif</span>
                      ) : (
                        <span className="badge-danger">Inactif</span>
                      )}
                    </td>
                    <td className="py-3">
                      {peutModifierPrix ? (
                        <PrixForm
                          boutiqueId={boutiqueId}
                          produitId={p.produit_id}
                          prixVente={Number(p.prix_vente)}
                          coutRevient={p.cout_revient ? Number(p.cout_revient) : null}
                        />
                      ) : (
                        <span className="text-gray-400">Lecture seule</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {produits.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-400">
                    Aucun produit dans cette boutique, utilisez « Nouveau
                    produit » pour commencer
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