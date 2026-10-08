"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerCommande } from "@/lib/actions";
import type { Client, TermePaiement } from "@/types";

interface ProduitPrix {
  produit_id: string;
  nom: string;
  prix_vente: number;
}

interface Props {
  boutiqueId: string;
  clients: Client[];
  produits: ProduitPrix[];
}

interface Ligne {
  produit_id: string;
  quantite: number;
  prix_unitaire: number;
}

export function CommandeForm({ boutiqueId, clients, produits }: Props) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [terme, setTerme] = useState<TermePaiement>("comptant");
  const [codePromo, setCodePromo] = useState("");
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

  function majLigne(index: number, patch: Partial<Ligne>) {
    setLignes((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  }

  function choisirProduit(index: number, produitId: string) {
    const p = produits.find((x) => x.produit_id === produitId);
    setLignes((prev) =>
      prev.map((l, i) =>
        i === index
          ? { ...l, produit_id: produitId, prix_unitaire: p ? p.prix_vente : 0 }
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
      const result = await creerCommande(boutiqueId, {
        client_id: clientId,
        terme_paiement: terme,
        code_promo: codePromo || undefined,
        note: note || undefined,
        lignes: lignes.map((l) => ({
          produit_id: l.produit_id,
          quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_unitaire),
        })),
      });
      setSuccess(
        `Commande ${result.reference} enregistrée (${result.montantTotal.toLocaleString("fr-FR")})`
      );
      setClientId("");
      setTerme("comptant");
      setCodePromo("");
      setNote("");
      setLignes([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setLoading(false);
    }
  }

  const totalBrut = lignes.reduce(
    (acc, l) => acc + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0),
    0
  );

  return (
    <div className="card mb-8">
      <button onClick={() => setOpen((o) => !o)} className="btn-primary">
        {open ? "Masquer le formulaire" : "+ Nouvelle commande grossiste"}
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
                Client
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="input-field"
                required
              >
                <option value="">— Choisir un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Modalité de paiement
              </label>
              <select
                value={terme}
                onChange={(e) => setTerme(e.target.value as TermePaiement)}
                className="input-field"
              >
                <option value="comptant">Comptant</option>
                <option value="credit">À crédit (encours)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Code promo (facultatif)
              </label>
              <input
                type="text"
                value={codePromo}
                onChange={(e) => setCodePromo(e.target.value.toUpperCase())}
                className="input-field"
                placeholder="Ex. GROSSISTE25"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Articles
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
                      majLigne(i, { quantite: Number(e.target.value) })
                    }
                    className="input-field w-24"
                    aria-label="Quantité"
                    required
                  />
                  <span className="w-8 text-right text-sm text-gray-500">
                    ×
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={l.prix_unitaire || ""}
                    onChange={(e) =>
                      majLigne(i, { prix_unitaire: Number(e.target.value) })
                    }
                    className="input-field w-32"
                    aria-label="Prix unitaire"
                    title="Prix officiel proposé automatiquement"
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

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Note (facultatif)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field"
              placeholder="Conditions de livraison, référence client…"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Total brut :{" "}
              <span className="font-bold text-gray-900">
                {totalBrut.toLocaleString("fr-FR")}
              </span>
            </p>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Créer la commande"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}