"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { creerProduit, entrerStock } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  categories?: { id: string; nom: string; code?: string | null }[];
}

export function ProduitForm({ boutiqueId, categories = [] }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");
  const [reference, setReference] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [prixVente, setPrixVente] = useState("");
  const [coutRevient, setCoutRevient] = useState("");
  const [quantiteInitiale, setQuantiteInitiale] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const categorieChoisie = categories.find((c) => c.id === categorieId);
  const apercuCode = code.trim()
    ? code.trim().toUpperCase()
    : `${(categorieChoisie?.code || "PRD")}-000${(categories.length || 0) + 1}`;

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setUploadEnCours(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", fichier);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload impossible");
      setImageUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploadEnCours(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

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
          image_url: imageUrl || undefined,
          code: code || undefined,
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
      setCode("");
      setDescription("");
      setCategorieId("");
      setPrixVente("");
      setCoutRevient("");
      setQuantiteInitiale("");
      setImageUrl("");
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Photo produit
              </label>
              <div className="flex items-center gap-3">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Aperçu produit"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
                    {uploadEnCours ? "…" : "Aucune"}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <input
                    ref={photoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handlePhoto}
                    disabled={uploadEnCours}
                    className="text-sm text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                  />
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="text-left text-xs text-red-600 hover:underline"
                    >
                      Retirer la photo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Code produit (nomenclature)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="input-field uppercase"
                placeholder={apercuCode}
              />
              <p className="mt-1 text-xs text-gray-400">
                Vide = généré automatiquement (ex. {apercuCode}) — pour le
                scanner des produits plus tard.
              </p>
            </div>
            <div>
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