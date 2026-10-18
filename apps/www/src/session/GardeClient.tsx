import { Chargement, useSession } from "@multiboutique/front";
import { Navigate, Outlet, useLocation } from "react-router";

/** L'espace client exige une session ; le reste de la vitrine est public. */
export function GardeClient() {
  const { utilisateur, chargement } = useSession();
  const { pathname, search } = useLocation();
  if (chargement) return <Chargement />;
  if (!utilisateur) return <Navigate to={`/connexion?retour=${encodeURIComponent(pathname + search)}`} replace />;
  return <Outlet />;
}
