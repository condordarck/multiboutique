import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { Sidebar } from "@/components/dashboard/Sidebar";
import type { Boutique } from "@/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  // L'administrateur gère la configuration, le client son espace personnel
  if (user.role === "administrateur") redirect("/admin");
  if (user.role === "client") redirect("/client");

  let boutiques: Boutique[] = [];
  if (user.role === "proprietaire") {
    boutiques = await query<Boutique>(
      `SELECT * FROM boutiques WHERE statut = 'active' ORDER BY nom`
    );
  } else {
    if (user.boutique_ids.length === 0) redirect("/dashboard");
    boutiques = await query<Boutique>(
      `SELECT * FROM boutiques WHERE statut = 'active' AND id = ANY($1::uuid[]) ORDER BY nom`,
      [user.boutique_ids]
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={user.role}
        boutiqueIds={user.boutique_ids}
        boutiques={boutiques}
        userName={user.nom_complet}
      />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}