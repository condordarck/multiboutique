import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <svg
              className="h-8 w-8 text-white"
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
          <h1 className="mb-3 text-4xl font-bold text-gray-900">
            MultiBoutique
          </h1>
          <p className="text-lg text-gray-600">
            Gestion centralisée de vos boutiques — Stock, Ventes, Commandes
            en ligne, Traçabilité.
          </p>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-2 text-2xl font-bold text-blue-600">3</div>
            <div className="text-sm text-gray-500">Boutiques connectées</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-2 text-2xl font-bold text-green-600">100%</div>
            <div className="text-sm text-gray-500">Traçabilité</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-2 text-2xl font-bold text-purple-600">
              24/7
            </div>
            <div className="text-sm text-gray-500">Accès à distance</div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/login" className="btn-primary px-8 py-3 text-base">
            Se connecter
          </Link>
          <Link
            href="/boutique"
            className="btn-secondary px-8 py-3 text-base"
          >
            Voir le catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
