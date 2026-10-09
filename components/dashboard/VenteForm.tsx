"use client";

import { useMemo, useState } from "react";
import { creerVente } from "@/lib/actions";
import type { ModePaiement } from "@/types";

export interface ProduitVente {
  produit_id: string;
  nom: string;
  reference: string;
  prix_vente: number;
  disponible: number;
}

interface LignePanier {
  produit_id: string;
  nom: string;
  reference: string;
  prix_unitaire: number;
  quantite: number;
  disponible: number;
}

export interface ClientVente {
  id: string;
  nom: string;
  telephone: string | null;
  encours: number;
  plafond_credit: number;
}

interface VenteFormProps {
  boutiqueId: string;
  boutiqueNom: string;
  boutiqueAdresse: string | null;
  boutiqueTelephone: string | null;
  monnaie: string;
  vendeurNom: string;
  produits: ProduitVente[];
  clients: ClientVente[];
}

type Ecran = "panier" | "recu";

const MODES_PAIEMENT: { valeur: ModePaiement; label: string }[] = [
  { valeur: "especes", label: "Espèces" },
  { valeur: "mobile_money", label: "Mobile Money" },
  { valeur: "carte", label: "Carte" },
];

export function VenteForm({
  boutiqueId,
  boutiqueNom,
  boutiqueAdresse,
  boutiqueTelephone,
  monnaie,
  vendeurNom,
  produits,
  clients,
}: VenteFormProps) {
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [modePaiement, setModePaiement] = useState<ModePaiement>("especes");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoyee, setEnvoyee] = useState(false);
  const [ecran, setEcran] = useState<Ecran>("panier");
  const [clientId, setClientId] = useState("");
  const [montantVerse, setMontantVerse] = useState("");
  const [recu, setRecu] = useState<{
    reference: string;
    montantTotal: number;
    remise: number;
    date: string;
    paye: number;
    reste: number;
    clientNom: string | null;
  } | null>(null);
  const [montantRecu, setMontantRecu] = useState<string>("");
  const [codePromo, setCodePromo] = useState("");

  const clientChoisi = clients.find((c) => c.id === clientId) || null;

  const produitsVendables = produits.filter((p) => p.disponible > 0);

  const total = useMemo(
    () => lignes.reduce((somme, l) => somme + l.quantite * l.prix_unitaire, 0),
    [lignes]
  );

const reste = useMemo(() => {
    const recu = Number(montantRecu) || 0;
    if (modePaiement !== "especes") return 0;
    return recu - total;
  }, [montantRecu, total, modePaiement]);

  function ajouterProduit(
    produitId: string,
    quantiteDemandee: number = 1
  ) {
    const p = produitsVendables.find((x) => x.produit_id === produitId);
    if (!p || quantiteDemandee <= 0) return;

    setLignes((anciennes) => {
      const existante = anciennes.find((l) => l.produit_id === produitId);
      const qteActuelle = existante?.quantite ?? 0;
      const qteMax = p.disponible - qteActuelle;
      const qte = Math.min(quantiteDemandee, qteMax);
      if (qte <= 0) return anciennes;

      if (existante) {
        return anciennes.map((l) =>
          l.produit_id === produitId ? { ...l, quantite: l.quantite + qte } : l
        );
      }
      return [
        ...anciennes,
        {
          produit_id: p.produit_id,
          nom: p.nom,
          reference: p.reference,
          prix_unitaire: p.prix_vente,
          quantite: qte,
          disponible: p.disponible,
        },
      ];
    });
  }

  function modifierQuantite(produitId: string, quantite: number) {
    if (quantite <= 0) {
      setLignes((a) => a.filter((l) => l.produit_id !== produitId));
      return;
    }
    setLignes((a) =>
      a.map((l) =>
        l.produit_id === produitId
          ? { ...l, quantite: Math.min(quantite, l.disponible) }
          : l
      )
    );
  }

  function retirerLigne(produitId: string) {
    setLignes((a) => a.filter((l) => l.produit_id !== produitId));
  }

  function toutEffacer() {
    setLignes([]);
    setErreur(null);
    setMontantRecu("");
    setCodePromo("");
    setClientId("");
    setMontantVerse("");
    setEcran("panier");
    setRecu(null);
  }

  async function enregistrerVente() {
    if (lignes.length === 0) {
      setErreur("Ajoutez au moins un article au panier");
      return;
    }
    const parti = Number(montantVerse) || 0;
    if (clientId && parti <= 0) {
      setErreur("Indiquez le montant payé par le client");
      return;
    }
    if (
      !clientId &&
      modePaiement === "especes" &&
      !codePromo.trim() &&
      reste < 0
    ) {
      setErreur(`Montant reçu insuffisant (il manque ${-reste.toFixed(2)} ${monnaie})`);
      return;
    }

    setEnvoyee(true);
    setErreur(null);
    try {
      const resultat = await creerVente({
        boutique_id: boutiqueId,
        mode_paiement: modePaiement,
        code_promo: codePromo.trim() || undefined,
        client_id: clientId || undefined,
        montant_paye: clientId ? parti : undefined,
        lignes: lignes.map((l) => ({
          produit_id: l.produit_id,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
        })),
      });
      if (resultat.success) {
        setRecu({
          reference: resultat.reference,
          montantTotal: resultat.montantTotal,
          remise: resultat.remise || 0,
          date: new Date().toLocaleString("fr-FR"),
          paye: clientId ? parti : resultat.montantTotal,
          reste: resultat.reste || 0,
          clientNom: clientChoisi ? clientChoisi.nom : null,
        });
        setEcran("recu");
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de la vente");
    } finally {
      setEnvoyee(false);
    }
  }

  if (ecran === "recu" && recu) {
    return (
      <div className="card mb-8">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Vente enregistrée</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn-primary">
              Imprimer le reçu
            </button>
            <button onClick={toutEffacer} className="btn-secondary">
              Nouvelle vente
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-sm rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{boutiqueNom}</p>
            {boutiqueAdresse && (
              <p className="text-xs text-gray-500">{boutiqueAdresse}</p>
            )}
            {boutiqueTelephone && (
              <p className="text-xs text-gray-500">Tél : {boutiqueTelephone}</p>
            )}
          </div>

          <div className="my-4 border-t border-dashed border-gray-300">
            <div className="mt-2 flex justify-between text-xs text-gray-600">
              <span>N° {recu.reference}</span>
              <span>{recu.date}</span>
            </div>
            <p className="text-xs text-gray-600">Vendeur : {vendeurNom}</p>
            <p className="text-xs text-gray-600 capitalize">
              Paiement : {modePaiement.replace("_", " ")}
            </p>
            {recu.clientNom && (
              <p className="text-xs font-medium text-gray-700">
                Client : {recu.clientNom}
              </p>
            )}
          </div>

          <div className="border-t border-dashed border-gray-300 pt-2">
            {lignes.map((l) => (
              <div key={l.produit_id} className="flex justify-between text-sm">
                <span className="text-gray-800">
                  {l.nom} × {l.quantite}
                </span>
                <span className="text-gray-900">
                  {(l.quantite * l.prix_unitaire).toLocaleString("fr-FR")} {monnaie}
                </span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-gray-300 pt-2">
              {recu.remise > 0 && (
                <div className="w-full">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Sous-total</span>
                    <span>
                      {total.toLocaleString("fr-FR")} {monnaie}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Remise ({codePromo.toUpperCase()})</span>
                    <span>-{recu.remise.toLocaleString("fr-FR")} {monnaie}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-300 pt-2 text-base font-bold">
              <span className="text-gray-900">
                {recu.remise > 0 ? "TOTAL NET" : "TOTAL"}
              </span>
              <span className="text-gray-900">
                {recu.montantTotal.toLocaleString("fr-FR")} {monnaie}
              </span>
            </div>
            {modePaiement === "especes" && !recu.clientNom && (
              <div className="mt-1 flex justify-between text-sm text-gray-600">
                <span>Rendu</span>
                <span>
                  {(Number(montantRecu || 0) - recu.montantTotal > 0
                    ? Number(montantRecu || 0) - recu.montantTotal
                    : 0
                  ).toLocaleString("fr-FR")}{" "}
                  {monnaie}
                </span>
              </div>
            )}
            {recu.clientNom && (
              <>
                <div className="mt-1 flex justify-between text-sm text-gray-600">
                  <span>Payé</span>
                  <span>
                    {recu.paye.toLocaleString("fr-FR")} {monnaie}
                  </span>
                </div>
                {recu.reste > 0 && (
                  <div className="mt-1 flex justify-between text-sm font-semibold text-red-600">
                    <span>Reste à devoir</span>
                    <span>
                      {recu.reste.toLocaleString("fr-FR")} {monnaie}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Merci de votre visite !
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Nouvelle vente</h2>
        {lignes.length > 0 && (
          <button onClick={toutEffacer} className="text-sm text-red-600 hover:underline">
            Tout effacer
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Client (facultatif)
          </label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setMontantVerse("");
            }}
            className="input-field"
          >
            <option value="">— Vente comptant —</option>
            {clients
              .filter((c) => c.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                  {Number(c.encours) > 0
                    ? ` (encours : ${Number(c.encours).toLocaleString("fr-FR")})`
                    : ""}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Renseignez un client pour accepter un paiement partiel (crédit).
          </p>
        </div>
        {clientId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Montant payé
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={montantVerse}
              onChange={(e) => setMontantVerse(e.target.value)}
              className="input-field"
              placeholder={`0 — ${total} ${monnaie}`}
            />
            <p className="mt-1 text-xs text-gray-400">
              La différence ({total.toLocaleString("fr-FR")} {monnaie} au
              total) sera portée au crédit du client.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sélection produits */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Produit
          </label>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                ajouterProduit(e.target.value);
                e.target.value = "";
              }
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Sélectionner un produit…
            </option>
            {produitsVendables.map((p) => (
              <option key={p.produit_id} value={p.produit_id}>
                {p.nom} — {Number(p.prix_vente).toLocaleString("fr-FR")} {monnaie}
                {" ("}
                {p.disponible} dispo.)
              </option>
            ))}
          </select>
          {produitsVendables.length === 0 && (
            <p className="mt-2 text-sm text-gray-400">
              Aucun produit disponible à la vente (stock épuisé ou prix non défini).
            </p>
          )}

          <div className="mt-4">
            <p className="mb-1 text-sm font-medium text-gray-700">Articles</p>
            <div className="space-y-1">
              {lignes.map((l) => (
                <div
                  key={l.produit_id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{l.nom}</p>
                    <p className="text-xs text-gray-500">
                      {Number(l.prix_unitaire).toLocaleString("fr-FR")} {monnaie}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={l.disponible}
                      value={l.quantite}
                      onChange={(e) =>
                        modifierQuantite(l.produit_id, Number(e.target.value))
                      }
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => retirerLigne(l.produit_id)}
                      className="text-red-600 hover:text-red-800"
                      aria-label={`Retirer ${l.nom}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {lignes.length === 0 && (
                <p className="text-sm text-gray-400">Panier vide</p>
              )}
            </div>
          </div>
        </div>

        {/* Paiement */}
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Mode de paiement</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {MODES_PAIEMENT.map((m) => (
              <button
                key={m.valeur}
                onClick={() => setModePaiement(m.valeur)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  modePaiement === m.valeur
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {modePaiement === "especes" && (
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Montant reçu ({monnaie})
              </label>
              <input
                type="number"
                min={0}
                value={montantRecu}
                onChange={(e) => setMontantRecu(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="0"
              />
              <p
                className={`mt-1 text-sm ${
                  reste < 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {reste < 0
                  ? `Manque ${(-reste).toLocaleString("fr-FR")} ${monnaie}`
                  : `Rendu : ${reste.toLocaleString("fr-FR")} ${monnaie}`}
              </p>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Code promo (optionnel)
            </label>
            <input
              type="text"
              value={codePromo}
              onChange={(e) => setCodePromo(e.target.value.toUpperCase())}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Ex : GROSSISTE10"
            />
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <p className="text-lg font-bold text-gray-900">
              Total : {total.toLocaleString("fr-FR")} {monnaie}
            </p>
            <button
              onClick={enregistrerVente}
              disabled={envoyee || lignes.length === 0}
              className="btn-primary"
            >
              {envoyee ? "Enregistrement…" : "Encaisser la vente"}
            </button>
          </div>

          {erreur && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {erreur}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}