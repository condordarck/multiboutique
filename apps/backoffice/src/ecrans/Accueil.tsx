import { Bouton, EtatVide } from "@multiboutique/ui";
import { Navigate } from "react-router";
import { accueilDu } from "../session/redirection";
import { useSession, useUtilisateur } from "../session/Session";

/** La racine envoie chacun vers son écran ; sans boutique, explique pourquoi. */
export function Accueil() {
  const utilisateur = useUtilisateur();
  const { deconnecter } = useSession();
  const cible = accueilDu(utilisateur);
  if (cible) return <Navigate to={cible} replace />;
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="flex flex-col items-center">
        <EtatVide
          message="Aucune boutique"
          description="Aucune boutique active ne vous est rattachée. Demandez à un administrateur de vous en attribuer une."
        />
        <Bouton variante="secondaire" onClick={() => void deconnecter()}>
          Se déconnecter
        </Bouton>
      </div>
    </main>
  );
}
