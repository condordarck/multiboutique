import type { Organisation } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, Panneau, Selecteur, TuileChiffre } from "@multiboutique/ui";
import { useId, useState } from "react";
import { creerGroupe, creerRegion, INVALIDE_ADMIN, modifierGroupe, modifierRegion, useOrganisation, type GroupeSaisi } from "../../api/administration";
import { EnTeteEcran, formatNombre, Formulaire, Lecture, useEcriture } from "@multiboutique/front";

type Groupe = Organisation["groupes"][number];
type Region = Organisation["regions"][number];
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** app/(admin)/admin/organisation/page.tsx, avec la modification des groupes et des régions. */
export function OrganisationAdmin() {
  const organisation = useOrganisation();
  const [groupe, setGroupe] = useState<Groupe | "nouveau" | null>(null);
  const [region, setRegion] = useState<Region | "nouvelle" | null>(null);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Organisation"
        sousTitre="Structurez vos boutiques en groupes et régions. Les directeurs de groupe et de région pilotent la consolidation de leur périmètre."
        actions={
          <>
            <Bouton onClick={() => setGroupe("nouveau")}>Nouveau groupe</Bouton>
            <Bouton variante="secondaire" onClick={() => setRegion("nouvelle")}>
              Nouvelle région
            </Bouton>
          </>
        }
      />
      <Lecture requete={organisation}>
        {(o) => (
          <>
            <div className="grid grid-cols-2 gap-3 tablette:grid-cols-3 tablette:gap-4">
              <TuileChiffre libelle="Groupes" valeur={formatNombre(o.groupes.length)} />
              <TuileChiffre libelle="Régions" valeur={formatNombre(o.regions.length)} />
              <TuileChiffre libelle="Boutiques non rattachées" valeur={formatNombre(o.sans_region.length)} miseEnAvant={o.sans_region.length > 0} />
            </div>
            <Carte titre="Organigramme">
              {o.groupes.length === 0 && <p className="m-0 text-texte-discret">Aucun groupe configuré. Commencez par créer un groupe.</p>}
              <div className="grid grid-cols-1 gap-4 bureau:grid-cols-2">
                {o.groupes.map((g) => (
                  <BlocGroupe key={g.id} groupe={g} regions={o.regions.filter((r) => r.groupe_id === g.id)} onModifier={() => setGroupe(g)} onModifierRegion={setRegion} />
                ))}
              </div>
              {o.sans_region.length > 0 && (
                <div className="flex flex-col gap-2 rounded-bouton bg-alerte-fond px-4 py-3 text-alerte">
                  <p className="m-0 font-semibold">{`Boutiques sans région (${o.sans_region.length})`}</p>
                  <div className="flex flex-wrap gap-1">
                    {o.sans_region.map((b) => (
                      <Badge key={b.nom}>{b.nom}</Badge>
                    ))}
                  </div>
                  <p className="m-0 text-mention">Rattachez-les via la page Boutiques pour qu'elles apparaissent dans la consolidation.</p>
                </div>
              )}
            </Carte>
            {groupe && <FicheGroupe groupe={groupe === "nouveau" ? null : groupe} onFermer={() => setGroupe(null)} />}
            {region && <FicheRegion region={region === "nouvelle" ? null : region} groupes={o.groupes} onFermer={() => setRegion(null)} />}
          </>
        )}
      </Lecture>
    </div>
  );
}

function BlocGroupe({
  groupe: g,
  regions,
  onModifier,
  onModifierRegion,
}: {
  groupe: Groupe;
  regions: Region[];
  onModifier: () => void;
  onModifierRegion: (r: Region) => void;
}) {
  const idTitre = useId();
  const nbBoutiques = regions.reduce((s, r) => s + (Number(r.nb_boutiques) || 0), 0);
  return (
    <section aria-labelledby={idTitre} className="flex flex-col gap-3 rounded-carte border border-bordure p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={idTitre} className="m-0 text-courant font-bold">
            {g.nom}
          </h3>
          <p className="m-0 text-mention text-texte-discret">{`${pluriel(regions.length, "région")} · ${pluriel(nbBoutiques, "boutique")}`}</p>
        </div>
        <Bouton variante="discret" aria-label={`Modifier le groupe ${g.nom}`} onClick={onModifier}>
          Modifier
        </Bouton>
      </div>
      {regions.length === 0 && <p className="m-0 text-texte-discret">Aucune région — créez-en une.</p>}
      {regions.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-bouton bg-surface-relevee px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">{r.nom}</span>
            <span className="flex items-center gap-2">
              <Badge ton="info">{pluriel(Number(r.nb_boutiques), "boutique")}</Badge>
              <Bouton variante="discret" aria-label={`Modifier la région ${r.nom}`} onClick={() => onModifierRegion(r)}>
                Modifier
              </Bouton>
            </span>
          </div>
          {r.boutique_noms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {r.boutique_noms.map((n) => (
                <Badge key={n}>{n}</Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function FicheGroupe({ groupe, onFermer }: { groupe: Groupe | null; onFermer: () => void }) {
  const creation = useEcriture({ appel: creerGroupe, invalide: INVALIDE_ADMIN, succes: "Groupe créé avec succès" });
  const modification = useEcriture({ appel: modifierGroupe, invalide: INVALIDE_ADMIN, succes: "Groupe modifié" });
  const ecriture = groupe ? modification : creation;
  const [f, setF] = useState({ nom: groupe?.nom ?? "", adresse: groupe?.adresse ?? "", telephone: groupe?.telephone ?? "", email: groupe?.email ?? "" });
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  async function envoyer() {
    const saisie: GroupeSaisi = {
      nom: f.nom,
      ...(f.adresse ? { adresse: f.adresse } : {}),
      ...(f.telephone ? { telephone: f.telephone } : {}),
      ...(f.email ? { email: f.email } : {}),
    };
    const ok = groupe ? await modification.envoyer({ ...saisie, id: groupe.id }) : await creation.envoyer(saisie);
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={groupe ? `Groupe ${groupe.nom}` : "Nouveau groupe"} onFermer={onFermer}>
      <Formulaire libelleEnvoyer={groupe ? "Enregistrer" : "Créer le groupe"} onEnvoyer={() => void envoyer()} erreur={ecriture.erreur} enCours={ecriture.enCours} desactivee={ecriture.desactivee}>
        <Champ libelle="Nom du groupe" placeholder="Ex. Groupe WARA" required value={f.nom} onChange={maj("nom")} />
        <Champ libelle="Adresse" value={f.adresse} onChange={maj("adresse")} />
        <Champ libelle="Téléphone" inputMode="tel" value={f.telephone} onChange={maj("telephone")} />
        <Champ libelle="E-mail" type="email" value={f.email} onChange={maj("email")} />
      </Formulaire>
    </Panneau>
  );
}

function FicheRegion({ region, groupes, onFermer }: { region: Region | null; groupes: Groupe[]; onFermer: () => void }) {
  const creation = useEcriture({ appel: creerRegion, invalide: INVALIDE_ADMIN, succes: "Région créée avec succès" });
  const modification = useEcriture({ appel: modifierRegion, invalide: INVALIDE_ADMIN, succes: "Région modifiée" });
  const ecriture = region ? modification : creation;
  const [nom, setNom] = useState(region?.nom ?? "");
  const [groupeId, setGroupeId] = useState(region?.groupe_id ?? "");
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    if (!groupeId) return setErreur("Choisissez un groupe");
    setErreur(null);
    const ok = region ? await modification.envoyer({ id: region.id, nom, groupe_id: groupeId }) : await creation.envoyer({ nom, groupe_id: groupeId });
    if (ok) onFermer();
  }

  return (
    <Panneau ouvert titre={region ? `Région ${region.nom}` : "Nouvelle région"} onFermer={onFermer}>
      <Formulaire libelleEnvoyer={region ? "Enregistrer" : "Créer la région"} onEnvoyer={() => void envoyer()} erreur={erreur ?? ecriture.erreur} enCours={ecriture.enCours} desactivee={ecriture.desactivee}>
        <Champ libelle="Nom de la région" placeholder="Ex. Région Ouest" required value={nom} onChange={(e) => setNom(e.target.value)} />
        <Selecteur
          libelle="Groupe"
          optionVide="— Sélectionner un groupe —"
          options={groupes.map((g) => ({ valeur: g.id, libelle: g.nom }))}
          value={groupeId}
          onChange={(e) => setGroupeId(e.target.value)}
        />
      </Formulaire>
    </Panneau>
  );
}
