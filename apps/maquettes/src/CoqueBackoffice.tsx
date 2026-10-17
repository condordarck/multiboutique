import { Coque, type EntreeNavigation } from "@multiboutique/ui";
import icone from "@multiboutique/ui/assets/icone.svg";
import type { ReactNode } from "react";
import {
  IconeAccueil,
  IconeAchats,
  IconeClients,
  IconeRapports,
  IconeReglages,
  IconeStock,
  IconeVentes,
} from "./icones";
import { SelecteurTheme } from "./SelecteurTheme";

type Section = "vente" | "stock";

// Sept entrées : assez pour voir le bouton « Plus » sur téléphone. Celles qui
// n'ont pas de maquette ramènent à la liste des maquettes.
function entrees(actif: Section): EntreeNavigation[] {
  return [
    { libelle: "Accueil", href: "#/", icone: <IconeAccueil /> },
    { libelle: "Ventes", href: "#/vente", icone: <IconeVentes />, actif: actif === "vente" },
    { libelle: "Stock", href: "#/stock", icone: <IconeStock />, actif: actif === "stock" },
    { libelle: "Clients", href: "#/clients", icone: <IconeClients /> },
    { libelle: "Rapports", href: "#/rapports", icone: <IconeRapports /> },
    { libelle: "Achats", href: "#/achats", icone: <IconeAchats /> },
    { libelle: "Réglages", href: "#/reglages", icone: <IconeReglages /> },
  ];
}

export function CoqueBackoffice({ actif, children }: { actif: Section; children: ReactNode }) {
  return (
    <Coque
      entrees={entrees(actif)}
      marque={<img src={icone} width={48} height={48} alt="MultiBoutique" />}
      enTete={
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <strong className="text-courant">Boutique 1</strong>
          <span className="text-libelle text-texte-discret">Samedi 17 octobre</span>
          <span className="flex-1" />
          <SelecteurTheme />
        </div>
      }
    >
      {children}
    </Coque>
  );
}
