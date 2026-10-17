import type { Db } from "@multiboutique/metier";
import type { FastifyPluginAsync } from "fastify";
import { route } from "../routes/registre";

// Lectures des pages /admin/* (administrateur seulement).
export const lecturesAdmin: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  const lecture = (chemin: string, gerer: () => Promise<unknown>) =>
    route(app, { methode: "GET", chemin: `/admin${chemin}`, garde: "administrateur", gerer: () => gerer() });

  // admin/page.tsx:12
  lecture("/statistiques", async () => {
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM utilisateurs) AS utilisateurs,
         (SELECT COUNT(*) FROM boutiques) AS boutiques,
         (SELECT COUNT(*) FROM boutiques WHERE statut = 'active') AS boutiques_actives,
         (SELECT COUNT(*) FROM produits) AS produits`
    );
    return rows[0];
  });

  // admin/boutiques/page.tsx:12,16
  lecture("/boutiques", async () => {
    const [regions, boutiques] = await Promise.all([
      db.query(`SELECT * FROM regions ORDER BY nom`),
      db.query(
        `SELECT b.*, r.nom AS region_nom, g.nom AS groupe_nom
         FROM boutiques b
         LEFT JOIN regions r ON r.id = b.region_id
         LEFT JOIN groupes g ON g.id = r.groupe_id
         ORDER BY b.nom`
      ),
    ]);
    return { boutiques: boutiques.rows, regions: regions.rows };
  });

  // admin/organisation/page.tsx:13,14,24
  lecture("/organisation", async () => {
    const [groupes, regions, sansRegion] = await Promise.all([
      db.query(`SELECT * FROM groupes ORDER BY nom`),
      db.query(
        `SELECT r.*, g.nom AS groupe_nom,
                COUNT(b.id)::int AS nb_boutiques,
                COALESCE(ARRAY_AGG(b.nom ORDER BY b.nom) FILTER (WHERE b.id IS NOT NULL), '{}') AS boutique_noms
         FROM regions r
         LEFT JOIN groupes g ON g.id = r.groupe_id
         LEFT JOIN boutiques b ON b.region_id = r.id
         GROUP BY r.id, g.nom
         ORDER BY g.nom, r.nom`
      ),
      db.query(`SELECT nom FROM boutiques WHERE region_id IS NULL ORDER BY nom`),
    ]);
    return { groupes: groupes.rows, regions: regions.rows, sans_region: sansRegion.rows };
  });

  // admin/categories/page.tsx:13
  lecture("/categories", async () => {
    const { rows } = await db.query(
      `SELECT c.id, c.nom, c.description,
              (SELECT count(*)::int FROM produits p WHERE p.categorie_id = c.id) AS nb_produits
       FROM categories c
       ORDER BY c.nom`
    );
    return rows;
  });

  // admin/roles/page.tsx:5
  lecture("/roles", async () => (await db.query(`SELECT role, permission, active FROM roles_permissions`)).rows);

  // admin/utilisateurs/page.tsx:38-62 — jamais password_hash
  lecture("/utilisateurs", async () => {
    const [boutiques, groupes, regions, utilisateurs] = await Promise.all([
      db.query(`SELECT * FROM boutiques WHERE statut = 'active' ORDER BY nom`),
      db.query(`SELECT * FROM groupes ORDER BY nom`),
      db.query(`SELECT * FROM regions ORDER BY nom`),
      db.query(
        `SELECT u.id, u.email, u.nom_complet, u.role, u.boutique_ids, u.region_id, u.groupe_id,
                u.telephone, u.actif, u.created_at,
                COALESCE(ARRAY(
                  SELECT b.nom FROM boutiques b WHERE b.id = ANY(u.boutique_ids)
                ), '{}') AS boutique_noms,
                r.nom AS region_nom,
                g.nom AS groupe_nom
         FROM utilisateurs u
         LEFT JOIN regions r ON r.id = u.region_id
         LEFT JOIN groupes g ON g.id = u.groupe_id
         ORDER BY u.role, u.nom_complet`
      ),
    ]);
    return { utilisateurs: utilisateurs.rows, boutiques: boutiques.rows, groupes: groupes.rows, regions: regions.rows };
  });
};
