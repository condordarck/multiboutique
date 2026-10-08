import { notFound } from "next/navigation";
import { getSession, canAccessBoutique } from "@/lib/auth";
import { aPermission } from "@/lib/permissions";
import { query } from "@/lib/db";
import { ImprimerBouton } from "@/components/dashboard/ImprimerBouton";
import { getMonnaie } from "@/lib/monnaie";
import type { Boutique, ModePaiement } from "@/types";

type Periode = "jour" | "semaine" | "mois" | "annee" | "personnalisee";

interface TotauxRow {
  nb_ventes: string;
  ca: string;
  remises: string;
  nb_promos: string;
}

interface JourRow {
  jour: string;
  nb: string;
  ca: string;
}

interface ModeRow {
  mode_paiement: ModePaiement;
  nb: string;
  ca: string;
}

interface ProduitRow {
  nom: string;
  qte: string;
  ca: string;
}

interface ReservationRow {
  nb: string;
  montant: string;
}

function debuterJour(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function arretePeriode(periode: Periode, debut: string, fin: string) {
  const now = new Date();

  switch (periode) {
    case "jour": {
      const d = debuterJour(now);
      return { debut: d, fin: new Date(d.getTime() + 86400000) };
    }
    case "semaine": {
      const lundi = debuterJour(now);
      const offset = (now.getDay() + 6) % 7; // lundi = 0
      lundi.setDate(lundi.getDate() - offset);
      return { debut: lundi, fin: new Date(lundi.getTime() + 7 * 86400000) };
    }
    case "mois": {
      const debut = new Date(now.getFullYear(), now.getMonth(), 1);
      const fin = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { debut, fin };
    }
    case "annee": {
      return {
        debut: new Date(now.getFullYear(), 0, 1),
        fin: new Date(now.getFullYear() + 1, 0, 1),
      };
    }
    case "personnalisee": {
      if (debut && fin) {
        const [ay, am, ad] = debut.split("-").map(Number);
        const [by, bm, bd] = fin.split("-").map(Number);
        if (ay && am && ad && by && bm && bd) {
          const d = new Date(ay, am - 1, ad);
          const f = new Date(by, bm - 1, bd);
          if (d <= f) {
            return { debut: d, fin: new Date(f.getTime() + 86400000) };
          }
        }
      }
      return {
        debut: new Date(now.getFullYear(), 0, 1),
        fin: new Date(now.getFullYear() + 1, 0, 1),
      };
    }
  }
}

function etiquettes(periode: Periode, debut: Date, fin: Date) {
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  switch (periode) {
    case "jour":
      return "Rapport journalier — " + fmt(debut);
    case "semaine":
      return "Rapport hebdomadaire — " + fmt(debut) + " au " + fmt(new Date(fin.getTime() - 86400000));
    case "mois":
      return "Rapport mensuel — " + fmt(debut) + " au " + fmt(new Date(fin.getTime() - 86400000));
    case "annee":
      return "Rapport annuel — " + debut.getFullYear();
    case "personnalisee":
      return "Rapport personnalisé — " + fmt(debut) + " au " + fmt(new Date(fin.getTime() - 86400000));
  }
}

export default async function RapportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ boutiqueId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { boutiqueId } = await params;
  const sp = await searchParams;
  const monnaie = await getMonnaie();
  const user = await getSession();
  if (!user) notFound();
  if (!canAccessBoutique(user, boutiqueId)) notFound();
  if (!aPermission(user, "rapports:voir")) notFound();

  const boutiques = await query<Boutique>(
    `SELECT * FROM boutiques WHERE id = $1 AND statut = 'active'`,
    [boutiqueId]
  );
  if (boutiques.length === 0) notFound();
  const boutique = boutiques[0];

  const rawPeriode = Array.isArray(sp.periode) ? sp.periode[0] : sp.periode;
  const periode: Periode =
    rawPeriode === "jour" ||
    rawPeriode === "semaine" ||
    rawPeriode === "annee" ||
    rawPeriode === "personnalisee"
      ? rawPeriode
      : "mois";

  const debutStr = Array.isArray(sp.debut) ? sp.debut[0] : sp.debut;
  const finStr = Array.isArray(sp.fin) ? sp.fin[0] : sp.fin;

  const { debut, fin } = arretePeriode(periode, debutStr || "", finStr || "");

  const [totaux] = await query<TotauxRow>(
    `SELECT COUNT(*) AS nb_ventes,
            COALESCE(SUM(montant_total), 0) AS ca,
            COALESCE(SUM(remise), 0) AS remises,
            COUNT(*) FILTER (WHERE code_promo_id IS NOT NULL) AS nb_promos
     FROM ventes
     WHERE boutique_id = $1 AND statut = 'validee'
       AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
    [boutiqueId, debut.toISOString(), fin.toISOString()]
  );

  const parJour = await query<JourRow>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS jour,
            COUNT(*) AS nb,
            COALESCE(SUM(montant_total), 0) AS ca
     FROM ventes
     WHERE boutique_id = $1 AND statut = 'validee'
       AND created_at >= $2::timestamptz AND created_at < $3::timestamptz
     GROUP BY 1 ORDER BY 1`,
    [boutiqueId, debut.toISOString(), fin.toISOString()]
  );

  const parMode = await query<ModeRow>(
    `SELECT mode_paiement, COUNT(*) AS nb, COALESCE(SUM(montant_total), 0) AS ca
     FROM ventes
     WHERE boutique_id = $1 AND statut = 'validee'
       AND created_at >= $2::timestamptz AND created_at < $3::timestamptz
     GROUP BY mode_paiement ORDER BY 3 DESC`,
    [boutiqueId, debut.toISOString(), fin.toISOString()]
  );

  const topProduits = await query<ProduitRow>(
    `SELECT p.nom, SUM(lv.quantite) AS qte, SUM(lv.quantite * lv.prix_unitaire) AS ca
     FROM lignes_vente lv
     JOIN ventes v ON v.id = lv.vente_id
     JOIN produits p ON p.id = lv.produit_id
     WHERE v.boutique_id = $1 AND v.statut = 'validee'
       AND v.created_at >= $2::timestamptz AND v.created_at < $3::timestamptz
     GROUP BY p.nom ORDER BY 3 DESC LIMIT 10`,
    [boutiqueId, debut.toISOString(), fin.toISOString()]
  );

  const [reservations] = await query<ReservationRow>(
    `SELECT COUNT(*) AS nb, COALESCE(SUM(montant_total), 0) AS montant
     FROM reservations
     WHERE boutique_id = $1 AND statut <> 'annulee'
       AND created_at >= $2::timestamptz AND created_at < $3::timestamptz`,
    [boutiqueId, debut.toISOString(), fin.toISOString()]
  );

  const nbVentes = Number(totaux.nb_ventes || 0);
  const ca = Number(totaux.ca || 0);
  const remises = Number(totaux.remises || 0);
  const panierMoyen = nbVentes > 0 ? ca / nbVentes : 0;

  const libelleMode: Record<ModePaiement, string> = {
    especes: "Espèces",
    mobile_money: "Mobile Money",
    carte: "Carte",
    autre: "Autre",
  };

  return (
    <div>
      <div className="mb-8 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">
          Rapports — {boutique.nom}
        </h1>
        <p className="text-gray-500">
          Choisissez la période puis cliquez sur « Générer le rapport »
        </p>
      </div>

      {/* Sélecteur de période */}
      <div className="card mb-8 print:hidden">
        <form method="GET" className="grid grid-cols-1 gap-4 sm:grid-cols-6 md:items-end">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Période
            </label>
            <select name="periode" defaultValue={periode} className="input-field">
              <option value="jour">Journalier</option>
              <option value="semaine">Hebdomadaire</option>
              <option value="mois">Mensuel</option>
              <option value="annee">Annuel</option>
              <option value="personnalisee">Personnalisée</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Du
            </label>
            <input type="date" name="debut" defaultValue={debutStr || ""} className="input-field" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Au
            </label>
            <input type="date" name="fin" defaultValue={finStr || ""} className="input-field" />
          </div>
          <div className="sm:col-span-3 flex gap-2">
            <button type="submit" className="btn-primary">
              Générer le rapport
            </button>
            <ImprimerBouton />
          </div>
        </form>
        <p className="mt-3 text-xs text-gray-500">
          Astuce : pour une période précise, choisissez « Personnalisée » et
          renseignez les dates « Du » / « Au ».
        </p>
      </div>

      {/* Contenu du rapport */}
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {etiquettes(periode, debut, fin)}
          </h2>
          <p className="text-sm text-gray-500">Boutique : {boutique.nom}</p>
        </div>

        {/* Synthèse */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="card">
            <p className="text-sm text-gray-500">Ventes validées</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">
              {nbVentes.toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Chiffre d&apos;affaires</p>
            <p className="mt-1 text-3xl font-bold text-green-600">
              {ca.toLocaleString("fr-FR")} {monnaie}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Panier moyen</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">
              {panierMoyen.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}{" "}
              {monnaie}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Remises accordées</p>
            <p className="mt-1 text-3xl font-bold text-yellow-600">
              {remises.toLocaleString("fr-FR")} {monnaie}
            </p>
          </div>
        </div>

        {/* Détail par jour */}
        <div className="card mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Ventes par jour
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 font-medium text-gray-500">Date</th>
                  <th className="pb-3 font-medium text-gray-500">Ventes</th>
                  <th className="pb-3 font-medium text-gray-500">Chiffre d&apos;affaires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parJour.map((j) => (
                  <tr key={j.jour} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-700">{j.jour}</td>
                    <td className="py-3 text-gray-700">{Number(j.nb).toLocaleString("fr-FR")}</td>
                    <td className="py-3 font-medium text-green-600">
                      {Number(j.ca).toLocaleString("fr-FR")} {monnaie}
                    </td>
                  </tr>
                ))}
                {parJour.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-400">
                      Aucune vente sur cette période
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modes de paiement + produits */}
        <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Modes de paiement
            </h3>
            <div className="space-y-3">
              {parMode.map((m) => {
                const part = ca > 0 ? (Number(m.ca) / ca) * 100 : 0;
                return (
                  <div key={m.mode_paiement}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {libelleMode[m.mode_paiement]}
                      </span>
                      <span className="text-gray-900">
                        {Number(m.ca).toLocaleString("fr-FR")} {monnaie}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-blue-600"
                        style={{ width: `${part}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {parMode.length === 0 && (
                <p className="text-sm text-gray-400">Aucun paiement sur cette période</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Top produits (CA)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 font-medium text-gray-500">Produit</th>
                    <th className="pb-3 font-medium text-gray-500">Qté</th>
                    <th className="pb-3 font-medium text-gray-500">CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topProduits.map((p) => (
                    <tr key={p.nom} className="hover:bg-gray-50">
                      <td className="py-3 text-gray-700">{p.nom}</td>
                      <td className="py-3 text-gray-700">{Number(p.qte).toLocaleString("fr-FR")}</td>
                      <td className="py-3 font-medium text-green-600">
                        {Number(p.ca).toLocaleString("fr-FR")} {monnaie}
                      </td>
                    </tr>
                  ))}
                  {topProduits.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-400">
                        Aucune vente sur cette période
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Réservations */}
        <div className="card mb-8">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Réservations</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Réservations créées</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {Number(reservations.nb).toLocaleString("fr-FR")}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Montant réservé</p>
              <p className="mt-1 text-2xl font-bold text-orange-600">
                {Number(reservations.montant).toLocaleString("fr-FR")} {monnaie}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}