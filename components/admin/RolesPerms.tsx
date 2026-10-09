"use client";

import { useState } from "react";
import { togglePermissionRole } from "@/lib/actions";

interface Props {
  initial: Record<string, boolean>;
}

const GROUPES = [
  {
    titre: "Produits & Stock",
    permissions: [
      { code: "produits:voir", label: "Voir les produits" },
      { code: "produits:gerer", label: "Créer / modifier des produits" },
      { code: "stock:voir", label: "Voir le stock" },
      { code: "stock:gerer", label: "Entrées / ajustements de stock" },
      { code: "prix:gerer", label: "Modifier les prix" },
      { code: "promos:voir", label: "Voir les promotions" },
      { code: "promos:gerer", label: "Créer des promotions" },
      { code: "prix_conseilles:voir", label: "Voir les prix conseillés" },
      { code: "prix_conseilles:gerer", label: "Publier prix conseillés" },
    ],
  },
  {
    titre: "Ventes & Clients",
    permissions: [
      { code: "ventes:voir", label: "Voir les ventes" },
      { code: "ventes:creer", label: "Encaisser une vente" },
      { code: "ventes:annuler", label: "Annuler une vente" },
      { code: "clients:voir", label: "Voir les clients" },
      { code: "clients:gerer", label: "Gérer les clients (VIP…)" },
      { code: "credits:voir", label: "Registre des créances" },
      { code: "credits:gerer", label: "Encaisser des versements" },
    ],
  },
  {
    titre: "Commandes & Achats",
    permissions: [
      { code: "commandes:voir", label: "Voir les commandes B2B" },
      { code: "commandes:gerer", label: "Gérer les commandes B2B" },
      { code: "achats:voir", label: "Voir les achats fournisseurs" },
      { code: "achats:gerer", label: "Gérer les achats fournisseurs" },
    ],
  },
  {
    titre: "Réservations & Rapports",
    permissions: [
      { code: "reservations:voir", label: "Voir les réservations" },
      { code: "reservations:gerer", label: "Valider / annuler" },
      { code: "rapports:voir", label: "Voir les rapports" },
      { code: "consolidation:voir", label: "Vue consolidée siège" },
    ],
  },
];

const ROLES = [
  { role: "proprietaire", label: "Propriétaire" },
  { role: "directeur_groupe", label: "Directeur groupe" },
  { role: "directeur_region", label: "Directeur région" },
  { role: "gerant", label: "Gérant" },
  { role: "gerant_stock", label: "Magasinier" },
  { role: "comptable", label: "Comptable" },
  { role: "vendeur", label: "Vendeur" },
  { role: "client", label: "Client" },
];

export function RolesPerms({ initial }: Props) {
  const [etat, setEtat] = useState(initial);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function basculer(role: string, permission: string, checked: boolean) {
    const cle = `${role}::${permission}`;
    setEnCours(cle);
    setErreur(null);
    const avant = etat[cle] ?? false;
    setEtat((e) => ({ ...e, [cle]: checked }));

    try {
      await togglePermissionRole(role, permission, checked);
    } catch (err) {
      setEtat((e) => ({ ...e, [cle]: avant }));
      setErreur((err as Error).message || "Erreur lors de l'enregistrement");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="card overflow-x-auto">
      {erreur && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {erreur}
        </div>
      )}
      <table className="min-w-max w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="pb-3 pr-4 font-medium text-gray-500">
              Fonctionnalité
            </th>
            {ROLES.map((r) => (
              <th
                key={r.role}
                className="pb-3 text-center font-medium text-gray-500"
              >
                {r.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPES.map((g) => (
            <PermissionRowGroup
              key={g.titre}
              groupe={g.titre}
              permissions={g.permissions}
              roles={ROLES}
              etat={etat}
              enCours={enCours}
              onToggle={basculer}
            />
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-gray-400">
        Les changements sont pris en compte lors des prochaines requêtes des
        utilisateurs concernés (pages et actions serveur).
      </p>
    </div>
  );
}

function PermissionRowGroup({
  groupe,
  permissions,
  roles,
  etat,
  enCours,
  onToggle,
}: {
  groupe: string;
  permissions: { code: string; label: string }[];
  roles: { role: string; label: string }[];
  etat: Record<string, boolean>;
  enCours: string | null;
  onToggle: (role: string, permission: string, checked: boolean) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={roles.length + 1} className="bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {groupe}
        </td>
      </tr>
      {permissions.map((p) => (
        <tr key={p.code} className="border-b border-gray-100 hover:bg-gray-50">
          <td className="py-2.5 pr-4 text-gray-800">{p.label}</td>
          {roles.map((r) => {
            const cle = `${r.role}::${p.code}`;
            const actif = etat[cle] ?? false;
            return (
              <td key={r.role} className="py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={actif}
                  disabled={enCours === cle}
                  onChange={(ev) => onToggle(r.role, p.code, ev.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}