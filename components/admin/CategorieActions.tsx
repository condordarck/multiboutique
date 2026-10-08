"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierCategorie, supprimerCategorie } from "@/lib/actions";

interface Props {
  categorieId: string;
  nom: string;
  description: string | null;
  nbProduits: number;
}

export function CategorieActions({
  categorieId,
  nom,
  description,
  nbProduits,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editNom, setEditNom] = useState(nom);
  const [editDesc, setEditDesc] = useState(description || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await modifierCategorie(categorieId, editNom, editDesc || undefined);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer la catégorie « ${nom} » ?`)) return;
    setLoading(true);
    setError("");
    try {
      await supprimerCategorie(categorieId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleEdit} className="space-y-2">
        {error && (
          <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>
        )}
        <input
          type="text"
          value={editNom}
          onChange={(e) => setEditNom(e.target.value)}
          className="input-field text-sm"
          required
        />
        <input
          type="text"
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          className="input-field text-sm"
          placeholder="Description"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary text-sm">
            {loading ? "..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-secondary text-sm"
          >
            Annuler
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm font-medium text-blue-600 hover:underline"
      >
        Modifier
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={nbProduits > 0 || loading}
        className="text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
        title={
          nbProduits > 0
            ? "Déplacez d'abord les produits rattachés"
            : "Supprimer"
        }
      >
        Supprimer
      </button>
    </div>
  );
}