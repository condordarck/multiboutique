import { ErreurMetier, type Db } from "@multiboutique/metier";
import { aPermission } from "@multiboutique/shared";
import type { FastifyPluginAsync } from "fastify";
import { parametre, route } from "../routes/registre";

// Valeurs par défaut de lib/monnaie.ts, si la table est vide.
const PARAMETRES_DEFAUT: Record<string, string> = {
  monnaie: "$",
  nom_application: "MultiBoutique",
  seuil_alerte_defaut: "10",
};

const COLONNES_PUBLIQUES_BOUTIQUE = "id, nom, adresse, telephone, email";

export const lecturesGenerales: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  // lib/monnaie.ts:18 — publique : la vitrine anonyme affiche la monnaie et le nom,
  // comme le monolithe. Aucun paramètre n'est sensible.
  route(app, {
    methode: "GET",
    chemin: "/parametres",
    garde: "public",
    gerer: async () => {
      const { rows } = await db.query(`SELECT cle, valeur FROM parametres`);
      return { ...PARAMETRES_DEFAUT, ...Object.fromEntries(rows.map((r) => [r.cle, r.valeur])) };
    },
  });

  // (dashboard)/layout.tsx:21,26 — barre latérale du personnel
  route(app, {
    methode: "GET",
    chemin: "/me/boutiques",
    garde: "connexion",
    gerer: async (_r, u) => {
      if (u.role === "administrateur" || u.role === "client") {
        throw new ErreurMetier("Réservé au personnel des boutiques", 403);
      }
      const { rows } =
        u.role === "proprietaire"
          ? await db.query(`SELECT * FROM boutiques WHERE statut = 'active' ORDER BY nom`)
          : await db.query(`SELECT * FROM boutiques WHERE statut = 'active' AND id = ANY($1::uuid[]) ORDER BY nom`, [
              u.boutique_ids,
            ]);
      return rows;
    },
  });

  // dashboard/page.tsx:29 — seul le propriétaire atteint cette page
  route(app, {
    methode: "GET",
    chemin: "/resume",
    garde: "connexion",
    gerer: async (_r, u) => {
      if (u.role !== "proprietaire") throw new ErreurMetier("Réservé au propriétaire", 403);
      const { rows } = await db.query(`SELECT * FROM resume_jour ORDER BY boutique_nom`);
      return rows;
    },
  });

  // consolidation/page.tsx:28-92. Écart volontaire : le périmètre est toujours
  // appliqué hors propriétaire ; le monolithe montrait toutes les boutiques à un
  // non-propriétaire sans boutique rattachée.
  route(app, {
    methode: "GET",
    chemin: "/consolidation",
    garde: "connexion",
    gerer: async (_r, u) => {
      if (!aPermission(u, "consolidation:voir")) {
        throw new ErreurMetier("Votre profil n'a pas les droits pour cette action", 403);
      }
      const proprietaire = u.role === "proprietaire";
      const { rows: boutiques } = await db.query(
        `SELECT b.id AS boutique_id, b.nom AS boutique_nom,
                r.nom AS region_nom, g.nom AS groupe_nom,
                COALESCE(rj.nombre_ventes, 0)::int AS nombre_ventes,
                COALESCE(rj.chiffre_affaires, 0) AS chiffre_affaires,
                COALESCE(rj.reservations_en_attente, 0)::int AS reservations_en_attente,
                COALESCE(rj.alertes_stock, 0)::int AS alertes_stock,
                COALESCE((SELECT SUM(c.encours) FROM clients c WHERE c.boutique_id = b.id), 0) AS encours_total,
                (SELECT COUNT(*)::int FROM commandes cmd
                 WHERE cmd.boutique_id = b.id AND cmd.statut = 'en_attente') AS commandes_attente
         FROM boutiques b
         LEFT JOIN regions r ON r.id = b.region_id
         LEFT JOIN groupes g ON g.id = r.groupe_id
         LEFT JOIN resume_jour rj ON rj.boutique_id = b.id
         WHERE b.statut = 'active' AND ($1::boolean OR b.id = ANY($2::uuid[]))
         ORDER BY g.nom, r.nom, b.nom`,
        [proprietaire, u.boutique_ids]
      );

      type Cumul = { nom: string; groupe?: string; ca: number; ventes: number; boutiques: string[] };
      const cumuler = (cle: (b: (typeof boutiques)[number]) => string, groupe?: (b: (typeof boutiques)[number]) => string) => {
        const parCle = new Map<string, Cumul>();
        for (const b of boutiques) {
          const nom = cle(b);
          const c = parCle.get(nom) ?? { nom, ...(groupe ? { groupe: groupe(b) } : {}), ca: 0, ventes: 0, boutiques: [] };
          c.ca += Number(b.chiffre_affaires) || 0;
          c.ventes += b.nombre_ventes || 0;
          if (!c.boutiques.includes(b.boutique_nom)) c.boutiques.push(b.boutique_nom);
          parCle.set(nom, c);
        }
        return [...parCle.values()].sort((a, z) => z.ca - a.ca);
      };

      return {
        boutiques,
        totaux: {
          ventes: boutiques.reduce((a, b) => a + (b.nombre_ventes || 0), 0),
          chiffre_affaires: boutiques.reduce((a, b) => a + (Number(b.chiffre_affaires) || 0), 0),
          encours: boutiques.reduce((a, b) => a + (Number(b.encours_total) || 0), 0),
          commandes_attente: boutiques.reduce((a, b) => a + (b.commandes_attente || 0), 0),
        },
        regions: cumuler((b) => b.region_nom || "Sans région", (b) => b.groupe_nom || "—"),
        groupes: cumuler((b) => b.groupe_nom || "Sans groupe"),
      };
    },
  });

  // produits/page.tsx:64
  route(app, {
    methode: "GET",
    chemin: "/categories",
    garde: "connexion",
    gerer: async () => (await db.query(`SELECT id, nom, code FROM categories ORDER BY nom`)).rows,
  });

  // Types de frais du coût de revient (désactivés compris : ils restent sur des prix).
  route(app, {
    methode: "GET",
    chemin: "/types-frais",
    garde: "connexion",
    gerer: async () => (await db.query(`SELECT id, libelle, actif FROM types_frais ORDER BY libelle`)).rows,
  });

    // client/page.tsx:28
  route(app, {
    methode: "GET",
    chemin: "/me/reservations",
    garde: "connexion",
    gerer: async (_r, u) => {
      if (u.role !== "client") throw new ErreurMetier("Réservé aux clients", 403);
      const { rows } = await db.query(
        `SELECT r.id, r.reference_reservation, b.nom AS boutique_nom,
                r.statut, r.montant_total, r.created_at, r.date_retrait_prevue,
                COALESCE((SELECT SUM(lr.quantite) FROM lignes_reservation lr WHERE lr.reservation_id = r.id), 0) AS nombre_articles
         FROM reservations r
         JOIN boutiques b ON b.id = r.boutique_id
         WHERE r.utilisateur_id = $1
         ORDER BY r.created_at DESC
         LIMIT 20`,
        [u.id]
      );
      return rows;
    },
  });

  // Vitrine publique : colonnes publiques seulement, jamais SELECT *.
  // boutique/page.tsx:8
  route(app, {
    methode: "GET",
    chemin: "/public/boutiques",
    garde: "public",
    gerer: async () =>
      (await db.query(`SELECT ${COLONNES_PUBLIQUES_BOUTIQUE} FROM boutiques WHERE statut = 'active' ORDER BY nom`)).rows,
  });

  // boutique/[id]/catalogue/page.tsx:36,43,55
  route(app, {
    methode: "GET",
    chemin: "/public/boutiques/:id/catalogue",
    garde: "public",
    gerer: async (r) => {
      const id = parametre(r, "id");
      const { rows } = await db.query(
        `SELECT ${COLONNES_PUBLIQUES_BOUTIQUE} FROM boutiques WHERE id = $1 AND statut = 'active'`,
        [id]
      );
      if (!rows[0]) throw new ErreurMetier("Boutique introuvable", 404);
      const [produits, categories] = await Promise.all([
        db.query(
          `SELECT sd.id, sd.produit_nom, sd.produit_reference, sd.produit_id,
                  sd.disponible, sd.prix_vente, c.id AS categorie_id, c.nom AS categorie_nom,
                  p.code AS produit_code, p.image_url AS produit_image
           FROM stock_disponible sd
           JOIN produits p ON p.id = sd.produit_id
           LEFT JOIN categories c ON c.id = p.categorie_id
           WHERE sd.boutique_id = $1 AND sd.disponible > 0
           ORDER BY c.nom, sd.produit_nom`,
          [id]
        ),
        db.query(
          `SELECT c.id, c.nom,
                  (SELECT count(*)::int FROM stock_disponible sd2
                   JOIN produits p2 ON p2.id = sd2.produit_id
                   WHERE sd2.boutique_id = $1 AND sd2.disponible > 0 AND p2.categorie_id = c.id) AS nb_produits
           FROM categories c
           ORDER BY c.nom`,
          [id]
        ),
      ]);
      return { boutique: rows[0], produits: produits.rows, categories: categories.rows };
    },
  });

  // reservation/[id]/page.tsx:21-34. Écart volontaire : ni téléphone ni e-mail
  // du client, que le monolithe affichait à quiconque connaissait l'identifiant.
  route(app, {
    methode: "GET",
    chemin: "/public/reservations/:id",
    garde: "public",
    gerer: async (r) => {
      const id = parametre(r, "id");
      const { rows } = await db.query(
        `SELECT id, reference_reservation, client_nom, boutique_id, statut, montant_total,
                date_retrait_prevue, created_at
         FROM reservations WHERE id = $1`,
        [id]
      );
      const reservation = rows[0];
      if (!reservation) throw new ErreurMetier("Réservation introuvable", 404);
      const [boutique, lignes] = await Promise.all([
        db.query(`SELECT ${COLONNES_PUBLIQUES_BOUTIQUE} FROM boutiques WHERE id = $1`, [reservation.boutique_id]),
        db.query(
          `SELECT lr.id, p.nom AS produit_nom, p.reference AS produit_reference, lr.quantite, lr.prix_unitaire
           FROM lignes_reservation lr
           JOIN produits p ON p.id = lr.produit_id
           WHERE lr.reservation_id = $1
           ORDER BY lr.created_at`,
          [id]
        ),
      ]);
      return { ...reservation, boutique: boutique.rows[0] ?? null, lignes: lignes.rows };
    },
  });
};
