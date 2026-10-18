import { ChoixSegmente } from "../composants/ChoixSegmente";
import { useState } from "react";
import { appliquerTheme, themeEnregistre, type Theme } from "./theme";

export function SelecteurTheme() {
  const [theme, setTheme] = useState<Theme>(themeEnregistre);
  return (
    <ChoixSegmente<Theme>
      legende="Thème"
      options={[
        { valeur: "clair", libelle: "Clair" },
        { valeur: "sombre", libelle: "Sombre" },
        { valeur: "systeme", libelle: "Système" },
      ]}
      valeur={theme}
      onChange={(choix) => {
        setTheme(choix);
        appliquerTheme(choix);
      }}
    />
  );
}
