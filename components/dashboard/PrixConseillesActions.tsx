"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appliquerPrixConseilles } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  produitIds?: string[];
}

export function PrixConseillesActions({ boutiqueId, produitIds }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function onAppliquer() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await appliquerPrixConseilles(boutiqueId, produitIds);
      setSuccess(`${result.appliques} prix appliqué${result.appliques > 1 ? "s" : ""}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-600">{success}</p>}
      <button
        onClick={onAppliquer}
        disabled={loading}
        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
      >
        {loading ? "..." : "Appliquer ici"}
      </button>
    </div>
  );
}