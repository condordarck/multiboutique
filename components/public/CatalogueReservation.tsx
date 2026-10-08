"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { creerReservation } from "@/lib/actions";

interface ArticleCatalogue {
  produit_id: string;
  produit_nom: string;
  produit_reference: string;
  disponible: number;
  prix_vente: number;
  categorie_id: string | null;
  categorie_nom: string | null;
}

interface LignePanier {
  produit_id: string;
  produit_nom: string;
  quantite: number;
  disponible: number;
  prix_vente: number;
}

interface Props {
  boutiqueId: string;
  catalogue: ArticleCatalogue[];
  categories?: { id: string; nom: string; nb_produits: number }[];
  produitInitial?: string | null;
  categorieInitiale?: string | null;
}

type Tri = "nom" | "prix_asc" | "prix_desc" | "dispo_desc";

const LABELS_TRI: Record<Tri, string> = {
  nom: "Nom (A → Z)",
  prix_asc: "Prix croissant",
  prix_desc: "Prix décroissant",
  dispo_desc: "Plus de stock",
};

const TAILLE_MAX = 200;
const TAILLE_MIN = 1;
const TAILLE_PAS = 1;

export function CatalogueReservation({
  boutiqueId,
  catalogue,
  categories = [],
  produitInitial,
  categorieInitiale,
}: Props) {
  const router = useRouter();
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [recherche, setRecherche] = useState("");
  const [categorie, setCategorie] = useState<string>(
    categorieInitiale && categories.some((c) => c.id === categorieInitiale)
      ? categorieInitiale
      : ""
  );
  const [tri, setTri] = useState<Tri>("nom");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [dateRetrait, setDateRetrait] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Pré-sélection d'un article via ?reserve=<produit_id>
  useEffect(() => {
    if (!produitInitial) return;
    const article = catalogue.find((c) => c.produit_id === produitInitial);
    if (!article) return;
    setLignes((cur) => {
      if (cur.some((l) => l.produit_id === article.produit_id)) return cur;
      return [
        ...cur,
        {
          produit_id: article.produit_id,
          produit_nom: article.produit_nom,
          quantite: 1,
          disponible: article.disponible,
          prix_vente: Number(article.prix_vente || 0),
        },
      ];
    });
  }, [produitInitial, catalogue]);

  // Filtre + tri
  const articlesAffiches = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let liste = catalogue.filter(
      (c) =>
        (!categorie || c.categorie_id === categorie) &&
        (!q ||
          c.produit_nom.toLowerCase().includes(q) ||
          c.produit_reference.toLowerCase().includes(q) ||
          (c.categorie_nom || "").toLowerCase().includes(q))
    );
    liste = [...liste].sort((a, b) => {
      switch (tri) {
        case "prix_asc":
          return a.prix_vente - b.prix_vente;
        case "prix_desc":
          return b.prix_vente - a.prix_vente;
        case "dispo_desc":
          return b.disponible - a.disponible;
        default:
          return a.produit_nom.localeCompare(b.produit_nom, "fr");
      }
    });
    return liste;
  }, [catalogue, recherche, tri, categorie]);

  const categoriesVisibles = useMemo(
    () => categories.filter((c) => c.nb_produits > 0),
    [categories]
  );

  const total = lignes.reduce(
    (acc, l) => acc + l.quantite * l.prix_vente,
    0
  );
  const nombreArticles = lignes.reduce((acc, l) => acc + l.quantite, 0);

  function ajouter(article: ArticleCatalogue) {
    setLignes((cur) => {
      const existante = cur.find((l) => l.produit_id === article.produit_id);
      if (existante) {
        if (existante.quantite >= existante.disponible) return cur;
        return cur.map((l) =>
          l.produit_id === article.produit_id
            ? { ...l, quantite: l.quantite + 1 }
            : l
        );
      }
      return [
        ...cur,
        {
          produit_id: article.produit_id,
          produit_nom: article.produit_nom,
          quantite: 1,
          disponible: article.disponible,
          prix_vente: Number(article.prix_vente || 0),
        },
      ];
    });
  }

  function changerQuantite(produitId: string, delta: number) {
    setLignes((cur) =>
      cur
        .map((l) =>
          l.produit_id === produitId
            ? { ...l, quantite: Math.max(0, l.quantite + delta) }
            : l
        )
        .filter((l) => l.quantite > 0)
    );
  }

  function saisirQuantite(produitId: string, valeur: string) {
    const n = Number(valeur);
    setLignes((cur) =>
      cur.map((l) => {
        if (l.produit_id !== produitId) return l;
        // Champ vidé : on garde la quantité minimale (1), jamais vide
        if (valeur === "" || !Number.isFinite(n))
          return { ...l, quantite: TAILLE_MIN };
        const q = Math.min(Math.max(TAILLE_MIN, Math.trunc(n)), l.disponible);
        return { ...l, quantite: q };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!nom.trim() || !telephone.trim()) {
      setError("Le nom et le téléphone sont requis");
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
        lignes: lignes.map((l) => ({
          produit_id: l.produit_id,
          quantite: l.quantite,
        })),
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* Catalogue */}
      <div>
        {/* Chips de catégories */}
        {categoriesVisibles.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategorie("")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !categorie
                  ? "bg-blue-600 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Tous
            </button>
            {categoriesVisibles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setCategorie(categorie === c.id ? "" : c.id)
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  categorie === c.id
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {c.nom}
                <span
                  className={`ml-1.5 text-xs ${
                    categorie === c.id ? "text-blue-100" : "text-gray-400"
                  }`}
                >
                  {c.nb_produits}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Barre recherche + tri */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un article..."
              className="input-field w-full pl-10"
            />
          </div>
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="input-field sm:w-56"
            aria-label="Trier les articles"
          >
            {(Object.keys(LABELS_TRI) as Tri[]).map((t) => (
              <option key={t} value={t}>
                {LABELS_TRI[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {articlesAffiches.length} article{articlesAffiches.length > 1 ? "s" : ""}
            {recherche.trim() && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                pour « {recherche.trim()} »
              </span>
            )}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {articlesAffiches.map((item) => {
            const ligne = lignes.find((l) => l.produit_id === item.produit_id);
            const maxAtteint = ligne && ligne.quantite >= item.disponible;
            return (
              <div
                key={item.produit_id}
                className={`rounded-xl border bg-white p-4 transition-all hover:shadow-md ${
                  ligne
                    ? "border-blue-500 ring-1 ring-blue-200"
                    : "border-gray-200"
                }`}
              >
                <div className="mb-3 flex h-24 items-center justify-center rounded-lg bg-gray-100">
                  <svg
                    className="h-10 w-10 text-gray-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                <h3 className="font-semibold text-gray-900">{item.produit_nom}</h3>
                <p className="text-xs text-gray-500">{item.produit_reference}</p>

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-lg font-bold text-green-600">
                    {Number(item.prix_vente || 0).toLocaleString("fr-FR")} $
                  </p>
                  <span
                    className={`text-xs font-medium ${
                      item.disponible > 20
                        ? "text-green-600"
                        : item.disponible > 5
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {item.disponible} dispo{item.disponible > 1 ? "s" : ""}
                  </span>
                </div>

                {ligne ? (
                  <div className="mt-3 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => changerQuantite(item.produit_id, -TAILLE_PAS)}
                      className="h-8 w-8 flex-none rounded-lg border border-gray-200 text-lg text-gray-600 hover:bg-gray-50"
                      aria-label="Réduire la quantité"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={TAILLE_MIN}
                      max={item.disponible}
                      step={TAILLE_PAS}
                      value={ligne.quantite}
                      onChange={(e) =>
                        saisirQuantite(item.produit_id, e.target.value)
                      }
                      className="h-8 w-14 rounded-lg border border-gray-200 text-center text-sm font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => changerQuantite(item.produit_id, TAILLE_PAS)}
                      disabled={maxAtteint}
                      className="h-8 w-8 flex-none rounded-lg border border-gray-200 text-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      aria-label="Augmenter la quantité"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => ajouter(item)}
                    className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    Ajouter au panier
                  </button>
                )}
              </div>
            );
          })}

          {articlesAffiches.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-400">
              {recherche.trim()
                ? "Aucun article ne correspond à votre recherche."
                : "Aucun produit disponible dans cette boutique"}
            </div>
          )}
        </div>
      </div>

      {/* Panier + formulaire */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Réservation ({nombreArticles} article{nombreArticles > 1 ? "s" : ""})
            </h2>
            {lignes.length > 0 && (
              <button
                type="button"
                onClick={() => setLignes([])}
                className="text-sm text-gray-400 hover:text-red-600"
              >
                Vider
              </button>
            )}
          </div>

          {error && (
            <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {lignes.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Votre panier est vide.
              <br />
              Sélectionnez un ou plusieurs articles pour réserver.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100">
                {lignes.map((l) => (
                  <li key={l.produit_id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {l.produit_nom}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(l.prix_vente * l.quantite).toLocaleString("fr-FR")} $
                        <span className="text-gray-400">
                          {" "}
                          · {l.prix_vente.toLocaleString("fr-FR")} $/u
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changerQuantite(l.produit_id, -1)}
                        className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                        aria-label="Réduire la quantité"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={l.disponible}
                        value={l.quantite}
                        onChange={(e) => saisirQuantite(l.produit_id, e.target.value)}
                        className="h-7 w-14 rounded-md border border-gray-200 px-1 text-center text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => changerQuantite(l.produit_id, 1)}
                        disabled={l.quantite >= l.disponible}
                        className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                        aria-label="Augmenter la quantité"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => changerQuantite(l.produit_id, -l.quantite)}
                        className="h-7 w-7 rounded-md text-gray-400 hover:text-red-600"
                        aria-label="Retirer l'article"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-sm font-medium text-gray-500">Total</span>
                <span className="text-xl font-bold text-gray-900">
                  {total.toLocaleString("fr-FR")} $
                </span>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Nom complet *
                  </span>
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
                  <span className="text-sm font-medium text-gray-700">
                    Téléphone *
                  </span>
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
                  <span className="text-sm font-medium text-gray-700">
                    Email (optionnel)
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field mt-1"
                    placeholder="Pour suivre vos réservations"
                  />
                </label>

                <label className="block">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading
                    ? "Réservation en cours..."
                    : `Confirmer (${total.toLocaleString("fr-FR")} $)`}
                </button>
              </form>
            </>
          )}

          <p className="mt-4 text-xs text-gray-400">
            Aucun compte nécessaire : présentez-vous en boutique avec la
            référence pour régler et récupérer vos articles.
          </p>
        </div>
      </aside>
    </div>
  );
}