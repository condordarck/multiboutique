import { aPermission } from "@multiboutique/shared";
import { ErreurMetier, type Db, type Utilisateur } from "@multiboutique/metier";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { parametre, route } from "../routes/registre";
import { bornesPeriode, boutiqueActive, estPeriode, exigerLecture } from "./commun";

// Lectures des pages /dashboard/[boutiqueId]/* : SQL repris de chaque page.
// Garde « boutique » : accès à la boutique ; certaines pages exigent en plus
// une permission de lecture, d'autres non (parité avec le monolithe).

const requete = <T extends Record<string, string | undefined>>(r: FastifyRequest) => r.query as T;

/** Le coût de revient n'est visible qu'avec prix:gerer, quelle que soit la lecture. */
function masquerCout<T extends Record<string, unknown>>(u: Utilisateur, lignes: T[]) {
  if (aPermission(u, "prix:gerer")) return lignes;
  return lignes.map(({ cout_revient: _masque, ...reste }) => reste);
}

export const lecturesBoutique: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const b = (r: FastifyRequest) => parametre(r, "boutiqueId");
  // Toutes les lectures d'une boutique commencent par vérifier qu'elle est active.
  const lecture = (chemin: string, gerer: (r: FastifyRequest, u: Utilisateur) => Promise<unknown>) =>
    route(app, {
      methode: "GET",
      chemin: `/boutiques/:boutiqueId${chemin}`,
      garde: "boutique",
      gerer: async (r, u) => {
        await boutiqueActive(db, b(r));
        return gerer(r, u);
      },
    });

  // Les 12 pages relisent la boutique ; ici, une seule route.
  route(app, {
    methode: "GET",
    chemin: "/boutiques/:boutiqueId",
    garde: "boutique",
    gerer: (r) => boutiqueActive(db, b(r)),
  });

  // [boutiqueId]/page.tsx:31-58
  lecture("/resume", async (r, u) => {
    const id = b(r);
    const [resume, ventes, reservations, alertes] = await Promise.all([
      db.query(`SELECT * FROM resume_jour WHERE boutique_id = $1`, [id]),
      db.query(
        `SELECT v.*, u.nom_complet AS vendeur_nom
         FROM ventes v
         JOIN utilisateurs u ON u.id = v.vendeur_id
         WHERE v.boutique_id = $1 AND v.statut = 'validee'
         ORDER BY v.created_at DESC
         LIMIT 5`,
        [id]
      ),
      db.query(
        `SELECT * FROM reservations
         WHERE boutique_id = $1 AND statut = 'en_attente'
         ORDER BY created_at DESC
         LIMIT 5`,
        [id]
      ),
      db.query(
        `SELECT * FROM stock_disponible
         WHERE boutique_id = $1 AND statut_stock IN ('alerte', 'rupture')
         ORDER BY disponible`,
        [id]
      ),
    ]);
    return {
      resume: resume.rows[0] ?? null,
      dernieres_ventes: ventes.rows,
      reservations_en_attente: reservations.rows,
      alertes_stock: masquerCout(u, alertes.rows),
    };
  });

  // ventes/page.tsx:40
  lecture("/ventes", async (r) => {
    const limite = Math.min(Math.max(Number(requete<{ limite?: string }>(r).limite) || 50, 1), 200);
    const { rows } = await db.query(
      `SELECT v.*, u.nom_complet AS vendeur_nom
       FROM ventes v
       JOIN utilisateurs u ON u.id = v.vendeur_id
       WHERE v.boutique_id = $1
       ORDER BY v.created_at DESC
       LIMIT $2`,
      [b(r), limite]
    );
    return rows;
  });

  // Remplace ventes/page.tsx:92-112, qui filtrait en JavaScript les 50 dernières
  // ventes sur une chaîne de date qui ne correspondait jamais.
  lecture("/ventes/statistiques", async (r) => {
    const { rows } = await db.query(
      `SELECT COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS ventes_jour,
              COALESCE(SUM(montant_total) FILTER (WHERE created_at >= date_trunc('day', now())), 0) AS ca_jour,
              COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS ventes_mois,
              COALESCE(SUM(montant_total) FILTER (WHERE created_at >= date_trunc('month', now())), 0) AS ca_mois
       FROM ventes
       WHERE boutique_id = $1 AND statut = 'validee'`,
      [b(r)]
    );
    return rows[0];
  });

  // ventes/[venteId]/page.tsx:41,51
  lecture("/ventes/:venteId", async (r) => {
    const venteId = parametre(r, "venteId");
    const { rows } = await db.query(
      `SELECT v.*, u.nom_complet AS vendeur_nom, cl.nom AS client_nom
       FROM ventes v
       JOIN utilisateurs u ON u.id = v.vendeur_id
       LEFT JOIN clients cl ON cl.id = v.client_id
       WHERE v.id = $1 AND v.boutique_id = $2`,
      [venteId, b(r)]
    );
    if (!rows[0]) throw new ErreurMetier("Vente introuvable", 404);
    const lignes = await db.query(
      `SELECT l.quantite, l.prix_unitaire,
              COALESCE(l.produit_nom, p.nom) AS produit_nom, p.reference AS produit_reference,
              COALESCE(l.produit_code, p.code) AS produit_code
       FROM lignes_vente l
       JOIN produits p ON p.id = l.produit_id
       WHERE l.vente_id = $1
       ORDER BY l.created_at`,
      [venteId]
    );
    return { vente: rows[0], lignes: lignes.rows };
  });

  // reservations/page.tsx:37,52 — lignes des réservations à traiter
  lecture("/reservations", async (r) => {
    const { rows: reservations } = await db.query(
      `SELECT * FROM reservations
       WHERE boutique_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [b(r)]
    );
    const aTraiter = reservations.filter((x) => x.statut === "en_attente" || x.statut === "prete").map((x) => x.id);
    const { rows: lignes } = aTraiter.length
      ? await db.query(
          `SELECT lr.reservation_id, lr.id, p.nom AS produit_nom, lr.quantite, lr.prix_unitaire
           FROM lignes_reservation lr
           JOIN produits p ON p.id = lr.produit_id
           WHERE lr.reservation_id = ANY($1::uuid[])
           ORDER BY lr.created_at`,
          [aTraiter]
        )
      : { rows: [] };
    return reservations.map((x) => ({
      ...x,
      lignes: aTraiter.includes(x.id) ? lignes.filter((l) => l.reservation_id === x.id) : [],
    }));
  });

  // stock/page.tsx:57
  lecture("/stock", async (r, u) => {
    const { rows } = await db.query(`SELECT * FROM stock_disponible WHERE boutique_id = $1 ORDER BY produit_nom`, [b(r)]);
    return masquerCout(u, rows);
  });

  // stock/page.tsx:64-108 ; une période inconnue n'impose pas de borne, comme la page.
  lecture("/mouvements-stock", async (r) => {
    const { periode, type, produit } = requete<{ periode?: string; type?: string; produit?: string }>(r);
    const conditions = ["m.boutique_id = $1"];
    const parametres: unknown[] = [b(r)];
    if (estPeriode(periode)) {
      parametres.push((await bornesPeriode(db, periode)).debut);
      conditions.push(`m.created_at >= $${parametres.length}`);
    }
    if (type) {
      parametres.push(type);
      conditions.push(`m.type = $${parametres.length}`);
    }
    if (produit && produit.trim()) {
      parametres.push(`%${produit.trim()}%`);
      conditions.push(`(p.nom ILIKE $${parametres.length} OR p.reference ILIKE $${parametres.length})`);
    }
    // Seuls des $n entrent dans le SQL ; toutes les valeurs sont liées.
    const { rows } = await db.query(
      `SELECT m.*, p.nom AS produit_nom, u.nom_complet AS auteur_nom
       FROM mouvements_stock m
       JOIN produits p ON p.id = m.produit_id
       LEFT JOIN utilisateurs u ON u.id = m.auteur_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY m.created_at DESC
       LIMIT 500`,
      parametres
    );
    return rows;
  });

  // produits/page.tsx:48 (sur-ensemble des listes de ventes, commandes et achats).
  // Le coût de revient n'est renvoyé qu'avec prix:gerer.
  lecture("/produits", async (r, u) => {
    const { rows } = await db.query(
      `SELECT pb.id, pb.produit_id, p.nom AS produit_nom, p.reference AS produit_reference,
              p.code AS produit_code, p.image_url AS produit_image,
              p.description AS produit_description, p.actif AS produit_actif,
              p.categorie_id, c.nom AS categorie_nom,
              pb.prix_vente, pb.cout_revient,
              s.quantite, s.quantite_reservee, s.seuil_alerte
       FROM prix_boutique pb
       JOIN produits p ON p.id = pb.produit_id
       LEFT JOIN categories c ON c.id = p.categorie_id
       LEFT JOIN stocks s ON s.produit_id = pb.produit_id AND s.boutique_id = pb.boutique_id
       WHERE pb.boutique_id = $1 AND pb.actif = true
       ORDER BY c.nom, p.nom`,
      [b(r)]
    );
    return masquerCout(u, rows);
  });

  // clients/page.tsx:30,53 ; ?actifs=1 : liste réduite de ventes:77 et commandes:57.
  lecture("/clients", async (r, u) => {
    const id = b(r);
    if (requete<{ actifs?: string }>(r).actifs === "1") {
      if (!(["clients:voir", "ventes:creer", "commandes:gerer"] as const).some((p) => aPermission(u, p))) {
        exigerLecture(u, id, "clients:voir");
      }
      const { rows } = await db.query(
        `SELECT id, nom, telephone, type_client, encours, plafond_credit, est_vip
         FROM clients
         WHERE boutique_id = $1 AND actif = true
         ORDER BY nom`,
        [id]
      );
      return rows;
    }
    exigerLecture(u, id, "clients:voir");
    const [clients, delai] = await Promise.all([
      db.query(
        `SELECT c.*,
                (SELECT MAX(created_at) FROM registre_credits rc
                 WHERE rc.client_id = c.id) AS derniere_activite
         FROM clients c
         WHERE c.boutique_id = $1
         ORDER BY c.actif DESC, c.nom`,
        [id]
      ),
      db.query(`SELECT valeur FROM parametres WHERE cle = 'relance_delai_jours'`),
    ]);
    const delaiRelance = Number(delai.rows[0]?.valeur) || 30;
    const maintenant = Date.now();
    // Relances : créance active restée inerte au-delà du délai (clients/page.tsx:60-71).
    const relances = clients.rows
      .filter((c) => Number(c.encours) > 0 && c.actif)
      .map((c) => ({
        client_id: c.id as string,
        jours: Math.max(
          0,
          Math.floor((maintenant - (c.derniere_activite ? new Date(c.derniere_activite).getTime() : maintenant)) / 86400000)
        ),
      }))
      .filter((x) => x.jours >= delaiRelance);
    return { clients: clients.rows, relances, delai_relance: delaiRelance };
  });

  // commandes/page.tsx:71
  lecture("/commandes", async (r, u) => {
    exigerLecture(u, b(r), "commandes:voir");
    const { rows } = await db.query(
      `SELECT c.*, cl.nom AS client_nom, cl.type_client AS client_type,
              cp.code AS code_promo,
              (SELECT COUNT(*)::int FROM lignes_commandes lc WHERE lc.commande_id = c.id) AS nb_lignes
       FROM commandes c
       INNER JOIN clients cl ON cl.id = c.client_id
       LEFT JOIN codes_promo cp ON cp.id = c.code_promo_id
       WHERE c.boutique_id = $1
       ORDER BY c.created_at DESC`,
      [b(r)]
    );
    return rows;
  });

  // achats/page.tsx:58
  lecture("/fournisseurs", async (r, u) => {
    exigerLecture(u, b(r), "achats:voir");
    const { rows } = await db.query(`SELECT * FROM fournisseurs WHERE boutique_id = $1 ORDER BY actif DESC, nom`, [b(r)]);
    return rows;
  });

  // achats/page.tsx:63,73 — lignes regroupées par commande
  lecture("/commandes-fournisseurs", async (r, u) => {
    exigerLecture(u, b(r), "achats:voir");
    const [commandes, lignes] = await Promise.all([
      db.query(
        `SELECT cf.*, f.nom AS fournisseur_nom,
                (SELECT COUNT(*)::int FROM lignes_cmd_fournisseur lc WHERE lc.commande_id = cf.id) AS nb_lignes
         FROM commandes_fournisseur cf
         INNER JOIN fournisseurs f ON f.id = cf.fournisseur_id
         WHERE cf.boutique_id = $1
         ORDER BY cf.created_at DESC`,
        [b(r)]
      ),
      db.query(
        `SELECT lc.commande_id, lc.id AS ligne_id, p.nom AS produit_nom,
                lc.quantite_commandee, lc.quantite_recue
         FROM lignes_cmd_fournisseur lc
         INNER JOIN produits p ON p.id = lc.produit_id
         INNER JOIN commandes_fournisseur cf ON cf.id = lc.commande_id
         WHERE cf.boutique_id = $1
         ORDER BY cf.created_at DESC, lc.created_at`,
        [b(r)]
      ),
    ]);
    return commandes.rows.map((c) => ({ ...c, lignes: lignes.rows.filter((l) => l.commande_id === c.id) }));
  });

  // prix-conseilles/page.tsx:43,58
  lecture("/prix-conseilles", async (r, u) => {
    exigerLecture(u, b(r), "prix_conseilles:voir");
    const [prix, produits] = await Promise.all([
      db.query(
        `SELECT pr.*, p.nom AS produit_nom,
                EXISTS(
                  SELECT 1 FROM prix_boutique pb
                  WHERE pb.produit_id = pr.produit_id
                    AND pb.boutique_id = $1
                    AND pb.actif = true
                ) AS applique
         FROM prix_reference pr
         INNER JOIN produits p ON p.id = pr.produit_id
         WHERE pr.actif = true
         ORDER BY p.nom`,
        [b(r)]
      ),
      db.query(
        `SELECT p.id AS produit_id, p.nom, pb.prix_vente
         FROM produits p
         LEFT JOIN prix_boutique pb
           ON pb.produit_id = p.id AND pb.boutique_id = $1 AND pb.actif = true
         ORDER BY p.nom`,
        [b(r)]
      ),
    ]);
    return { prix: prix.rows, produits: produits.rows };
  });

  // promotions/page.tsx:31
  lecture("/codes-promo", async (r, u) => {
    exigerLecture(u, b(r), "promos:voir");
    const { rows } = await db.query(
      `SELECT * FROM codes_promo
       WHERE boutique_id = $1
       ORDER BY actif DESC, created_at DESC`,
      [b(r)]
    );
    return rows;
  });

  // rapports/page.tsx:45-88,143-185, bornes calculées par la base.
  lecture("/rapports", async (r, u) => {
    const id = b(r);
    exigerLecture(u, id, "rapports:voir");
    const q = requete<{ periode?: string; debut?: string; fin?: string }>(r);
    const periode = estPeriode(q.periode) || q.periode === "personnalisee" ? q.periode : "mois";
    let bornes: { debut: Date; fin: Date };
    const dateValide = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
    if (periode === "personnalisee") {
      bornes =
        dateValide(q.debut) && dateValide(q.fin) && q.debut! <= q.fin!
          ? (await db.query(`SELECT $1::date::timestamptz AS debut, ($2::date + 1)::timestamptz AS fin`, [q.debut, q.fin])).rows[0]
          : await bornesPeriode(db, "annee");
    } else {
      bornes = await bornesPeriode(db, periode);
    }
    const valeurs = [id, bornes.debut, bornes.fin];
    const [totaux, parJour, parMode, topProduits, reservations] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS nb_ventes,
                COALESCE(SUM(montant_total), 0) AS ca,
                COALESCE(SUM(remise), 0) AS remises,
                COUNT(*) FILTER (WHERE code_promo_id IS NOT NULL) AS nb_promos
         FROM ventes
         WHERE boutique_id = $1 AND statut = 'validee'
           AND created_at >= $2 AND created_at < $3`,
        valeurs
      ),
      db.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS jour,
                COUNT(*) AS nb,
                COALESCE(SUM(montant_total), 0) AS ca
         FROM ventes
         WHERE boutique_id = $1 AND statut = 'validee'
           AND created_at >= $2 AND created_at < $3
         GROUP BY 1 ORDER BY 1`,
        valeurs
      ),
      db.query(
        `SELECT mode_paiement, COUNT(*) AS nb, COALESCE(SUM(montant_total), 0) AS ca
         FROM ventes
         WHERE boutique_id = $1 AND statut = 'validee'
           AND created_at >= $2 AND created_at < $3
         GROUP BY mode_paiement ORDER BY 3 DESC`,
        valeurs
      ),
      db.query(
        `SELECT p.nom, SUM(lv.quantite) AS qte, SUM(lv.quantite * lv.prix_unitaire) AS ca
         FROM lignes_vente lv
         JOIN ventes v ON v.id = lv.vente_id
         JOIN produits p ON p.id = lv.produit_id
         WHERE v.boutique_id = $1 AND v.statut = 'validee'
           AND v.created_at >= $2 AND v.created_at < $3
         GROUP BY p.nom ORDER BY 3 DESC LIMIT 10`,
        valeurs
      ),
      db.query(
        `SELECT COUNT(*) AS nb, COALESCE(SUM(montant_total), 0) AS montant
         FROM reservations
         WHERE boutique_id = $1 AND statut <> 'annulee'
           AND created_at >= $2 AND created_at < $3`,
        valeurs
      ),
    ]);
    const t = totaux.rows[0];
    return {
      periode,
      debut: bornes.debut,
      fin: bornes.fin,
      totaux: { ...t, panier_moyen: t.nb_ventes > 0 ? t.ca / t.nb_ventes : 0 },
      par_jour: parJour.rows,
      par_mode: parMode.rows,
      top_produits: topProduits.rows,
      reservations: reservations.rows[0],
    };
  });
};
