"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierBoutique, listerComptesBoutique, creerUtilisateursDefaut } from "@/lib/actions";

interface Props {
  boutiqueId: string;
  nom: string;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  actif: boolean;
}

interface CompteBoutique {
  id: string;
  nom_complet: string;
  email: string;
  role: string;
  actif: boolean;
}

interface CompteCree {
  role: string;
  label: string;
  email: string;
  password: string;
}

export function BoutiqueActions({
  boutiqueId,
  nom,
  adresse,
  telephone,
  email,
  actif,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nomEd, setNomEd] = useState(nom);
  const [adresseEd, setAdresseEd] = useState(adresse || "");
  const [telEd, setTelEd] = useState(telephone || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [comptesOpen, setComptesOpen] = useState(false);
  const [comptes, setComptes] = useState<CompteBoutique[] | null>(null);
  const [crees, setCrees] = useState<CompteCree[]>([]);
  const [chargementComptes, setChargementComptes] = useState(false);

  async function handleToggle() {
    setError("");
    try {
      await modifierBoutique(boutiqueId, {
        nom,
        adresse: adresse || undefined,
        telephone: telephone || undefined,
        email: email || undefined,
        statut: actif ? "inactive" : "active",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await modifierBoutique(boutiqueId, {
        nom: nomEd,
        adresse: adresseEd || undefined,
        telephone: telEd || undefined,
        email: email || undefined,
        statut: actif ? "active" : "inactive",
      });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function ouvrirComptes() {
    if (comptesOpen) {
      setComptesOpen(false);
      return;
    }
    setChargementComptes(true);
    setError("");
    try {
      const liste = await listerComptesBoutique(boutiqueId);
      setComptes(liste);
      setCrees([]);
      setComptesOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setChargementComptes(false);
    }
  }

  async function genererManquants() {
    setChargementComptes(true);
    setError("");
    try {
      const resultat = await creerUtilisateursDefaut(boutiqueId);
      setCrees(resultat.comptes);
      const liste = await listerComptesBoutique(boutiqueId);
      setComptes(liste);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setChargementComptes(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleEdit} className="space-y-2">
        <input
          type="text"
          value={nomEd}
          onChange={(e) => setNomEd(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="text"
          value={adresseEd}
          onChange={(e) => setAdresseEd(e.target.value)}
          className="input-field"
          placeholder="Adresse"
        />
        <input
          type="tel"
          value={telEd}
          onChange={(e) => setTelEd(e.target.value)}
          className="input-field"
          placeholder="Téléphone"
        />
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary px-3 py-1.5 text-xs">
            {loading ? "..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            Annuler
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="btn-secondary px-2 py-1 text-xs"
        >
          Modifier
        </button>
        <button
          onClick={ouvrirComptes}
          className="rounded-lg bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
        >
          Comptes
        </button>
        <button
          onClick={handleToggle}
          className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
            actif
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          {actif ? "Désactiver" : "Activer"}
        </button>
      </div>

      {comptesOpen && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-gray-700">
              Comptes de la boutique ({comptes?.length || 0})
            </p>
            <button
              onClick={genererManquants}
              disabled={chargementComptes}
              className="rounded-lg bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {chargementComptes
                ? "..."
                : "Créer les profils par défaut manquants"}
            </button>
          </div>

          {crees.length > 0 && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="mb-1 text-xs font-semibold text-amber-800">
                Profils créés — conservez ces accès et changez les mots de
                passe :
              </p>
              <ul className="space-y-1 text-xs text-amber-900">
                {crees.map((c) => (
                  <li key={c.email}>
                    <span className="font-medium">{c.label}</span> —{" "}
                    {c.email} / <span className="font-mono">{c.password}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comptes && comptes.length === 0 ? (
            <p className="text-xs text-gray-500">Aucun compte rattaché.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(comptes || []).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-gray-800">
                    <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 capitalize">
                      {c.role.replace("_", " ")}
                    </span>{" "}
                    {c.nom_complet}
                  </span>
                  <span
                    className={`shrink-0 ${
                      c.actif ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {c.actif ? "actif" : "inactif"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}