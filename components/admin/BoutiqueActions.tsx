"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierBoutique } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  actif: boolean;
}

export function BoutiqueActions({
  boutiqueId,
  nom,
  adresse,
  telephone,
  email,
  actif,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nomEd, setNomEd] = useState(nom);
  const [adresseEd, setAdresseEd] = useState(adresse || "");
  const [telEd, setTelEd] = useState(telephone || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setError("");
    try {
      await modifierBoutique(boutiqueId, {
        nom,
        adresse: adresse || undefined,
        telephone: telephone || undefined,
        email: email || undefined,
        statut: actif ? "inactive" : "active",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await modifierBoutique(boutiqueId, {
        nom: nomEd,
        adresse: adresseEd || undefined,
        telephone: telEd || undefined,
        email: email || undefined,
        statut: actif ? "active" : "inactive",
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
      <form onSubmit={handleEdit} className="space-y-2">
        <input
          type="text"
          value={nomEd}
          onChange={(e) => setNomEd(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="text"
          value={adresseEd}
          onChange={(e) => setAdresseEd(e.target.value)}
          className="input-field"
          placeholder="Adresse"
        />
        <input
          type="tel"
          value={telEd}
          onChange={(e) => setTelEd(e.target.value)}
          className="input-field"
          placeholder="Téléphone"
        />
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

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="btn-secondary px-2 py-1 text-xs"
        >
          Modifier
        </button>
        <button
          onClick={handleToggle}
          className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            actif
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          {actif ? "Désactiver" : "Activer"}
        </button>
      </div>
    </div>
  );
}