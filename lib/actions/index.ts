"use server";

// Actions serveur du monolithe. Le code métier vit dans packages/metier, partagé
// avec l'API ; chaque action ne fait ici que charger la session, appeler le
// service et invalider les pages concernées.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { pool } from "@/lib/db";
import * as metier from "@multiboutique/metier";
import type {
  BoutiqueFormData,
  ClientFormData,
  CodePromoFormData,
  CommandeFormData,
  CommandeFournisseurFormData,
  FournisseurFormData,
  GroupeFormData,
  ModePaiement,
  NouvelUtilisateurData,
  ProduitFormData,
  RegionFormData,
  ReservationFormData,
  VenteFormData,
} from "@/types";

// Session de l'appelant, pour les services de @multiboutique/metier : mêmes
// messages qu'avant le déplacement du code métier.
async function sessionExigee(): Promise<metier.Utilisateur> {
  const user = await getSession();
  if (!user) throw new Error("Non authentifié");
  return { ...user, permissions: user.permissions ?? [] };
}

// ============================================================
// VENTES — packages/metier/src/ventes.ts
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
// RÉSERVATIONS — packages/metier/src/reservations.ts
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
// PRODUITS, STOCK, PRIX — packages/metier/src/catalogue.ts
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
// CLIENTS GROSSISTES ET CRÉDIT — packages/metier/src/clients.ts
// ============================================================
export async function creerClient(boutiqueId: string, data: ClientFormData) {
  const resultat = await metier.creerClient(pool, await sessionExigee(), boutiqueId, data);
  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return resultat;
}

export async function modifierClient(clientId: string, boutiqueId: string, data: ClientFormData) {
  const resultat = await metier.modifierClient(pool, await sessionExigee(), clientId, boutiqueId, data);
  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return resultat;
}

export async function toggleActifClient(clientId: string, boutiqueId: string) {
  const resultat = await metier.toggleActifClient(pool, await sessionExigee(), clientId, boutiqueId);
  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return resultat;
}

export async function basculerVip(clientId: string, boutiqueId: string) {
  const resultat = await metier.basculerVip(pool, await sessionExigee(), clientId, boutiqueId);
  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return resultat;
}

export async function listerRegistre(clientId: string, boutiqueId: string) {
  return metier.listerRegistre(pool, await sessionExigee(), clientId, boutiqueId);
}

export async function reglerEncours(clientId: string, boutiqueId: string, montant: number) {
  const resultat = await metier.reglerEncours(pool, await sessionExigee(), clientId, boutiqueId, montant);
  revalidatePath(`/dashboard/${boutiqueId}/clients`);
  return resultat;
}

// ============================================================
// CODES PROMO — packages/metier/src/promotions.ts
// ============================================================
export async function creerCodePromo(boutiqueId: string, data: CodePromoFormData) {
  const resultat = await metier.creerCodePromo(pool, await sessionExigee(), boutiqueId, data);
  revalidatePath(`/dashboard/${boutiqueId}/promotions`);
  return resultat;
}

export async function modifierCodePromo(codeId: string, data: CodePromoFormData) {
  const resultat = await metier.modifierCodePromo(pool, await sessionExigee(), codeId, data);
  revalidatePath(`/dashboard/${resultat.boutique_id}/promotions`);
  return resultat;
}

export async function toggleActifCodePromo(codeId: string) {
  const resultat = await metier.toggleActifCodePromo(pool, await sessionExigee(), codeId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/promotions`);
  return resultat;
}

export async function supprimerCodePromo(codeId: string) {
  const resultat = await metier.supprimerCodePromo(pool, await sessionExigee(), codeId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/promotions`);
  return resultat;
}

// ============================================================
// COMMANDES GROSSISTES (B2B) — packages/metier/src/commandes.ts
// ============================================================
export async function creerCommande(boutiqueId: string, data: CommandeFormData) {
  const resultat = await metier.creerCommande(pool, await sessionExigee(), boutiqueId, data);
  revalidatePath(`/dashboard/${boutiqueId}/commandes`);
  return resultat;
}

export async function confirmerCommande(commandeId: string) {
  const resultat = await metier.confirmerCommande(pool, await sessionExigee(), commandeId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/commandes`);
  return resultat;
}

export async function livrerCommande(commandeId: string) {
  const resultat = await metier.livrerCommande(pool, await sessionExigee(), commandeId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/commandes`);
  revalidatePath(`/dashboard/${resultat.boutique_id}/stock`);
  return resultat;
}

export async function annulerCommande(commandeId: string) {
  const resultat = await metier.annulerCommande(pool, await sessionExigee(), commandeId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/commandes`);
  return resultat;
}

// ============================================================
// ACHATS — FOURNISSEURS ET COMMANDES D'ACHAT — packages/metier/src/achats.ts
// ============================================================
export async function creerFournisseur(boutiqueId: string, data: FournisseurFormData) {
  const resultat = await metier.creerFournisseur(pool, await sessionExigee(), boutiqueId, data);
  revalidatePath(`/dashboard/${boutiqueId}/fournisseurs`);
  revalidatePath(`/dashboard/${boutiqueId}/achats`);
  return resultat;
}

export async function modifierFournisseur(fournisseurId: string, boutiqueId: string, data: FournisseurFormData) {
  const resultat = await metier.modifierFournisseur(pool, await sessionExigee(), fournisseurId, boutiqueId, data);
  revalidatePath(`/dashboard/${boutiqueId}/fournisseurs`);
  revalidatePath(`/dashboard/${boutiqueId}/achats`);
  return resultat;
}

export async function toggleActifFournisseur(fournisseurId: string, boutiqueId: string) {
  const resultat = await metier.toggleActifFournisseur(pool, await sessionExigee(), fournisseurId, boutiqueId);
  revalidatePath(`/dashboard/${boutiqueId}/fournisseurs`);
  revalidatePath(`/dashboard/${boutiqueId}/achats`);
  return resultat;
}

export async function creerCommandeFournisseur(boutiqueId: string, data: CommandeFournisseurFormData) {
  const resultat = await metier.creerCommandeFournisseur(pool, await sessionExigee(), boutiqueId, data);
  revalidatePath(`/dashboard/${boutiqueId}/achats`);
  return resultat;
}

export async function recevoirCommandeFournisseur(
  commandeId: string,
  receptions: { ligne_id: string; quantite_recue: number }[]
) {
  const resultat = await metier.recevoirCommandeFournisseur(pool, await sessionExigee(), commandeId, receptions);
  revalidatePath(`/dashboard/${resultat.boutique_id}/achats`);
  revalidatePath(`/dashboard/${resultat.boutique_id}/stock`);
  return resultat;
}

export async function annulerCommandeFournisseur(commandeId: string) {
  const resultat = await metier.annulerCommandeFournisseur(pool, await sessionExigee(), commandeId);
  revalidatePath(`/dashboard/${resultat.boutique_id}/achats`);
  return resultat;
}

// ============================================================
// ADMINISTRATION — packages/metier/src/administration.ts
// ============================================================
export async function creerUtilisateur(data: NouvelUtilisateurData) {
  const resultat = await metier.creerUtilisateur(pool, await sessionExigee(), data);
  revalidatePath("/admin/utilisateurs");
  return resultat;
}

export async function toggleActifUtilisateur(utilisateurId: string) {
  const resultat = await metier.toggleActifUtilisateur(pool, await sessionExigee(), utilisateurId);
  revalidatePath("/admin/utilisateurs");
  return resultat;
}

export async function reinitialiserMotDePasse(utilisateurId: string, nouveauMotDePasse: string) {
  const resultat = await metier.reinitialiserMotDePasse(pool, await sessionExigee(), utilisateurId, nouveauMotDePasse);
  revalidatePath("/admin/utilisateurs");
  return resultat;
}

export async function creerBoutique(data: BoutiqueFormData) {
  const resultat = await metier.creerBoutique(pool, await sessionExigee(), data);
  revalidatePath("/admin/boutiques");
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/boutique");
  return resultat;
}

export async function listerComptesBoutique(boutiqueId: string) {
  return metier.listerComptesBoutique(pool, await sessionExigee(), boutiqueId);
}

export async function creerUtilisateursDefaut(boutiqueId: string) {
  const resultat = await metier.creerUtilisateursDefaut(pool, await sessionExigee(), boutiqueId);
  revalidatePath("/admin/boutiques");
  revalidatePath("/admin/utilisateurs");
  return resultat;
}

export async function modifierBoutique(boutiqueId: string, data: BoutiqueFormData) {
  const resultat = await metier.modifierBoutique(pool, await sessionExigee(), boutiqueId, data);
  revalidatePath("/admin/boutiques");
  revalidatePath("/boutique");
  return resultat;
}

export async function mettreAJourParametres(params: { cle: string; valeur: string }[]) {
  const resultat = await metier.mettreAJourParametres(pool, await sessionExigee(), params);
  revalidatePath("/admin/parametres");
  return resultat;
}

export async function creerGroupe(data: GroupeFormData) {
  const resultat = await metier.creerGroupe(pool, await sessionExigee(), data);
  revalidatePath("/admin/organisation");
  return resultat;
}

export async function modifierGroupe(groupeId: string, data: GroupeFormData) {
  const resultat = await metier.modifierGroupe(pool, await sessionExigee(), groupeId, data);
  revalidatePath("/admin/organisation");
  return resultat;
}

export async function creerRegion(data: RegionFormData) {
  const resultat = await metier.creerRegion(pool, await sessionExigee(), data);
  revalidatePath("/admin/organisation");
  return resultat;
}

export async function modifierRegion(regionId: string, data: RegionFormData) {
  const resultat = await metier.modifierRegion(pool, await sessionExigee(), regionId, data);
  revalidatePath("/admin/organisation");
  return resultat;
}

export async function creerCategorie(nom: string, description?: string) {
  const resultat = await metier.creerCategorie(pool, await sessionExigee(), nom, description);
  revalidatePath("/admin/categories");
  revalidatePath("/boutique");
  return resultat;
}

export async function modifierCategorie(categorieId: string, nom: string, description?: string) {
  const resultat = await metier.modifierCategorie(pool, await sessionExigee(), categorieId, nom, description);
  revalidatePath("/admin/categories");
  revalidatePath("/boutique");
  return resultat;
}

export async function supprimerCategorie(categorieId: string) {
  const resultat = await metier.supprimerCategorie(pool, await sessionExigee(), categorieId);
  revalidatePath("/admin/categories");
  revalidatePath("/boutique");
  return resultat;
}

export async function togglePermissionRole(role: string, permission: string, active: boolean) {
  const resultat = await metier.togglePermissionRole(pool, await sessionExigee(), role, permission, active);
  revalidatePath("/admin/roles");
  revalidatePath("/dashboard");
  return resultat;
}
