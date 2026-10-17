// Couleurs de l'identité « Comptoir, primaire bleue ».
// Source : docs/superpowers/specs/2026-10-17-identite-visuelle.md. Toute valeur
// changée ici l'est aussi là-bas, et dans theme.css (vérifié par les tests).

const clair = {
  fond: "#F4F0E8",
  surface: "#FFFFFF",
  surfaceRelevee: "#FBF8F3",
  texte: "#1F1B16",
  texteDiscret: "#5E564C",
  bordure: "#E2DACD",
  bordureForte: "#8C8174",
  primaire: "#2B50D9",
  primaireSurvol: "#1F3DAE",
  surPrimaire: "#FFFFFF",
  primaireFond: "#E6ECFA",
  accent: "#E0A526",
  surAccent: "#1F1B16",
  succes: "#1F7A4D",
  succesFond: "#E3F1E9",
  alerte: "#8F5300",
  alerteFond: "#FBEFD6",
  danger: "#B3261E",
  surDanger: "#FFFFFF",
  dangerFond: "#F8E1DF",
  info: "#0E6B6B",
  infoFond: "#DDF0EE",
  neutreFond: "#EDE7DD",
  focus: "#2B50D9",
};

export type NomToken = keyof typeof clair;

const sombre: Record<NomToken, string> = {
  fond: "#16130F",
  surface: "#211D18",
  surfaceRelevee: "#2B261F",
  texte: "#F3EEE6",
  texteDiscret: "#B5AA9B",
  bordure: "#3A332B",
  bordureForte: "#7A6F62",
  primaire: "#8AA8FF",
  primaireSurvol: "#A9C0FF",
  surPrimaire: "#0E1630",
  primaireFond: "#1C2340",
  accent: "#F0BC4C",
  surAccent: "#16130F",
  succes: "#6CCB97",
  succesFond: "#173323",
  alerte: "#F0BC4C",
  alerteFond: "#3A2C10",
  danger: "#FF8A80",
  surDanger: "#2A0D0B",
  dangerFond: "#3D1A17",
  info: "#6FD3CB",
  infoFond: "#143331",
  neutreFond: "#2B261F",
  focus: "#8AA8FF",
};

export const tokens: Record<"clair" | "sombre", Record<NomToken, string>> = { clair, sombre };
