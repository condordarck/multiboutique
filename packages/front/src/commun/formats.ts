// Formats du monolithe (lib/utils.ts, pages) : nombres en fr-FR suivis du
// paramètre « monnaie ». Seule différence : l'espace devant le symbole est
// insécable, pour qu'un montant ne se coupe jamais en fin de ligne.

export function formatNombre(valeur: number | string): string {
  return Number(valeur).toLocaleString("fr-FR");
}

export function formatMontant(valeur: number | string, monnaie: string): string {
  return `${formatNombre(valeur)} ${monnaie}`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateHeure(date: string): string {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
