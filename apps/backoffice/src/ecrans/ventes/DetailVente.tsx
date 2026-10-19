import { Bouton, Dialogue, ZoneTexte } from "@multiboutique/ui";
import { useState } from "react";
import { useParams } from "react-router";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { annulerVente, LIBELLES_PAIEMENT, useVente } from "../../api/ventes";
import { Lecture, LienBouton, useEcriture, useSession } from "@multiboutique/front";
import { ImpressionTicket } from "../../impression/ImpressionTicket";

/**
 * Reçu d'une vente (app/(dashboard)/dashboard/[boutiqueId]/ventes/[venteId]/page.tsx),
 * plus l'annulation : le service annulerVente existait sans écran qui l'appelle.
 */
export function DetailVente() {
  const { boutiqueId = "", venteId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const detail = useVente(boutiqueId, venteId);
  const annulation = useEcriture({
    appel: annulerVente,
    invalide: [["boutiques", boutiqueId]],
    succes: "Vente annulée, stock rétabli",
  });
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState("");
  const [motifManquant, setMotifManquant] = useState(false);

  async function confirmer() {
    if (!motif.trim()) return setMotifManquant(true);
    const ok = await annulation.envoyer({ venteId, motif: motif.trim() });
    if (ok) setOuvert(false);
  }

  return (
    <Lecture requete={detail}>
      {({ vente, lignes }) => {
        const total = Number(vente.montant_total) || 0;
        const paye = Number(vente.montant_paye) || 0;
        return (
          <>
            <ImpressionTicket
              titre="Reçu de vente"
              actions={
                <>
                  {vente.statut === "validee" && peut("ventes:annuler") && (
                    <Bouton variante="danger" onClick={() => setOuvert(true)}>
                      Annuler la vente
                    </Bouton>
                  )}
                  <LienBouton to={`/b/${boutiqueId}/ventes`} variante="secondaire">
                    Retour aux ventes
                  </LienBouton>
                </>
              }
              ticket={{
                boutique: boutique.data ?? { nom: "" },
                reference: vente.reference_vente,
                date: new Date(vente.created_at).toLocaleString("fr-FR"),
                vendeur: vente.vendeur_nom,
                paiement: LIBELLES_PAIEMENT[vente.mode_paiement] ?? vente.mode_paiement,
                client: vente.client_nom,
                lignes: lignes.map((l) => ({
                  nom: l.produit_nom,
                  code: l.produit_code || l.produit_reference,
                  quantite: Number(l.quantite),
                  prix: Number(l.prix_unitaire),
                })),
                monnaie,
                total,
                remise: Number(vente.remise) || 0,
                ...(vente.client_id ? { paye, reste: vente.statut !== "annulee" ? Math.max(0, total - paye) : 0 } : {}),
                annulee: vente.statut === "annulee" ? (vente.motif_annulation ?? "") : null,
              }}
            />
            <Dialogue
              ouvert={ouvert}
              titre={`Annuler la vente ${vente.reference_vente} ?`}
              message="Le stock des articles sera rétabli."
              libelleConfirmer="Confirmer l'annulation"
              libelleAnnuler="Revenir"
              variante="danger"
              chargement={annulation.enCours}
              onConfirmer={() => void confirmer()}
              onAnnuler={() => {
                setOuvert(false);
                annulation.reinitialiser();
              }}
            >
              <ZoneTexte
                libelle="Motif"
                value={motif}
                onChange={(e) => {
                  setMotif(e.target.value);
                  setMotifManquant(false);
                }}
                erreur={motifManquant ? "Un motif d'annulation est requis" : undefined}
              />
              {annulation.erreur && (
                <p role="alert" className="m-0 font-semibold text-danger">
                  {annulation.erreur}
                </p>
              )}
            </Dialogue>
          </>
        );
      }}
    </Lecture>
  );
}
