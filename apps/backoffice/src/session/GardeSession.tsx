import { Navigate, Outlet, useLocation } from "react-router";
import { Chargement, useSession } from "@multiboutique/front";

/** Sans session, renvoie à la connexion en retenant l'écran demandé. */
export function GardeSession() {
  const { utilisateur, chargement, deconnecte } = useSession();
  const { pathname, search } = useLocation();

  if (chargement) return <Chargement />;
  // Déconnexion volontaire : l'utilisateur suivant (tablette partagée) part de
  // son propre accueil, pas de la page du précédent.
  if (!utilisateur && deconnecte) return <Navigate to="/connexion" replace />;
  if (!utilisateur) {
    const retour = encodeURIComponent(pathname + search);
    return <Navigate to={`/connexion?retour=${retour}`} replace />;
  }
  return <Outlet />;
}
