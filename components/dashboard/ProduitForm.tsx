"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerProduit, entrerStock } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  categories?: { id: string; nom: string }[];
}

export function ProduitForm({ boutiqueId, categories = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [coutRevient, setCoutRevient] = useState("");
  const [quantiteInitiale, setQuantiteInitiale] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const prix = Number(prixVente);
    if (!prix || prix <= 0) {
      setError("Le prix de vente doit être un nombre positif");
      setLoading(false);
      return;
    }

    try {
      const res = await creerProduit(
        boutiqueId,
        {
          nom,
          reference: reference || nom.replace(/\s+/g, "-").toUpperCase(),
          description: description || undefined,
          categorie_id: categorieId || undefined,
        },
        prix,
        coutRevient ? Number(coutRevient) : undefined
      );

      // Entrée de stock initiale facultative
      const qte = Number(quantiteInitiale);
      if (res.success && qte > 0) {
        await entrerStock(
          boutiqueId,
          res.produitId,
          qte,
          "Stock initial"
        );
      }

      setSuccess("Produit ajouté");
      setNom("");
      setReference("");
      setDescription("");
      setCategorieId("");
      setPrixVente("");
      setCoutRevient("");
      setQuantiteInitiale("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mb-8">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        {open ? "Masquer le formulaire" : "+ Nouveau produit"}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nom du produit
              </label>
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
                Référence (optionnel)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="input-field"
                placeholder="auto si vide"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Catégorie (rayon)
              </label>
              <select
                value={categorieId}
                onChange={(e) => setCategorieId(e.target.value)}
                className="input-field"
              >
                <option value="">Aucune</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Prix de vente *
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
                Coût de revient
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Quantité initiale en stock
              </label>
              <input
                type="number"
                min="0"
                value={quantiteInitiale}
                onChange={(e) => setQuantiteInitiale(e.target.value)}
                className="input-field"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Ajout..." : "Ajouter le produit"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}