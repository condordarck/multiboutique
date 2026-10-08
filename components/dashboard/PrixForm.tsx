"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierPrix } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  produitId: string;
  prixVente: number;
  coutRevient: number | null;
}

export function PrixForm({ boutiqueId, produitId, prixVente, coutRevient }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [prix, setPrix] = useState(String(prixVente));
  const [cout, setCout] = useState(coutRevient != null ? String(coutRevient) : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const p = Number(prix);
    if (!p || p <= 0) {
      setError("Le prix de vente doit être positif");
      setLoading(false);
      return;
    }

    try {
      await modifierPrix(
        boutiqueId,
        produitId,
        p,
        cout.trim() ? Number(cout) : undefined
      );
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-blue-600 hover:underline text-sm font-medium"
      >
        Modifier le prix
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          className="input-field"
          aria-label="Prix de vente"
          required
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={cout}
          onChange={(e) => setCout(e.target.value)}
          className="input-field"
          aria-label="Coût de revient"
          placeholder="Coût"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary px-3 py-1.5 text-xs">
          {loading ? "..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}