"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface Props {
  total: number;
}

const PERIODES = [
  { valeur: "", label: "Toute la période" },
  { valeur: "jour", label: "Aujourd'hui" },
  { valeur: "semaine", label: "Cette semaine" },
  { valeur: "mois", label: "Ce mois" },
  { valeur: "annee", label: "Cette année" },
];

const TYPES = [
  { valeur: "", label: "Tous les types" },
  { valeur: "entree", label: "Entrées" },
  { valeur: "sortie", label: "Sorties" },
  { valeur: "ajustement", label: "Ajustements" },
  { valeur: "transfert", label: "Transferts" },
];

export function MouvementsFiltres({ total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const periode = params.get("periode") || "";
  const type = params.get("type") || "";
  const produit = params.get("produit") || "";

  function maj(cle: string, valeur: string) {
    const p = new URLSearchParams(params.toString());
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="card mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Historique des mouvements</h2>
        <span className="text-sm text-gray-500">{total} mouvement{total > 1 ? "s" : ""}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Période
          </label>
          <select
            value={periode}
            onChange={(e) => maj("periode", e.target.value)}
            className="input-field"
          >
            {PERIODES.map((p) => (
              <option key={p.valeur} value={p.valeur}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => maj("type", e.target.value)}
            className="input-field"
          >
            {TYPES.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Rechercher un produit
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              defaultValue={produit}
              onKeyDown={(e) => {
                if (e.key === "Enter") maj("produit", (e.target as HTMLInputElement).value);
              }}
              onBlur={(e) => maj("produit", e.target.value)}
              className="input-field"
              placeholder="Nom ou référence…"
            />
            {(periode || type || produit) && (
              <button
                onClick={() => {
                  router.replace(pathname, { scroll: false });
                }}
                className="btn-secondary shrink-0"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}