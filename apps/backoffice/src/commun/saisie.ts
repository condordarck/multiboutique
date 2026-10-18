/**
 * Nombre saisi : chiffres, virgule ou point décimal, espaces de milliers
 * tolérés (« 10 000,5 »). NaN pour tout le reste — y compris « 1e3 » ou
 * « 0x10 », que Number() accepterait.
 */
export function lireNombre(texte: string): number {
  const t = texte.replace(/[\s  ]/g, "").replace(",", ".");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/** Entier au moins égal à `min` ; NaN sinon. */
export function lireEntier(texte: string, min: number): number {
  const n = lireNombre(texte);
  return Number.isInteger(n) && n >= min ? n : Number.NaN;
}
