import type { BoutiquesAdmin as Donnees, CompteCree } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, Panneau, Selecteur } from "@multiboutique/ui";
import { useState } from "react";
import {
  creerBoutique,
  creerUtilisateursDefaut,
  INVALIDE_ADMIN,
  modifierBoutique,
  useBoutiquesAdmin,
  useComptesBoutique,
  type BoutiqueSaisie,
} from "../../api/administration";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { Formulaire } from "../../commun/Formulaire";
import { ListeChargee } from "../../commun/ListeChargee";
import { useEcriture } from "../../commun/useEcriture";
import { ComptesCrees } from "./ComptesCrees";

type LigneBoutique = Donnees["boutiques"][number];

/** Ce qu'il faut renvoyer au service pour une boutique : tout, région comprise (sinon il l'efface). */
function saisieDe(b: LigneBoutique): BoutiqueSaisie {
  return {
    nom: b.nom,
    ...(b.adresse ? { adresse: b.adresse } : {}),
    ...(b.telephone ? { telephone: b.telephone } : {}),
    ...(b.email ? { email: b.email } : {}),
    region_id: b.region_id ?? null,
    statut: b.statut === "active" ? "active" : "inactive",
  };
}

/** app/(admin)/admin/boutiques/page.tsx */
export function BoutiquesAdmin() {
  const donnees = useBoutiquesAdmin();
  const modification = useEcriture({ appel: modifierBoutique, invalide: INVALIDE_ADMIN });
  const [fiche, setFiche] = useState<LigneBoutique | "nouvelle" | null>(null);
  const [comptes, setComptes] = useState<LigneBoutique | null>(null);
  const regions = donnees.data?.regions ?? [];

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Boutiques"
        sousTitre="Ajoutez, modifiez ou activez / désactivez les boutiques et rattachez-les à une région."
        actions={<Bouton onClick={() => setFiche("nouvelle")}>Créer une boutique</Bouton>}
      />
      {modification.erreur && (
        <p role="alert" className="m-0 font-semibold text-danger">
          {modification.erreur}
        </p>
      )}
      <Carte>
        <ListeChargee
          legende="Boutiques"
          requete={{ ...donnees, data: donnees.data?.boutiques }}
          cleLigne={(b) => b.id}
          vide="Aucune boutique"
          colonnes={[
            {
              cle: "nom",
              libelle: "Boutique",
              principale: true,
              rendu: (b) => (
                <span className="flex flex-col">
                  <span>{b.nom}</span>
                  <span className="text-mention font-normal text-texte-discret">{b.adresse || "—"}</span>
                </span>
              ),
            },
            { cle: "contact", libelle: "Contact", rendu: (b) => [b.telephone, b.email].filter(Boolean).join(" · ") || "—" },
            { cle: "region", libelle: "Région", rendu: (b) => (b.region_nom ? `${b.region_nom}${b.groupe_nom ? ` · ${b.groupe_nom}` : ""}` : "Non rattachée") },
            { cle: "statut", libelle: "Statut", rendu: (b) => (b.statut === "active" ? <Badge ton="succes">Active</Badge> : <Badge ton="danger">Inactive</Badge>) },
          ]}
          libelleAction="Actions"
          action={(b) => (
            <span className="flex flex-wrap justify-end gap-1">
              <Bouton variante="discret" aria-label={`Modifier ${b.nom}`} onClick={() => setFiche(b)}>
                Modifier
              </Bouton>
              <Bouton variante="discret" aria-label={`Comptes de ${b.nom}`} onClick={() => setComptes(b)}>
                Comptes
              </Bouton>
              <Bouton
                variante="discret"
                aria-label={`${b.statut === "active" ? "Désactiver" : "Activer"} ${b.nom}`}
                disabled={modification.desactivee}
                onClick={() =>
                  void modification.envoyer({ ...saisieDe(b), statut: b.statut === "active" ? "inactive" : "active", id: b.id })
                }
              >
                {b.statut === "active" ? "Désactiver" : "Activer"}
              </Bouton>
            </span>
          )}
        />
      </Carte>
      {fiche && <FicheBoutique boutique={fiche === "nouvelle" ? null : fiche} regions={regions} onFermer={() => setFiche(null)} />}
      {comptes && <ComptesBoutique boutique={comptes} onFermer={() => setComptes(null)} />}
    </div>
  );
}

/** NouvelleBoutiqueForm.tsx et l'édition de BoutiqueActions.tsx. */
function FicheBoutique({ boutique, regions, onFermer }: { boutique: LigneBoutique | null; regions: Donnees["regions"]; onFermer: () => void }) {
  const creation = useEcriture({ appel: creerBoutique, invalide: INVALIDE_ADMIN });
  const modification = useEcriture({ appel: modifierBoutique, invalide: INVALIDE_ADMIN, succes: "Boutique modifiée" });
  const ecriture = boutique ? modification : creation;
  const [f, setF] = useState({
    nom: boutique?.nom ?? "",
    adresse: boutique?.adresse ?? "",
    telephone: boutique?.telephone ?? "",
    email: boutique?.email ?? "",
    region: boutique?.region_id ?? "",
  });
  const [crees, setCrees] = useState<CompteCree[]>([]);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  async function envoyer() {
    const saisie: BoutiqueSaisie = {
      nom: f.nom,
      ...(f.adresse ? { adresse: f.adresse } : {}),
      ...(f.telephone ? { telephone: f.telephone } : {}),
      ...(f.email ? { email: f.email } : {}),
      region_id: f.region || null,
      statut: boutique ? (boutique.statut === "active" ? "active" : "inactive") : "active",
    };
    if (boutique) {
      if (await modification.envoyer({ ...saisie, id: boutique.id })) onFermer();
      return;
    }
    const resultat = await creation.envoyer(saisie);
    if (resultat) {
      // La boutique est créée avec ses profils d'équipe ; le panneau reste ouvert sur leurs accès.
      setCrees(resultat.comptes ?? []);
      setF({ nom: "", adresse: "", telephone: "", email: "", region: "" });
    }
  }

  return (
    <Panneau ouvert titre={boutique ? boutique.nom : "Créer une boutique"} onFermer={onFermer}>
      <div className="flex flex-col gap-4">
        <ComptesCrees comptes={crees} />
        <Formulaire
          libelleEnvoyer={boutique ? "Enregistrer" : "Créer la boutique"}
          onEnvoyer={() => void envoyer()}
          erreur={ecriture.erreur}
          enCours={ecriture.enCours}
          desactivee={ecriture.desactivee}
        >
          <Champ libelle="Nom" required value={f.nom} onChange={maj("nom")} />
          <Champ libelle="Téléphone" inputMode="tel" value={f.telephone} onChange={maj("telephone")} />
          <Champ libelle="Adresse" value={f.adresse} onChange={maj("adresse")} />
          <Champ libelle="E-mail" type="email" value={f.email} onChange={maj("email")} />
          <Selecteur
            libelle="Région"
            optionVide="— Non rattachée —"
            options={regions.map((r) => ({ valeur: r.id, libelle: r.nom }))}
            value={f.region}
            onChange={maj("region")}
          />
        </Formulaire>
      </div>
    </Panneau>
  );
}

/** Comptes rattachés et profils par défaut manquants (BoutiqueActions.tsx). */
function ComptesBoutique({ boutique, onFermer }: { boutique: LigneBoutique; onFermer: () => void }) {
  const comptes = useComptesBoutique(boutique.id);
  const generation = useEcriture({ appel: creerUtilisateursDefaut, invalide: INVALIDE_ADMIN });
  const [crees, setCrees] = useState<CompteCree[]>([]);

  return (
    <Panneau ouvert titre={`Comptes — ${boutique.nom}`} onFermer={onFermer}>
      <div className="flex flex-col gap-4">
        <Bouton
          variante="secondaire"
          chargement={generation.enCours}
          disabled={generation.desactivee}
          onClick={async () => {
            const resultat = await generation.envoyer({ id: boutique.id });
            if (resultat) setCrees(resultat.comptes);
          }}
        >
          Créer les profils par défaut manquants
        </Bouton>
        {generation.erreur && (
          <p role="alert" className="m-0 font-semibold text-danger">
            {generation.erreur}
          </p>
        )}
        <ComptesCrees comptes={crees} />
        {comptes.isPending ? (
          <p className="m-0 text-texte-discret">Chargement…</p>
        ) : !comptes.data?.length ? (
          <p className="m-0 text-texte-discret">Aucun compte rattaché.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {comptes.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle">
                <span className="flex flex-col">
                  <span className="font-semibold">{c.nom_complet}</span>
                  <span className="text-mention text-texte-discret">{`${c.role.replace("_", " ")} · ${c.email}`}</span>
                </span>
                {c.actif ? <Badge ton="succes">actif</Badge> : <Badge ton="danger">inactif</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panneau>
  );
}
