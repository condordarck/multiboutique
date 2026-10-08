"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  modifierCodePromo,
  toggleActifCodePromo,
  supprimerCodePromo,
} from "@/lib/actions";
import type { CodePromo, TypeReduction } from "@/types";

interface Props {
  code: CodePromo;
}

const toInputDate = (d: string | Date | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

export function CodePromoActions({ code }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    code: code.code,
    description: code.description || "",
    type_reduction: code.type_reduction as TypeReduction,
    valeur_reduction: String(code.valeur_reduction),
    max_utilisations: code.max_utilisations !== null ? String(code.max_utilisations) : "",
    date_debut: toInputDate(code.date_debut),
    date_fin: toInputDate(code.date_fin),
  });

  async function onToggle() {
    setLoading(true);
    setError("");
    try {
      await toggleActifCodePromo(code.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!window.confirm(`Supprimer définitivement le code ${code.code} ?`)) return;
    setLoading(true);
    setError("");
    try {
      await supprimerCodePromo(code.id);
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
    const valeur = Number(form.valeur_reduction);
    if (!form.code.trim() || !valeur || valeur <= 0) {
      setError("Code ou valeur invalide");
      setLoading(false);
      return;
    }
    if (form.date_debut && form.date_fin && form.date_debut > form.date_fin) {
      setError("La date de fin est antérieure à la date de début");
      setLoading(false);
      return;
    }
    try {
      await modifierCodePromo(code.id, {
        code: form.code,
        description: form.description || undefined,
        type_reduction: form.type_reduction,
        valeur_reduction: valeur,
        max_utilisations: form.max_utilisations
          ? Number(form.max_utilisations)
          : null,
        date_debut: form.date_debut || null,
        date_fin: form.date_fin || null,
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
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          className="input-field"
          aria-label="Code"
          required
        />
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input-field"
          aria-label="Description"
          placeholder="Description"
        />
        <select
          value={form.type_reduction}
          onChange={(e) =>
            setForm({ ...form, type_reduction: e.target.value as TypeReduction })
          }
          className="input-field"
          aria-label="Type"
        >
          <option value="pourcentage">Pourcentage (%)</option>
          <option value="montant">Montant fixe</option>
        </select>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={form.valeur_reduction}
          onChange={(e) => setForm({ ...form, valeur_reduction: e.target.value })}
          className="input-field"
          aria-label="Valeur"
          required
        />
        <input
          type="date"
          value={form.date_debut}
          onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
          className="input-field"
          aria-label="Début"
        />
        <input
          type="date"
          value={form.date_fin}
          onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
          className="input-field"
          aria-label="Fin"
        />
        <input
          type="number"
          min="1"
          value={form.max_utilisations}
          onChange={(e) => setForm({ ...form, max_utilisations: e.target.value })}
          className="input-field"
          aria-label="Limite utilisations"
          placeholder="Limite (vide = illimité)"
        />
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary px-3 py-1.5 text-xs">
            {loading ? "..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setForm({
                code: code.code,
                description: code.description || "",
                type_reduction: code.type_reduction as TypeReduction,
                valeur_reduction: String(code.valeur_reduction),
                max_utilisations: code.max_utilisations !== null ? String(code.max_utilisations) : "",
                date_debut: toInputDate(code.date_debut),
                date_fin: toInputDate(code.date_fin),
              });
            }}
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
      <div className="flex gap-2">
        <button
          onClick={onToggle}
          disabled={loading}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            code.actif
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          {code.actif ? "Arrêter" : "Lancer"}
        </button>
        <button
          onClick={() => setEditing(true)}
          disabled={loading}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          Modifier
        </button>
        <button
          onClick={onDelete}
          disabled={loading}
          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}