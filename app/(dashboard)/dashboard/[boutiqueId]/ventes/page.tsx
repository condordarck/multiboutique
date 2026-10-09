import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { VenteForm } from "@/components/dashboard/VenteForm";
import type { Boutique, Vente, PrixBoutique } from "@/types";

interface VenteAvecVendeur extends Vente {
  vendeur_nom: string;
}

interface ProduitVenteRow extends PrixBoutique {
  produit_nom: string;
  reference: string;
  quantite: number;
  quantite_reservee: number;
}

export default async function VentesPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();

  const peutVendre = aPermission(user, "ventes:creer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const ventes = await query<VenteAvecVendeur>(
    `SELECT v.*, u.nom_complet AS vendeur_nom
     FROM ventes v
     JOIN utilisateurs u ON u.id = v.vendeur_id
     WHERE v.boutique_id = $1
     ORDER BY v.created_at DESC
     LIMIT 50`,
    [boutiqueId]
  );

  const produitsRows = await query<ProduitVenteRow>(
    `SELECT pb.produit_id, pb.prix_vente, pb.cout_revient, pb.actif,
            p.nom AS produit_nom, p.reference AS reference,
            COALESCE(s.quantite, 0) AS quantite, COALESCE(s.quantite_reservee, 0) AS quantite_reservee
     FROM prix_boutique pb
     JOIN produits p ON p.id = pb.produit_id
     LEFT JOIN stocks s ON s.produit_id = pb.produit_id AND s.boutique_id = pb.boutique_id
     WHERE pb.boutique_id = $1 AND pb.actif = true
     ORDER BY p.nom`,
    [boutiqueId]
  );

  const produits = produitsRows.map((p) => ({
    produit_id: p.produit_id,
    nom: p.produit_nom,
    reference: p.reference,
    prix_vente: Number(p.prix_vente),
    disponible: Number(p.quantite) - Number(p.quantite_reservee),
  }));

  const clientsRows = await query<{
    id: string;
    nom: string;
    telephone: string | null;
    encours: number;
    plafond_credit: number;
  }>(
    `SELECT id, nom, telephone, encours, plafond_credit
     FROM clients
     WHERE boutique_id = $1 AND actif = true
     ORDER BY nom`,
    [boutiqueId]
  );
  const clients = clientsRows.map((c) => ({
    id: c.id,
    nom: c.nom,
    telephone: c.telephone,
    encours: Number(c.encours) || 0,
    plafond_credit: Number(c.plafond_credit) || 0,
  }));

  // Stats du jour / du mois (calcul côté serveur)
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const monthKey = todayKey.substring(0, 7);

  const ventesJour = ventes.filter(
    (v) => String(v.created_at).startsWith(todayKey) && v.statut === "validee"
  );
  const caJour = ventesJour.reduce(
    (acc, v) => acc + Number(v.montant_total),
    0
  );

  const ventesMois = ventes.filter(
    (v) => String(v.created_at).startsWith(monthKey) && v.statut === "validee"
  );
  const caMois = ventesMois.reduce(
    (acc, v) => acc + Number(v.montant_total),
    0
  );

  return (
    <div>
      <div className="print:hidden">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Ventes — {boutique.nom}
            </h1>
            <p className="text-gray-500">Encaissement et historique des ventes</p>
          </div>
        </div>
      </div>

      {peutVendre && (
<VenteForm
          boutiqueId={boutiqueId}
          boutiqueNom={boutique.nom}
          boutiqueAdresse={boutique.adresse}
          boutiqueTelephone={boutique.telephone}
          monnaie={monnaie}
          vendeurNom={user.nom_complet}
          produits={produits}
          clients={clients}
        />
      )}

      <div className="print:hidden">
        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="card">
            <p className="text-sm text-gray-500">Ventes aujourd&apos;hui</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {ventesJour.length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Ventes du mois</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {ventesMois.length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">CA du jour</p>
            <p className="mt-1 text-3xl font-bold text-green-600">
              {caJour.toLocaleString("fr-FR")} {monnaie}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">CA du mois</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">
              {caMois.toLocaleString("fr-FR")} {monnaie}
            </p>
          </div>
        </div>

        {/* Tableau des ventes */}
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 font-medium text-gray-500">Référence</th>
                  <th className="pb-3 font-medium text-gray-500">Date</th>
                  <th className="pb-3 font-medium text-gray-500">Vendeur</th>
                  <th className="pb-3 font-medium text-gray-500">Montant</th>
                  <th className="pb-3 font-medium text-gray-500">Paiement</th>
                  <th className="pb-3 font-medium text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ventes.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">
                      {v.reference_vente}
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(v.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-3 text-gray-700">{v.vendeur_nom}</td>
                    <td className="py-3 font-medium text-green-600">
                      {Number(v.montant_total).toLocaleString("fr-FR")} {monnaie}
                    </td>
                    <td className="py-3">
                      <span className="capitalize text-gray-700">
                        {v.mode_paiement === "especes"
                          ? "Espèces"
                          : v.mode_paiement === "mobile_money"
                          ? "Mobile Money"
                          : v.mode_paiement}
                      </span>
                    </td>
                    <td className="py-3">
                      {v.statut === "validee" ? (
                        <span className="badge-success">Validée</span>
                      ) : v.statut === "annulee" ? (
                        <span className="badge-danger">Annulée</span>
                      ) : (
                        <span className="badge-warning">Corrigée</span>
                      )}
                    </td>
                  </tr>
                ))}
                {ventes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      Aucune vente enregistrée
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}