"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  confirmerCommande,
  livrerCommande,
  annulerCommande,
} from "@/lib/actions";
import type { StatutCommande } from "@/types";

interface Props {
  commandeId: string;
  statut: StatutCommande;
}

export function CommandeActions({ commandeId, statut }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onConfirmer() {
    setLoading(true);
    setError("");
    try {
      await confirmerCommande(commandeId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function onLivrer() {
    if (
      !window.confirm(
        "Livrer cette commande ? Le stock sera déduit de la boutique."
      )
    )
      return;
    setLoading(true);
    setError("");
    try {
      await livrerCommande(commandeId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function onAnnuler() {
    if (!window.confirm("Annuler cette commande ?")) return;
    setLoading(true);
    setError("");
    try {
      await annulerCommande(commandeId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  if (statut !== "en_attente" && statut !== "confirmee") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {statut === "en_attente" && (
          <button
            onClick={onConfirmer}
            disabled={loading}
            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
          >
            Confirmer
          </button>
        )}
        {statut === "confirmee" && (
          <button
            onClick={onLivrer}
            disabled={loading}
            className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
          >
            Livrer
          </button>
        )}
        <button
          onClick={onAnnuler}
          disabled={loading}
          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}