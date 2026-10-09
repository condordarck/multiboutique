"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  modifierClient,
  toggleActifClient,
  reglerEncours,
  basculerVip,
  listerRegistre,
} from "@/lib/actions";
import type { Client, TypeClient } from "@/types";

interface Props {
  client: Client;
  boutiqueId: string;
}

interface LigneRegistre {
  id: string;
  type: "vente" | "versement" | "annulation";
  libelle: string;
  montant: number;
  soldeApres: number;
  auteurNom: string | null;
  createdAt: string;
}

const LIBELLES_TYPE: Record<LigneRegistre["type"], string> = {
  vente: "Vente à crédit",
  versement: "Versement",
  annulation: "Annulation",
};

export function ClientActions({ client, boutiqueId }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reglement, setReglement] = useState(false);
  const [registre, setRegistre] = useState(false);
  const [lignesRegistre, setLignesRegistre] = useState<LigneRegistre[] | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nom: client.nom,
    telephone: client.telephone || "",
    email: client.email || "",
    adresse: client.adresse || "",
    type_client: client.type_client as TypeClient,
    plafond_credit: String(client.plafond_credit),
    est_vip: client.est_vip,
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

  async function onVip() {
    setLoading(true);
    setError("");
    try {
      await basculerVip(client.id, boutiqueId);
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

  async function onRegistre() {
    if (registre) {
      setRegistre(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const ligne = await listerRegistre(client.id, boutiqueId);
      setLignesRegistre(ligne);
      setRegistre(true);
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
        est_vip: form.est_vip,
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
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.est_vip}
            onChange={(e) => setForm({ ...form, est_vip: e.target.checked })}
            className="h-4 w-4 accent-amber-500"
          />
          Client VIP <span className="text-xs text-amber-600">★</span>
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-3 py-1.5 text-xs"
          >
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
                est_vip: client.est_vip,
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
          onClick={onVip}
          disabled={loading}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            client.est_vip
              ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {client.est_vip ? "★ VIP" : "☆ Marquer VIP"}
        </button>
        <button
          onClick={onRegistre}
          disabled={loading}
          className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-100"
        >
          Registre
        </button>
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
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-3 py-1.5 text-xs"
          >
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

      {registre && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-700">
            Registre des créances — {client.nom}
          </p>
          {!lignesRegistre || lignesRegistre.length === 0 ? (
            <p className="text-xs text-gray-500">
              Aucune opération enregistrée.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {lignesRegistre.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {LIBELLES_TYPE[l.type]}
                      {l.type === "vente" || l.type === "annulation"
                        ? l.libelle.split("—")[1]
                          ? ` — ${l.libelle.split("—")[1].trim()}`
                          : ""
                        : ""}
                    </p>
                    <p className="text-gray-500">
                      {new Date(l.createdAt).toLocaleString("fr-FR")}
                      {l.auteurNom ? ` · ${l.auteurNom}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        l.montant > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {l.montant > 0 ? "+" : ""}
                      {l.montant.toLocaleString("fr-FR")}
                    </p>
                    <p className="text-gray-500">
                      Solde : {l.soldeApres.toLocaleString("fr-FR")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}