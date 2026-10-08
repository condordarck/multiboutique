"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publierPrixReference } from "@/lib/actions";

interface Produit {
  produit_id: string;
  nom: string;
  prix_vente: number | null;
}

interface Props {
  produits: Produit[];
}

export function PrixConseillesPublisher({ produits }: Props) {
  const router = useRouter();
  const [produitId, setProduitId] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [coutRevient, setCoutRevient] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function choisirProduit(id: string) {
    setProduitId(id);
    const p = produits.find((x) => x.produit_id === id);
    setPrixVente(p && p.prix_vente ? String(p.prix_vente) : "");
    setCoutRevient("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await publierPrixReference({
        produit_id: produitId,
        prix_vente: Number(prixVente),
        cout_revient: coutRevient ? Number(coutRevient) : null,
        actif: true,
      });
      setSuccess("Prix conseillé publié — les boutiques peuvent l&apos;appliquer");
      setProduitId("");
      setPrixVente("");
      setCoutRevient("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mb-6">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        {open ? "Masquer le formulaire" : "+ Publier un prix conseillé"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Produit
              </label>
              <select
                value={produitId}
                onChange={(e) => choisirProduit(e.target.value)}
                className="input-field"
                required
              >
                <option value="">— Produit —</option>
                {produits.map((p) => (
                  <option key={p.produit_id} value={p.produit_id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Prix de vente conseillé
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={prixVente}
                onChange={(e) => setPrixVente(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Coût de revient conseillé
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={coutRevient}
                onChange={(e) => setCoutRevient(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Publication..." : "Publier"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}