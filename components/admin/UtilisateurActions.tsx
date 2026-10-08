"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toggleActifUtilisateur, reinitialiserMotDePasse } from "@/lib/actions";

interface Props {
  utilisateurId: string;
  actif: boolean;
  estMoi: boolean;
}

export function UtilisateurActions({ utilisateurId, actif, estMoi }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [mdpOpen, setMdpOpen] = useState(false);
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setError("");
    try {
      await toggleActifUtilisateur(utilisateurId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await reinitialiserMotDePasse(utilisateurId, nouveauMdp);
      setMdpOpen(false);
      setNouveauMdp("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleToggle}
          disabled={estMoi}
          className={`btn-secondary px-2 py-1 text-xs ${
            estMoi ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {actif ? "Désactiver" : "Activer"}
        </button>
        <button
          onClick={() => setMdpOpen((o) => !o)}
          className="btn-secondary px-2 py-1 text-xs"
        >
          Mot de passe
        </button>
      </div>
      {mdpOpen && (
        <form onSubmit={handleResetPassword} className="mt-2 flex gap-2">
          <input
            type="password"
            value={nouveauMdp}
            onChange={(e) => setNouveauMdp(e.target.value)}
            placeholder="Nouveau mot de passe"
            minLength={6}
            required
            className="input-field"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-3 py-1.5 text-xs"
          >
            {loading ? "..." : "OK"}
          </button>
        </form>
      )}
    </div>
  );
}