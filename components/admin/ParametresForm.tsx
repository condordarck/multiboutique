"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mettreAJourParametres } from "@/lib/actions";

interface Props {
  monnaie: string;
  nomApplication: string;
  seuilAlerte: string;
  delaiRelance: string;
}

export function ParametresForm({
  monnaie,
  nomApplication,
  seuilAlerte,
  delaiRelance,
}: Props) {
  const router = useRouter();
  const [monnaieEd, setMonnaieEd] = useState(monnaie);
  const [nomAppEd, setNomAppEd] = useState(nomApplication);
  const [seuilEd, setSeuilEd] = useState(seuilAlerte);
  const [delaiEd, setDelaiEd] = useState(delaiRelance);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await mettreAJourParametres([
        { cle: "monnaie", valeur: monnaieEd },
        { cle: "nom_application", valeur: nomAppEd },
        { cle: "seuil_alerte_defaut", valeur: seuilEd },
        { cle: "relance_delai_jours", valeur: delaiEd },
      ]);
      setMessage("Paramètres enregistrés");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {message && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Monnaie affichée
        </label>
        <input
          type="text"
          value={monnaieEd}
          onChange={(e) => setMonnaieEd(e.target.value)}
          className="input-field"
          maxLength={5}
          placeholder="$"
        />
        <p className="mt-1 text-xs text-gray-400">
          Symbole ou code utilisé dans tous les prix (ex : $, FC, USD).
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Nom de l&apos;application
        </label>
        <input
          type="text"
          value={nomAppEd}
          onChange={(e) => setNomAppEd(e.target.value)}
          className="input-field"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Seuil d&apos;alerte stock par défaut
        </label>
        <input
          type="number"
          value={seuilEd}
          onChange={(e) => setSeuilEd(e.target.value)}
          className="input-field"
          min={0}
        />
        <p className="mt-1 text-xs text-gray-400">
          Alerte déclenchée quand le disponible passe sous ce seuil pour un
          nouveau produit.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Délai de relance des créances (jours)
        </label>
        <input
          type="number"
          value={delaiEd}
          onChange={(e) => setDelaiEd(e.target.value)}
          className="input-field"
          min={1}
        />
        <p className="mt-1 text-xs text-gray-400">
          Un client avec un reste dû est signalé dans la page Clients après ce
          nombre de jours sans activité.
        </p>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}