"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { entrerStock, ajusterStock } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  produitId: string;
  quantite: number;
}

type Mode = "entree" | "ajustement" | null;

export function StockActions({ boutiqueId, produitId, quantite }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [quantiteValue, setQuantiteValue] = useState("");
  const [motif, setMotif] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const qte = Number(quantiteValue);

    try {
      if (mode === "entree") {
        if (!qte || qte <= 0) throw new Error("Quantité invalide");
        await entrerStock(boutiqueId, produitId, qte, motif);
      } else if (mode === "ajustement") {
        if (Number.isNaN(qte)) throw new Error("Quantité invalide");
        await ajusterStock(boutiqueId, produitId, qte, motif);
      }
      setMode(null);
      setQuantiteValue("");
      setMotif("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (mode) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <input
          type="number"
          min={mode === "entree" ? 1 : 0}
          value={quantiteValue}
          onChange={(e) => setQuantiteValue(e.target.value)}
          className="input-field"
          placeholder={mode === "entree" ? "Quantité entrée" : "Nouvelle quantité (total)"}
          required
        />
        <input
          type="text"
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          className="input-field"
          placeholder="Motif (optionnel)"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary px-3 py-1.5 text-xs">
            {loading ? "..." : "Valider"}
          </button>
          <button
            type="button"
            onClick={() => setMode(null)}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Annuler
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setMode("entree")}
        className="rounded-lg bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
      >
        Entrée
      </button>
      <button
        onClick={() => setMode("ajustement")}
        className="rounded-lg bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-100"
        title={`Stock total actuel : ${quantite}`}
      >
        Ajuster
      </button>
    </div>
  );
}