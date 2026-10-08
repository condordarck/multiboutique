import Link from "next/link";
import { query } from "@/lib/db";
import type { Boutique } from "@/types";

export const dynamic = "force-dynamic";

export default async function BoutiqueListPage() {
  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE statut = 'active' ORDER BY nom`
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

      {/* Contenu */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Nos Boutiques</h1>
          <p className="mt-2 text-gray-500">
            Choisissez une boutique pour consulter le catalogue et réserver
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {boutiques.map((b) => (
            <Link
              key={b.id}
              href={`/boutique/${b.id}/catalogue`}
              className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-blue-300"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600">
                {b.nom}
              </h2>
              {b.adresse && (
                <p className="mt-1 text-sm text-gray-500">{b.adresse}</p>
              )}
              {b.telephone && (
                <p className="mt-1 text-sm text-gray-500">{b.telephone}</p>
              )}
              <div className="mt-4">
                <span className="text-sm font-medium text-blue-600 group-hover:underline">
                  Voir le catalogue →
                </span>
              </div>
            </Link>
          ))}

          {boutiques.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400">
              Aucune boutique disponible pour le moment
            </div>
          )}
        </div>
      </main>
    </div>
  );
}