// @vitest-environment node
import * as metier from "@multiboutique/metier";
import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";
import { SERVICES } from "./api/services";
import { routes } from "./routes";

// Exports de @multiboutique/metier qui ne sont pas des services (même liste que l'API).
const OUTILS = new Set(["ErreurMetier", "exigerAccesBoutique", "exigerAdministrateur", "peutAccederBoutique"]);

// Services qui ne relèvent pas du backoffice.
const EXCLUS = new Set([
  "creerReservation", // couvert par la vitrine (apps/www)
  // « Payée » et stock déduit sans vente : aucun écran dans le monolithe, recoupe
  // encaisserReservation. Non exposé tant que le besoin n'est pas décidé.
  "validerReservation",
]);

// Écritures pas encore branchées. Vide : tout est branché ; la liste reste pour
// qu'un service ajouté plus tard sans écran se déclare ici, explicitement.
const MANQUES_ATTENDUS = new Set<string>([]);

const B = "11111111-1111-1111-1111-111111111111";

// Page du monolithe retiré (sous app/, voir l'historique Git avant la phase 5)
// → adresse équivalente du backoffice. Table figée : elle trace la parité et
// vérifie que chaque écran existe toujours.
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

  it("chaque page du personnel de l'ancien monolithe a toujours son écran", () => {
    expect(Object.keys(PAGES).filter((p) => !aUnEcran(PAGES[p]!))).toEqual([]);
  });
});
