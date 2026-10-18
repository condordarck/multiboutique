import type { BoutiqueResumee } from "@multiboutique/shared";
import { Selecteur } from "@multiboutique/ui";
import { useLocation, useNavigate } from "react-router";

/**
 * La boutique courante. Avec plusieurs boutiques, un sélecteur qui garde la
 * section ouverte : passer de Stock (boutique 1) à Stock (boutique 2).
 */
export function ChoixBoutique({ boutiques, courante }: { boutiques: BoutiqueResumee[]; courante: string | null }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const actuelle = boutiques.find((b) => b.id === courante);

  if (boutiques.length <= 1) {
    return actuelle ? <strong className="text-courant">{actuelle.nom}</strong> : null;
  }

  function changer(id: string) {
    const section = courante ? pathname.split("/")[3] : undefined;
    navigate(section ? `/b/${id}/${section}` : `/b/${id}`);
  }

  return (
    <div className="w-48 tablette:w-56">
      <Selecteur
        libelle="Boutique"
        libelleMasque
        className="min-h-11"
        options={boutiques.map((b) => ({ valeur: b.id, libelle: b.nom }))}
        optionVide={actuelle ? undefined : "Choisir une boutique"}
        value={courante ?? ""}
        onChange={(e) => e.target.value && changer(e.target.value)}
      />
    </div>
  );
}
