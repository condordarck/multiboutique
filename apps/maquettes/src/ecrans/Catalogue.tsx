import { Badge, Bouton, ChoixSegmente, Champ, EtatVide, Logotype } from "@multiboutique/ui";
import { useState } from "react";
import { BOUTIQUES, CATEGORIES, etatStock, formatMontant, PRODUITS, type EtatStock } from "../donnees";
import { IconeSac } from "../icones";
import { correspond } from "../recherche";
import { SelecteurTheme } from "../SelecteurTheme";

type Boutique = (typeof BOUTIQUES)[number];

const DISPONIBILITE: Record<EtatStock, { ton: "succes" | "alerte" | "danger"; libelle: string }> = {
  ok: { ton: "succes", libelle: "Disponible" },
  bas: { ton: "alerte", libelle: "Stock limité" },
  rupture: { ton: "danger", libelle: "Épuisé" },
};

export function Catalogue() {
  const [boutique, setBoutique] = useState<Boutique>("Boutique 1");
  const [categorie, setCategorie] = useState<string>("toutes");
  const [recherche, setRecherche] = useState("");
  const [reservation, setReservation] = useState<string[]>([]);
  const [envoyee, setEnvoyee] = useState(false);

  const produits = PRODUITS.filter(
    (p) => (categorie === "toutes" || p.categorie === categorie) && correspond(p.nom, recherche)
  );
  const total = PRODUITS.filter((p) => reservation.includes(p.id)).reduce((s, p) => s + p.prix, 0);

  function basculer(id: string) {
    setReservation((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }

  if (envoyee) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <EtatVide
          message="Réservation envoyée"
          description={`${reservation.length} article${reservation.length > 1 ? "s" : ""} réservé${reservation.length > 1 ? "s" : ""} à ${boutique}, pour ${formatMontant(total)}.`}
          action={{
            libelle: "Retour au catalogue",
            onClick: () => {
              setReservation([]);
              setEnvoyee(false);
            },
          }}
        />
      </main>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-bordure bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 tablette:px-8">
          <a href="#/" className="rounded-bouton focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <Logotype alt="MultiBoutique, toutes les maquettes" className="h-7" />
          </a>
          <ChoixSegmente<Boutique>
            legende="Boutique"
            options={BOUTIQUES.map((b) => ({ valeur: b, libelle: b }))}
            valeur={boutique}
            onChange={setBoutique}
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-6 pb-32 tablette:px-8">
        <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">{boutique}</h1>
        <Champ libelle="Rechercher un produit" type="recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        <ChoixSegmente
          legende="Catégorie"
          options={[{ valeur: "toutes", libelle: "Toutes" }, ...CATEGORIES.map((c) => ({ valeur: c, libelle: c }))]}
          valeur={categorie}
          onChange={setCategorie}
        />

        {produits.length === 0 ? (
          <EtatVide message="Aucun produit" description="Essayez une autre catégorie ou un autre mot." />
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 min-[30rem]:grid-cols-2 tablette:grid-cols-3 bureau:grid-cols-4">
            {produits.map((produit) => {
              const etat = etatStock(produit);
              const reserve = reservation.includes(produit.id);
              return (
                <li key={produit.id} className="flex flex-col gap-2 rounded-carte bg-surface p-4 shadow-carte">
                  <span className="text-mention text-texte-discret">{produit.categorie}</span>
                  <h2 className="m-0 font-titre text-panneau font-bold">{produit.nom}</h2>
                  <span className="text-chiffre font-bold tabular-nums">{formatMontant(produit.prix)}</span>
                  <Badge ton={DISPONIBILITE[etat].ton} className="self-start">
                    {DISPONIBILITE[etat].libelle}
                  </Badge>
                  <Bouton
                    variante={reserve ? "secondaire" : "primaire"}
                    disabled={etat === "rupture"}
                    aria-pressed={reserve}
                    onClick={() => basculer(produit.id)}
                    className="mt-auto"
                  >
                    {reserve ? "Retirer de ma réservation" : "Réserver"}
                  </Bouton>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="mt-6 flex flex-col gap-3 border-t border-bordure pt-6">
          <SelecteurTheme />
        </footer>
      </main>

      {reservation.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-bordure bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 tablette:px-8">
            <IconeSac />
            <p className="m-0 flex-1 text-libelle" aria-live="polite">
              <strong>Ma réservation</strong> · {reservation.length} article{reservation.length > 1 ? "s" : ""} ·{" "}
              <span className="font-bold tabular-nums">{formatMontant(total)}</span>
            </p>
            <Bouton onClick={() => setEnvoyee(true)}>Valider</Bouton>
          </div>
        </div>
      )}
    </div>
  );
}
