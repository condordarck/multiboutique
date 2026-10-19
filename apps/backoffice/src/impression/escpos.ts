import type { LigneImprimee } from "./mise-en-page";
import type { JeuCaracteres } from "./reglages";

// Commandes ESC/POS (Epson, et les imprimantes thermiques compatibles).
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Caractères 0x80 à 0xFF de chaque table, et le numéro qui la choisit (ESC t n,
 * numérotation Epson). Les tables sont celles d'IBM (Python codecs cp437/850/858).
 */
const TABLES: Record<Exclude<JeuCaracteres, "ascii">, { numero: number; haut: string }> = {
  cp437: { numero: 0, haut: "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0" },
  cp850: { numero: 2, haut: "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00f8\u00a3\u00d8\u00d7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00ae\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u00c1\u00c2\u00c0\u00a9\u2563\u2551\u2557\u255d\u00a2\u00a5\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u00e3\u00c3\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u00a4\u00f0\u00d0\u00ca\u00cb\u00c8\u0131\u00cd\u00ce\u00cf\u2518\u250c\u2588\u2584\u00a6\u00cc\u2580\u00d3\u00df\u00d4\u00d2\u00f5\u00d5\u00b5\u00fe\u00de\u00da\u00db\u00d9\u00fd\u00dd\u00af\u00b4\u00ad\u00b1\u2017\u00be\u00b6\u00a7\u00f7\u00b8\u00b0\u00a8\u00b7\u00b9\u00b3\u00b2\u25a0\u00a0" },
  cp858: { numero: 19, haut: "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00f8\u00a3\u00d8\u00d7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u00ae\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u00c1\u00c2\u00c0\u00a9\u2563\u2551\u2557\u255d\u00a2\u00a5\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u00e3\u00c3\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u00a4\u00f0\u00d0\u00ca\u00cb\u00c8\u20ac\u00cd\u00ce\u00cf\u2518\u250c\u2588\u2584\u00a6\u00cc\u2580\u00d3\u00df\u00d4\u00d2\u00f5\u00d5\u00b5\u00fe\u00de\u00da\u00db\u00d9\u00fd\u00dd\u00af\u00b4\u00ad\u00b1\u2017\u00be\u00b6\u00a7\u00f7\u00b8\u00b0\u00a8\u00b7\u00b9\u00b3\u00b2\u25a0\u00a0" },
};

// Typographie courante sans équivalent dans les tables.
const SUBSTITUTS: Record<string, string> = {
  "\u2019": "'", "\u2018": "'", "\u201c": '"', "\u201d": '"', "\u2014": "-", "\u2013": "-",
  "\u2026": "...", "\u00b0": "o", "\u0153": "oe", "\u0152": "OE", "\u20ac": "EUR", "\u00a0": " ", "\u202f": " ",
};

/** Texte → octets de la table choisie ; sans équivalent : la lettre sans accent, sinon « ? ». */
export function encoderTexte(texte: string, jeu: JeuCaracteres): number[] {
  const haut = jeu === "ascii" ? "" : TABLES[jeu].haut;
  const octets: number[] = [];
  for (const caractere of texte) {
    const code = caractere.codePointAt(0)!;
    if (code >= 0x20 && code < 0x7f) {
      octets.push(code);
      continue;
    }
    const position = haut.indexOf(caractere);
    if (position >= 0) {
      octets.push(0x80 + position);
      continue;
    }
    const remplacement = SUBSTITUTS[caractere] ?? caractere.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (remplacement !== caractere && remplacement.length > 0) octets.push(...encoderTexte(remplacement, jeu));
    else octets.push(0x3f);
  }
  return octets;
}

export interface OptionsEscPos {
  jeu: JeuCaracteres;
  couper: boolean;
  tiroir: boolean;
  exemplaires: number;
}

/** Ticket complet : initialisation, lignes, avance, coupe et tiroir-caisse. */
export function encoderTicket(lignes: LigneImprimee[], options: OptionsEscPos): Uint8Array {
  const octets: number[] = [];
  for (let i = 0; i < options.exemplaires; i++) {
    octets.push(ESC, 0x40); // ESC @ : réinitialise
    if (options.jeu !== "ascii") octets.push(ESC, 0x74, TABLES[options.jeu].numero); // ESC t n
    for (const ligne of lignes) {
      octets.push(ESC, 0x61, ligne.centre ? 1 : 0); // ESC a : alignement
      octets.push(ESC, 0x45, ligne.gras ? 1 : 0); // ESC E : gras
      octets.push(GS, 0x21, ligne.grand ? 0x01 : 0x00); // GS ! : double hauteur
      octets.push(...encoderTexte(ligne.texte, options.jeu), LF);
    }
    octets.push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0);
    // Avance jusqu'au couteau (sans coupe : de quoi détacher le ticket).
    octets.push(ESC, 0x64, 4); // ESC d 4
    if (options.couper) octets.push(GS, 0x56, 0x42, 0x00); // GS V B 0 : coupe partielle après avance
  }
  // Une fois, après le dernier exemplaire : impulsion sur la broche 2, 50 ms / 500 ms.
  if (options.tiroir) octets.push(ESC, 0x70, 0x00, 0x19, 0xfa);
  return Uint8Array.from(octets);
}
