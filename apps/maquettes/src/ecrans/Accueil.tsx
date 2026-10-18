import { Logotype } from "@multiboutique/ui";
import { SelecteurTheme } from "@multiboutique/ui";

const ECRANS = [
  {
    href: "#/vente",
    titre: "Nouvelle vente",
    description: "Le vendeur encaisse : produits, quantités, mode de paiement.",
    format: "Tablette, dans la coque du backoffice",
  },
  {
    href: "#/stock",
    titre: "Stock",
    description: "Le magasinier et le gérant suivent les seuils et les ruptures.",
    format: "Tablette et bureau : cartes, puis tableau",
  },
  {
    href: "#/catalogue",
    titre: "Catalogue",
    description: "Le client consulte une boutique et réserve des produits.",
    format: "Téléphone d'abord, vitrine publique",
  },
];

export function Accueil() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 tablette:px-8">
      <Logotype className="h-9 self-start" />
      <div className="flex flex-col gap-3">
        <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Maquettes</h1>
        <p className="m-0 text-courant text-texte-discret">
          Trois écrans construits avec le design system, sur des données fictives. À essayer sur une
          tablette, un téléphone et un ordinateur, en clair comme en sombre.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {ECRANS.map((ecran) => (
          <li key={ecran.href}>
            <a
              href={ecran.href}
              className="flex flex-col gap-1 rounded-carte bg-surface p-5 text-texte no-underline shadow-carte hover:bg-surface-relevee focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="font-titre text-panneau font-bold text-primaire">{ecran.titre}</span>
              <span className="text-courant">{ecran.description}</span>
              <span className="text-mention text-texte-discret">{ecran.format}</span>
            </a>
          </li>
        ))}
      </ul>
      <SelecteurTheme />
    </main>
  );
}
