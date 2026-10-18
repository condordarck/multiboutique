import { appeler, ErreurApi, Formulaire, useEcriture } from "@multiboutique/front";
import { Champ } from "@multiboutique/ui";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

interface Inscription {
  nom_complet: string;
  email: string;
  mot_de_passe: string;
  telephone?: string;
}

const inscrire = async (corps: Inscription) => {
  try {
    return await appeler<{ id: string }>("POST", "/auth/inscription", corps);
  } catch (e) {
    // L'API renvoie le message générique des doublons ; le monolithe était explicite.
    if (e instanceof ErreurApi && e.statut === 409) throw new ErreurApi(409, "Cet e-mail est déjà utilisé");
    throw e;
  }
};

/** app/(auth)/register/page.tsx : mêmes champs, mêmes règles (mot de passe de 6 à 72 caractères). */
export function Inscription() {
  const navigate = useNavigate();
  const inscription = useEcriture({ appel: inscrire, invalide: [] });
  const [f, setF] = useState({ nom: "", telephone: "", email: "", motDePasse: "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  async function envoyer() {
    if (!f.nom.trim() || !f.email.trim()) return setErreur("Nom, e-mail et mot de passe requis");
    if (f.motDePasse.length < 6) return setErreur("Le mot de passe doit contenir au moins 6 caractères");
    if (f.motDePasse.length > 72) return setErreur("Le mot de passe ne doit pas dépasser 72 caractères");
    setErreur(null);
    // L'API enregistre l'adresse en minuscules et compare la connexion telle quelle.
    const email = f.email.trim().toLowerCase();
    const ok = await inscription.envoyer({
      nom_complet: f.nom.trim(),
      email,
      mot_de_passe: f.motDePasse,
      ...(f.telephone.trim() ? { telephone: f.telephone.trim() } : {}),
    });
    // Comme le monolithe : le compte créé, on se connecte.
    if (ok) navigate("/connexion", { state: { email, inscrit: true } });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-10">
      <div className="text-center">
        <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Créer un compte</h1>
        <p className="m-0 mt-1 text-courant text-texte-discret">Inscrivez-vous pour réserver en ligne</p>
      </div>
      <div className="rounded-carte bg-surface p-6 shadow-carte">
        <Formulaire
          libelleEnvoyer="Créer mon compte"
          onEnvoyer={() => void envoyer()}
          erreur={erreur ?? inscription.erreur}
          enCours={inscription.enCours}
          desactivee={inscription.desactivee}
        >
          <Champ libelle="Nom complet" autoComplete="name" required value={f.nom} onChange={maj("nom")} />
          <Champ libelle="Téléphone (facultatif)" inputMode="tel" autoComplete="tel" placeholder="+243 ..." value={f.telephone} onChange={maj("telephone")} />
          <Champ libelle="E-mail" type="email" autoComplete="email" required value={f.email} onChange={maj("email")} />
          <Champ
            libelle="Mot de passe"
            type="motDePasse"
            autoComplete="new-password"
            required
            aide="De 6 à 72 caractères."
            value={f.motDePasse}
            onChange={maj("motDePasse")}
          />
        </Formulaire>
      </div>
      <p className="m-0 text-center text-libelle text-texte-discret">
        Déjà un compte ?{" "}
        <Link to="/connexion" className="font-semibold text-primaire">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
