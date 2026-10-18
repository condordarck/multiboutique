import type { Parametres } from "@multiboutique/shared";
import { Carte, Champ } from "@multiboutique/ui";
import { useState } from "react";
import { INVALIDE_ADMIN, mettreAJourParametres } from "../../api/administration";
import { cles, useParametres } from "../../api/generales";
import { EnTeteEcran, Formulaire, Lecture, lireEntier, useEcriture } from "@multiboutique/front";

/** app/(admin)/admin/parametres/page.tsx */
export function ParametresAdmin() {
  // Relus à l'ouverture : un autre administrateur a pu les changer entre-temps.
  const parametres = useParametres({ refetchOnMount: "always" });
  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran titre="Paramètres généraux" sousTitre="Configuration générale de l'application appliquée partout." />
      <Lecture requete={parametres}>{(p) => <FormulaireParametres key={parametres.dataUpdatedAt} initial={p} />}</Lecture>
    </div>
  );
}

function FormulaireParametres({ initial }: { initial: Parametres }) {
  const ecriture = useEcriture({ appel: mettreAJourParametres, invalide: [...INVALIDE_ADMIN, cles.parametres], succes: "Paramètres enregistrés" });
  const [f, setF] = useState({
    monnaie: initial.monnaie || "$",
    nom: initial.nom_application || "MultiBoutique",
    seuil: initial.seuil_alerte_defaut || "10",
    delai: initial.relance_delai_jours || "30",
  });
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  return (
    <Carte className="max-w-2xl">
      <Formulaire
        libelleEnvoyer="Enregistrer"
        onEnvoyer={() => {
          // Le seuil est relu en entier par la création de produit (::integer).
          if (Number.isNaN(lireEntier(f.seuil, 0))) return setErreur("Le seuil d'alerte doit être un entier positif ou nul");
          if (Number.isNaN(lireEntier(f.delai, 1))) return setErreur("Le délai de relance doit être un entier d'au moins 1 jour");
          setErreur(null);
          void ecriture.envoyer([
            { cle: "monnaie", valeur: f.monnaie },
            { cle: "nom_application", valeur: f.nom },
            { cle: "seuil_alerte_defaut", valeur: f.seuil },
            { cle: "relance_delai_jours", valeur: f.delai },
          ]);
        }}
        erreur={erreur ?? ecriture.erreur}
        enCours={ecriture.enCours}
        desactivee={ecriture.desactivee}
      >
        <Champ libelle="Monnaie affichée" maxLength={5} placeholder="$" value={f.monnaie} onChange={maj("monnaie")} aide="Symbole ou code utilisé dans tous les prix (ex : $, FC, USD)." />
        <Champ libelle="Nom de l'application" value={f.nom} onChange={maj("nom")} />
        <Champ
          libelle="Seuil d'alerte stock par défaut"
          type="nombre"
          value={f.seuil}
          onChange={maj("seuil")}
          aide="Alerte déclenchée quand le disponible passe sous ce seuil pour un nouveau produit."
        />
        <Champ
          libelle="Délai de relance des créances (jours)"
          type="nombre"
          value={f.delai}
          onChange={maj("delai")}
          aide="Un client avec un reste dû est signalé dans la page Clients après ce nombre de jours sans activité."
        />
      </Formulaire>
    </Carte>
  );
}
