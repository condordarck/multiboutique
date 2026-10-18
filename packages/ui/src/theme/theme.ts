export type Theme = "systeme" | "clair" | "sombre";

const CLE = "mb-theme";

export function themeEnregistre(): Theme {
  try {
    const valeur = localStorage.getItem(CLE);
    return valeur === "clair" || valeur === "sombre" ? valeur : "systeme";
  } catch {
    // Navigation privée ou stockage bloqué : on suit le système.
    return "systeme";
  }
}

/** « systeme » retire l'attribut : theme.css suit alors prefers-color-scheme. */
export function appliquerTheme(theme: Theme) {
  const racine = document.documentElement;
  if (theme === "systeme") delete racine.dataset.theme;
  else racine.dataset.theme = theme;
  try {
    localStorage.setItem(CLE, theme);
  } catch {
    // Le choix ne survivra pas au rechargement ; l'affichage reste correct.
  }
}
