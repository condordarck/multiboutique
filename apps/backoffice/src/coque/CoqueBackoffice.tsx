import { Coque, EtatVide } from "@multiboutique/ui";
import icone from "@multiboutique/ui/assets/icone.svg";
import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { useMesBoutiques } from "../api/generales";
import { Chargement, useUtilisateur } from "@multiboutique/front";
import { ChoixBoutique } from "./ChoixBoutique";
import { EnTete } from "./EnTete";
import { ICONES } from "./icones-sections";
import { LienRouteur } from "./LienRouteur";
import { entreeActive, entreesPersonnel } from "./navigation";

const CLE_DERNIERE = "mb-derniere-boutique";

function derniereBoutique(): string | null {
  try {
    return localStorage.getItem(CLE_DERNIERE);
  } catch {
    return null;
  }
}

/** Coque des écrans du personnel (tout sauf l'administration). */
export function CoqueBackoffice() {
  const utilisateur = useUtilisateur();
  const { boutiqueId } = useParams();
  const { pathname } = useLocation();
  const boutiques = useMesBoutiques();

  // L'administrateur gère la configuration, pas les données commerciales.
  if (utilisateur.role === "administrateur") return <Navigate to="/admin" replace />;
  if (boutiques.isPending) return <Chargement />;

  const liste = boutiques.data ?? [];
  // Hors d'une boutique (tableau de bord, consolidation), le menu reprend la
  // dernière boutique ouverte, ou la première.
  const memorisee = derniereBoutique();
  const courante =
    boutiqueId ?? (liste.some((b) => b.id === memorisee) ? memorisee : (liste[0]?.id ?? null));
  if (boutiqueId) {
    try {
      localStorage.setItem(CLE_DERNIERE, boutiqueId);
    } catch {
      // Sans stockage, le menu repartira de la première boutique.
    }
  }

  const entrees = entreesPersonnel(utilisateur, courante);
  const active = entreeActive(entrees, pathname);
  const accessible = !boutiqueId || liste.some((b) => b.id === boutiqueId);

  return (
    <Coque
      composantLien={LienRouteur}
      marque={<img src={icone} width={48} height={48} alt="MultiBoutique" />}
      entrees={entrees.map((e) => ({ libelle: e.libelle, href: e.chemin, icone: ICONES[e.cle], actif: e.cle === active }))}
      enTete={<EnTete contexte={<ChoixBoutique boutiques={liste} courante={boutiqueId ?? null} />} />}
    >
      {accessible ? (
        <Outlet />
      ) : (
        <EtatVide
          message="Boutique inaccessible"
          description="Cette boutique n'existe pas, n'est plus active ou ne fait pas partie de votre périmètre."
        />
      )}
    </Coque>
  );
}
