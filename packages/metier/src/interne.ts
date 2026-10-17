import { randomBytes } from "node:crypto";
import type { RoleUtilisateur, TypeMouvementStock } from "@multiboutique/shared";
import { ErreurMetier } from "./erreurs";

// Helpers repris de lib/actions/index.ts, partagés par les services.

/** Ce qui sait exécuter une requête : le pool, ou un client en transaction. */
export interface Requeteur {
  query: (texte: string, valeurs?: unknown[]) => Promise<{ rows: any[] }>;
}

export function genererReference(prefix: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const aleatoire = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${date}-${aleatoire}`;
}

export async function insererMouvementWithClient(
  client: Requeteur,
  p: {
    produit_id: string;
    boutique_id: string;
    type: TypeMouvementStock;
    quantite: number;
    quantite_avant: number;
    quantite_apres: number;
    motif: string;
    auteur_id: string;
    boutique_destination_id?: string | null;
  }
) {
  await client.query(
    `INSERT INTO mouvements_stock
       (produit_id, boutique_id, type, quantite, quantite_avant, quantite_apres, motif, boutique_destination_id, auteur_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      p.produit_id,
      p.boutique_id,
      p.type,
      p.quantite,
      p.quantite_avant,
      p.quantite_apres,
      p.motif,
      p.boutique_destination_id ?? null,
      p.auteur_id,
    ]
  );
}

// Validation + application d'un code promo dans une transaction.
// Utilisée par les ventes ET les commandes grossistes.
export async function appliquerCodePromo(
  client: Requeteur,
  code: string | undefined,
  boutiqueId: string,
  montantTotal: number
): Promise<{
  remise: number;
  montantFinal: number;
  codePromoId: string | null;
}> {
  if (!code?.trim()) {
    return { remise: 0, montantFinal: montantTotal, codePromoId: null };
  }

  const ref = code.trim().toUpperCase();
  const { rows: promoRows } = await client.query(
    `SELECT * FROM codes_promo WHERE code = $1 AND boutique_id = $2`,
    [ref, boutiqueId]
  );
  if (promoRows.length === 0) {
    throw new ErreurMetier("Code promo invalide pour cette boutique");
  }

  const promo = promoRows[0];
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const actif =
    promo.actif &&
    (!promo.date_debut || new Date(promo.date_debut) <= aujourdhui) &&
    (!promo.date_fin || new Date(promo.date_fin) >= aujourdhui);
  if (!actif) throw new ErreurMetier("Ce code promo est inactif ou expiré");

  if (
    promo.max_utilisations !== null &&
    Number(promo.max_utilisations) > 0 &&
    Number(promo.nombre_utilisations) >= Number(promo.max_utilisations)
  ) {
    throw new ErreurMetier("Ce code promo a atteint sa limite d'utilisation");
  }

  const valeur = Number(promo.valeur_reduction);
  const remise =
    promo.type_reduction === "pourcentage"
      ? (montantTotal * valeur) / 100
      : Math.min(valeur, montantTotal);
  const montantFinal = Math.max(0, montantTotal - remise);

  await client.query(
    `UPDATE codes_promo
     SET nombre_utilisations = nombre_utilisations + 1, updated_at = NOW()
     WHERE id = $1`,
    [promo.id]
  );

  return { remise, montantFinal, codePromoId: promo.id };
}

export async function exigerClientDeLaBoutique(db: Requeteur, clientId: string, boutiqueId: string) {
  const { rows } = await db.query(
    `SELECT id FROM clients WHERE id = $1 AND boutique_id = $2`,
    [clientId, boutiqueId]
  );
  if (rows.length === 0) {
    throw new ErreurMetier("Client non trouvé dans cette boutique", 404);
  }
  return rows[0] as { id: string };
}

export async function exigerFournisseurDeLaBoutique(db: Requeteur, fournisseurId: string, boutiqueId: string) {
  const { rows } = await db.query(
    `SELECT id FROM fournisseurs WHERE id = $1 AND boutique_id = $2`,
    [fournisseurId, boutiqueId]
  );
  if (rows.length === 0) {
    throw new ErreurMetier("Fournisseur non trouvé dans cette boutique", 404);
  }
  return rows[0] as { id: string };
}

// Comptes et rôles, pour l'administration.

export const ROLES_AVEC_BOUTIQUE = new Set([
  "gerant",
  "gerant_stock",
  "comptable",
  "vendeur",
]);

// Profils d'équipe créés par défaut à chaque boutique
export const ROLES_PAR_DEFAUT: { role: RoleUtilisateur; label: string }[] = [
  { role: "gerant", label: "Gérant" },
  { role: "gerant_stock", label: "Magasinier" },
  { role: "comptable", label: "Comptable" },
  { role: "vendeur", label: "Vendeur" },
];

export function slugifier(nom: string): string {
  return (
    nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "boutique"
  ).slice(0, 24);
}

export function genererMotDePasse(): string {
  return randomBytes(9).toString("base64url");
}

export async function creerComptesParDefaut(
  db: Requeteur,
  boutiqueId: string,
  boutiqueNom: string
): Promise<{ role: RoleUtilisateur; label: string; email: string; password: string }[]> {
  const slug = `${slugifier(boutiqueNom)}-${boutiqueId.slice(0, 6)}`;
  const crees = [];
  for (const { role, label } of ROLES_PAR_DEFAUT) {
    const email = `${role}.${slug}@defaut.multiboutique.com`;
    const { rows } = await db.query(
      `SELECT 1 FROM utilisateurs
       WHERE role = $1::role_utilisateur AND boutique_ids @> ARRAY[$2]::uuid[]
       LIMIT 1`,
      [role, boutiqueId]
    );
    if (rows.length > 0) continue;

    const password = genererMotDePasse();
    await db.query(
      `INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, actif)
       VALUES ($1, crypt($2, gen_salt('bf', 10)), $3, $4::role_utilisateur, $5, true)`,
      [email, password, `${label} — ${boutiqueNom}`, role, [boutiqueId]]
    );
    crees.push({ role, label, email, password });
  }
  return crees;
}
