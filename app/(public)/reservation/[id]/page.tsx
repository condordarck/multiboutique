import { notFound } from "next/navigation";
import Link from "next/link";
import { query } from "@/lib/db";
import type { Reservation, Boutique } from "@/types";

interface LigneAvecProduit {
  id: string;
  produit_nom: string;
  produit_reference: string;
  quantite: number;
  prix_unitaire: number;
}

export default async function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const reservations = await query<Reservation>(
    `SELECT * FROM reservations WHERE id = $1`,
    [id]
  );
  if (reservations.length === 0) notFound();
  const reservation = reservations[0];

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1`,
    [reservation.boutique_id]
  );
  const boutique = boutiques[0] || null;

  const lignes = await query<LigneAvecProduit>(
    `SELECT lr.id, p.nom AS produit_nom, p.reference AS produit_reference, lr.quantite, lr.prix_unitaire
     FROM lignes_reservation lr
     JOIN produits p ON p.id = lr.produit_id
     WHERE lr.reservation_id = $1
     ORDER BY lr.created_at`,
    [id]
  );

  const statutLabels: Record<string, string> = {
    en_attente: "En attente de retrait",
    prete: "Prête pour retrait",
    payee: "Payée",
    retiree: "Retirée",
    annulee: "Annulée",
  };

  const statutColors: Record<string, string> = {
    en_attente: "bg-yellow-100 text-yellow-800",
    prete: "bg-blue-100 text-blue-800",
    payee: "bg-green-100 text-green-800",
    retiree: "bg-green-100 text-green-800",
    annulee: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-sm font-bold text-white">MB</span>
            </div>
            <span className="text-lg font-bold text-gray-900">MultiBoutique</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">
          Détail de la réservation
        </h1>

        <div className="card">
          {/* Statut */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Référence</p>
              <p className="text-lg font-bold text-gray-900">
                {reservation.reference_reservation}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                statutColors[reservation.statut] || ""
              }`}
            >
              {statutLabels[reservation.statut] || reservation.statut}
            </span>
          </div>

          {/* Infos client */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              Informations client
            </h3>
            <p className="text-gray-900">{reservation.client_nom}</p>
            <p className="text-sm text-gray-600">
              {reservation.client_telephone}
            </p>
            {reservation.client_email && (
              <p className="text-sm text-gray-600">{reservation.client_email}</p>
            )}
          </div>

          {/* Boutique */}
          <div className="mb-6 rounded-lg bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-medium text-blue-500">
              Boutique de retrait
            </h3>
            <p className="font-semibold text-gray-900">{boutique?.nom}</p>
            <p className="text-sm text-gray-600">{boutique?.adresse}</p>
            <p className="text-sm text-gray-600">{boutique?.telephone}</p>
          </div>

          {/* Articles */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium text-gray-500">
              Articles réservés
            </h3>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {lignes.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-gray-900">{l.produit_nom}</p>
                    <p className="text-sm text-gray-500">
                      {l.produit_reference} — Qty: {l.quantite}
                    </p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    {(l.prix_unitaire * l.quantite).toLocaleString("fr-FR")} $
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-green-50 p-4">
            <span className="text-sm font-medium text-green-700">
              Total à payer
            </span>
            <span className="text-2xl font-bold text-green-700">
              {Number(reservation.montant_total).toLocaleString("fr-FR")} $
            </span>
          </div>

          {/* Date */}
          <div className="mt-4 text-sm text-gray-500">
            <p>
              Réservation effectuée le :{" "}
              {new Date(reservation.created_at).toLocaleString("fr-FR")}
            </p>
            {reservation.date_retrait_prevue && (
              <p>
                Retrait prévu le :{" "}
                {new Date(reservation.date_retrait_prevue).toLocaleDateString(
                  "fr-FR"
                )}
              </p>
            )}
          </div>

          {reservation.statut === "en_attente" && (
            <div className="mt-6 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
              <p className="font-medium">Prochaine étape :</p>
              <p>
                Présentez-vous en boutique avec cette référence pour régler en
                espèces et récupérer vos articles.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}