import { query } from "@/lib/db";
import { NouvelUtilisateurForm } from "@/components/admin/NouvelUtilisateurForm";
import { UtilisateurActions } from "@/components/admin/UtilisateurActions";
import type { Boutique, Groupe, Region, RoleUtilisateur } from "@/types";
import { getSession } from "@/lib/auth";

interface UserRow {
  id: string;
  email: string;
  nom_complet: string;
  role: RoleUtilisateur;
  boutique_ids: string[];
  region_id: string | null;
  groupe_id: string | null;
  telephone: string | null;
  actif: boolean;
  created_at: string;
  boutique_noms: string[];
  region_nom: string | null;
  groupe_nom: string | null;
}

const LIBELLES_ROLE: Record<string, string> = {
  administrateur: "Administrateur",
  proprietaire: "Propriétaire",
  directeur_groupe: "Directeur de groupe",
  directeur_region: "Directeur de région",
  gerant: "Gérant",
  gerant_stock: "Gérant stock",
  comptable: "Comptable",
  vendeur: "Vendeur",
  client: "Client",
};

export default async function UtilisateursPage() {
  const session = await getSession();

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE statut = 'active' ORDER BY nom`
  );

  const groupes = await query<Groupe>(
    `SELECT * FROM groupes ORDER BY nom`
  );

  const regions = await query<Region>(
    `SELECT * FROM regions ORDER BY nom`
  );

  const utilisateurs = await query<UserRow>(
    `SELECT u.id, u.email, u.nom_complet, u.role, u.boutique_ids, u.region_id, u.groupe_id,
            u.telephone, u.actif, u.created_at,
            COALESCE(ARRAY(
              SELECT b.nom FROM boutiques b WHERE b.id = ANY(u.boutique_ids)
            ), '{}') AS boutique_noms,
            r.nom AS region_nom,
            g.nom AS groupe_nom
     FROM utilisateurs u
     LEFT JOIN regions r ON r.id = u.region_id
     LEFT JOIN groupes g ON g.id = u.groupe_id
     ORDER BY u.role, u.nom_complet`
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <p className="text-gray-500">
          Créez des comptes pour chaque profil et contrôlez l&apos;accès aux
          boutiques.
        </p>
      </div>

      <NouvelUtilisateurForm
        boutiques={boutiques}
        groupes={groupes}
        regions={regions}
      />

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Utilisateur</th>
                <th className="pb-3 font-medium text-gray-500">Profil</th>
                <th className="pb-3 font-medium text-gray-500">Boutiques</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {utilisateurs.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{u.nom_complet}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="py-3">
                    <span className="badge-info">
                      {LIBELLES_ROLE[u.role] || u.role}
                    </span>
                    {(u.groupe_nom || u.region_nom) && (
                      <p className="mt-1 text-xs text-gray-500">
                        {u.groupe_nom
                          ? `Groupe : ${u.groupe_nom}`
                          : `Région : ${u.region_nom}`}
                      </p>
                    )}
                  </td>
                  <td className="py-3">
                    {u.boutique_noms.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.boutique_noms.map((n) => (
                          <span
                            key={n}
                            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    {u.actif ? (
                      <span className="badge-success">Actif</span>
                    ) : (
                      <span className="badge-danger">Désactivé</span>
                    )}
                  </td>
                  <td className="py-3">
                    <UtilisateurActions
                      utilisateurId={u.id}
                      actif={u.actif}
                      estMoi={session?.id === u.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}