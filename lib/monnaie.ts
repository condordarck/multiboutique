import { cache } from "react";
import { query } from "@/lib/db";

interface ParamRow {
  cle: string;
  valeur: string;
}

// Valeurs par défaut si la table n'est pas encore initialisée
const DEFAUTS: Record<string, string> = {
  monnaie: "$",
  nom_application: "MultiBoutique",
  seuil_alerte_defaut: "10",
};

export const getParametres = cache(async (): Promise<Record<string, string>> => {
  try {
    const rows = await query<ParamRow>(`SELECT cle, valeur FROM parametres`);
    const params = { ...DEFAUTS };
    for (const row of rows) {
      params[row.cle] = row.valeur;
    }
    return params;
  } catch {
    return { ...DEFAUTS };
  }
});

export const getMonnaie = cache(async (): Promise<string> => {
  const params = await getParametres();
  return params["monnaie"] || "$";
});

export const getNomApplication = cache(async (): Promise<string> => {
  const params = await getParametres();
  return params["nom_application"] || "MultiBoutique";
});

export const getSeuilAlerteDefaut = cache(async (): Promise<number> => {
  const params = await getParametres();
  return Number(params["seuil_alerte_defaut"] || "10");
});