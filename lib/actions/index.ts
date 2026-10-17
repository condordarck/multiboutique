"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { pool } from "@/lib/db";
import * as metier from "@multiboutique/metier";
import { getSession, canAccessBoutique } from "@/lib/auth";
import {
  aPermission,
  type Permission,
} from "@/lib/permissions";
import type {
  VenteFormData,
  ReservationFormData,
  ProduitFormData,
  TypeMouvementStock,
  NouvelUtilisateurData,
  BoutiqueFormData,
  ModePaiement,
  CodePromoFormData,
  ClientFormData,
  CommandeFormData,
  RoleUtilisateur,
  FournisseurFormData,
  CommandeFournisseurFormData,
  GroupeFormData,
  RegionFormData,
} from "@/types";

const ROLES_AVEC_BOUTIQUE = new Set([
  "gerant",
  "gerant_stock",
  "comptable",
  "vendeur",
]);

const ROLES_SIEGE = new Set(["directeur_groupe", "directeur_region"]);

const ROLES_AVEC_SCOPE = new Set([
  "directeur_groupe",
  "directeur_region",
]);

// Profils d'équipe créés par défaut à chaque boutique
const ROLES_PAR_DEFAUT: { role: RoleUtilisateur; label: string }[] = [
  { role: "gerant", label: "Gérant" },
  { role: "gerant_stock", label: "Magasinier" },
  { role: "comptable", label: "Comptable" },
  { role: "vendeur", label: "Vendeur" },
];

function slugifier(nom: string): string {
  return (
    nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "boutique"
  ).slice(0, 24);
}

function genererMotDePasse(): string {
  return randomBytes(9).toString("base64url");
}

async function creerComptesParDefaut(
  boutiqueId: string,
  boutiqueNom: string
): Promise<{ role: RoleUtilisateur; label: string; email: string; password: string }[]> {
  const slug = `${slugifier(boutiqueNom)}-${boutiqueId.slice(0, 6)}`;
  const crees = [];
  for (const { role, label } of ROLES_PAR_DEFAUT) {
    const email = `${role}.${slug}@defaut.multiboutique.com`;
    const { rows } = await pool.query(
      `SELECT 1 FROM utilisateurs
       WHERE role = $1::role_utilisateur AND boutique_ids @> ARRAY[$2]::uuid[]
       LIMIT 1`,
      [role, boutiqueId]
    );
    if (rows.length > 0) continue;

    const password = genererMotDePasse();
    await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, actif)
       VALUES ($1, crypt($2, gen_salt('bf', 10)), $3, $4::role_utilisateur, $5, true)`,
      [email, password, `${label} — ${boutiqueNom}`, role, [boutiqueId]]
    );
    crees.push({ role, label, email, password });
  }
  return crees;
}

async function exigerAccesBoutique(
  boutiqueId: string,
  permissions: Permission[] = []
) {
  const user = await getSession();
  if (!user) throw new Error("Non authentifié");
  if (!canAccessBoutique(user, boutiqueId)) {
    throw new Error("Accès refusé à cette boutique");
  }
  if (permissions.length > 0 && !permissions.every((p) => aPermission(user, p))) {
    throw new Error("Votre profil n'a pas les droits pour cette action");
  }
  return user;
}

async function exigerAdministrateur() {
  const user = await getSession();
  if (!user) throw new Error("Non authentifié");
  if (user.role !== "administrateur") {
    throw new Error("Réservé à l'administrateur");
  }
  return user;
}

// Session de l'appelant, pour les services de @multiboutique/metier : mêmes
// messages qu'avant le déplacement du code métier.
async function sessionExigee(): Promise<metier.Utilisateur> {
  const user = await getSession();
  if (!user) throw new Error("Non authentifié");
  return { ...user, permissions: user.permissions ?? [] };
}

// ============================================================
// HELPERS
// ============================================================

function genererReference(prefix: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const aleatoire = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${date}-${aleatoire}`;
}

async function insererMouvementWithClient(
  client: any,
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
async function appliquerCodePromo(
  client: any,
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
    throw new Error("Code promo invalide pour cette boutique");
  }

  const promo = promoRows[0];
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  const actif =
    promo.actif &&
    (!promo.date_debut || new Date(promo.date_debut) <= aujourdhui) &&
    (!promo.date_fin || new Date(promo.date_fin) >= aujourdhui);
  if (!actif) throw new Error("Ce code promo est inactif ou expiré");

  if (
    promo.max_utilisations !== null &&
    Number(promo.max_utilisations) > 0 &&
    Number(promo.nombre_utilisations) >= Number(promo.max_utilisations)
  ) {
    throw new Error("Ce code promo a atteint sa limite d'utilisation");
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

// ============================================================
// VENTES — code métier dans packages/metier/src/ventes.ts
// ============================================================

export async function creerVente(data: VenteFormData) {
  const resultat = await metier.creerVente(pool, await sessionExigee(), data);
  revalidatePath(`/dashboard/${data.boutique_id}/ventes`);
  revalidatePath(`/dashboard/${data.boutique_id}/stock`);
  revalidatePath(`/dashboard/${data.boutique_id}/clients`);
  return resultat;
}

export async function annulerVente(venteId: string, motif: string) {
  const resultat = await metier.annulerVente(pool, await sessionExigee(), venteId, motif);
  revalidatePath(`/dashboard/${resultat.boutique_id}/ventes`);
  revalidatePath(`/dashboard/${resultat.boutique_id}/stock`);
  revalidatePath(`/dashboard/${resultat.boutique_id}/clients`);
  return resultat;
}



// ============================================================
// RÉSERVATIONS — code métier dans packages/metier/src/reservations.ts
// ============================================================

export async function creerReservation(data: ReservationFormData) {
  // Le flux public reste ouvert aux visiteurs anonymes : pas de session exigée.
  const session = await getSession();
  const resultat = await metier.creerReservation(
    pool,
    session ? { ...session, permissions: session.permissions ?? [] } : null,
    data
  );
  revalidatePath(`/dashboard/${data.boutique_id}/reservations`);
  return resultat;
}

export async function validerReservation(reservationId: string) {
  const resultat = await metier.validerReservation(pool, await sessionExigee(), reservationId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/reservations`);
  revalidatePath(`/dashboard/${resultat.boutique_id}/stock`);
  return resultat;
}

export async function annulerReservation(reservationId: string, motif: string) {
  const resultat = await metier.annulerReservation(pool, await sessionExigee(), reservationId, motif);
  revalidatePath(`/dashboard/${resultat.boutique_id}/reservations`);
  return resultat;
}

export async function confirmerReservation(reservationId: string) {
  const resultat = await metier.confirmerReservation(pool, await sessionExigee(), reservationId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/reservations`);
  return resultat;
}

export async function encaisserReservation(reservationId: string, modePaiement: ModePaiement) {
  const resultat = await metier.encaisserReservation(pool, await sessionExigee(), reservationId, modePaiement);
  revalidatePath(`/dashboard/${resultat.boutique_id}/reservations`);
  revalidatePath(`/dashboard/${resultat.boutique_id}/ventes`);
  revalidatePath(`/dashboard/${resultat.boutique_id}/stock`);
  return resultat;
}






// ============================================================
// PRODUITS, STOCK, PRIX — code métier dans packages/metier/src/catalogue.ts
// ============================================================

export async function creerProduit(
  boutiqueId: string,
  data: ProduitFormData,
  prixVente: number,
  coutRevient?: number
) {
  const resultat = await metier.creerProduit(pool, await sessionExigee(), boutiqueId, data, prixVente, coutRevient);
  revalidatePath(`/dashboard/${boutiqueId}/produits`);
  revalidatePath(`/dashboard/${boutiqueId}/stock`);
  return resultat;
}

export async function entrerStock(boutiqueId: string, produitId: string, quantite: number, motif: string) {
  const resultat = await metier.entrerStock(pool, await sessionExigee(), boutiqueId, produitId, quantite, motif);
  revalidatePath(`/dashboard/${boutiqueId}/stock`);
  return resultat;
}

export async function ajusterStock(boutiqueId: string, produitId: string, nouvelleQuantite: number, motif: string) {
  const resultat = await metier.ajusterStock(pool, await sessionExigee(), boutiqueId, produitId, nouvelleQuantite, motif);
  revalidatePath(`/dashboard/${boutiqueId}/stock`);
  return resultat;
}

export async function transfertStock(
  boutiqueSourceId: string,
  boutiqueDestId: string,
  produitId: string,
  quantite: number,
  motif: string
) {
  const resultat = await metier.transfertStock(
    pool,
    await sessionExigee(),
    boutiqueSourceId,
    boutiqueDestId,
    produitId,
    quantite,
    motif
  );
  revalidatePath(`/dashboard/${boutiqueSourceId}/stock`);
  revalidatePath(`/dashboard/${boutiqueDestId}/stock`);
  return resultat;
}

export async function modifierPrix(boutiqueId: string, produitId: string, prixVente: number, coutRevient?: number) {
  const resultat = await metier.modifierPrix(pool, await sessionExigee(), boutiqueId, produitId, prixVente, coutRevient);
  revalidatePath(`/dashboard/${boutiqueId}/produits`);
  revalidatePath(`/dashboard/${boutiqueId}/stock`);
  return resultat;
}

export async function publierPrixReference(data: {
  produit_id: string;
  prix_vente: number;
  cout_revient?: number | null;
  actif?: boolean;
}) {
  const resultat = await metier.publierPrixReference(pool, await sessionExigee(), data);
  revalidatePath("/prix-conseilles");
  revalidatePath("/admin/organisation");
  return resultat;
}

export async function appliquerPrixConseilles(boutiqueId: string, produitIds?: string[]) {
  const resultat = await metier.appliquerPrixConseilles(pool, await sessionExigee(), boutiqueId, produitIds);
  revalidatePath(`/dashboard/${boutiqueId}/prix-conseilles`);
  revalidatePath(`/dashboard/${boutiqueId}/produits`);
  return resultat;
}


// ============================================================
// STOCK
// ============================================================




// ============================================================
// PRIX
// ============================================================


// ============================================================
// ADMIN — UTILISATEURS
// ============================================================

export async function creerUtilisateur(data: NouvelUtilisateurData) {
  const admin = await exigerAdministrateur();
  if (!data.nom_complet.trim() || !data.email.trim() || !data.password) {
    throw new Error("Nom, email et mot de passe requis");
  }
  if (data.password.length < 6) {
    throw new Error("Le mot de passe doit contenir au moins 6 caractères");
  }
  if (data.password.length > 72) {
    throw new Error("Le mot de passe ne doit pas dépasser 72 caractères");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    throw new Error("Adresse email invalide");
  }
  if (ROLES_AVEC_BOUTIQUE.has(data.role) && data.boutique_ids.length === 0) {
    throw new Error("Ce profil doit être rattaché à au moins une boutique");
  }
  if (data.role === "directeur_groupe" && !data.groupe_id) {
    throw new Error("Un directeur de groupe doit être rattaché à un groupe");
  }
  if (data.role === "directeur_region" && !data.region_id) {
    throw new Error("Un directeur de région doit être rattaché à une région");
  }
  if (
    data.role === "directeur_groupe" &&
    !data.boutique_ids.length &&
    data.region_id
  ) {
    throw new Error("Un directeur de groupe couvre un groupe, pas une région");
  }

  try {
    await pool.query(
      `INSERT INTO utilisateurs (email, password_hash, nom_complet, role, boutique_ids, region_id, groupe_id, telephone, actif)
       VALUES ($1, crypt($2, gen_salt('bf', 10)), $3, $4::role_utilisateur, $5, $6, $7, $8, true)`,
      [
        data.email.trim().toLowerCase(),
        data.password,
        data.nom_complet.trim(),
        data.role,
        data.boutique_ids,
        data.region_id || null,
        data.groupe_id || null,
        data.telephone?.trim() || null,
      ]
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new Error(
        `Un compte existe déjà avec l'adresse email ${data.email.trim().toLowerCase()}`
      );
    }
    throw err;
  }

  // Trace de qui a créé le compte
  await pool.query(
    `INSERT INTO journal_audit (auteur_id, action, entite, valeur_apres)
     VALUES ($1, 'creation', 'utilisateur', jsonb_build_object('email', $2, 'role', $3))`,
    [admin.id, data.email.trim().toLowerCase(), data.role]
  );

  revalidatePath("/admin/utilisateurs");
  return { success: true };
}

export async function toggleActifUtilisateur(utilisateurId: string) {
  const admin = await exigerAdministrateur();
  if (utilisateurId === admin.id) {
    throw new Error("Impossible de désactiver votre propre compte");
  }

  await pool.query(
    `UPDATE utilisateurs
     SET actif = NOT actif, updated_at = NOW()
     WHERE id = $1`,
    [utilisateurId]
  );

  revalidatePath("/admin/utilisateurs");
  return { success: true };
}

export async function reinitialiserMotDePasse(
  utilisateurId: string,
  nouveauMotDePasse: string
) {
  await exigerAdministrateur();
  if (nouveauMotDePasse.length < 6) {
    throw new Error("Le mot de passe doit contenir au moins 6 caractères");
  }
  if (nouveauMotDePasse.length > 72) {
    throw new Error("Le mot de passe ne doit pas dépasser 72 caractères");
  }

  await pool.query(
    `UPDATE utilisateurs
     SET password_hash = crypt($1, gen_salt('bf', 10)), updated_at = NOW()
     WHERE id = $2`,
    [nouveauMotDePasse, utilisateurId]
  );

  revalidatePath("/admin/utilisateurs");
  return { success: true };
}

// ============================================================
// ADMIN — BOUTIQUES
// ============================================================

export async function creerBoutique(data: BoutiqueFormData) {
  await exigerAdministrateur();
  if (!data.nom.trim()) throw new Error("Le nom de la boutique est requis");

  const { rows } = await pool.query(
    `INSERT INTO boutiques (nom, adresse, telephone, email, region_id, statut)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      data.nom.trim(),
      data.adresse?.trim() || null,
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.region_id || null,
      data.statut,
    ]
  );
  const boutiqueId = rows[0].id;

  const comptes = await creerComptesParDefaut(boutiqueId, data.nom.trim());

  revalidatePath("/admin/boutiques");
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/boutique");
  return { success: true, boutiqueId, comptes };
}

export async function listerComptesBoutique(boutiqueId: string) {
  await exigerAdministrateur();
  const { rows } = await pool.query(
    `SELECT id, nom_complet, email, role, actif
     FROM utilisateurs
     WHERE boutique_ids @> ARRAY[$1]::uuid[]
     ORDER BY role, email`,
    [boutiqueId]
  );
  return rows;
}

export async function creerUtilisateursDefaut(boutiqueId: string) {
  const admin = await exigerAdministrateur();
  const { rows } = await pool.query(
    `SELECT id, nom FROM boutiques WHERE id = $1`,
    [boutiqueId]
  );
  if (rows.length === 0) throw new Error("Boutique introuvable");

  const comptes = await creerComptesParDefaut(boutiqueId, rows[0].nom);

  if (comptes.length > 0) {
    await pool.query(
      `INSERT INTO journal_audit (auteur_id, action, entite, valeur_apres)
       VALUES ($1, 'creation', 'utilisateurs_defaut',
               jsonb_build_object('boutique_id', $2::text, 'comptes', $3::text))`,
      [admin.id, boutiqueId, JSON.stringify(comptes.map((c) => c.email))]
    );
  }

  revalidatePath("/admin/boutiques");
  revalidatePath("/admin/utilisateurs");
  return { success: true, comptes };
}

export async function modifierBoutique(
  boutiqueId: string,
  data: BoutiqueFormData
) {
  await exigerAdministrateur();
  if (!data.nom.trim()) throw new Error("Le nom de la boutique est requis");

  await pool.query(
    `UPDATE boutiques
     SET nom = $2, adresse = $3, telephone = $4, email = $5, region_id = $6, statut = $7, updated_at = NOW()
     WHERE id = $1`,
    [
      boutiqueId,
      data.nom.trim(),
      data.adresse?.trim() || null,
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.region_id || null,
      data.statut,
    ]
  );

  revalidatePath("/admin/boutiques");
  revalidatePath("/boutique");
  return { success: true };
}

// ============================================================
// ADMIN — PARAMÈTRES GÉNÉRAUX
// ============================================================

export async function mettreAJourParametres(
  params: { cle: string; valeur: string }[]
) {
  await exigerAdministrateur();

  for (const { cle, valeur } of params) {
    await pool.query(
      `INSERT INTO parametres (cle, valeur)
       VALUES ($1, $2)
       ON CONFLICT (cle) DO UPDATE SET valeur = $2, updated_at = NOW()`,
      [cle, valeur.trim()]
    );
  }

  revalidatePath("/admin/parametres");
  return { success: true };
}

// ============================================================
// PROMOTIONS — CODES PROMO (grossistes)
// ============================================================

export async function creerCodePromo(
  boutiqueId: string,
  data: CodePromoFormData
) {
  const user = await exigerAccesBoutique(boutiqueId, ["promos:gerer"]);

  const code = data.code.trim().toUpperCase();
  if (!code) throw new Error("Le code est requis");

  const valeur = Number(data.valeur_reduction);
  if (!valeur || valeur <= 0) {
    throw new Error("La valeur de réduction doit être positive");
  }

  await pool.query(
    `INSERT INTO codes_promo
       (code, description, type_reduction, valeur_reduction, boutique_id, max_utilisations, date_debut, date_fin, actif, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      code,
      data.description?.trim() || null,
      data.type_reduction,
      valeur,
      boutiqueId,
      data.max_utilisations ? Number(data.max_utilisations) : null,
      data.date_debut || null,
      data.date_fin || null,
      false,
      user.id,
    ]
  );

  revalidatePath(`/dashboard/${boutiqueId}/promotions`);
  return { success: true };
}

export async function modifierCodePromo(
  codeId: string,
  data: CodePromoFormData
) {
  const { rows } = await pool.query<{ boutique_id: string }>(
    `SELECT boutique_id FROM codes_promo WHERE id = $1`,
    [codeId]
  );
  if (rows.length === 0) throw new Error("Code promo non trouvé");
  await exigerAccesBoutique(rows[0].boutique_id, ["promos:gerer"]);

  const code = data.code.trim().toUpperCase();
  if (!code) throw new Error("Le code est requis");
  const valeur = Number(data.valeur_reduction);
  if (!valeur || valeur <= 0) {
    throw new Error("La valeur de réduction doit être positive");
  }

  await pool.query(
    `UPDATE codes_promo
     SET code = $2, description = $3, type_reduction = $4, valeur_reduction = $5,
         max_utilisations = $6, date_debut = $7, date_fin = $8, updated_at = NOW()
     WHERE id = $1`,
    [
      codeId,
      code,
      data.description?.trim() || null,
      data.type_reduction,
      valeur,
      data.max_utilisations ? Number(data.max_utilisations) : null,
      data.date_debut || null,
      data.date_fin || null,
    ]
  );

  revalidatePath(`/dashboard/${rows[0].boutique_id}/promotions`);
  return { success: true };
}

export async function toggleActifCodePromo(codeId: string) {
  const { rows } = await pool.query<{ boutique_id: string }>(
    `SELECT boutique_id FROM codes_promo WHERE id = $1`,
    [codeId]
  );
  if (rows.length === 0) throw new Error("Code promo non trouvé");
  await exigerAccesBoutique(rows[0].boutique_id, ["promos:gerer"]);

  await pool.query(
    `UPDATE codes_promo SET actif = NOT actif, updated_at = NOW() WHERE id = $1`,
    [codeId]
  );

  revalidatePath(`/dashboard/${rows[0].boutique_id}/promotions`);
  return { success: true };
}

export async function supprimerCodePromo(codeId: string) {
  const { rows } = await pool.query<{ boutique_id: string }>(
    `SELECT boutique_id FROM codes_promo WHERE id = $1`,
    [codeId]
  );
  if (rows.length === 0) throw new Error("Code promo non trouvé");
  await exigerAccesBoutique(rows[0].boutique_id, ["promos:gerer"]);

  await pool.query(`DELETE FROM codes_promo WHERE id = $1`, [codeId]);

  revalidatePath(`/dashboard/${rows[0].boutique_id}/promotions`);
  return { success: true };
}

// ============================================================
// ADMIN — ORGANISATION (groupes / régions)
// ============================================================

export async function creerGroupe(data: GroupeFormData) {
  await exigerAdministrateur();
  if (!data.nom.trim()) throw new Error("Le nom du groupe est requis");

  await pool.query(
    `INSERT INTO groupes (nom, adresse, telephone, email)
     VALUES ($1, $2, $3, $4)`,
    [
      data.nom.trim(),
      data.adresse?.trim() || null,
      data.telephone?.trim() || null,
      data.email?.trim() || null,
    ]
  );

  revalidatePath("/admin/organisation");
  return { success: true };
}

export async function modifierGroupe(groupeId: string, data: GroupeFormData) {
  await exigerAdministrateur();
  if (!data.nom.trim()) throw new Error("Le nom du groupe est requis");

  await pool.query(
    `UPDATE groupes SET nom = $2, adresse = $3, telephone = $4, email = $5, updated_at = NOW()
     WHERE id = $1`,
    [
      groupeId,
      data.nom.trim(),
      data.adresse?.trim() || null,
      data.telephone?.trim() || null,
      data.email?.trim() || null,
    ]
  );

  revalidatePath("/admin/organisation");
  return { success: true };
}

export async function creerRegion(data: RegionFormData) {
  await exigerAdministrateur();
  if (!data.nom.trim()) throw new Error("Le nom de la région est requis");
  if (!data.groupe_id) throw new Error("Une région doit appartenir à un groupe");

  await pool.query(
    `INSERT INTO regions (nom, groupe_id) VALUES ($1, $2)`,
    [data.nom.trim(), data.groupe_id]
  );

  revalidatePath("/admin/organisation");
  return { success: true };
}

export async function modifierRegion(regionId: string, data: RegionFormData) {
  await exigerAdministrateur();
  if (!data.nom.trim()) throw new Error("Le nom de la région est requis");
  if (!data.groupe_id) throw new Error("Une région doit appartenir à un groupe");

  await pool.query(
    `UPDATE regions SET nom = $2, groupe_id = $3, updated_at = NOW() WHERE id = $1`,
    [regionId, data.nom.trim(), data.groupe_id]
  );

  revalidatePath("/admin/organisation");
  return { success: true };
}

// ============================================================
// CLIENTS GROSSISTES
// ============================================================

async function exigerClientDeLaBoutique(
  clientId: string,
  boutiqueId: string
) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM clients WHERE id = $1 AND boutique_id = $2`,
    [clientId, boutiqueId]
  );
  if (rows.length === 0) {
    throw new Error("Client non trouvé dans cette boutique");
  }
  return rows[0];
}

export async function creerClient(
  boutiqueId: string,
  data: ClientFormData
) {
  await exigerAccesBoutique(boutiqueId, ["clients:gerer"]);
  if (!data.nom.trim()) throw new Error("Le nom du client est requis");

  await pool.query(
    `INSERT INTO clients (nom, telephone, email, adresse, boutique_id, type_client, plafond_credit, est_vip)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
      boutiqueId,
      data.type_client,
      data.plafond_credit != null ? Number(data.plafond_credit) : 0,
      data.est_vip ?? false,
    ]
  );

  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return { success: true };
}

export async function modifierClient(
  clientId: string,
  boutiqueId: string,
  data: ClientFormData
) {
  await exigerAccesBoutique(boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(clientId, boutiqueId);
  if (!data.nom.trim()) throw new Error("Le nom du client est requis");

  await pool.query(
    `UPDATE clients
     SET nom = $2, telephone = $3, email = $4, adresse = $5,
         type_client = $6, plafond_credit = $7, est_vip = $8, updated_at = NOW()
     WHERE id = $1`,
    [
      clientId,
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
      data.type_client,
      data.plafond_credit != null ? Number(data.plafond_credit) : 0,
      data.est_vip ?? false,
    ]
  );

  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return { success: true };
}

export async function toggleActifClient(
  clientId: string,
  boutiqueId: string
) {
  await exigerAccesBoutique(boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(clientId, boutiqueId);

  await pool.query(
    `UPDATE clients SET actif = NOT actif, updated_at = NOW() WHERE id = $1`,
    [clientId]
  );

  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return { success: true };
}

export async function basculerVip(clientId: string, boutiqueId: string) {
  await exigerAccesBoutique(boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(clientId, boutiqueId);

  await pool.query(
    `UPDATE clients SET est_vip = NOT est_vip, updated_at = NOW() WHERE id = $1`,
    [clientId]
  );

  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return { success: true };
}

export async function listerRegistre(clientId: string, boutiqueId: string) {
  await exigerAccesBoutique(boutiqueId, ["clients:voir"]);
  await exigerClientDeLaBoutique(clientId, boutiqueId);

  const { rows } = await pool.query(
    `SELECT rc.id, rc.type, rc.libelle, rc.montant, rc.solde_apres,
            rc.auteur_id, rc.created_at,
            u.nom_complet AS auteur_nom
     FROM registre_credits rc
     LEFT JOIN utilisateurs u ON u.id = rc.auteur_id
     WHERE rc.client_id = $1 AND rc.boutique_id = $2
     ORDER BY rc.created_at DESC`,
    [clientId, boutiqueId]
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    libelle: r.libelle,
    montant: Number(r.montant),
    soldeApres: Number(r.solde_apres),
    auteurNom: r.auteur_nom,
    createdAt: r.created_at,
  }));
}

export async function reglerEncours(
  clientId: string,
  boutiqueId: string,
  montant: number
) {
  const user = await exigerAccesBoutique(boutiqueId, ["clients:gerer"]);
  await exigerClientDeLaBoutique(clientId, boutiqueId);
  const montantRegle = Number(montant);
  if (!montantRegle || montantRegle <= 0) {
    throw new Error("Le montant à régler doit être positif");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, encours, nom FROM clients WHERE id = $1 AND boutique_id = $2 FOR UPDATE`,
      [clientId, boutiqueId]
    );
    if (rows.length === 0) {
      throw new Error("Client non trouvé dans cette boutique");
    }
    const encoursAvant = Number(rows[0].encours) || 0;
    const difference = Math.min(montantRegle, encoursAvant);

    const { rows: maj } = await client.query(
      `UPDATE clients SET encours = GREATEST(0, encours - $2), updated_at = NOW()
       WHERE id = $1 RETURNING encours`,
      [clientId, difference]
    );
    const nouvelEncours = Number(maj[0].encours);

    await client.query(
      `INSERT INTO registre_credits
         (client_id, boutique_id, type, libelle, montant, solde_apres, auteur_id)
       VALUES ($1, $2, 'versement', $3, $4, $5, $6)`,
      [
        clientId,
        boutiqueId,
        `Versement de ${difference.toFixed(2)}`,
        -difference,
        nouvelEncours,
        user.id,
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return { success: true };
}

// ============================================================
// COMMANDES GROSSISTES (B2B)
// ============================================================

export async function creerCommande(
  boutiqueId: string,
  data: CommandeFormData
) {
  const user = await exigerAccesBoutique(boutiqueId, ["commandes:gerer"]);
  if (!data.client_id) throw new Error("Le client est requis");
  if (!data.lignes?.length) {
    throw new Error("La commande doit contenir au moins un article");
  }

  await exigerClientDeLaBoutique(data.client_id, boutiqueId);
  const reference = genererReference("CMD");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Priorité : une commande en attente ne déduit pas le stock,
    // le prix officiel garantit une facturation fiable à la livraison.
    let montantBrut = 0;
    const lignesCalculees: {
      produit_id: string;
      quantite: number;
      prixUnitaire: number;
    }[] = [];

    for (const ligne of data.lignes) {
      const { rows: prixRows } = await client.query(
        `SELECT prix_vente FROM prix_boutique
         WHERE produit_id = $1 AND boutique_id = $2 AND actif = true`,
        [ligne.produit_id, boutiqueId]
      );
      if (prixRows.length === 0) {
        throw new Error("Produit non configuré dans cette boutique");
      }
      if (!ligne.quantite || ligne.quantite <= 0) {
        throw new Error("Quantité invalide");
      }
      const prixUnitaire = Number(ligne.prix_unitaire);
      if (!prixUnitaire || prixUnitaire <= 0) {
        throw new Error("Prix unitaire invalide");
      }
      lignesCalculees.push({
        produit_id: ligne.produit_id,
        quantite: ligne.quantite,
        prixUnitaire,
      });
      montantBrut += ligne.quantite * prixUnitaire;
    }

    // Remise éventuelle via code promo
    const { remise, montantFinal, codePromoId } = await appliquerCodePromo(
      client,
      data.code_promo,
      boutiqueId,
      montantBrut
    );

    const { rows: cmdRows } = await client.query<{ id: string }>(
      `INSERT INTO commandes
         (reference_commande, boutique_id, client_id, statut, montant_brut, remise,
          montant_total, code_promo_id, terme_paiement, note, validee_par)
       VALUES ($1, $2, $3, 'en_attente', $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        reference,
        boutiqueId,
        data.client_id,
        montantBrut,
        remise,
        montantFinal,
        codePromoId,
        data.terme_paiement,
        data.note?.trim() || null,
        user.id,
      ]
    );
    const commandeId = cmdRows[0].id;

    for (const ligne of lignesCalculees) {
      await client.query(
        `INSERT INTO lignes_commandes (commande_id, produit_id, quantite, prix_unitaire)
         VALUES ($1, $2, $3, $4)`,
        [commandeId, ligne.produit_id, ligne.quantite, ligne.prixUnitaire]
      );
    }

    await client.query("COMMIT");

    revalidatePath(`/dashboard/${boutiqueId}/commandes`);
    return {
      success: true,
      reference,
      montantTotal: montantFinal,
      remise,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmerCommande(commandeId: string) {
  const { rows } = await pool.query<{
    boutique_id: string;
    statut: string;
  }>(
    `SELECT boutique_id, statut FROM commandes WHERE id = $1`,
    [commandeId]
  );
  if (rows.length === 0) throw new Error("Commande non trouvée");
  if (rows[0].statut !== "en_attente") {
    throw new Error("Seule une commande en attente peut être confirmée");
  }
  const user = await exigerAccesBoutique(rows[0].boutique_id, [
    "commandes:gerer",
  ]);

  await pool.query(
    `UPDATE commandes SET statut = 'confirmee', validee_par = $2, updated_at = NOW()
     WHERE id = $1`,
    [commandeId, user.id]
  );

  revalidatePath(`/dashboard/${rows[0].boutique_id}/commandes`);
  return { success: true };
}

export async function livrerCommande(commandeId: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: cmdRows } = await client.query<{
      id: string;
      boutique_id: string;
      reference_commande: string;
      statut: string;
      client_id: string;
      montant_total: string;
      terme_paiement: string;
    }>(
      `SELECT id, boutique_id, reference_commande, statut, client_id, montant_total, terme_paiement
       FROM commandes WHERE id = $1 FOR UPDATE`,
      [commandeId]
    );
    if (cmdRows.length === 0) throw new Error("Commande non trouvée");
    const cmd = cmdRows[0];
    if (cmd.statut !== "confirmee") {
      throw new Error("Seule une commande confirmée peut être livrée");
    }

    const user = await exigerAccesBoutique(cmd.boutique_id, [
      "commandes:gerer",
    ]);

    // Client (respect du plafond d'encours si paiement non comptant)
    const { rows: clientRows } = await client.query<{
      id: string;
      encours: string;
      plafond_credit: string;
      actif: boolean;
    }>(`SELECT id, encours, plafond_credit, actif FROM clients WHERE id = $1 FOR UPDATE`, [
      cmd.client_id,
    ]);
    if (clientRows.length === 0) throw new Error("Client non trouvé");
    if (!clientRows[0].actif) throw new Error("Client inactif");

    const montantTotal = Number(cmd.montant_total);
    if (cmd.terme_paiement === "credit") {
      const encours = Number(clientRows[0].encours);
      const plafond = Number(clientRows[0].plafond_credit);
      if (plafond > 0 && encours + montantTotal > plafond) {
        throw new Error(
          `Plafond de crédit dépassé (encours ${encours} + commande ${montantTotal} > plafond ${plafond})`
        );
      }
    }

    const { rows: lignes } = await client.query<{
      produit_id: string;
      quantite: number;
    }>(
      `SELECT produit_id, quantite FROM lignes_commandes WHERE commande_id = $1`,
      [commandeId]
    );

    for (const ligne of lignes) {
      const { rows: stockRows } = await client.query<{ quantite: string }>(
        `SELECT quantite FROM stocks
         WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
        [ligne.produit_id, cmd.boutique_id]
      );
      const quantiteAvant = stockRows.length
        ? Number(stockRows[0].quantite)
        : 0;

      await client.query(
        `SELECT deduire_stock($1::uuid, $2::uuid, $3::integer)`,
        [ligne.produit_id, cmd.boutique_id, ligne.quantite]
      );

      await insererMouvementWithClient(client, {
        produit_id: ligne.produit_id,
        boutique_id: cmd.boutique_id,
        type: "sortie",
        quantite: ligne.quantite,
        quantite_avant: quantiteAvant,
        quantite_apres: quantiteAvant - ligne.quantite,
        motif: `Commande ${cmd.reference_commande}`,
        auteur_id: user.id,
      });
    }

    if (cmd.terme_paiement === "credit") {
      await client.query(
        `UPDATE clients SET encours = encours + $2, updated_at = NOW() WHERE id = $1`,
        [cmd.client_id, montantTotal]
      );
    }

    await client.query(
      `UPDATE commandes SET statut = 'livree', date_livraison = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [commandeId]
    );

    await client.query("COMMIT");

    revalidatePath(`/dashboard/${cmd.boutique_id}/commandes`);
    revalidatePath(`/dashboard/${cmd.boutique_id}/stock`);
    return { success: true, reference: cmd.reference_commande };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function annulerCommande(commandeId: string) {
  const { rows } = await pool.query<{
    id: string;
    boutique_id: string;
    statut: string;
  }>(`SELECT id, boutique_id, statut FROM commandes WHERE id = $1`, [
    commandeId,
  ]);
  if (rows.length === 0) throw new Error("Commande non trouvée");
  if (rows[0].statut === "livree") {
    throw new Error("Une commande livrée ne peut pas être annulée");
  }
  await exigerAccesBoutique(rows[0].boutique_id, ["commandes:gerer"]);

  await pool.query(
    `UPDATE commandes SET statut = 'annulee', updated_at = NOW() WHERE id = $1`,
    [commandeId]
  );

  revalidatePath(`/dashboard/${rows[0].boutique_id}/commandes`);
  return { success: true };
}

// ============================================================
// ACHATS — FOURNISSEURS & COMMANDES D'ACHAT
// ============================================================

async function exigerFournisseurDeLaBoutique(
  fournisseurId: string,
  boutiqueId: string
) {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM fournisseurs WHERE id = $1 AND boutique_id = $2`,
    [fournisseurId, boutiqueId]
  );
  if (rows.length === 0) {
    throw new Error("Fournisseur non trouvé dans cette boutique");
  }
  return rows[0];
}

export async function creerFournisseur(
  boutiqueId: string,
  data: FournisseurFormData
) {
  await exigerAccesBoutique(boutiqueId, ["achats:gerer"]);
  if (!data.nom.trim()) throw new Error("Le nom du fournisseur est requis");

  await pool.query(
    `INSERT INTO fournisseurs (nom, telephone, email, adresse, boutique_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
      boutiqueId,
    ]
  );

  revalidatePath(`/dashboard/${boutiqueId}/fournisseurs`);
  revalidatePath(`/dashboard/${boutiqueId}/achats`);
  return { success: true };
}

export async function modifierFournisseur(
  fournisseurId: string,
  boutiqueId: string,
  data: FournisseurFormData
) {
  await exigerAccesBoutique(boutiqueId, ["achats:gerer"]);
  await exigerFournisseurDeLaBoutique(fournisseurId, boutiqueId);
  if (!data.nom.trim()) throw new Error("Le nom du fournisseur est requis");

  await pool.query(
    `UPDATE fournisseurs
     SET nom = $2, telephone = $3, email = $4, adresse = $5, updated_at = NOW()
     WHERE id = $1`,
    [
      fournisseurId,
      data.nom.trim(),
      data.telephone?.trim() || null,
      data.email?.trim() || null,
      data.adresse?.trim() || null,
    ]
  );

  revalidatePath(`/dashboard/${boutiqueId}/fournisseurs`);
  revalidatePath(`/dashboard/${boutiqueId}/achats`);
  return { success: true };
}

export async function toggleActifFournisseur(
  fournisseurId: string,
  boutiqueId: string
) {
  await exigerAccesBoutique(boutiqueId, ["achats:gerer"]);
  await exigerFournisseurDeLaBoutique(fournisseurId, boutiqueId);

  await pool.query(
    `UPDATE fournisseurs SET actif = NOT actif, updated_at = NOW() WHERE id = $1`,
    [fournisseurId]
  );

  revalidatePath(`/dashboard/${boutiqueId}/fournisseurs`);
  revalidatePath(`/dashboard/${boutiqueId}/achats`);
  return { success: true };
}

export async function creerCommandeFournisseur(
  boutiqueId: string,
  data: CommandeFournisseurFormData
) {
  await exigerAccesBoutique(boutiqueId, ["achats:gerer"]);
  if (!data.fournisseur_id) throw new Error("Le fournisseur est requis");
  if (!data.lignes?.length) {
    throw new Error("La commande fournisseur doit contenir au moins un article");
  }
  await exigerFournisseurDeLaBoutique(data.fournisseur_id, boutiqueId);

  const reference = genererReference("ACH");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let totalAttendu = 0;
    for (const ligne of data.lignes) {
      const prix = Number(ligne.prix_unitaire);
      if (!prix || prix <= 0) throw new Error("Prix unitaire invalide");
      if (!ligne.quantite || ligne.quantite <= 0) {
        throw new Error("Quantité invalide");
      }
      totalAttendu += ligne.quantite * prix;
    }

    const { rows: cmdRows } = await client.query<{ id: string }>(
      `INSERT INTO commandes_fournisseur
         (reference_cmd, boutique_id, fournisseur_id, total_attendu, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [reference, boutiqueId, data.fournisseur_id, totalAttendu, data.note?.trim() || null]
    );
    const commandeId = cmdRows[0].id;

    for (const ligne of data.lignes) {
      await client.query(
        `INSERT INTO lignes_cmd_fournisseur
           (commande_id, produit_id, quantite_commandee, prix_unitaire)
         VALUES ($1, $2, $3, $4)`,
        [commandeId, ligne.produit_id, ligne.quantite, Number(ligne.prix_unitaire)]
      );
    }

    await client.query("COMMIT");

    revalidatePath(`/dashboard/${boutiqueId}/achats`);
    return { success: true, reference };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recevoirCommandeFournisseur(
  commandeId: string,
  receptions: { ligne_id: string; quantite_recue: number }[]
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: cmdRows } = await client.query<{
      id: string;
      boutique_id: string;
      reference_cmd: string;
      statut: string;
    }>(
      `SELECT id, boutique_id, reference_cmd, statut
       FROM commandes_fournisseur WHERE id = $1 FOR UPDATE`,
      [commandeId]
    );
    if (cmdRows.length === 0) throw new Error("Commande fournisseur non trouvée");
    const cmd = cmdRows[0];

    const user = await exigerAccesBoutique(cmd.boutique_id, ["achats:gerer"]);

    const { rows: lignes } = await client.query<{
      id: string;
      produit_id: string;
      quantite_commandee: number;
      quantite_recue: number;
    }>(
      `SELECT id, produit_id, quantite_commandee, quantite_recue
       FROM lignes_cmd_fournisseur WHERE commande_id = $1 FOR UPDATE`,
      [commandeId]
    );

    const recuesParLigne = new Map<string, number>();

    for (const recept of receptions) {
      const ligne = lignes.find((l) => l.id === recept.ligne_id);
      if (!ligne) {
        throw new Error("Ligne de commande fournisseur inconnue");
      }
      const q = Number(recept.quantite_recue);
      if (!q || q <= 0) throw new Error("Quantité reçue invalide");
      if (ligne.quantite_recue + q > ligne.quantite_commandee) {
        throw new Error("Quantité reçue supérieure à la quantité commandée");
      }

      await client.query(
        `UPDATE lignes_cmd_fournisseur SET quantite_recue = quantite_recue + $2, updated_at = NOW()
         WHERE id = $1`,
        [ligne.id, q]
      );

      // Entrée de stock atomique
      const { rows: stockRows } = await client.query<{ quantite: string }>(
        `SELECT quantite FROM stocks
         WHERE produit_id = $1 AND boutique_id = $2 FOR UPDATE`,
        [ligne.produit_id, cmd.boutique_id]
      );
      const quantiteAvant = stockRows.length
        ? Number(stockRows[0].quantite)
        : 0;

      await client.query(
        `SELECT ajouter_stock($1::uuid, $2::uuid, $3::integer)`,
        [ligne.produit_id, cmd.boutique_id, q]
      );

      await insererMouvementWithClient(client, {
        produit_id: ligne.produit_id,
        boutique_id: cmd.boutique_id,
        type: "entree",
        quantite: q,
        quantite_avant: quantiteAvant,
        quantite_apres: quantiteAvant + q,
        motif: `Réception ${cmd.reference_cmd}`,
        auteur_id: user.id,
      });

      recuesParLigne.set(ligne.id, (recuesParLigne.get(ligne.id) || 0) + q);
    }

    // Statut selon complétude : tout reçu -> "recue", sinon "partielle"
    let complet = true;
    for (const ligne of lignes) {
      const totalRecu = ligne.quantite_recue + (recuesParLigne.get(ligne.id) || 0);
      if (totalRecu < ligne.quantite_commandee) {
        complet = false;
        break;
      }
    }

    await client.query(
      `UPDATE commandes_fournisseur SET statut = $2, updated_at = NOW() WHERE id = $1`,
      [commandeId, complet ? "recue" : "partielle"]
    );

    await client.query("COMMIT");

    revalidatePath(`/dashboard/${cmd.boutique_id}/achats`);
    revalidatePath(`/dashboard/${cmd.boutique_id}/stock`);
    return { success: true, reference: cmd.reference_cmd };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function annulerCommandeFournisseur(commandeId: string) {
  const { rows } = await pool.query<{ boutique_id: string; statut: string }>(
    `SELECT boutique_id, statut FROM commandes_fournisseur WHERE id = $1`,
    [commandeId]
  );
  if (rows.length === 0) throw new Error("Commande fournisseur non trouvée");
  if (rows[0].statut === "recue" || rows[0].statut === "partielle") {
    throw new Error("Une commande déjà réceptionnée ne peut pas être annulée");
  }
  await exigerAccesBoutique(rows[0].boutique_id, ["achats:gerer"]);

  await pool.query(
    `UPDATE commandes_fournisseur SET statut = 'annulee', updated_at = NOW() WHERE id = $1`,
    [commandeId]
  );

  revalidatePath(`/dashboard/${rows[0].boutique_id}/achats`);
  return { success: true };
}

// ============================================================
// PRIX CONSEILLÉS (publiés par le siège)
// ============================================================



// ============================================================
// ADMIN — CATÉGORIES
// ============================================================

export async function creerCategorie(nom: string, description?: string) {
  await exigerAdministrateur();
  const trimmed = nom.trim();
  if (!trimmed) throw new Error("Le nom de la catégorie est requis");
  if (trimmed.length > 100) {
    throw new Error("Le nom ne doit pas dépasser 100 caractères");
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO categories (nom, description) VALUES ($1, $2) RETURNING id`,
      [trimmed, description?.trim() || null]
    );
    revalidatePath("/admin/categories");
    revalidatePath("/boutique");
    return { success: true, id: rows[0].id };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new Error("Cette catégorie existe déjà");
    }
    throw err;
  }
}

export async function modifierCategorie(
  categorieId: string,
  nom: string,
  description?: string
) {
  await exigerAdministrateur();
  const trimmed = nom.trim();
  if (!trimmed) throw new Error("Le nom de la catégorie est requis");
  if (trimmed.length > 100) {
    throw new Error("Le nom ne doit pas dépasser 100 caractères");
  }

  try {
    await pool.query(
      `UPDATE categories SET nom = $2, description = $3 WHERE id = $1`,
      [categorieId, trimmed, description?.trim() || null]
    );
    revalidatePath("/admin/categories");
    revalidatePath("/boutique");
    return { success: true };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new Error("Cette catégorie existe déjà");
    }
    throw err;
  }
}

export async function supprimerCategorie(categorieId: string) {
  await exigerAdministrateur();

  const { rows } = await pool.query(
    `SELECT (SELECT count(*)::int FROM produits WHERE categorie_id = $1) AS nb_produits`,
    [categorieId]
  );
  const nbProduits = rows[0]?.nb_produits ?? 0;
  if (nbProduits > 0) {
    throw new Error(
      `Impossible : ${nbProduits} produit(s) sont rattachés à cette catégorie. Déplacez-les d'abord.`
    );
  }

  await pool.query(`DELETE FROM categories WHERE id = $1`, [categorieId]);
  revalidatePath("/admin/categories");
  revalidatePath("/boutique");
  return { success: true };
}

// ============================================================
// ADMIN — RÔLES & PERMISSIONS (habilitations configurables)
// ============================================================

const ROLES_AUTORISES = new Set([
  "proprietaire",
  "directeur_groupe",
  "directeur_region",
  "gerant",
  "gerant_stock",
  "comptable",
  "vendeur",
  "client",
]);

export async function togglePermissionRole(
  role: string,
  permission: string,
  active: boolean
) {
  await exigerAdministrateur();
  if (!ROLES_AUTORISES.has(role)) {
    throw new Error("Rôle inconnu");
  }
  if (!permission.includes(":")) {
    throw new Error("Permission invalide");
  }

  await pool.query(
    `INSERT INTO roles_permissions (role, permission, active)
     VALUES ($1, $2, $3)
     ON CONFLICT (role, permission)
     DO UPDATE SET active = $3`,
    [role, permission, active]
  );

  revalidatePath("/admin/roles");
  revalidatePath("/dashboard");
  return {
    success: true,
    role,
    permission,
    active,
  };
}