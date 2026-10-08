import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/shared/LogoutButton";

const NAV = [
  { href: "/admin", label: "Accueil" },
  { href: "/admin/organisation", label: "Organisation" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/boutiques", label: "Boutiques" },
  { href: "/admin/categories", label: "Catégories" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "administrateur") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500">
              <span className="text-sm font-bold text-gray-900">AD</span>
            </div>
            <span className="block text-sm font-bold">
              Administration
              <span className="ml-2 font-normal text-gray-400">
                Configuration générale
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">{user.nom_complet}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 px-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border-b-2 border-transparent px-3 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-blue-500 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}