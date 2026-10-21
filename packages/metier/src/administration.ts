import type {
  BoutiqueFormData,
  GroupeFormData,
  NouvelUtilisateurData,
  RegionFormData,
} from "@multiboutique/shared";
import { exigerAdministrateur } from "./acces";
import type { Db, Utilisateur } from "./contexte";
import { ErreurMetier } from "./erreurs";
import { creerComptesParDefaut, ROLES_AVEC_BOUTIQUE } from "./interne";

// Administration (utilisateurs, boutiques, paramètres, organisation, catégories,
// habilitations) : repris de lib/actions/index.ts, SQL inchangé.

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

export async function creerUtilisateur(db: Db, user: Utilisateur, data: NouvelUtilisateurData) {
  const admin = exigerAdministrateur(user);
  if (!data.nom_complet.trim() || !data.email.trim() || !data.password) {
    throw new ErreurMetier("Nom, email et mot de passe requis");
  }
  if (data.password.length < 6) {
    throw new ErreurMetier("Le mot de passe doit contenir au moins 6 caractères");
  }
  if (data.password.length > 72) {
    throw new ErreurMetier("Le mot de passe ne doit pas dépasser 72 caractères");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    throw new ErreurMetier("Adresse email invalide");
  }
  if (ROLES_AVEC_BOUTIQUE.has(data.role) && data.boutique_ids.length === 0) {
    throw new ErreurMetier("Ce profil doit être rattaché à au moins une boutique");
  }
  if (data.role === "directeur_groupe" && !data.groupe_id) {
    throw new ErreurMetier("Un directeur de groupe doit être rattaché à un groupe");
  }
  if (data.role === "directeur_region" && !data.region_id) {
    throw new ErreurMetier("Un directeur de région doit être rattaché à une région");
  }
  if (
    data.role === "directeur_groupe" &&
    !data.boutique_ids.length &&
    data.region_id
  ) {
    throw new ErreurMetier("Un directeur de groupe couvre un groupe, pas une région");
  }

  try {
    await db.query(
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
      throw new ErreurMetier(
        `Un compte existe déjà avec l'adresse email ${data.email.trim().toLowerCase()}`);
    }
    throw err;
  }

  // Trace de qui a créé le compte. Les ::text sont indispensables : sans eux,
  // jsonb_build_object ne peut pas typer les paramètres (42P18) et l'action
  // échouait après avoir créé le compte.
  await db.query(
    `INSERT INTO journal_audit (auteur_id, action, entite, valeur_apres)
     VALUES ($1, 'creation', 'utilisateur', jsonb_build_object('email', $2::text, 'role', $3::text))`,
    [admin.id, data.email.trim().toLowerCase(), data.role]
  );

  return { success: true };
}

export async function toggleActifUtilisateur(db: Db, user: Utilisateur, utilisateurId: string) {
  const admin = exigerAdministrateur(user);
  if (utilisateurId === admin.id) {
    throw new ErreurMetier("Impossible de désactiver votre propre compte");
  }

  await db.query(
    `UPDATE utilisateurs
     SET actif = NOT actif, updated_at = NOW()
     WHERE id = $1`,
    [utilisateurId]
  );

  return { success: true };
}

export async function reinitialiserMotDePasse(db: Db, user: Utilisateur, 
  utilisateurId: string,
  nouveauMotDePasse: string
) {
  exigerAdministrateur(user);
  if (nouveauMotDePasse.length < 6) {
    throw new ErreurMetier("Le mot de passe doit contenir au moins 6 caractères");
  }
  if (nouveauMotDePasse.length > 72) {
    throw new ErreurMetier("Le mot de passe ne doit pas dépasser 72 caractères");
  }

  await db.query(
    `UPDATE utilisateurs
     SET password_hash = crypt($1, gen_salt('bf', 10)), updated_at = NOW()
     WHERE id = $2`,
    [nouveauMotDePasse, utilisateurId]
  );

  return { success: true };
}

export async function creerBoutique(db: Db, user: Utilisateur, data: BoutiqueFormData) {
  exigerAdministrateur(user);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom de la boutique est requis");

  const { rows } = await db.query(
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

  const comptes = await creerComptesParDefaut(db, boutiqueId, data.nom.trim());

  return { success: true, boutiqueId, comptes };
}

export async function listerComptesBoutique(db: Db, user: Utilisateur, boutiqueId: string) {
  exigerAdministrateur(user);
  const { rows } = await db.query(
    `SELECT id, nom_complet, email, role, actif
     FROM utilisateurs
     WHERE boutique_ids @> ARRAY[$1]::uuid[]
     ORDER BY role, email`,
    [boutiqueId]
  );
  return rows;
}

export async function creerUtilisateursDefaut(db: Db, user: Utilisateur, boutiqueId: string) {
  const admin = exigerAdministrateur(user);
  const { rows } = await db.query(
    `SELECT id, nom FROM boutiques WHERE id = $1`,
    [boutiqueId]
  );
  if (rows.length === 0) throw new ErreurMetier("Boutique introuvable", 404);

  const comptes = await creerComptesParDefaut(db, boutiqueId, rows[0].nom);

  if (comptes.length > 0) {
    await db.query(
      `INSERT INTO journal_audit (auteur_id, action, entite, valeur_apres)
       VALUES ($1, 'creation', 'utilisateurs_defaut',
               jsonb_build_object('boutique_id', $2::text, 'comptes', $3::text))`,
      [admin.id, boutiqueId, JSON.stringify(comptes.map((c) => c.email))]
    );
  }

  return { success: true, comptes };
}

export async function modifierBoutique(db: Db, user: Utilisateur, 
  boutiqueId: string,
  data: BoutiqueFormData
) {
  exigerAdministrateur(user);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom de la boutique est requis");

  await db.query(
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

  return { success: true };
}

export async function mettreAJourParametres(db: Db, user: Utilisateur, 
  params: { cle: string; valeur: string }[]
) {
  exigerAdministrateur(user);

  for (const { cle, valeur } of params) {
    await db.query(
      `INSERT INTO parametres (cle, valeur)
       VALUES ($1, $2)
       ON CONFLICT (cle) DO UPDATE SET valeur = $2, updated_at = NOW()`,
      [cle, valeur.trim()]
    );
  }

  return { success: true };
}

export async function creerGroupe(db: Db, user: Utilisateur, data: GroupeFormData) {
  exigerAdministrateur(user);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom du groupe est requis");

  await db.query(
    `INSERT INTO groupes (nom, adresse, telephone, email)
     VALUES ($1, $2, $3, $4)`,
    [
      data.nom.trim(),
      data.adresse?.trim() || null,
      data.telephone?.trim() || null,
      data.email?.trim() || null,
    ]
  );

  return { success: true };
}

export async function modifierGroupe(db: Db, user: Utilisateur, groupeId: string, data: GroupeFormData) {
  exigerAdministrateur(user);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom du groupe est requis");

  await db.query(
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

  return { success: true };
}

export async function creerRegion(db: Db, user: Utilisateur, data: RegionFormData) {
  exigerAdministrateur(user);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom de la région est requis");
  if (!data.groupe_id) throw new ErreurMetier("Une région doit appartenir à un groupe");

  await db.query(
    `INSERT INTO regions (nom, groupe_id) VALUES ($1, $2)`,
    [data.nom.trim(), data.groupe_id]
  );

  return { success: true };
}

export async function modifierRegion(db: Db, user: Utilisateur, regionId: string, data: RegionFormData) {
  exigerAdministrateur(user);
  if (!data.nom.trim()) throw new ErreurMetier("Le nom de la région est requis");
  if (!data.groupe_id) throw new ErreurMetier("Une région doit appartenir à un groupe");

  await db.query(
    `UPDATE regions SET nom = $2, groupe_id = $3, updated_at = NOW() WHERE id = $1`,
    [regionId, data.nom.trim(), data.groupe_id]
  );

  return { success: true };
}

export async function creerCategorie(db: Db, user: Utilisateur, nom: string, description?: string) {
  exigerAdministrateur(user);
  const trimmed = nom.trim();
  if (!trimmed) throw new ErreurMetier("Le nom de la catégorie est requis");
  if (trimmed.length > 100) {
    throw new ErreurMetier("Le nom ne doit pas dépasser 100 caractères");
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO categories (nom, description) VALUES ($1, $2) RETURNING id`,
      [trimmed, description?.trim() || null]
    );
    return { success: true, id: rows[0].id };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new ErreurMetier("Cette catégorie existe déjà");
    }
    throw err;
  }
}

export async function modifierCategorie(db: Db, user: Utilisateur, 
  categorieId: string,
  nom: string,
  description?: string
) {
  exigerAdministrateur(user);
  const trimmed = nom.trim();
  if (!trimmed) throw new ErreurMetier("Le nom de la catégorie est requis");
  if (trimmed.length > 100) {
    throw new ErreurMetier("Le nom ne doit pas dépasser 100 caractères");
  }

  try {
    await db.query(
      `UPDATE categories SET nom = $2, description = $3 WHERE id = $1`,
      [categorieId, trimmed, description?.trim() || null]
    );
    return { success: true };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new ErreurMetier("Cette catégorie existe déjà");
    }
    throw err;
  }
}

export async function supprimerCategorie(db: Db, user: Utilisateur, categorieId: string) {
  exigerAdministrateur(user);

  const { rows } = await db.query(
    `SELECT (SELECT count(*)::int FROM produits WHERE categorie_id = $1) AS nb_produits`,
    [categorieId]
  );
  const nbProduits = rows[0]?.nb_produits ?? 0;
  if (nbProduits > 0) {
    throw new ErreurMetier(
      `Impossible : ${nbProduits} produit(s) sont rattachés à cette catégorie. Déplacez-les d'abord.`);
  }

  await db.query(`DELETE FROM categories WHERE id = $1`, [categorieId]);
  return { success: true };
}

function libelleTypeFrais(libelle: string) {
  const l = libelle.trim();
  if (!l) throw new ErreurMetier("Le libellé du frais est requis");
  if (l.length > 100) throw new ErreurMetier("Le libellé ne doit pas dépasser 100 caractères");
  return l;
}

export async function creerTypeFrais(db: Db, user: Utilisateur, libelle: string) {
  exigerAdministrateur(user);
  try {
    const { rows } = await db.query(`INSERT INTO types_frais (libelle) VALUES ($1) RETURNING id`, [libelleTypeFrais(libelle)]);
    return { success: true, id: rows[0].id };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new ErreurMetier("Ce type de frais existe déjà");
    throw err;
  }
}

/** Renomme ou (dés)active : un type désactivé n'est plus proposé, les prix qui l'utilisent le gardent. */
export async function modifierTypeFrais(db: Db, user: Utilisateur, typeFraisId: string, libelle: string, actif: boolean) {
  exigerAdministrateur(user);
  try {
    const { rowCount } = await db.query(
      `UPDATE types_frais SET libelle = $2, actif = $3, updated_at = NOW() WHERE id = $1`,
      [typeFraisId, libelleTypeFrais(libelle), actif]
    );
    if (!rowCount) throw new ErreurMetier("Type de frais introuvable", 404);
    return { success: true };
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new ErreurMetier("Ce type de frais existe déjà");
    throw err;
  }
}

export async function supprimerTypeFrais(db: Db, user: Utilisateur, typeFraisId: string) {
  exigerAdministrateur(user);
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM frais_prix WHERE type_frais_id = $1`, [typeFraisId]);
  if (rows[0].n > 0) {
    throw new ErreurMetier(`Impossible : ${rows[0].n} prix utilisent ce frais. Désactivez-le plutôt.`);
  }
  await db.query(`DELETE FROM types_frais WHERE id = $1`, [typeFraisId]);
  return { success: true };
}

export async function togglePermissionRole(db: Db, user: Utilisateur, 
  role: string,
  permission: string,
  active: boolean
) {
  exigerAdministrateur(user);
  if (!ROLES_AUTORISES.has(role)) {
    throw new ErreurMetier("Rôle inconnu");
  }
  if (!permission.includes(":")) {
    throw new ErreurMetier("Permission invalide");
  }

  await db.query(
    `INSERT INTO roles_permissions (role, permission, active)
     VALUES ($1, $2, $3)
     ON CONFLICT (role, permission)
     DO UPDATE SET active = $3`,
    [role, permission, active]
  );

  return {
    success: true,
    role,
    permission,
    active,
  };
}