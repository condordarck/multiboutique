import { Navigate, Outlet, useLocation } from "react-router";
import { Chargement } from "../commun/Chargement";
import { useSession } from "./Session";

/** Sans session, renvoie à la connexion en retenant l'écran demandé. */
export function GardeSession() {
  const { utilisateur, chargement } = useSession();
  const { pathname, search } = useLocation();

  if (chargement) return <Chargement />;
  if (!utilisateur) {
    const retour = encodeURIComponent(pathname + search);
    return <Navigate to={`/connexion?retour=${retour}`} replace />;
  }
  return <Outlet />;
}
