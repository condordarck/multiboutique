"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerReservation } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  produitId: string;
  produitNom: string;
  disponible: number;
}

export function FormulaireReservation({
  boutiqueId,
  produitId,
  produitNom,
  disponible,
}: Props) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [dateRetrait, setDateRetrait] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const qte = Number(quantite);
    if (!nom.trim() || !telephone.trim()) {
      setError("Le nom et le téléphone sont requis");
      setLoading(false);
      return;
    }
    if (!qte || qte < 1 || qte > disponible) {
      setError(`Quantité invalide (disponible : ${disponible})`);
      setLoading(false);
      return;
    }

    try {
      const res = await creerReservation({
        client_nom: nom.trim(),
        client_telephone: telephone.trim(),
        client_email: email.trim() || undefined,
        boutique_id: boutiqueId,
        date_retrait_prevue: dateRetrait || undefined,
        lignes: [{ produit_id: produitId, quantite: qte }],
      });
      router.push(`/reservation/${res.reservationId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la réservation"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Réserver un article</h2>
        <p className="text-sm text-gray-500">
          {produitNom} — {disponible} disponible{disponible > 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Nom complet *</span>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="input-field mt-1"
            placeholder="Votre nom"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Téléphone *</span>
          <input
            type="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            className="input-field mt-1"
            placeholder="Votre numéro"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email (optionnel)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field mt-1"
            placeholder="Pour suivre vos réservations"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Quantité</span>
          <input
            type="number"
            min={1}
            max={disponible}
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className="input-field mt-1"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-gray-700">
            Date de retrait prévue (optionnel)
          </span>
          <input
            type="date"
            value={dateRetrait}
            onChange={(e) => setDateRetrait(e.target.value)}
            className="input-field mt-1"
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Réservation..." : "Confirmer la réservation"}
        </button>
        <a href={`/boutique/${boutiqueId}/catalogue`} className="btn-secondary">
          Annuler
        </a>
      </div>

      <p className="text-xs text-gray-400">
        Aucun compte nécessaire : présentez-vous en boutique avec la référence
        pour régler et récupérer vos articles.
      </p>
    </form>
  );
}