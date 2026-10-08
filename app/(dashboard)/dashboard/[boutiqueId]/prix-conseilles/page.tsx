import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { PrixConseillesPublisher } from "@/components/dashboard/PrixConseillesPublisher";
import { PrixConseillesActions } from "@/components/dashboard/PrixConseillesActions";
import type { Boutique, PrixReference } from "@/types";

interface PrixRow extends PrixReference {
  produit_nom: string;
  applique: boolean;
}

interface ProduitOption {
  produit_id: string;
  nom: string;
  prix_vente: number | null;
}

export default async function PrixConseillesPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();
  if (!aPermission(user, "prix_conseilles:voir")) notFound();

  const peutPublier = aPermission(user, "prix_conseilles:gerer");
  const peutAppliquer = aPermission(user, "prix:gerer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const prix = await query<PrixRow>(
    `SELECT pr.*, p.nom AS produit_nom,
            EXISTS(
              SELECT 1 FROM prix_boutique pb
              WHERE pb.produit_id = pr.produit_id
                AND pb.boutique_id = $1
                AND pb.actif = true
            ) AS applique
     FROM prix_reference pr
     INNER JOIN produits p ON p.id = pr.produit_id
     WHERE pr.actif = true
     ORDER BY p.nom`,
    [boutiqueId]
  );

  const produits = await query<ProduitOption>(
    `SELECT p.id AS produit_id, p.nom, pb.prix_vente
     FROM produits p
     LEFT JOIN prix_boutique pb
       ON pb.produit_id = p.id AND pb.boutique_id = $1 AND pb.actif = true
     ORDER BY p.nom`,
    [boutiqueId]
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Prix conseillés — {boutique.nom}
        </h1>
        <p className="text-gray-500">
          Grille de prix publiée par le siège. Appliquez-la aux produits de
          cette boutique en un clic.
        </p>
      </div>

      {peutPublier && <PrixConseillesPublisher produits={produits} />}

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Grille publiée</h2>
          {peutAppliquer && prix.length > 0 && (
            <PrixConseillesActions boutiqueId={boutiqueId} />
          )}
        </div>
        {!peutAppliquer && (
          <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
            La grille est en lecture seule — seule la boutique peut décider de
            l&apos;appliquer.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Produit</th>
                <th className="pb-3 font-medium text-gray-500">Prix conseillé</th>
                <th className="pb-3 font-medium text-gray-500">Coût revient</th>
                <th className="pb-3 font-medium text-gray-500">État boutique</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prix.map((p) => (
                <tr key={p.produit_id} className="hover:bg-gray-50 align-top">
                  <td className="py-3 font-medium text-gray-900">{p.produit_nom}</td>
                  <td className="py-3 font-medium text-blue-600">
                    {Number(p.prix_vente).toLocaleString("fr-FR")} {monnaie}
                  </td>
                  <td className="py-3 text-gray-600">
                    {p.cout_revient != null
                      ? `${Number(p.cout_revient).toLocaleString("fr-FR")} ${monnaie}`
                      : "—"}
                  </td>
                  <td className="py-3">
                    {p.applique ? (
                      <span className="badge-success">Appliqué</span>
                    ) : (
                      <span className="badge-warning">Non appliqué</span>
                    )}
                  </td>
                  <td className="py-3">
                    {peutAppliquer && (
                      <PrixConseillesActions
                        boutiqueId={boutiqueId}
                        produitIds={[p.produit_id]}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {prix.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Aucun prix conseillé publié par le siège
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