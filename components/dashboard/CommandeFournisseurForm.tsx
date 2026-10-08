"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerCommandeFournisseur } from "@/lib/actions";
import type { Fournisseur } from "@/types";

interface ProduitCout {
  produit_id: string;
  nom: string;
  cout_revient: number | null;
  prix_vente: number | null;
}

interface Props {
  boutiqueId: string;
  fournisseurs: Fournisseur[];
  produits: ProduitCout[];
}

interface Ligne {
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
}

export function CommandeFournisseurForm({
  boutiqueId,
  fournisseurs,
  produits,
}: Props) {
  const router = useRouter();
  const [fournisseurId, setFournisseurId] = useState("");
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function ajouterLigne() {
    setLignes((prev) => [
      ...prev,
      { produit_id: "", quantite: 1, prix_unitaire: 0 },
    ]);
  }

  function choisirProduit(index: number, produitId: string) {
    const p = produits.find((x) => x.produit_id === produitId);
    setLignes((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              produit_id: produitId,
              prix_unitaire: p && p.cout_revient ? p.cout_revient : 0,
            }
          : l
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!lignes.length || lignes.some((l) => !l.produit_id)) {
      setError("Ajoutez au moins une ligne avec un produit");
      setLoading(false);
      return;
    }

    try {
      const result = await creerCommandeFournisseur(boutiqueId, {
        fournisseur_id: fournisseurId,
        note: note || undefined,
        lignes: lignes.map((l) => ({
          produit_id: l.produit_id,
          quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_unitaire),
        })),
      });
      setSuccess(`Commande fournisseur ${result.reference} enregistrée`);
      setFournisseurId("");
      setNote("");
      setLignes([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const totalAttendu = lignes.reduce(
    (acc, l) => acc + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0),
    0
  );

  return (
    <div className="card mb-8">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        {open ? "Masquer le formulaire" : "+ Commandez au fournisseur"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fournisseur
              </label>
              <select
                value={fournisseurId}
                onChange={(e) => setFournisseurId(e.target.value)}
                className="input-field"
                required
              >
                <option value="">— Choisir un fournisseur —</option>
                {fournisseurs.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Note (facultatif)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Articles (prix = coût de revient enregistré)
            </label>
            <div className="space-y-2">
              {lignes.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    value={l.produit_id}
                    onChange={(e) => choisirProduit(i, e.target.value)}
                    className="input-field flex-1"
                    aria-label="Produit"
                    required
                  >
                    <option value="">— Produit —</option>
                    {produits.map((p) => (
                      <option key={p.produit_id} value={p.produit_id}>
                        {p.nom}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={l.quantite}
                    onChange={(e) =>
                      setLignes((prev) =>
                        prev.map((x, idx) =>
                          idx === i ? { ...x, quantite: Number(e.target.value) } : x
                        )
                      )
                    }
                    className="input-field w-24"
                    aria-label="Quantité"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={l.prix_unitaire || ""}
                    onChange={(e) =>
                      setLignes((prev) =>
                        prev.map((x, idx) =>
                          idx === i
                            ? { ...x, prix_unitaire: Number(e.target.value) }
                            : x
                        )
                      )
                    }
                    className="input-field w-32"
                    aria-label="Prix d'achat"
                    title="Coût d'achat unitaire"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLignes((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {lignes.length === 0 && (
                <p className="text-sm text-gray-400">Aucun article</p>
              )}
            </div>
            <button
              type="button"
              onClick={ajouterLigne}
              className="mt-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
            >
              + Ajouter un article
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Total attendu :{" "}
              <span className="font-bold text-gray-900">
                {totalAttendu.toLocaleString("fr-FR")}
              </span>
            </p>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Passer la commande"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}