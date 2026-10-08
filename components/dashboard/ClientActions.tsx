"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  modifierClient,
  toggleActifClient,
  reglerEncours,
} from "@/lib/actions";
import type { Client, TypeClient } from "@/types";

interface Props {
  client: Client;
  boutiqueId: string;
}

export function ClientActions({ client, boutiqueId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reglement, setReglement] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nom: client.nom,
    telephone: client.telephone || "",
    email: client.email || "",
    adresse: client.adresse || "",
    type_client: client.type_client as TypeClient,
    plafond_credit: String(client.plafond_credit),
  });
  const [montant, setMontant] = useState("");

  async function onToggle() {
    setLoading(true);
    setError("");
    try {
      await toggleActifClient(client.id, boutiqueId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function onRegler(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const m = Number(montant);
    if (!m || m <= 0) {
      setError("Montant invalide");
      setLoading(false);
      return;
    }
    try {
      await reglerEncours(client.id, boutiqueId, m);
      setReglement(false);
      setMontant("");
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
      await modifierClient(client.id, boutiqueId, {
        nom: form.nom,
        telephone: form.telephone || undefined,
        email: form.email || undefined,
        adresse: form.adresse || undefined,
        type_client: form.type_client,
        plafond_credit: form.plafond_credit ? Number(form.plafond_credit) : 0,
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
        <select
          value={form.type_client}
          onChange={(e) =>
            setForm({ ...form, type_client: e.target.value as TypeClient })
          }
          className="input-field"
          aria-label="Type"
        >
          <option value="grossiste">Grossiste</option>
          <option value="detaillant">Détaillant</option>
        </select>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.plafond_credit}
          onChange={(e) => setForm({ ...form, plafond_credit: e.target.value })}
          className="input-field"
          aria-label="Plafond de crédit"
          placeholder="Plafond de crédit"
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
                nom: client.nom,
                telephone: client.telephone || "",
                email: client.email || "",
                adresse: client.adresse || "",
                type_client: client.type_client as TypeClient,
                plafond_credit: String(client.plafond_credit),
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
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEditing(true)}
          disabled={loading}
          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          Modifier
        </button>
        {Number(client.encours) > 0 && (
          <button
            onClick={() => setReglement(true)}
            disabled={loading}
            className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            Régler un montant
          </button>
        )}
        <button
          onClick={onToggle}
          disabled={loading}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            client.actif
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {client.actif ? "Désactiver" : "Réactiver"}
        </button>
      </div>

      {reglement && (
        <form onSubmit={onRegler} className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className="input-field w-32"
            placeholder="Montant"
            required
            autoFocus
          />
          <button type="submit" disabled={loading} className="btn-primary px-3 py-1.5 text-xs">
            {loading ? "..." : "Valider"}
          </button>
          <button
            type="button"
            onClick={() => setReglement(false)}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Annuler
          </button>
        </form>
      )}
    </div>
  );
}