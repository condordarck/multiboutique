import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "../session/Session";
import { verifierProprietaire } from "./persistance";

/**
 * Vide le cache d'un autre utilisateur quand une session apparaît sans passer
 * par la connexion (session restaurée). La connexion, elle, le fait avant
 * d'afficher quoi que ce soit (surConnexion).
 */
export function GardeProprietaire({ purger }: { purger: () => Promise<void> }) {
  const { utilisateur } = useSession();
  const client = useQueryClient();
  const id = utilisateur?.id;
  useEffect(() => {
    if (id) void verifierProprietaire(client, id, purger);
  }, [id, client, purger]);
  return null;
}
