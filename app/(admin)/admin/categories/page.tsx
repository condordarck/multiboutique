import { query } from "@/lib/db";
import { CategorieForm } from "@/components/admin/CategorieForm";
import { CategorieActions } from "@/components/admin/CategorieActions";

interface CategorieRow {
  id: string;
  nom: string;
  description: string | null;
  nb_produits: number;
}

export default async function CategoriesPage() {
  const categories = await query<CategorieRow>(
    `SELECT c.id, c.nom, c.description,
            (SELECT count(*)::int FROM produits p WHERE p.categorie_id = c.id) AS nb_produits
     FROM categories c
     ORDER BY c.nom`
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
        <p className="text-gray-500">
          Organisez les produits en rayons (type supermarché) pour structurer
          le catalogue public. Une catégorie ne peut être supprimée que si
          aucun produit n&apos;y est rattaché.
        </p>
      </div>

      <CategorieForm />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Catégorie</th>
                <th className="pb-3 font-medium text-gray-500">Description</th>
                <th className="pb-3 font-medium text-gray-500">Produits</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{c.nom}</td>
                  <td className="py-3 text-gray-500">{c.description || "—"}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {c.nb_produits}
                    </span>
                  </td>
                  <td className="py-3">
                    <CategorieActions
                      categorieId={c.id}
                      nom={c.nom}
                      description={c.description}
                      nbProduits={c.nb_produits}
                    />
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    Aucune catégorie
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