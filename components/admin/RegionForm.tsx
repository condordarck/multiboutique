"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerRegion } from "@/lib/actions";
import type { Groupe } from "@/types";

export function RegionForm({ groupes }: { groupes: Groupe[] }) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [groupeId, setGroupeId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await creerRegion({ nom, groupe_id: groupeId });
      setSuccess("Région créée avec succès");
      setNom("");
      setGroupeId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        {open ? "Masquer le formulaire" : "+ Nouvelle région"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nom de la région
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="input-field"
              placeholder="Ex. Région Ouest"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Groupe
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
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Créer la région"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}