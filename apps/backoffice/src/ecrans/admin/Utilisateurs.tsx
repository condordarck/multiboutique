import type { RoleUtilisateur, UtilisateurAdmin } from "@multiboutique/shared";
import { Badge, Bouton, CaseACocher, Carte, Champ, Panneau, Selecteur } from "@multiboutique/ui";
import { useState } from "react";
import {
  creerUtilisateur,
  INVALIDE_ADMIN,
  reinitialiserMotDePasse,
  toggleActifUtilisateur,
  useComptesAdmin,
} from "../../api/administration";
import { EnTeteEcran, Formulaire, ListeChargee, useEcriture, useUtilisateur } from "@multiboutique/front";
import { LIBELLES_ROLE } from "../../coque/navigation";

const ROLES: { valeur: RoleUtilisateur; libelle: string }[] = [
  { valeur: "administrateur", libelle: "Administrateur — Configuration générale du système" },
  { valeur: "proprietaire", libelle: "Propriétaire — Vue globale sur toutes les boutiques" },
  { valeur: "directeur_groupe", libelle: "Directeur de groupe — Vue consolidée d'un groupe (siège)" },
  { valeur: "directeur_region", libelle: "Directeur de région — Vue consolidée d'une région" },
  { valeur: "gerant", libelle: "Gérant — Gère sa boutique (ventes, stock, prix)" },
  { valeur: "gerant_stock", libelle: "Gérant stock — Suit les stocks et mouvements" },
  { valeur: "comptable", libelle: "Comptable — Lecture seule sur ventes et mouvements" },
  { valeur: "vendeur", libelle: "Vendeur — Enregistre les ventes au comptoir" },
  { valeur: "client", libelle: "Client — Réservations en ligne" },
];
const ROLES_AVEC_BOUTIQUE: RoleUtilisateur[] = ["gerant", "gerant_stock", "comptable", "vendeur"];

/** app/(admin)/admin/utilisateurs/page.tsx */
export function Utilisateurs() {
  const moi = useUtilisateur();
  const comptes = useComptesAdmin();
  const activation = useEcriture({ appel: toggleActifUtilisateur, invalide: INVALIDE_ADMIN });
  const [creation, setCreation] = useState(false);
  const [motDePasse, setMotDePasse] = useState<UtilisateurAdmin | null>(null);

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Utilisateurs"
        sousTitre="Créez des comptes pour chaque profil et contrôlez l'accès aux boutiques."
        actions={<Bouton onClick={() => setCreation(true)}>Créer un utilisateur</Bouton>}
      />
      {activation.erreur && (
        <p role="alert" className="m-0 font-semibold text-danger">
          {activation.erreur}
        </p>
      )}
      <Carte>
        <ListeChargee
          legende="Utilisateurs"
          requete={{ ...comptes, data: comptes.data?.utilisateurs }}
          cleLigne={(u) => u.id}
          vide="Aucun utilisateur"
          colonnes={[
            {
              cle: "nom",
              libelle: "Utilisateur",
              principale: true,
              rendu: (u) => (
                <span className="flex flex-col">
                  <span>{u.nom_complet}</span>
                  <span className="text-mention font-normal text-texte-discret">{u.email}</span>
                </span>
              ),
            },
            {
              cle: "profil",
              libelle: "Profil",
              rendu: (u) => (
                <span className="flex flex-col">
                  <span>{LIBELLES_ROLE[u.role] ?? u.role}</span>
                  {(u.groupe_nom || u.region_nom) && (
                    <span className="text-mention text-texte-discret">{u.groupe_nom ? `Groupe : ${u.groupe_nom}` : `Région : ${u.region_nom}`}</span>
                  )}
                </span>
              ),
            },
            {
              cle: "boutiques",
              libelle: "Boutiques",
              rendu: (u) =>
                u.boutique_noms.length ? (
                  <span className="flex flex-wrap gap-1">
                    {u.boutique_noms.map((n) => (
                      <Badge key={n} ton="info">
                        {n}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  "—"
                ),
            },
            { cle: "statut", libelle: "Statut", rendu: (u) => (u.actif ? <Badge ton="succes">Actif</Badge> : <Badge ton="danger">Désactivé</Badge>) },
          ]}
          libelleAction="Actions"
          action={(u) => (
            <span className="flex flex-wrap justify-end gap-1">
              <Bouton
                variante="discret"
                aria-label={`${u.actif ? "Désactiver" : "Activer"} ${u.nom_complet}`}
                // On ne se désactive pas soi-même.
                disabled={u.id === moi.id || activation.desactivee}
                chargement={activation.enCours}
                onClick={() => void activation.envoyer({ id: u.id })}
              >
                {u.actif ? "Désactiver" : "Activer"}
              </Bouton>
              <Bouton variante="discret" aria-label={`Mot de passe de ${u.nom_complet}`} onClick={() => setMotDePasse(u)}>
                Mot de passe
              </Bouton>
            </span>
          )}
        />
      </Carte>
      {creation && comptes.data && <NouvelUtilisateur donnees={comptes.data} onFermer={() => setCreation(false)} />}
      {motDePasse && <NouveauMotDePasse utilisateur={motDePasse} onFermer={() => setMotDePasse(null)} />}
    </div>
  );
}

const VIDE = { nom: "", email: "", motDePasse: "", telephone: "", role: "gerant" as RoleUtilisateur, boutiques: [] as string[], region: "", groupe: "" };

/** components/admin/NouvelUtilisateurForm.tsx, dans un panneau. */
function NouvelUtilisateur({ donnees, onFermer }: { donnees: NonNullable<ReturnType<typeof useComptesAdmin>["data"]>; onFermer: () => void }) {
  const creation = useEcriture({ appel: creerUtilisateur, invalide: INVALIDE_ADMIN });
  const [f, setF] = useState(VIDE);
  const [message, setMessage] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));
  const avecBoutiques = ROLES_AVEC_BOUTIQUE.includes(f.role);

  async function envoyer() {
    setMessage(null);
    const ok = await creation.envoyer({
      nom_complet: f.nom,
      email: f.email,
      password: f.motDePasse,
      ...(f.telephone ? { telephone: f.telephone } : {}),
      role: f.role,
      boutique_ids: avecBoutiques ? f.boutiques : [],
      region_id: f.role === "directeur_region" ? f.region || null : null,
      groupe_id: f.role === "directeur_groupe" ? f.groupe || null : null,
    });
    if (ok) {
      setMessage("Compte créé avec succès");
      setF(VIDE);
    }
  }

  return (
    <Panneau ouvert titre="Créer un utilisateur" onFermer={onFermer}>
      <Formulaire libelleEnvoyer="Créer le compte" onEnvoyer={() => void envoyer()} erreur={creation.erreur} enCours={creation.enCours} desactivee={creation.desactivee}>
        {message && <p className="m-0 rounded-bouton bg-succes-fond px-4 py-3 font-semibold text-succes">{message}</p>}
        <Champ libelle="Nom complet" required value={f.nom} onChange={maj("nom")} />
        <Champ libelle="Téléphone" inputMode="tel" placeholder="+243 ..." value={f.telephone} onChange={maj("telephone")} />
        <Champ libelle="E-mail" type="email" required value={f.email} onChange={maj("email")} />
        <Champ libelle="Mot de passe" type="motDePasse" autoComplete="new-password" required value={f.motDePasse} onChange={maj("motDePasse")} aide="6 caractères au moins." />
        <Selecteur libelle="Profil" options={ROLES} value={f.role} onChange={maj("role")} />
        {f.role === "directeur_groupe" && (
          <Selecteur
            libelle="Groupe supervisé"
            optionVide="— Sélectionner un groupe —"
            options={donnees.groupes.map((g) => ({ valeur: g.id, libelle: g.nom }))}
            value={f.groupe}
            onChange={maj("groupe")}
            aide={donnees.groupes.length ? "Périmètre : toutes les boutiques du groupe." : "Aucun groupe configuré. Créez-en un dans Organisation."}
          />
        )}
        {f.role === "directeur_region" && (
          <Selecteur
            libelle="Région supervisée"
            optionVide="— Sélectionner une région —"
            options={donnees.regions.map((r) => ({ valeur: r.id, libelle: r.nom }))}
            value={f.region}
            onChange={maj("region")}
            aide={donnees.regions.length ? "Périmètre : toutes les boutiques de la région." : "Aucune région configurée. Créez-en une dans Organisation."}
          />
        )}
        {avecBoutiques && (
          <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
            <legend className="mb-1 text-libelle font-semibold">Boutiques rattachées (accès limité à ces boutiques)</legend>
            {donnees.boutiques.map((b) => (
              <CaseACocher
                key={b.id}
                libelle={b.nom}
                checked={f.boutiques.includes(b.id)}
                onChange={() =>
                  setF((x) => ({ ...x, boutiques: x.boutiques.includes(b.id) ? x.boutiques.filter((i) => i !== b.id) : [...x.boutiques, b.id] }))
                }
              />
            ))}
            {!donnees.boutiques.length && <p className="m-0 text-texte-discret">Aucune boutique active disponible</p>}
          </fieldset>
        )}
      </Formulaire>
    </Panneau>
  );
}

function NouveauMotDePasse({ utilisateur, onFermer }: { utilisateur: UtilisateurAdmin; onFermer: () => void }) {
  const reinitialisation = useEcriture({ appel: reinitialiserMotDePasse, invalide: INVALIDE_ADMIN, succes: "Mot de passe modifié" });
  const [mdp, setMdp] = useState("");
  return (
    <Panneau ouvert titre={`Nouveau mot de passe — ${utilisateur.nom_complet}`} onFermer={onFermer}>
      <Formulaire
        libelleEnvoyer="Enregistrer"
        onEnvoyer={async () => {
          if (await reinitialisation.envoyer({ id: utilisateur.id, mot_de_passe: mdp })) onFermer();
        }}
        erreur={reinitialisation.erreur}
        enCours={reinitialisation.enCours}
        desactivee={reinitialisation.desactivee}
      >
        <Champ libelle="Nouveau mot de passe" type="motDePasse" autoComplete="new-password" value={mdp} onChange={(e) => setMdp(e.target.value)} aide="6 caractères au moins." />
      </Formulaire>
    </Panneau>
  );
}
