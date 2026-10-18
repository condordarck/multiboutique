import { Coque } from "@multiboutique/ui";
import icone from "@multiboutique/ui/assets/icone.svg";
import { Navigate, Outlet, useLocation } from "react-router";
import { useUtilisateur } from "../session/Session";
import { EnTete } from "./EnTete";
import { ICONES } from "./icones-sections";
import { LienRouteur } from "./LienRouteur";
import { ENTREES_ADMIN, entreeActive } from "./navigation";

/** Coque de l'administration, réservée au rôle administrateur (app/(admin)/layout.tsx). */
export function CoqueAdmin() {
  const utilisateur = useUtilisateur();
  const { pathname } = useLocation();

  if (utilisateur.role !== "administrateur") {
    // Comme le middleware du monolithe : le siège retourne à sa consolidation.
    const siege = utilisateur.role === "directeur_groupe" || utilisateur.role === "directeur_region";
    return <Navigate to={siege ? "/consolidation" : "/"} replace />;
  }

  const active = entreeActive(ENTREES_ADMIN, pathname);
  return (
    <Coque
      composantLien={LienRouteur}
      marque={<img src={icone} width={48} height={48} alt="MultiBoutique" />}
      entrees={ENTREES_ADMIN.map((e) => ({ libelle: e.libelle, href: e.chemin, icone: ICONES[e.cle], actif: e.cle === active }))}
      enTete={<EnTete contexte={<strong className="text-courant">Administration</strong>} />}
    >
      <Outlet />
    </Coque>
  );
}
