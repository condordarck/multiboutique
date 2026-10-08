"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerCodePromo } from "@/lib/actions";
import type { TypeReduction } from "@/types";

interface Props {
  boutiqueId: string;
}

export function CodePromoForm({ boutiqueId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [typeReduction, setTypeReduction] = useState<TypeReduction>("pourcentage");
  const [valeur, setValeur] = useState("");
  const [maxUtilisations, setMaxUtilisations] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setCode("");
    setDescription("");
    setTypeReduction("pourcentage");
    setValeur("");
    setMaxUtilisations("");
    setDateDebut("");
    setDateFin("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const v = Number(valeur);
    if (!code.trim()) {
      setError("Le code promo est requis");
      setLoading(false);
      return;
    }
    if (!v || v <= 0 || (typeReduction === "pourcentage" && v > 100)) {
      setError(
        typeReduction === "pourcentage"
          ? "Le pourcentage doit être entre 1 et 100"
          : "Le montant doit être positif"
      );
      setLoading(false);
      return;
    }
    if (dateDebut && dateFin && dateDebut > dateFin) {
      setError("La date de fin est antérieure à la date de début");
      setLoading(false);
      return;
    }

    try {
      await creerCodePromo(boutiqueId, {
        code,
        description: description || undefined,
        type_reduction: typeReduction,
        valeur_reduction: v,
        max_utilisations: maxUtilisations
          ? Number(maxUtilisations)
          : null,
        date_debut: dateDebut || null,
        date_fin: dateFin || null,
      });
      setSuccess("Code promo créé (inactif, lancez-le quand il doit être actif)");
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mb-8">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        {open ? "Masquer le formulaire" : "+ Nouveau code promo"}
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
                Code promo *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="input-field"
                placeholder="EX : GROSSISTE10"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description (optionnel)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                placeholder="Ex : remise grossiste 10%"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Type de réduction
              </label>
              <select
                value={typeReduction}
                onChange={(e) => setTypeReduction(e.target.value as TypeReduction)}
                className="input-field"
              >
                <option value="pourcentage">Pourcentage (%)</option>
                <option value="montant">Montant fixe</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {typeReduction === "pourcentage"
                  ? "Pourcentage de réduction *"
                  : "Montant de réduction *"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={typeReduction === "pourcentage" ? 100 : undefined}
                value={valeur}
                onChange={(e) => setValeur(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Date de début (optionnel)
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Date de fin (optionnel)
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Limite d&apos;utilisations (laisser vide = illimité)
              </label>
              <input
                type="number"
                min="1"
                value={maxUtilisations}
                onChange={(e) => setMaxUtilisations(e.target.value)}
                className="input-field"
                placeholder="Illimité"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Créer le code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}