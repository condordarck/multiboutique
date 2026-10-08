"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierFournisseur, toggleActifFournisseur } from "@/lib/actions";
import type { Fournisseur } from "@/types";

interface Props {
  fournisseur: Fournisseur;
  boutiqueId: string;
}

export function FournisseurActions({ fournisseur, boutiqueId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nom: fournisseur.nom,
    telephone: fournisseur.telephone || "",
    email: fournisseur.email || "",
    adresse: fournisseur.adresse || "",
  });

  async function onToggle() {
    setLoading(true);
    setError("");
    try {
      await toggleActifFournisseur(fournisseur.id, boutiqueId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function onEdit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (!form.nom.trim()) {
      setError("Le nom est requis");
      setLoading(false);
      return;
    }
    try {
      await modifierFournisseur(fournisseur.id, boutiqueId, {
        nom: form.nom,
        telephone: form.telephone || undefined,
        email: form.email || undefined,
        adresse: form.adresse || undefined,
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={onEdit} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
        <input
          type="text"
          value={form.nom}
          onChange={(e) => setForm({ ...form, nom: e.target.value })}
          className="input-field"
          aria-label="Nom"
          required
        />
        <input
          type="tel"
          value={form.telephone}
          onChange={(e) => setForm({ ...form, telephone: e.target.value })}
          className="input-field"
          aria-label="Téléphone"
          placeholder="Téléphone"
        />
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="input-field"
          aria-label="Email"
          placeholder="Email"
        />
        <input
          type="text"
          value={form.adresse}
          onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          className="input-field"
          aria-label="Adresse"
          placeholder="Adresse"
        />
        <div className="flex gap-2 sm:col-span-2">
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

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEditing(true)}
          disabled={loading}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          Modifier
        </button>
        <button
          onClick={onToggle}
          disabled={loading}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            fournisseur.actif
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {fournisseur.actif ? "Désactiver" : "Réactiver"}
        </button>
      </div>
    </div>
  );
}