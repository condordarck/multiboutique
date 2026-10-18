import { TuileChiffre } from "@multiboutique/ui";
import { Link } from "react-router";
import { useStatistiquesAdmin } from "../../api/administration";
import { EnTeteEcran, formatNombre, Lecture } from "@multiboutique/front";

const RACCOURCIS = [
  { to: "/admin/utilisateurs", titre: "Utilisateurs", texte: "Créer des comptes pour chaque profil (gérant, vendeur, comptable…) et leur attribuer des boutiques." },
  { to: "/admin/boutiques", titre: "Boutiques", texte: "Ajouter, renommer ou activer / désactiver les boutiques." },
  { to: "/admin/parametres", titre: "Paramètres", texte: "Monnaie affichée, nom de l'application, seuil d'alerte stock par défaut." },
];

/** app/(admin)/admin/page.tsx */
export function AccueilAdmin() {
  const statistiques = useStatistiquesAdmin();
  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre="Accueil administrateur"
        sousTitre="Gérez les utilisateurs, les boutiques et les paramètres généraux de l'application."
      />
      <Lecture requete={statistiques}>
        {(s) => (
          <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
            <TuileChiffre libelle="Utilisateurs" valeur={formatNombre(s.utilisateurs)} />
            <TuileChiffre libelle="Boutiques actives" valeur={`${s.boutiques_actives} / ${s.boutiques}`} />
            <TuileChiffre libelle="Produits au catalogue" valeur={formatNombre(s.produits)} />
            <TuileChiffre libelle="Rôles disponibles" valeur="7" />
          </div>
        )}
      </Lecture>
      <div className="grid grid-cols-1 gap-4 tablette:grid-cols-3">
        {RACCOURCIS.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className="flex flex-col gap-2 rounded-carte bg-surface p-5 text-texte no-underline shadow-carte hover:bg-surface-relevee focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span className="font-titre text-panneau font-bold">{r.titre}</span>
            <span className="text-libelle text-texte-discret">{r.texte}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
