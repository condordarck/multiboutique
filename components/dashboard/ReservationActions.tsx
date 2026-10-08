"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmerReservation, encaisserReservation } from "@/lib/actions";
import type { ModePaiement, Reservation } from "@/types";

interface ReservationActionsProps {
  reservation: Reservation;
  lignes: {
    id: string;
    produit_nom: string;
    quantite: number;
    prix_unitaire: number;
  }[];
  monnaie: string;
  boutiqueNom: string;
  boutiqueAdresse: string | null;
  boutiqueTelephone: string | null;
  vendeurNom: string;
}

const MODES_PAIEMENT: { valeur: ModePaiement; label: string }[] = [
  { valeur: "especes", label: "Espèces" },
  { valeur: "mobile_money", label: "Mobile Money" },
  { valeur: "carte", label: "Carte" },
];

export function ReservationActions({
  reservation,
  lignes,
  monnaie,
  boutiqueNom,
  boutiqueAdresse,
  boutiqueTelephone,
  vendeurNom,
}: ReservationActionsProps) {
  const router = useRouter();
  const [confirmant, setConfirmant] = useState(false);
  const [encaissant, setEncaissant] = useState(false);
  const [afficherEncaissement, setAfficherEncaissement] = useState(false);
  const [modePaiement, setModePaiement] = useState<ModePaiement>("especes");
  const [erreur, setErreur] = useState<string | null>(null);
  const [recu, setRecu] = useState<{
    reference: string;
    montantTotal: number;
    date: string;
  } | null>(null);

  async function onConfirmer() {
    setConfirmant(true);
    setErreur(null);
    try {
      await confirmerReservation(reservation.id);
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur de confirmation");
    } finally {
      setConfirmant(false);
    }
  }

  async function onEncaisser() {
    setEncaissant(true);
    setErreur(null);
    try {
      const resultat = await encaisserReservation(reservation.id, modePaiement);
      setRecu({
        reference: resultat.reference,
        montantTotal: resultat.montantTotal,
        date: new Date().toLocaleString("fr-FR"),
      });
      setAfficherEncaissement(false);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'encaissement");
    } finally {
      setEncaissant(false);
    }
  }

  function annulerRecu() {
    setRecu(null);
    router.refresh();
  }

  if (recu) {
    return (
      <div className="mt-4">
        <div className="mb-3 flex gap-2 print:hidden">
          <button onClick={() => window.print()} className="btn-primary">
            Imprimer le reçu
          </button>
          <button onClick={annulerRecu} className="btn-secondary">
            Terminé
          </button>
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
            <p className="text-xs text-gray-600">Client : {reservation.client_nom}</p>
            <p className="text-xs text-gray-600">Réservation : {reservation.reference_reservation}</p>
            <p className="text-xs text-gray-600">Caissier : {vendeurNom}</p>
            <p className="text-xs text-gray-600 capitalize">
              Paiement : {modePaiement.replace("_", " ")}
            </p>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-2">
            {lignes.map((l) => (
              <div key={l.id} className="flex justify-between text-sm">
                <span className="text-gray-800">
                  {l.produit_nom} × {l.quantite}
                </span>
                <span className="text-gray-900">
                  {(l.quantite * Number(l.prix_unitaire)).toLocaleString("fr-FR")} {monnaie}
                </span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-gray-300 pt-2 text-base font-bold">
              <span className="text-gray-900">TOTAL</span>
              <span className="text-gray-900">
                {recu.montantTotal.toLocaleString("fr-FR")} {monnaie}
              </span>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Merci de votre visite !
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-orange-200 pt-3">
      {erreur && (
        <p className="mb-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">
          {erreur}
        </p>
      )}

      {reservation.statut === "en_attente" && (
        <button
          onClick={onConfirmer}
          disabled={confirmant}
          className="btn-secondary"
        >
          {confirmant ? "Confirmation…" : "Confirmer (prête)"}
        </button>
      )}

      {reservation.statut === "prete" && !afficherEncaissement && (
        <button
          onClick={() => setAfficherEncaissement(true)}
          className="btn-primary"
        >
          Encaisser à la remise
        </button>
      )}

      {reservation.statut === "prete" && afficherEncaissement && (
        <div className="rounded-lg border border-orange-200 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">Mode de paiement</p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {MODES_PAIEMENT.map((m) => (
              <button
                key={m.valeur}
                onClick={() => setModePaiement(m.valeur)}
                className={`rounded-lg border px-2 py-1.5 text-sm ${
                  modePaiement === m.valeur
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onEncaisser} disabled={encaissant} className="btn-primary">
              {encaissant ? "Encaissement…" : "Encaisser"}
            </button>
            <button
              onClick={() => setAfficherEncaissement(false)}
              className="btn-secondary"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}