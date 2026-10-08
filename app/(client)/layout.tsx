import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/LogoutButton";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600">
              <span className="text-sm font-bold text-white">MB</span>
            </div>
            <span className="text-lg font-bold text-gray-900">MultiBoutique</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/boutique"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Voir les boutiques
            </Link>
            <Link
              href="/client"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Mes réservations
            </Link>
            <span className="text-sm text-gray-500">{user.nom_complet}</span>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  );
}