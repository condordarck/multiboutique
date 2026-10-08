import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { CommandeForm } from "@/components/dashboard/CommandeForm";
import { CommandeActions } from "@/components/dashboard/CommandeActions";
import type { Boutique, Client, Commande } from "@/types";

interface CommandeRow extends Commande {
  client_nom: string;
  client_type: string;
  code_promo: string | null;
  nb_lignes: number;
}

interface ProduitPrix {
  produit_id: string;
  nom: string;
  prix_vente: number;
}

const LIBELLES_STATUT: Record<string, string> = {
  en_attente: "En attente",
  confirmee: "Confirmée",
  livree: "Livrée",
  annulee: "Annulée",
};

const BADGES_STATUT: Record<string, string> = {
  en_attente: "badge-warning",
  confirmee: "badge-info",
  livree: "badge-success",
  annulee: "badge-danger",
};

export default async function CommandesPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();
  if (!aPermission(user, "commandes:voir")) notFound();
  const peutGerer = aPermission(user, "commandes:gerer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const clients = await query<Client>(
    `SELECT * FROM clients WHERE boutique_id = $1 AND actif = true ORDER BY nom`,
    [boutiqueId]
  );

  const produits = await query<ProduitPrix>(
    `SELECT p.id AS produit_id, p.nom, pb.prix_vente
     FROM prix_boutique pb
     INNER JOIN produits p ON p.id = pb.produit_id
     WHERE pb.boutique_id = $1 AND pb.actif = true
     ORDER BY p.nom`,
    [boutiqueId]
  );

  const commandes = await query<CommandeRow>(
    `SELECT c.*, cl.nom AS client_nom, cl.type_client AS client_type,
            cp.code AS code_promo,
            (SELECT COUNT(*)::int FROM lignes_commandes lc WHERE lc.commande_id = c.id) AS nb_lignes
     FROM commandes c
     INNER JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN codes_promo cp ON cp.id = c.code_promo_id
     WHERE c.boutique_id = $1
     ORDER BY c.created_at DESC`,
    [boutiqueId]
  );

  const fmtDate = (d: string | Date | null) =>
    d ? new Date(d).toLocaleDateString("fr-FR") : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Commandes B2B — {boutique.nom}
        </h1>
        <p className="text-gray-500">
          Bons de commande grossistes : confirmation, livraison (déduction du
          stock) et suivi de l&apos;encours
        </p>
      </div>

      {peutGerer && (
        <CommandeForm
          boutiqueId={boutiqueId}
          clients={clients}
          produits={produits}
        />
      )}

      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Commandes en cours
        </h2>
        {!peutGerer && (
          <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
            Lecture seule — la gestion des commandes est réservée au gérant et
            au propriétaire.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Référence</th>
                <th className="pb-3 font-medium text-gray-500">Client</th>
                <th className="pb-3 font-medium text-gray-500">Total</th>
                <th className="pb-3 font-medium text-gray-500">Remise</th>
                <th className="pb-3 font-medium text-gray-500">Net</th>
                <th className="pb-3 font-medium text-gray-500">Paiement</th>
                <th className="pb-3 font-medium text-gray-500">Date</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commandes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 align-top">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{c.reference_commande}</p>
                    <p className="text-xs text-gray-500">
                      {c.nb_lignes} article{c.nb_lignes > 1 ? "s" : ""}
                    </p>
                  </td>
                  <td className="py-3">
                    <p className="text-gray-700">{c.client_nom}</p>
                    <p className="text-xs uppercase text-gray-400">{c.client_type}</p>
                  </td>
                  <td className="py-3 text-gray-600">
                    {Number(c.montant_brut).toLocaleString("fr-FR")} {monnaie}
                  </td>
                  <td className="py-3">
                    {Number(c.remise) > 0 ? (
                      <span className="font-medium text-green-600">
                        −{Number(c.remise).toLocaleString("fr-FR")} {monnaie}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 font-medium text-gray-900">
                    {Number(c.montant_total).toLocaleString("fr-FR")} {monnaie}
                  </td>
                  <td className="py-3 text-gray-600">
                    {c.terme_paiement === "credit" ? "À crédit" : "Comptant"}
                    {c.code_promo && (
                      <p className="text-xs uppercase text-blue-600">{c.code_promo}</p>
                    )}
                  </td>
                  <td className="py-3 text-gray-500">{fmtDate(c.created_at)}</td>
                  <td className="py-3">
                    <span className={BADGES_STATUT[c.statut]}>
                      {LIBELLES_STATUT[c.statut]}
                    </span>
                  </td>
                  <td className="py-3">
                    {peutGerer ? (
                      <CommandeActions commandeId={c.id} statut={c.statut} />
                    ) : (
                      <span className="text-gray-400">Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))}
              {commandes.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-400">
                    Aucune commande. Créez un client sur l&apos;onglet Clients
                    puis une commande ci-dessus.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}