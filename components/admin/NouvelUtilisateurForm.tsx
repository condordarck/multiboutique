"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerUtilisateur } from "@/lib/actions";
import type { Boutique, Groupe, Region, RoleUtilisateur } from "@/types";

const ROLES: { value: RoleUtilisateur; label: string; description: string }[] =
  [
    { value: "administrateur", label: "Administrateur", description: "Configuration générale du système" },
    { value: "proprietaire", label: "Propriétaire", description: "Vue globale sur toutes les boutiques" },
    { value: "directeur_groupe", label: "Directeur de groupe", description: "Vue consolidée d'un groupe (siège)" },
    { value: "directeur_region", label: "Directeur de région", description: "Vue consolidée d'une région" },
    { value: "gerant", label: "Gérant", description: "Gère sa boutique (ventes, stock, prix)" },
    { value: "gerant_stock", label: "Gérant stock", description: "Suit les stocks et mouvements" },
    { value: "comptable", label: "Comptable", description: "Lecture seule sur ventes et mouvements" },
    { value: "vendeur", label: "Vendeur", description: "Enregistre les ventes au comptoir" },
    { value: "client", label: "Client", description: "Réservations en ligne" },
  ];

const ROLES_AVEC_BOUTIQUE = ["gerant", "gerant_stock", "comptable", "vendeur"];

interface Props {
  boutiques: Boutique[];
  groupes: Groupe[];
  regions: Region[];
}

export function NouvelUtilisateurForm({ boutiques, groupes, regions }: Props) {
  const router = useRouter();
  const [nomComplet, setNomComplet] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState<RoleUtilisateur>("gerant");
  const [boutiqueIds, setBoutiqueIds] = useState<string[]>([]);
  const [regionId, setRegionId] = useState("");
  const [groupeId, setGroupeId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggleBoutique(id: string) {
    setBoutiqueIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await creerUtilisateur({
        nom_complet: nomComplet,
        email,
        password,
        telephone,
        role,
        boutique_ids: boutiqueIds,
        region_id: regionId || null,
        groupe_id: groupeId || null,
      });
      setSuccess("Compte créé avec succès");
      setNomComplet("");
      setEmail("");
      setPassword("");
      setTelephone("");
      setBoutiqueIds([]);
      setRegionId("");
      setGroupeId("");
      setRole("gerant");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  const roleRequiertBoutique = ROLES_AVEC_BOUTIQUE.includes(role);
  const roleRequiertScope =
    role === "directeur_groupe" || role === "directeur_region";

  return (
    <div className="card mb-8">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-primary"
      >
        {open ? "Masquer le formulaire" : "+ Créer un utilisateur"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nom complet
              </label>
              <input
                type="text"
                value={nomComplet}
                onChange={(e) => setNomComplet(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Téléphone
              </label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="input-field"
                placeholder="+243 ..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                minLength={6}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Profil
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleUtilisateur)}
              className="input-field"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label} — {r.description}
                </option>
              ))}
            </select>
          </div>

          {roleRequiertScope && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {role === "directeur_groupe" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Groupe supervisé
                  </label>
                  <select
                    value={groupeId}
                    onChange={(e) => setGroupeId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">— Sélectionner un groupe —</option>
                    {groupes.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nom}
                      </option>
                    ))}
                  </select>
                  {groupes.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      Aucun groupe configuré. Créez-en un dans Organisation.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Région supervisée
                  </label>
                  <select
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">— Sélectionner une région —</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nom}
                      </option>
                    ))}
                  </select>
                  {regions.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      Aucune région configurée. Créez-en une dans Organisation.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Périmètre d&apos;accès
                </label>
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {role === "directeur_groupe"
                    ? "Toutes les boutiques du groupe sélectionné"
                    : "Toutes les boutiques de la région sélectionnée"}
                </p>
              </div>
            </div>
          )}

          {roleRequiertBoutique && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Boutiques rattachées (le gérant n&apos;a accès qu&apos;à ses
                boutiques)
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {boutiques.map((b) => (
                  <label
                    key={b.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={boutiqueIds.includes(b.id)}
                      onChange={() => toggleBoutique(b.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    {b.nom}
                  </label>
                ))}
                {boutiques.length === 0 && (
                  <p className="text-sm text-gray-400">
                    Aucune boutique active disponible
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Créer le compte"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}