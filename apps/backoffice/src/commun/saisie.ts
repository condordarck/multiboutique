/** Nombre saisi (virgule ou point décimal) ; NaN si vide ou invalide. */
export function lireNombre(texte: string): number {
  const t = texte.trim().replace(/\s/g, "").replace(",", ".");
  return t === "" ? Number.NaN : Number(t);
}
