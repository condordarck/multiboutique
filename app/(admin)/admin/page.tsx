import Link from "next/link";
import { query } from "@/lib/db";

interface Comptages {
  utilisateurs: number;
  boutiques: number;
  boutiques_actives: number;
  produits: number;
}

export default async function AdminAccueilPage() {
  const rows = await query<Comptages>(
    `SELECT
       (SELECT COUNT(*) FROM utilisateurs) AS utilisateurs,
       (SELECT COUNT(*) FROM boutiques) AS boutiques,
       (SELECT COUNT(*) FROM boutiques WHERE statut = 'active') AS boutiques_actives,
       (SELECT COUNT(*) FROM produits) AS produits`
  );
  const stats = rows[0];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Accueil administrateur
        </h1>
        <p className="text-gray-500">
          Gérez les utilisateurs, les boutiques et les paramètres généraux de
          l&apos;application.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Utilisateurs</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {stats.utilisateurs}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Boutiques actives</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {stats.boutiques_actives} / {stats.boutiques}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Produits au catalogue</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {stats.produits}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Rôles disponibles</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">7</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/admin/utilisateurs" className="card transition-shadow hover:shadow-md">
          <h2 className="font-semibold text-gray-900">Utilisateurs</h2>
          <p className="mt-1 text-sm text-gray-500">
            Créer des comptes pour chaque profil (gérant, vendeur, comptable…)
            et leur attribuer des boutiques.
          </p>
        </Link>
        <Link href="/admin/boutiques" className="card transition-shadow hover:shadow-md">
          <h2 className="font-semibold text-gray-900">Boutiques</h2>
          <p className="mt-1 text-sm text-gray-500">
            Ajouter, renommer ou activer / désactiver les boutiques.
          </p>
        </Link>
        <Link href="/admin/parametres" className="card transition-shadow hover:shadow-md">
          <h2 className="font-semibold text-gray-900">Paramètres</h2>
          <p className="mt-1 text-sm text-gray-500">
            Monnaie affichée, nom de l&apos;application, seuil d&apos;alerte
            stock par défaut.
          </p>
        </Link>
      </div>
    </div>
  );
}