import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListeAdaptative, type Colonne } from "./ListeAdaptative";

interface Vente {
  id: string;
  heure: string;
  articles: string;
  montant: string;
}

const ventes: Vente[] = [
  { id: "v1", heure: "14:32", articles: "Riz 25 kg × 2", montant: "64,50 $" },
  { id: "v2", heure: "14:05", articles: "Sucre 1 kg × 6", montant: "9,00 $" },
];

const colonnes: Colonne<Vente>[] = [
  { cle: "heure", libelle: "Heure", rendu: (v) => v.heure },
  { cle: "articles", libelle: "Articles", rendu: (v) => v.articles, principale: true },
  { cle: "montant", libelle: "Montant", rendu: (v) => v.montant, alignement: "fin" },
];

function rendre(lignes = ventes) {
  return render(
    <ListeAdaptative
      legende="Dernières ventes"
      colonnes={colonnes}
      lignes={lignes}
      cleLigne={(v) => v.id}
      vide="Aucune vente"
    />
  );
}

describe("ListeAdaptative", () => {
  it("rend un vrai tableau, légendé, avec un en-tête par colonne", () => {
    rendre();
    const tableau = screen.getByRole("table", { name: "Dernières ventes" });
    expect(within(tableau).getAllByRole("columnheader").map((c) => c.textContent)).toEqual([
      "Heure",
      "Articles",
      "Montant",
    ]);
    expect(within(tableau).getAllByRole("row")).toHaveLength(3);
  });

  it("le tableau n'apparaît qu'au format bureau", () => {
    rendre();
    const classes = screen.getByRole("table").className;
    expect(classes).toContain("hidden");
    expect(classes).toContain("bureau:table");
  });

  it("rend aussi une carte par ligne, titrée par la colonne principale", () => {
    rendre();
    const liste = screen.getByRole("list", { name: "Dernières ventes" });
    expect(liste.className).toContain("bureau:hidden");
    const cartes = within(liste).getAllByRole("listitem");
    expect(cartes).toHaveLength(2);
    expect(cartes[0]!.firstElementChild!.textContent).toBe("Riz 25 kg × 2");
  });

  it("dans une carte, chaque autre colonne garde son libellé", () => {
    rendre();
    const carte = within(screen.getByRole("list")).getAllByRole("listitem")[0]!;
    expect(within(carte).getByText("Heure")).toBeTruthy();
    expect(within(carte).getByText("14:32")).toBeTruthy();
    expect(within(carte).getByText("64,50 $")).toBeTruthy();
  });

  it("aligne à droite les colonnes de montant", () => {
    rendre();
    const entete = screen.getAllByRole("columnheader")[2]!;
    expect(entete.className).toContain("text-right");
  });

  it("sans ligne, affiche l'état vide à la place du tableau et des cartes", () => {
    rendre([]);
    expect(screen.getByText("Aucune vente")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
