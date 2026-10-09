"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerBoutique } from "@/lib/actions";
import type { Region } from "@/types";

interface CompteCree {
  role: string;
  label: string;
  email: string;
  password: string;
}

export function NouvelleBoutiqueForm({ regions }: { regions: Region[] }) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [regionId, setRegionId] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [comptes, setComptes] = useState<CompteCree[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setComptes([]);
    try {
      const resultat = await creerBoutique({
        nom,
        adresse,
        telephone,
        email,
        region_id: regionId || null,
        statut: "active",
      });
      setSuccess("Boutique créée avec ses profils d'équipe par défaut");
      setComptes(resultat.comptes || []);
      setNom("");
      setAdresse("");
      setTelephone("");
      setEmail("");
      setRegionId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mb-8">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        {open ? "Masquer le formulaire" : "+ Créer une boutique"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}
          {comptes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-800">
                Profils créés — notez ces accès, puis changez les mots de
                passe :
              </p>
              <ul className="mt-1 space-y-1 text-amber-900">
                {comptes.map((c) => (
                  <li key={c.email}>
                    <span className="font-medium">{c.label}</span> —{" "}
                    {c.email} / <span className="font-mono">{c.password}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
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
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Adresse
              </label>
              <input
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Région
              </label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="input-field"
              >
                <option value="">— Non rattachée —</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Créer la boutique"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}