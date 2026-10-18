import type { CodePromo, CodePromoFormData, TypeReduction } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, Dialogue, Panneau, Selecteur } from "@multiboutique/ui";
import { useState } from "react";
import { useParams } from "react-router";
import { creerCodePromo, modifierCodePromo, supprimerCodePromo, toggleActifCodePromo, useCodesPromo } from "../../api/clients";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { formatMontant, formatNombre } from "../../commun/formats";
import { Formulaire } from "../../commun/Formulaire";
import { ListeChargee } from "../../commun/ListeChargee";
import { lireEntier, lireNombre } from "../../commun/saisie";
import { useEcriture } from "../../commun/useEcriture";
import { useSession } from "../../session/Session";

const enDate = (d: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const affichageDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : null);

/** Expiré : date de fin passée (avant aujourd'hui) ou limite d'utilisations atteinte. */
function expire(c: CodePromo): boolean {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return (
    (!!c.date_fin && new Date(c.date_fin) < aujourdhui) ||
    (c.max_utilisations !== null && Number(c.nombre_utilisations) >= Number(c.max_utilisations))
  );
}

/** Codes promo (app/(dashboard)/dashboard/[boutiqueId]/promotions/page.tsx). */
export function Promotions() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const codes = useCodesPromo(boutiqueId);
  const peutGerer = peut("promos:gerer");
  const invalide = [["boutiques", boutiqueId]];
  const activation = useEcriture({ appel: toggleActifCodePromo, invalide });
  const suppression = useEcriture({ appel: supprimerCodePromo, invalide, succes: "Code supprimé" });
  const [edition, setEdition] = useState<CodePromo | "nouveau" | null>(null);
  const [aSupprimer, setASupprimer] = useState<CodePromo | null>(null);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre={`Promotions — ${boutique.data?.nom ?? ""}`}
        sousTitre="Codes promo pour les grossistes et lancement des campagnes"
        actions={peutGerer && <Bouton onClick={() => setEdition("nouveau")}>Nouveau code promo</Bouton>}
      />
      <Carte titre="Codes promo">
        {!peutGerer && (
          <p className="m-0 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle text-texte-discret">
            Lecture seule — seuls le propriétaire et le gérant peuvent créer ou lancer des codes promo.
          </p>
        )}
        {(activation.erreur || suppression.erreur) && (
          <p role="alert" className="m-0 font-semibold text-danger">
            {activation.erreur ?? suppression.erreur}
          </p>
        )}
        <ListeChargee
          legende="Codes promo"
          requete={codes}
          cleLigne={(c) => c.id}
          vide="Aucun code promo, utilisez « Nouveau code promo » pour en créer un"
          colonnes={[
            {
              cle: "code",
              libelle: "Code",
              principale: true,
              rendu: (c) => (
                <span className="flex flex-col">
                  <span>{c.code}</span>
                  {c.description && <span className="text-mention font-normal text-texte-discret">{c.description}</span>}
                </span>
              ),
            },
            {
              cle: "reduction",
              libelle: "Réduction",
              rendu: (c) =>
                c.type_reduction === "pourcentage" ? `${formatNombre(c.valeur_reduction)}%` : formatMontant(c.valeur_reduction, monnaie),
            },
            { cle: "validite", libelle: "Validité", rendu: (c) => `${affichageDate(c.date_debut) || "—"} → ${affichageDate(c.date_fin) ?? "∞"}` },
            {
              cle: "utilisations",
              libelle: "Utilisations",
              rendu: (c) =>
                `${formatNombre(c.nombre_utilisations)}${c.max_utilisations !== null ? ` / ${formatNombre(c.max_utilisations)}` : ""}`,
            },
            {
              cle: "statut",
              libelle: "Statut",
              rendu: (c) =>
                c.actif && !expire(c) ? (
                  <Badge ton="succes">Active</Badge>
                ) : expire(c) ? (
                  <Badge ton="danger">Expirée</Badge>
                ) : (
                  <Badge ton="alerte">Inactive</Badge>
                ),
            },
          ]}
          libelleAction="Actions"
          action={
            peutGerer
              ? (c) => (
                  <span className="flex flex-wrap justify-end gap-1">
                    <Bouton
                      variante="discret"
                      aria-label={`${c.actif ? "Arrêter" : "Lancer"} ${c.code}`}
                      disabled={activation.desactivee}
                      // Le service inverse l'état : un double appui l'annulerait.
                      chargement={activation.enCours}
                      onClick={() => void activation.envoyer({ id: c.id })}
                    >
                      {c.actif ? "Arrêter" : "Lancer"}
                    </Bouton>
                    <Bouton variante="discret" aria-label={`Modifier ${c.code}`} onClick={() => setEdition(c)}>
                      Modifier
                    </Bouton>
                    <Bouton variante="discret" aria-label={`Supprimer ${c.code}`} onClick={() => setASupprimer(c)}>
                      Supprimer
                    </Bouton>
                  </span>
                )
              : undefined
          }
        />
      </Carte>
      {edition && <EditionCode boutiqueId={boutiqueId} code={edition === "nouveau" ? null : edition} onFermer={() => setEdition(null)} />}
      <Dialogue
        ouvert={!!aSupprimer}
        titre={`Supprimer le code ${aSupprimer?.code ?? ""} ?`}
        message="La suppression est définitive."
        libelleConfirmer="Supprimer"
        variante="danger"
        chargement={suppression.enCours}
        onAnnuler={() => setASupprimer(null)}
        onConfirmer={async () => {
          if (aSupprimer && (await suppression.envoyer({ id: aSupprimer.id }))) setASupprimer(null);
        }}
      />
    </div>
  );
}

/** CodePromoForm.tsx (création) et le mode édition de CodePromoActions.tsx. */
function EditionCode({ boutiqueId, code, onFermer }: { boutiqueId: string; code: CodePromo | null; onFermer: () => void }) {
  const invalide = [["boutiques", boutiqueId]];
  const creation = useEcriture({ appel: creerCodePromo, invalide, succes: "Code promo créé (inactif, lancez-le quand il doit être actif)" });
  const modification = useEcriture({ appel: modifierCodePromo, invalide, succes: "Code promo modifié" });
  const ecriture = code ? modification : creation;
  const [f, setF] = useState({
    code: code?.code ?? "",
    description: code?.description ?? "",
    type: (code?.type_reduction ?? "pourcentage") as TypeReduction,
    valeur: code ? String(code.valeur_reduction) : "",
    max: code?.max_utilisations != null ? String(code.max_utilisations) : "",
    debut: enDate(code?.date_debut ?? null),
    fin: enDate(code?.date_fin ?? null),
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  async function envoyer() {
    const v = lireNombre(f.valeur);
    if (!f.code.trim()) return setErreur("Le code promo est requis");
    if (!v || v <= 0 || (f.type === "pourcentage" && v > 100)) {
      return setErreur(f.type === "pourcentage" ? "Le pourcentage doit être entre 1 et 100" : "Le montant doit être positif");
    }
    if (f.debut && f.fin && f.debut > f.fin) return setErreur("La date de fin est antérieure à la date de début");
    const max = f.max.trim() ? lireEntier(f.max, 1) : null;
    if (Number.isNaN(max)) return setErreur("La limite d'utilisations doit être un entier positif");
    setErreur(null);
    const donnees: CodePromoFormData = {
      code: f.code,
      ...(f.description ? { description: f.description } : {}),
      type_reduction: f.type,
      valeur_reduction: v,
      max_utilisations: max,
      date_debut: f.debut || null,
      date_fin: f.fin || null,
    };
    const ok = code ? await modification.envoyer({ ...donnees, id: code.id }) : await creation.envoyer({ ...donnees, boutiqueId });
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={code ? `Modifier ${code.code}` : "Nouveau code promo"} onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer={code ? "Enregistrer" : "Créer le code"}
        onEnvoyer={() => void envoyer()}
        erreur={erreur ?? ecriture.erreur}
        enCours={ecriture.enCours}
        desactivee={ecriture.desactivee}
      >
        <Champ
          libelle="Code promo"
          placeholder="EX : GROSSISTE10"
          required
          value={f.code}
          onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase() }))}
        />
        <Champ libelle="Description (optionnel)" value={f.description} onChange={maj("description")} />
        <Selecteur
          libelle="Type de réduction"
          options={[
            { valeur: "pourcentage", libelle: "Pourcentage (%)" },
            { valeur: "montant", libelle: "Montant fixe" },
          ]}
          value={f.type}
          onChange={maj("type")}
        />
        <Champ
          libelle={f.type === "pourcentage" ? "Pourcentage de réduction" : "Montant de réduction"}
          type="montant"
          required
          value={f.valeur}
          onChange={maj("valeur")}
        />
        <Champ libelle="Date de début (optionnel)" type="date" value={f.debut} onChange={maj("debut")} />
        <Champ libelle="Date de fin (optionnel)" type="date" value={f.fin} onChange={maj("fin")} />
        <Champ libelle="Limite d'utilisations (vide = illimité)" type="nombre" placeholder="Illimité" value={f.max} onChange={maj("max")} />
      </Formulaire>
    </Panneau>
  );
}
