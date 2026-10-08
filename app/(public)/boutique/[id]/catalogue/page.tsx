import { notFound } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";
import { CatalogueReservation } from "@/components/public/CatalogueReservation";
import type { Boutique } from "@/types";

interface CatalogueItem {
  id: string;
  produit_nom: string;
  produit_reference: string;
  produit_id: string;
  disponible: number;
  prix_vente: number;
  categorie_id: string | null;
  categorie_nom: string | null;
}

interface CategorieCatalogue {
  id: string;
  nom: string;
  nb_produits: number;
}

export default async function CataloguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reserve?: string; categorie?: string }>;
}) {
  const { id } = await params;
  const { reserve, categorie } = await searchParams;

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [id]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const catalogue = await query<CatalogueItem>(
    `SELECT sd.id, sd.produit_nom, sd.produit_reference, sd.produit_id,
            sd.disponible, sd.prix_vente, c.id AS categorie_id, c.nom AS categorie_nom
     FROM stock_disponible sd
     JOIN produits p ON p.id = sd.produit_id
     LEFT JOIN categories c ON c.id = p.categorie_id
     WHERE sd.boutique_id = $1 AND sd.disponible > 0
     ORDER BY c.nom, sd.produit_nom`,
    [id]
  );

  const categories = await query<CategorieCatalogue>(
    `SELECT c.id, c.nom,
            (SELECT count(*)::int FROM stock_disponible sd2
             JOIN produits p2 ON p2.id = sd2.produit_id
             WHERE sd2.boutique_id = $1 AND sd2.disponible > 0 AND p2.categorie_id = c.id) AS nb_produits
     FROM categories c
     ORDER BY c.nom`,
    [id]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-sm font-bold text-white">MB</span>
            </div>
            <span className="text-lg font-bold text-gray-900">MultiBoutique</span>
          </Link>
          <div className="flex gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Connexion
            </Link>
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="mx-auto max-w-7xl px-6 py-4">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/boutique" className="hover:text-gray-900">
            Boutiques
          </Link>
          <span>/</span>
          <span className="text-gray-900">{boutique.nom}</span>
        </nav>
      </div>

      {/* Info boutique */}
      <div className="mx-auto max-w-7xl px-6 pb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-gray-900">{boutique.nom}</h1>
          {boutique.adresse && (
            <p className="mt-1 text-gray-500">{boutique.adresse}</p>
          )}
        </div>
      </div>

      {/* Catalogue + panier */}
      <main className="mx-auto max-w-7xl px-6 pb-12">
        <CatalogueReservation
          boutiqueId={id}
          catalogue={catalogue}
          categories={categories}
          produitInitial={reserve}
          categorieInitiale={categorie}
        />
      </main>
    </div>
  );
}
