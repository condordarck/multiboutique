import { query } from "@/lib/db";
import { RolesPerms } from "@/components/admin/RolesPerms";

export default async function RolesPage() {
  const rows = await query<{ role: string; permission: string; active: boolean }>(
    `SELECT role, permission, active FROM roles_permissions`
  );

  const etat: Record<string, boolean> = {};
  for (const r of rows) {
    etat[`${r.role}::${r.permission}`] = r.active;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Rôles & habilitations</h1>
        <p className="max-w-3xl text-gray-500">
          Activez ou désactivez chaque fonctionnalité pour chaque profil.
          La modification est immédiate : le menu et les écrans s&apos;adaptent
          automatiquement, y compris les droits de modification du stock par le
          magasinier.
        </p>
      </div>

      <RolesPerms initial={etat} />
    </div>
  );
}