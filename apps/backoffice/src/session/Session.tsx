import { aPermission, type Permission, type SessionUtilisateur } from "@multiboutique/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { appeler, ErreurApi, EVENEMENT_SESSION_EXPIREE } from "../api/client";

export const CLE_SESSION = ["session"] as const;

interface ContexteSession {
  utilisateur: SessionUtilisateur | null;
  chargement: boolean;
  /** Confort d'affichage seulement : l'API vérifie chaque requête. */
  peut: (permission: Permission) => boolean;
  connecter: (email: string, motDePasse: string) => Promise<SessionUtilisateur>;
  deconnecter: () => Promise<void>;
}

const Contexte = createContext<ContexteSession | null>(null);

/** Actions à mener à la déconnexion en plus du vidage du cache (purge IndexedDB). */
const nettoyages = new Set<() => Promise<void> | void>();
export function surDeconnexion(nettoyage: () => Promise<void> | void) {
  nettoyages.add(nettoyage);
  return () => nettoyages.delete(nettoyage);
}

async function lireSession(): Promise<SessionUtilisateur | null> {
  try {
    const { utilisateur } = await appeler<{ utilisateur: SessionUtilisateur }>("GET", "/auth/session");
    return utilisateur;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 401) return null;
    throw erreur;
  }
}

export function FournisseurSession({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  // Relue à chaque ouverture : une session restaurée du cache hors ligne n'est
  // qu'un affichage provisoire, l'API reste juge (hors ligne, elle reste affichée).
  const { data, isPending } = useQuery({ queryKey: CLE_SESSION, queryFn: lireSession, staleTime: 60_000, refetchOnMount: "always" });
  const utilisateur = data ?? null;

  // L'API ne reconnaît plus la session : on l'oublie, la garde renvoie à la connexion.
  useEffect(() => {
    const oublier = () => client.setQueryData(CLE_SESSION, null);
    window.addEventListener(EVENEMENT_SESSION_EXPIREE, oublier);
    return () => window.removeEventListener(EVENEMENT_SESSION_EXPIREE, oublier);
  }, [client]);

  const connecter = useCallback(
    async (email: string, motDePasse: string) => {
      const { utilisateur } = await appeler<{ utilisateur: SessionUtilisateur }>("POST", "/auth/connexion", {
        email,
        mot_de_passe: motDePasse,
      });
      client.setQueryData(CLE_SESSION, utilisateur);
      return utilisateur;
    },
    [client]
  );

  const deconnecter = useCallback(async () => {
    try {
      await appeler("POST", "/auth/deconnexion");
    } catch {
      // Hors ligne ou API à terre : on efface quand même tout côté appareil.
    }
    // La session d'abord : vider son entrée relancerait sa lecture.
    client.setQueryData(CLE_SESSION, null);
    // Tablettes partagées : rien des données du précédent utilisateur ne reste.
    client.removeQueries({ predicate: (requete) => requete.queryKey[0] !== CLE_SESSION[0] });
    client.getMutationCache().clear();
    for (const nettoyage of nettoyages) await nettoyage();
  }, [client]);

  const valeur = useMemo<ContexteSession>(
    () => ({
      utilisateur,
      chargement: isPending,
      peut: (permission) => aPermission(utilisateur, permission),
      connecter,
      deconnecter,
    }),
    [utilisateur, isPending, connecter, deconnecter]
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): ContexteSession {
  const session = useContext(Contexte);
  if (!session) throw new Error("useSession exige un FournisseurSession.");
  return session;
}

/** Variante pour les écrans sous la garde : l'utilisateur est forcément connecté. */
export function useUtilisateur(): SessionUtilisateur {
  const { utilisateur } = useSession();
  if (!utilisateur) throw new Error("useUtilisateur hors de la garde de session.");
  return utilisateur;
}
