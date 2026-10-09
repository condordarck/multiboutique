import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import type { Boutique, Vente } from "@/types";

interface LigneRecu {
  produit_nom: string;
  produit_reference: string;
  produit_code: string | null;
  quantite: number;
  prix_unitaire: number;
}

const LIBELLE_MODE: Record<string, string> = {
  especes: "Espèces",
  mobile_money: "Mobile Money",
  carte: "Carte",
};

export default async function RecuVentePage({
  params,
}: {
  params: Promise<{ boutiqueId: string; venteId: string }>;
}) {
  const { boutiqueId, venteId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();

  const [bou] = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (!bou) notFound();

  const ventes = await query<
    Vente & { vendeur_nom: string; client_nom: string | null }
  >(
    `SELECT v.*, u.nom_complet AS vendeur_nom, cl.nom AS client_nom
     FROM ventes v
     JOIN utilisateurs u ON u.id = v.vendeur_id
     LEFT JOIN clients cl ON cl.id = v.client_id
     WHERE v.id = $1 AND v.boutique_id = $2`,
    [venteId, boutiqueId]
  );
  if (ventes.length === 0) notFound();
  const vente = ventes[0];

  const lignes = await query<LigneRecu>(
    `SELECT l.quantite, l.prix_unitaire,
            p.nom AS produit_nom, p.reference AS produit_reference, p.code AS produit_code
     FROM lignes_vente l
     JOIN produits p ON p.id = l.produit_id
     WHERE l.vente_id = $1
     ORDER BY l.created_at`,
    [venteId]
  );

  const total = Number(vente.montant_total) || 0;
  const paie = Number(vente.montant_paye) || 0;
  const reste = Math.max(0, total - paie);
  const retour = `/dashboard/${boutiqueId}/ventes`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-gray-900">Reçu de vente</h1>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-primary">
            Imprimer le reçu
          </button>
          <a href={retour} className="btn-secondary">
            Retour aux ventes
          </a>
        </div>
      </div>

      {vente.statut === "annulee" && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm font-semibold text-red-700 print:mb-2">
          VENTE ANNULÉE — {vente.motif_annulation || "motif non précisé"}
        </div>
      )}

      <div className="mx-auto max-w-sm rounded-lg border border-gray-200 bg-white p-6 print:border-0 print:p-0">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">{bou.nom}</p>
          {bou.adresse && <p className="text-xs text-gray-500">{bou.adresse}</p>}
          {bou.telephone && <p className="text-xs text-gray-500">Tél : {bou.telephone}</p>}
        </div>

        <div className="my-4 border-t border-dashed border-gray-300 pt-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span className="font-medium text-gray-800">N° {vente.reference_vente}</span>
            <span>{new Date(vente.created_at).toLocaleString("fr-FR")}</span>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Vendeur : {vente.vendeur_nom}
          </p>
          <p className="text-xs text-gray-600">
            Paiement : {LIBELLE_MODE[vente.mode_paiement] || vente.mode_paiement}
          </p>
          {vente.client_nom && (
            <p className="text-xs font-medium text-gray-800">
              Client : {vente.client_nom}
            </p>
          )}
        </div>

        <table className="w-full border-t border-dashed border-gray-300 text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[11px] uppercase text-gray-400">
              <th className="pb-1 font-medium">Article</th>
              <th className="pb-1 text-center font-medium">Qté</th>
              <th className="pb-1 text-right font-medium">PU</th>
              <th className="pb-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="py-1.5 pr-2 text-gray-800">
                  {l.produit_nom}
                  <span className="block text-[11px] text-gray-400">
                    {l.produit_code || l.produit_reference}
                  </span>
                </td>
                <td className="py-1.5 text-center text-gray-700">{l.quantite}</td>
                <td className="py-1.5 text-right text-gray-700">
                  {Number(l.prix_unitaire).toLocaleString("fr-FR")} {monnaie}
                </td>
                <td className="py-1.5 text-right font-medium text-gray-900">
                  {(Number(l.quantite) * Number(l.prix_unitaire)).toLocaleString("fr-FR")}{" "}
                  {monnaie}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 border-t border-gray-300 pt-2 text-sm">
          {Number(vente.remise) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Remise</span>
              <span>
                -{Number(vente.remise).toLocaleString("fr-FR")} {monnaie}
              </span>
            </div>
          )}
          <div className="mt-1 flex justify-between text-base font-bold text-gray-900">
            <span>TOTAL</span>
            <span>{total.toLocaleString("fr-FR")} {monnaie}</span>
          </div>
          {vente.client_id && (
            <>
              <div className="mt-1 flex justify-between text-sm text-gray-600">
                <span>Payé</span>
                <span>{paie.toLocaleString("fr-FR")} {monnaie}</span>
              </div>
              {vente.statut !== "annulee" && reste > 0 && (
                <div className="flex justify-between text-sm font-semibold text-red-600">
                  <span>Reste à devoir</span>
                  <span>{reste.toLocaleString("fr-FR")} {monnaie}</span>
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