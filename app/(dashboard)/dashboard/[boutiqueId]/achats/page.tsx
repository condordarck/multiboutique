import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { getMonnaie } from "@/lib/monnaie";
import { FournisseurForm } from "@/components/dashboard/FournisseurForm";
import { FournisseurActions } from "@/components/dashboard/FournisseurActions";
import { CommandeFournisseurForm } from "@/components/dashboard/CommandeFournisseurForm";
import {
  CommandeFournisseurActions,
  type LigneReception,
} from "@/components/dashboard/CommandeFournisseurActions";
import type { Boutique, CommandeFournisseur, Fournisseur } from "@/types";

interface CommandeFournisseurRow extends CommandeFournisseur {
  fournisseur_nom: string;
  nb_lignes: number;
}

interface ProduitCout {
  produit_id: string;
  nom: string;
  cout_revient: number | null;
  prix_vente: number | null;
}

interface LigneRow extends LigneReception {
  commande_id: string;
}

const LIBELLES_STATUT: Record<string, string> = {
  en_attente: "En attente",
  partielle: "Partielle",
  recue: "Réceptionnée",
  annulee: "Annulée",
};

export default async function AchatsPage({
  params,
}: {
  params: Promise<{ boutiqueId: string }>;
}) {
  const { boutiqueId } = await params;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();
  if (!aPermission(user, "achats:voir")) notFound();
  const peutGerer = aPermission(user, "achats:gerer");

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const fournisseurs = await query<Fournisseur>(
    `SELECT * FROM fournisseurs WHERE boutique_id = $1 ORDER BY actif DESC, nom`,
    [boutiqueId]
  );

  const commandes = await query<CommandeFournisseurRow>(
    `SELECT cf.*, f.nom AS fournisseur_nom,
            (SELECT COUNT(*)::int FROM lignes_cmd_fournisseur lc WHERE lc.commande_id = cf.id) AS nb_lignes
     FROM commandes_fournisseur cf
     INNER JOIN fournisseurs f ON f.id = cf.fournisseur_id
     WHERE cf.boutique_id = $1
     ORDER BY cf.created_at DESC`,
    [boutiqueId]
  );

  const lignes = await query<LigneRow>(
    `SELECT lc.commande_id, lc.id AS ligne_id, p.nom AS produit_nom,
            lc.quantite_commandee, lc.quantite_recue
     FROM lignes_cmd_fournisseur lc
     INNER JOIN produits p ON p.id = lc.produit_id
     INNER JOIN commandes_fournisseur cf ON cf.id = lc.commande_id
     WHERE cf.boutique_id = $1
     ORDER BY cf.created_at DESC, lc.created_at`,
    [boutiqueId]
  );

  const lignesParCommande = new Map<string, LigneReception[]>();
  for (const l of lignes) {
    const liste = lignesParCommande.get(l.commande_id) || [];
    liste.push({
      ligne_id: l.ligne_id,
      produit_nom: l.produit_nom,
      quantite_commandee: l.quantite_commandee,
      quantite_recue: l.quantite_recue,
    });
    lignesParCommande.set(l.commande_id, liste);
  }

  const produits = await query<ProduitCout>(
    `SELECT p.id AS produit_id, p.nom,
            pb.cout_revient, pb.prix_vente
     FROM prix_boutique pb
     INNER JOIN produits p ON p.id = pb.produit_id
     WHERE pb.boutique_id = $1 AND pb.actif = true
     ORDER BY p.nom`,
    [boutiqueId]
  );

  const totalDu = commandes
    .filter((c) => c.statut === "en_attente" || c.statut === "partielle")
    .reduce((acc, c) => acc + (Number(c.total_attendu) || 0), 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Achats — {boutique.nom}
        </h1>
        <p className="text-gray-500">
          Fournisseurs, commandes d&apos;achat et réceptions (entrée de stock)
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-gray-500">Fournisseurs</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{fournisseurs.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Commandes en cours</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {commandes.filter((c) => c.statut !== "annulee" && c.statut !== "recue").length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Engagé (en cours)</p>
          <p className="mt-1 text-3xl font-bold text-orange-600">
            {totalDu.toLocaleString("fr-FR")} {monnaie}
          </p>
        </div>
      </div>

      {peutGerer && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FournisseurForm boutiqueId={boutiqueId} />
            <div className="card">
              {fournisseurs.filter((f) => f.actif).length > 0 && produits.length > 0 ? (
                <CommandeFournisseurForm
                  boutiqueId={boutiqueId}
                  fournisseurs={fournisseurs.filter((f) => f.actif)}
                  produits={produits}
                />
              ) : (
                <p className="text-sm text-gray-400">
                  Ajoutez d&apos;abord un fournisseur et configurez le prix des
                  produits dans Produits pour pouvoir commander.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Commandes fournisseur */}
      <div className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Commandes fournisseur
        </h2>
        {!peutGerer && (
          <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
            Lecture seule — la gestion des achats est réservée au gérant et au
            propriétaire.
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Référence</th>
                <th className="pb-3 font-medium text-gray-500">Fournisseur</th>
                <th className="pb-3 font-medium text-gray-500">Articles</th>
                <th className="pb-3 font-medium text-gray-500">Total attendu</th>
                <th className="pb-3 font-medium text-gray-500">Réception</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commandes.map((c) => {
                const lignesCmd = lignesParCommande.get(c.id) || [];
                const recuTotal = lignesCmd.reduce(
                  (acc, l) => acc + l.quantite_recue,
                  0
                );
                const commandeTotal = lignesCmd.reduce(
                  (acc, l) => acc + l.quantite_commandee,
                  0
                );
                return (
                  <tr key={c.id} className="hover:bg-gray-50 align-top">
                    <td className="py-3 font-medium text-gray-900">
                      {c.reference_cmd}
                    </td>
                    <td className="py-3 text-gray-700">{c.fournisseur_nom}</td>
                    <td className="py-3 text-gray-500">
                      {c.nb_lignes} ligne{c.nb_lignes > 1 ? "s" : ""}
                    </td>
                    <td className="py-3 text-gray-600">
                      {Number(c.total_attendu).toLocaleString("fr-FR")} {monnaie}
                    </td>
                    <td className="py-3 text-gray-600">
                      {recuTotal} / {commandeTotal} unité{commandeTotal > 1 ? "s" : ""}
                    </td>
                    <td className="py-3">
                      <span className="badge-info">{LIBELLES_STATUT[c.statut]}</span>
                    </td>
                    <td className="py-3">
                      {peutGerer ? (
                        <CommandeFournisseurActions
                          commandeId={c.id}
                          reference={c.reference_cmd}
                          lignes={lignesCmd}
                          statut={c.statut}
                        />
                      ) : (
                        <span className="text-gray-400">Lecture seule</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {commandes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Aucune commande fournisseur
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fournisseurs */}
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Fournisseurs</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 font-medium text-gray-500">Fournisseur</th>
                <th className="pb-3 font-medium text-gray-500">Contact</th>
                <th className="pb-3 font-medium text-gray-500">Statut</th>
                <th className="pb-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fournisseurs.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 align-top">
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{f.nom}</p>
                    <p className="text-xs text-gray-500">{f.adresse || ""}</p>
                  </td>
                  <td className="py-3 text-gray-500">
                    <p>{f.telephone || "—"}</p>
                    <p className="text-xs">{f.email || ""}</p>
                  </td>
                  <td className="py-3">
                    {f.actif ? (
                      <span className="badge-success">Actif</span>
                    ) : (
                      <span className="badge-danger">Inactif</span>
                    )}
                  </td>
                  <td className="py-3">
                    {peutGerer ? (
                      <FournisseurActions fournisseur={f} boutiqueId={boutiqueId} />
                    ) : (
                      <span className="text-gray-400">Lecture seule</span>
                    )}
                  </td>
                </tr>
              ))}
              {fournisseurs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">
                    Aucun fournisseur
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