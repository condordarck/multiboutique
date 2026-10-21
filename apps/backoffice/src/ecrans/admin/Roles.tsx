import { Carte } from "@multiboutique/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EnTeteEcran, ErreurApi, Lecture, useEnLigne } from "@multiboutique/front";
import { togglePermissionRole, useRolesPermissions } from "../../api/administration";

// Mêmes groupes, libellés et colonnes que components/admin/RolesPerms.tsx.
const GROUPES = [
  {
    titre: "Produits & Stock",
    permissions: [
      ["produits:voir", "Voir les produits"],
      ["produits:gerer", "Créer / modifier des produits"],
      ["stock:voir", "Voir le stock"],
      ["stock:gerer", "Entrées / ajustements de stock"],
      ["prix:gerer", "Modifier les prix"],
      ["promos:voir", "Voir les promotions"],
      ["promos:gerer", "Créer des promotions"],
      ["prix_conseilles:voir", "Voir les prix conseillés"],
      ["prix_conseilles:gerer", "Publier prix conseillés"],
    ],
  },
  {
    titre: "Ventes & Clients",
    permissions: [
      ["ventes:voir", "Voir les ventes"],
      ["ventes:creer", "Encaisser une vente"],
      ["ventes:annuler", "Annuler une vente"],
      ["clients:voir", "Voir les clients"],
      ["clients:gerer", "Gérer les clients (VIP…)"],
      ["credits:voir", "Registre des créances"],
      ["credits:gerer", "Encaisser des versements"],
    ],
  },
  {
    titre: "Commandes & Achats",
    permissions: [
      ["commandes:voir", "Voir les commandes B2B"],
      ["commandes:gerer", "Gérer les commandes B2B"],
      ["commandes:modifier", "Modifier une commande B2B avant livraison"],
      ["achats:voir", "Voir les achats fournisseurs"],
      ["achats:gerer", "Gérer les achats fournisseurs"],
      ["achats:modifier", "Modifier une commande fournisseur avant réception"],
    ],
  },
  {
    titre: "Réservations & Rapports",
    permissions: [
      ["reservations:voir", "Voir les réservations"],
      ["reservations:gerer", "Valider / annuler"],
      ["rapports:voir", "Voir les rapports"],
      ["consolidation:voir", "Vue consolidée siège"],
    ],
  },
] as const;

const ROLES = [
  ["proprietaire", "Propriétaire"],
  ["directeur_groupe", "Directeur groupe"],
  ["directeur_region", "Directeur région"],
  ["gerant", "Gérant"],
  ["gerant_stock", "Magasinier"],
  ["comptable", "Comptable"],
  ["vendeur", "Vendeur"],
  ["client", "Client"],
] as const;

/** Matrice des habilitations (app/(admin)/admin/roles/page.tsx) : une case, un appel. */
export function Roles() {
  const lignes = useRolesPermissions();
  const client = useQueryClient();
  const enLigne = useEnLigne();
  const [surcharges, setSurcharges] = useState<Record<string, boolean>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function basculer(role: string, permission: string, active: boolean) {
    const cle = `${role}::${permission}`;
    setEnCours(cle);
    setErreur(null);
    // Affichage immédiat ; rétabli si l'API refuse.
    setSurcharges((s) => ({ ...s, [cle]: active }));
    try {
      await togglePermissionRole({ role, permission, active });
      await client.invalidateQueries({ queryKey: ["admin", "roles"] });
      // La valeur relue fait foi ; la surcharge ne masquera pas un changement ultérieur.
      setSurcharges(({ [cle]: _confirmee, ...reste }) => reste);
    } catch (e) {
      setSurcharges((s) => ({ ...s, [cle]: !active }));
      setErreur(e instanceof ErreurApi ? e.message : "Erreur lors de l'enregistrement");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Rôles & habilitations"
        sousTitre="Activez ou désactivez chaque fonctionnalité pour chaque profil. La modification est immédiate : le menu et les écrans s'adaptent."
      />
      {erreur && (
        <p role="alert" className="m-0 rounded-bouton bg-danger-fond px-4 py-3 font-semibold text-danger">
          {erreur}
        </p>
      )}
      <Lecture requete={lignes}>
        {(donnees) => {
          const etat: Record<string, boolean> = {};
          for (const l of donnees) etat[`${l.role}::${l.permission}`] = l.active;
          Object.assign(etat, surcharges);
          return (
            <Carte>
              {/* La matrice défile dans sa carte, jamais la page entière. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] border-collapse text-libelle">
                  <caption className="sr-only">Habilitations par profil</caption>
                  <thead>
                    <tr className="border-b border-bordure">
                      <th scope="col" className="sticky left-0 bg-surface px-3 py-2 text-left text-mention text-texte-discret">
                        Fonctionnalité
                      </th>
                      {ROLES.map(([, libelle]) => (
                        <th key={libelle} scope="col" className="px-2 py-2 text-center text-mention text-texte-discret">
                          {libelle}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {GROUPES.map((g) => [
                      <tr key={g.titre}>
                        <th colSpan={ROLES.length + 1} scope="colgroup" className="bg-surface-relevee px-3 py-2 text-left font-bold">
                          {g.titre}
                        </th>
                      </tr>,
                      ...g.permissions.map(([code, libelle]) => (
                        <tr key={code} className="border-b border-bordure">
                          <th scope="row" className="sticky left-0 bg-surface px-3 py-1 text-left font-normal">
                            {libelle}
                          </th>
                          {ROLES.map(([role, libelleRole]) => {
                            const cle = `${role}::${code}`;
                            return (
                              <td key={role} className="text-center">
                                <label className="inline-flex size-11 cursor-pointer items-center justify-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`${libelleRole} — ${libelle}`}
                                    checked={etat[cle] ?? false}
                                    disabled={enCours === cle || !enLigne}
                                    onChange={(e) => void basculer(role, code, e.target.checked)}
                                    className="size-5 accent-primaire"
                                  />
                                </label>
                              </td>
                            );
                          })}
                        </tr>
                      )),
                    ])}
                  </tbody>
                </table>
              </div>
              <p className="m-0 text-mention text-texte-discret">
                Les changements valent dès la requête suivante des utilisateurs concernés.
              </p>
            </Carte>
          );
        }}
      </Lecture>
    </div>
  );
}
