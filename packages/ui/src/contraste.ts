// Rapport de contraste WCAG 2.x entre deux couleurs #rrggbb.
// https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio

function luminance(hex: string): number {
  const correspondance = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!correspondance) {
    throw new Error(`Couleur invalide « ${hex} » : format #rrggbb attendu.`);
  }
  const [r, v, b] = correspondance.slice(1).map((canal) => {
    const c = parseInt(canal, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [claire, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (claire + 0.05) / (sombre + 0.05);
}
