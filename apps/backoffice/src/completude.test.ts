// @vitest-environment node
import * as metier from "@multiboutique/metier";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { SERVICES } from "./api/services";
import { routes } from "./routes";

// Exports de @multiboutique/metier qui ne sont pas des services (même liste que l'API).
const OUTILS = new Set(["ErreurMetier", "exigerAccesBoutique", "exigerAdministrateur", "peutAccederBoutique"]);

// Services qui ne relèvent pas du backoffice.
const EXCLUS = new Set([
  "creerReservation", // réservation de la vitrine : phase 4
]);

// Écritures pas encore branchées : chaque tâche d'écran du plan en retire ;
// la tâche 14 vide la liste.
const MANQUES_ATTENDUS = new Set<string>([
  "ajusterStock", "annulerCommande", "annulerCommandeFournisseur", "annulerReservation", "annulerVente",
  "appliquerPrixConseilles", "basculerVip", "confirmerCommande", "confirmerReservation", "creerBoutique",
  "creerCategorie", "creerClient", "creerCodePromo", "creerCommande", "creerCommandeFournisseur",
  "creerFournisseur", "creerGroupe", "creerProduit", "creerRegion", "creerUtilisateur",
  "creerUtilisateursDefaut", "creerVente", "encaisserReservation", "entrerStock", "listerComptesBoutique",
  "listerRegistre", "livrerCommande", "mettreAJourParametres", "modifierBoutique", "modifierCategorie",
  "modifierClient", "modifierCodePromo", "modifierFournisseur", "modifierGroupe", "modifierPrix",
  "modifierRegion", "publierPrixReference", "recevoirCommandeFournisseur", "reglerEncours",
  "reinitialiserMotDePasse", "supprimerCategorie", "supprimerCodePromo", "toggleActifClient",
  "toggleActifCodePromo", "toggleActifFournisseur", "toggleActifUtilisateur", "togglePermissionRole",
  "transfertStock", "validerReservation",
]);

const B = "11111111-1111-1111-1111-111111111111";

// Page du monolithe (sous app/) → adresse équivalente du backoffice.
const PAGES: Record<string, string> = {
  "(auth)/login/page.tsx": "/connexion",
  "(dashboard)/dashboard/page.tsx": "/tableau-de-bord",
  "(dashboard)/dashboard/consolidation/page.tsx": "/consolidation",
  "(dashboard)/dashboard/[boutiqueId]/page.tsx": `/b/${B}`,
  "(dashboard)/dashboard/[boutiqueId]/ventes/page.tsx": `/b/${B}/ventes`,
  "(dashboard)/dashboard/[boutiqueId]/ventes/[venteId]/page.tsx": `/b/${B}/ventes/v1`,
  "(dashboard)/dashboard/[boutiqueId]/produits/page.tsx": `/b/${B}/produits`,
  "(dashboard)/dashboard/[boutiqueId]/stock/page.tsx": `/b/${B}/stock`,
  "(dashboard)/dashboard/[boutiqueId]/clients/page.tsx": `/b/${B}/clients`,
  "(dashboard)/dashboard/[boutiqueId]/promotions/page.tsx": `/b/${B}/promotions`,
  "(dashboard)/dashboard/[boutiqueId]/commandes/page.tsx": `/b/${B}/commandes`,
  "(dashboard)/dashboard/[boutiqueId]/reservations/page.tsx": `/b/${B}/reservations`,
  "(dashboard)/dashboard/[boutiqueId]/achats/page.tsx": `/b/${B}/achats`,
  "(dashboard)/dashboard/[boutiqueId]/prix-conseilles/page.tsx": `/b/${B}/prix-conseilles`,
  "(dashboard)/dashboard/[boutiqueId]/rapports/page.tsx": `/b/${B}/rapports`,
  "(admin)/admin/page.tsx": "/admin",
  "(admin)/admin/utilisateurs/page.tsx": "/admin/utilisateurs",
  "(admin)/admin/boutiques/page.tsx": "/admin/boutiques",
  "(admin)/admin/organisation/page.tsx": "/admin/organisation",
  "(admin)/admin/categories/page.tsx": "/admin/categories",
  "(admin)/admin/roles/page.tsx": "/admin/roles",
  "(admin)/admin/parametres/page.tsx": "/admin/parametres",
};

// Pages pas encore reprises : chaque tâche d'écran en retire ; la tâche 14 vide la liste.
const PAGES_MANQUANTES = new Set<string>(Object.keys(PAGES).filter((p) => p !== "(auth)/login/page.tsx"));

const APP = fileURLToPath(new URL("../../../app/", import.meta.url));

function pagesDuMonolithe(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return pagesDuMonolithe(chemin);
    return nom === "page.tsx" ? [relative(APP, chemin)] : [];
  });
}

/**
 * Une adresse a un écran si la route la plus profonde qui la reçoit est une
 * feuille (pas une coque sans écran d'index) et pas un « * » de repli.
 */
function aUnEcran(adresse: string): boolean {
  const derniere = (matchRoutes(routes, adresse) ?? []).at(-1)?.route;
  return !!derniere && derniere.path !== "*" && !derniere.children?.length && !!derniere.element;
}

describe("garde de complétude du backoffice", () => {
  it("chaque service du personnel a exactement une fonction d'appel", () => {
    const services = Object.entries(metier)
      .filter(([nom, valeur]) => typeof valeur === "function" && !OUTILS.has(nom) && !EXCLUS.has(nom))
      .map(([nom]) => nom)
      .sort();
    const branches = Object.keys(SERVICES);
    const manquants = services.filter((s) => !branches.includes(s) && !MANQUES_ATTENDUS.has(s));
    const inconnus = branches.filter((s) => !services.includes(s));
    // Branché ET encore déclaré manquant : la liste n'a pas été tenue à jour.
    const perimes = branches.filter((s) => MANQUES_ATTENDUS.has(s));
    expect({ manquants, inconnus, perimes }).toEqual({ manquants: [], inconnus: [], perimes: [] });
  });

  it("chaque page du personnel dans le monolithe a son écran", () => {
    const pages = [
      ...pagesDuMonolithe(join(APP, "(dashboard)")),
      ...pagesDuMonolithe(join(APP, "(admin)")),
      "(auth)/login/page.tsx",
    ].sort();
    // Une page ajoutée au monolithe doit être reportée dans la table.
    expect(pages.filter((p) => !(p in PAGES))).toEqual([]);

    const sansEcran = pages.filter((p) => !aUnEcran(PAGES[p]!) && !PAGES_MANQUANTES.has(p));
    const perimees = pages.filter((p) => aUnEcran(PAGES[p]!) && PAGES_MANQUANTES.has(p));
    expect({ sansEcran, perimees }).toEqual({ sansEcran: [], perimees: [] });
  });
});
