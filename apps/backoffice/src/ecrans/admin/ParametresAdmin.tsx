import type { Parametres } from "@multiboutique/shared";
import { Carte, Champ } from "@multiboutique/ui";
import { useState } from "react";
import { INVALIDE_ADMIN, mettreAJourParametres } from "../../api/administration";
import { cles, useParametres } from "../../api/generales";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { Formulaire } from "../../commun/Formulaire";
import { Lecture } from "../../commun/Lecture";
import { useEcriture } from "../../commun/useEcriture";

/** app/(admin)/admin/parametres/page.tsx */
export function ParametresAdmin() {
  const parametres = useParametres();
  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran titre="Paramètres généraux" sousTitre="Configuration générale de l'application appliquée partout." />
      <Lecture requete={parametres}>{(p) => <FormulaireParametres initial={p} />}</Lecture>
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
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  return (
    <Carte className="max-w-2xl">
      <Formulaire
        libelleEnvoyer="Enregistrer"
        onEnvoyer={() =>
          void ecriture.envoyer([
            { cle: "monnaie", valeur: f.monnaie },
            { cle: "nom_application", valeur: f.nom },
            { cle: "seuil_alerte_defaut", valeur: f.seuil },
            { cle: "relance_delai_jours", valeur: f.delai },
          ])
        }
        erreur={ecriture.erreur}
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
