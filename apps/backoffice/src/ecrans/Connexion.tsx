import { Bouton, Champ, Logotype } from "@multiboutique/ui";
import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router";
import { ErreurApi } from "../api/client";
import { retourSain } from "../session/redirection";
import { useSession } from "../session/Session";

export function Connexion() {
  const { utilisateur, connecter } = useSession();
  const [parametres] = useSearchParams();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  // Connecté, juste à l'instant ou déjà (onglet rouvert) : vers l'écran retenu,
  // s'il est interne, sinon vers l'accueil du rôle.
  if (utilisateur) return <Navigate to={retourSain(parametres.get("retour")) ?? "/"} replace />;

  async function soumettre(evenement: FormEvent) {
    evenement.preventDefault();
    setEnvoi(true);
    setErreur("");
    try {
      await connecter(email.trim(), motDePasse);
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Erreur de connexion");
      setEnvoi(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fond px-4 py-10">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-carte bg-surface p-6 shadow-carte tablette:p-8">
        <Logotype className="h-9 self-center" />
        <div className="text-center">
          <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Connexion</h1>
          <p className="m-0 mt-1 text-courant text-texte-discret">Accédez à votre espace de gestion</p>
        </div>
        <form onSubmit={soumettre} className="flex flex-col gap-4" noValidate>
          {erreur && (
            <p role="alert" className="m-0 rounded-bouton bg-danger-fond px-4 py-3 font-semibold text-danger">
              {erreur}
            </p>
          )}
          <Champ
            libelle="E-mail"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
      </div>
    </main>
  );
}
