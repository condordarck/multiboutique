import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useSession } from "../session/Session";
import { persistance } from "./instance";
import { verifierProprietaire } from "./persistance";

/** Vide le cache d'un autre utilisateur dès qu'une session s'ouvre (voir verifierProprietaire). */
export function GardeProprietaire() {
  const { utilisateur } = useSession();
  const client = useQueryClient();
  const id = utilisateur?.id;
  useEffect(() => {
    if (id) void verifierProprietaire(client, id, persistance.purger);
  }, [id, client]);
  return null;
}
