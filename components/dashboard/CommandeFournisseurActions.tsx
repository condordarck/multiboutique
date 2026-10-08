"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recevoirCommandeFournisseur, annulerCommandeFournisseur } from "@/lib/actions";

export interface LigneReception {
  ligne_id: string;
  produit_nom: string;
  quantite_commandee: number;
  quantite_recue: number;
}

interface Props {
  commandeId: string;
  reference: string;
  lignes: LigneReception[];
  statut: string;
}

export function CommandeFournisseurActions({
  commandeId,
  reference,
  lignes,
  statut,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recepts, setRecepts] = useState<Record<string, string>>({});

  async function onAnnuler() {
    if (!window.confirm(`Annuler la commande fournisseur ${reference} ?`)) return;
    setLoading(true);
    setError("");
    try {
      await annulerCommandeFournisseur(commandeId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function onReception(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const entrantes = Object.entries(recepts)
      .map(([ligne_id, q]) => ({
        ligne_id,
        quantite_recue: Number(q),
      }))
      .filter((r) => r.quantite_recue && r.quantite_recue > 0);
    if (entrantes.length === 0) {
      setError("Entrez au moins une quantité reçue");
      setLoading(false);
      return;
    }
    try {
      const result = await recevoirCommandeFournisseur(commandeId, entrantes);
      setRecepts({});
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const peutRecevoir = statut === "en_attente" || statut === "partielle";

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {peutRecevoir && (
          <button
            onClick={() => setOpen((o) => !o)}
            disabled={loading}
            className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            {open ? "Fermer" : "Réceptionner"}
          </button>
        )}
        {statut === "en_attente" && (
          <button
            onClick={onAnnuler}
            disabled={loading}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Annuler
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={onReception} className="mt-2 space-y-2 rounded-lg bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-700">
            Réception — {reference}
          </p>
          {lignes.map((l) => {
            const restant = l.quantite_commandee - l.quantite_recue;
            return (
              <div key={l.ligne_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-700">{l.produit_nom}</p>
                  <p className="text-xs text-gray-500">
                    Reçu {l.quantite_recue} / {l.quantite_commandee}
                  </p>
                </div>
                <input
                  type="number"
                  min="0"
                  max={restant}
                  value={recepts[l.ligne_id] ?? ""}
                  onChange={(e) =>
                    setRecepts({ ...recepts, [l.ligne_id]: e.target.value })
                  }
                  className="input-field w-24"
                  placeholder={`Max ${restant}`}
                />
              </div>
            );
          })}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Annuler
            </button>
            <button type="submit" disabled={loading} className="btn-primary px-3 py-1.5 text-xs">
              {loading ? "..." : "Valider la réception"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}