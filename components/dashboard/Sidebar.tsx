"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { permissionsDuRole } from "@/lib/permissions";
import type { RoleUtilisateur, Boutique } from "@/types";

interface SidebarProps {
  role: RoleUtilisateur;
  boutiqueIds: string[];
  boutiques: Boutique[];
  userName: string;
}

const LIBELLES_ROLE: Record<string, string> = {
  administrateur: "Administrateur",
  proprietaire: "Propriétaire",
  directeur_groupe: "Directeur de groupe",
  directeur_region: "Directeur de région",
  gerant: "Gérant",
  gerant_stock: "Gérant de stock",
  comptable: "Comptable",
  vendeur: "Vendeur",
  client: "Client",
};

interface LienMenu {
  href: string | ((boutiqueId: string) => string);
  label: string;
  permission?: string;
  matcher: string;
}

const LIENS_BOUTIQUE: LienMenu[] = [
  { href: (b) => `/dashboard/${b}`, label: "Vue d'ensemble", matcher: "ensemble" },
  {
    href: (b) => `/dashboard/${b}/produits`,
    label: "Produits",
    permission: "produits:voir",
    matcher: "/produits",
  },
  {
    href: (b) => `/dashboard/${b}/stock`,
    label: "Stock",
    permission: "stock:voir",
    matcher: "/stock",
  },
  {
    href: (b) => `/dashboard/${b}/ventes`,
    label: "Ventes",
    permission: "ventes:voir",
    matcher: "/ventes",
  },
  {
    href: (b) => `/dashboard/${b}/clients`,
    label: "Clients",
    permission: "clients:voir",
    matcher: "/clients",
  },
  {
    href: (b) => `/dashboard/${b}/commandes`,
    label: "Commandes B2B",
    permission: "commandes:voir",
    matcher: "/commandes",
  },
  {
    href: (b) => `/dashboard/${b}/reservations`,
    label: "Réservations",
    permission: "reservations:voir",
    matcher: "/reservations",
  },
  {
    href: (b) => `/dashboard/${b}/rapports`,
    label: "Rapports",
    permission: "rapports:voir",
    matcher: "/rapports",
  },
  {
    href: (b) => `/dashboard/${b}/promotions`,
    label: "Promotions",
    permission: "promos:voir",
    matcher: "/promotions",
  },
  {
    href: (b) => `/dashboard/${b}/achats`,
    label: "Achats & fournisseurs",
    permission: "achats:voir",
    matcher: "/achats",
  },
  {
    href: (b) => `/dashboard/${b}/prix-conseilles`,
    label: "Prix conseillés",
    permission: "prix_conseilles:voir",
    matcher: "/prix-conseilles",
  },
];

export function Sidebar({ role, boutiqueIds, boutiques, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const perms = permissionsDuRole(role);
  const isProprietaire = role === "proprietaire";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const boutiquesAccessibles = isProprietaire
    ? boutiques
    : boutiques.filter((b) => boutiqueIds.includes(b.id));

  const liensFiltres = LIENS_BOUTIQUE.filter(
    (l) => !l.permission || perms.includes(l.permission as never)
  );

  function menuBoutique(b: Boutique, key: number) {
    const currentBoutiqueId = pathname.split("/").filter(Boolean)[1];
    const base = `/dashboard/${b.id}`;
    return (
      <div key={key} className="mb-3">
        <p className="mb-1 px-3 text-xs font-semibold uppercase text-gray-400">
          {b.nom}
        </p>
        <Link
          href={base}
          className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            currentBoutiqueId === b.id && pathname === base
              ? "bg-blue-50 text-blue-700"
              : "text-gray-700 hover:bg-gray-100"
          }`}
        >
          Vue d&apos;ensemble
        </Link>
        {liensFiltres
          .filter((l) => l.label !== "Vue d'ensemble")
          .map((l) => {
            const href = typeof l.href === "function" ? l.href(b.id) : l.href;
            const actif = pathname.includes(l.matcher) && pathname.startsWith(base);
            return (
              <Link
                key={l.matcher}
                href={href}
                className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  actif ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
      </div>
    );
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="text-sm font-bold text-white">MB</span>
          </div>
          <span className="text-lg font-bold text-gray-900">MultiBoutique</span>
        </Link>
      </div>

      {/* Info utilisateur */}
      <div className="border-b border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-900">{userName}</p>
        <p className="text-xs text-gray-500">
          {LIBELLES_ROLE[role] || role.replace("_", " ")}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {perms.includes("consolidation:voir" as never) && (
          <Link
            href="/dashboard/consolidation"
            className={`mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/consolidation")
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Consolidation siège
          </Link>
        )}
        {isProprietaire && (
          <Link
            href="/dashboard"
            className={`mb-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === "/dashboard"
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Tableau de bord
          </Link>
        )}
        {boutiquesAccessibles.map((b, i) => menuBoutique(b, i))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-3">
        <Link
          href="/"
          className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Accueil
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
