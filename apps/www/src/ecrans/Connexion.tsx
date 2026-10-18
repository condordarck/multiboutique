import { ErreurApi, retourSain, useSession } from "@multiboutique/front";
import { Bouton, Champ } from "@multiboutique/ui";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router";
import { URL_BACKOFFICE } from "../config";

/** Connexion des clients (côté client de app/(auth)/login/page.tsx). */
export function Connexion() {
  const { utilisateur, connecter } = useSession();
  const [parametres] = useSearchParams();
  // Après une inscription : adresse pré-remplie et message de bienvenue.
  const etat = useLocation().state as { email?: string; inscrit?: boolean } | null;
  const [email, setEmail] = useState(etat?.email ?? "");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<ErreurApi | null>(null);
  const [envoi, setEnvoi] = useState(false);

  if (utilisateur) return <Navigate to={retourSain(parametres.get("retour")) ?? "/espace"} replace />;

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      await connecter(email.trim(), motDePasse);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e : new ErreurApi(0, "Erreur de connexion"));
      setEnvoi(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Connexion</h1>
        <p className="m-0 mt-1 text-courant text-texte-discret">Suivez vos réservations en ligne</p>
      </div>
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-4 rounded-carte bg-surface p-6 shadow-carte">
        {etat?.inscrit && !erreur && (
          <p role="status" className="m-0 rounded-bouton bg-succes-fond px-4 py-3 font-semibold text-succes">
            Compte créé, connectez-vous.
          </p>
        )}
        {erreur && (
          <div role="alert" className="flex flex-col gap-2 rounded-bouton bg-danger-fond px-4 py-3 font-semibold text-danger">
            <span>{erreur.message}</span>
            {/* Un membre du personnel s'est trompé de porte : on lui montre la bonne. */}
            {erreur.statut === 403 && (
              <a href={URL_BACKOFFICE} className="text-primaire underline">
                Aller à l'espace professionnel
              </a>
            )}
          </div>
        )}
        <Champ libelle="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Champ
          libelle="Mot de passe"
          type="motDePasse"
          autoComplete="current-password"
          required
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
        />
        <Bouton type="submit" grand chargement={envoi} disabled={!email || !motDePasse}>
          {envoi ? "Connexion en cours…" : "Se connecter"}
        </Bouton>
      </form>
      <p className="m-0 text-center text-libelle text-texte-discret">
        Pas encore de compte ?{" "}
        <Link to="/inscription" className="font-semibold text-primaire">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
