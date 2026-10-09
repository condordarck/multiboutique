"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerClient } from "@/lib/actions";
import type { TypeClient } from "@/types";

interface Props {
  boutiqueId: string;
}

export function ClientForm({ boutiqueId }: Props) {
  const router = useRouter();
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [adresse, setAdresse] = useState("");
  const [typeClient, setTypeClient] = useState<TypeClient>("grossiste");
  const [plafond, setPlafond] = useState("");
  const [estVip, setEstVip] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await creerClient(boutiqueId, {
        nom,
        telephone,
        email,
        adresse,
        type_client: typeClient,
        plafond_credit: plafond ? Number(plafond) : 0,
        est_vip: estVip,
      });
      setSuccess("Client créé avec succès");
      setNom("");
      setTelephone("");
      setEmail("");
      setAdresse("");
      setPlafond("");
      setTypeClient("grossiste");
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
        {open ? "Masquer le formulaire" : "+ Nouveau client"}
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Téléphone</label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Adresse</label>
              <input
                type="text"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Type de client
              </label>
              <select
                value={typeClient}
                onChange={(e) => setTypeClient(e.target.value as TypeClient)}
                className="input-field"
              >
                <option value="grossiste">Grossiste</option>
                <option value="detaillant">Détaillant</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Plafond de crédit (0 = au comptant)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={plafond}
                onChange={(e) => setPlafond(e.target.value)}
                className="input-field"
                placeholder="0"
              />
            </div>
          </div>

          <label className="flex w-fit items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={estVip}
              onChange={(e) => setEstVip(e.target.checked)}
              className="h-4 w-4 accent-amber-500"
            />
            Client VIP <span className="text-xs text-amber-600">★</span>
            <span className="text-xs font-normal text-gray-400">
              Paiement partiel autorisé à la vente (créance suivie au registre)
            </span>
          </label>

          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Création..." : "Créer le client"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}