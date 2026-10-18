import type { BoutiqueResumee, Consolidation, ResumeBoutique, ResumeJour } from "@multiboutique/shared";
import { useQuery } from "@tanstack/react-query";
import { appeler } from "@multiboutique/front";

/**
 * Clés des lectures. Toutes celles d'une boutique commencent par
 * ["boutiques", id] : une écriture invalide la boutique entière d'un coup.
 */
export const cle = {
  boutique: (id: string) => ["boutiques", id] as const,
  resumeBoutique: (id: string) => ["boutiques", id, "resume"] as const,
  resumeGlobal: ["resume"] as const,
  consolidation: ["consolidation"] as const,
};

export const useResumeGlobal = () =>
  useQuery({ queryKey: cle.resumeGlobal, queryFn: () => appeler<ResumeJour[]>("GET", "/resume") });

export const useConsolidation = () =>
  useQuery({ queryKey: cle.consolidation, queryFn: () => appeler<Consolidation>("GET", "/consolidation") });

export const useBoutique = (id: string) =>
  useQuery({
    queryKey: [...cle.boutique(id), "fiche"],
    queryFn: () => appeler<BoutiqueResumee>("GET", `/boutiques/${id}`),
  });

export const useResumeBoutique = (id: string) =>
  useQuery({
    queryKey: cle.resumeBoutique(id),
    queryFn: () => appeler<ResumeBoutique>("GET", `/boutiques/${id}/resume`),
  });
