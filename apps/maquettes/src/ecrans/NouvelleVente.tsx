import { Badge, Bouton, Carte, ChoixSegmente, Champ, EtatVide, Quantite } from "@multiboutique/ui";
import { useMemo, useRef, useState } from "react";
import { CoqueBackoffice } from "../CoqueBackoffice";
import { etatStock, formatMontant, PRODUITS } from "../donnees";
import { correspond } from "../recherche";

type Paiement = "especes" | "mobile" | "credit";

const PAIEMENTS: { valeur: Paiement; libelle: string }[] = [
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "mobile", libelle: "Mobile money" },
  { valeur: "credit", libelle: "Crédit" },
];

// Simule l'aller-retour vers l'API, pour voir l'état de chargement du bouton.
const DELAI_ENREGISTREMENT_MS = 300;

export function NouvelleVente() {
  const [recherche, setRecherche] = useState("");
  const [panier, setPanier] = useState<Record<string, number>>({});
  const [paiement, setPaiement] = useState<Paiement>("especes");
  const [statut, setStatut] = useState<"saisie" | "envoi" | "faite">("saisie");
  const panierRef = useRef<HTMLDivElement>(null);

  const produits = PRODUITS.filter((p) => correspond(p.nom, recherche));
  const lignes = PRODUITS.filter((p) => panier[p.id]).map((p) => ({ produit: p, quantite: panier[p.id]! }));
  const nbArticles = lignes.reduce((somme, l) => somme + l.quantite, 0);
  const total = useMemo(() => lignes.reduce((somme, l) => somme + l.produit.prix * l.quantite, 0), [lignes]);

  function ajouter(id: string) {
    setPanier((actuel) => ({ ...actuel, [id]: (actuel[id] ?? 0) + 1 }));
  }

  function changerQuantite(id: string, quantite: number) {
    setPanier((actuel) => ({ ...actuel, [id]: quantite }));
  }

  function retirer(id: string) {
    setPanier(({ [id]: _retire, ...reste }) => reste);
  }

  function encaisser() {
    setStatut("envoi");
    setTimeout(() => setStatut("faite"), DELAI_ENREGISTREMENT_MS);
  }

  function recommencer() {
    setPanier({});
    setPaiement("especes");
    setStatut("saisie");
  }

  if (statut === "faite") {
    const libelle = PAIEMENTS.find((p) => p.valeur === paiement)!.libelle;
    return (
      <CoqueBackoffice actif="vente">
        <Carte>
          <EtatVide
            message="Vente enregistrée"
            description={`${formatMontant(total)} encaissés en ${libelle.toLowerCase()}. Le stock est à jour.`}
            action={{ libelle: "Nouvelle vente", onClick: recommencer }}
          />
        </Carte>
      </CoqueBackoffice>
    );
  }

  return (
    <CoqueBackoffice actif="vente">
      <div className="flex flex-col gap-5">
        <h1 className="m-0 font-titre text-ecran font-extrabold tracking-[-0.02em]">Nouvelle vente</h1>

        <div className="grid gap-5 min-[60rem]:grid-cols-[minmax(0,1fr)_360px] min-[60rem]:items-start">
          <section aria-labelledby="titre-produits" className="flex flex-col gap-4">
            <h2 id="titre-produits" className="sr-only">
              Produits
            </h2>
            <Champ
              libelle="Rechercher un produit"
              type="recherche"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 tablette:grid-cols-3">
              {produits.map((produit) => {
                const etat = etatStock(produit);
                const dansPanier = panier[produit.id] ?? 0;
                return (
                  <li key={produit.id}>
                    <button
                      type="button"
                      onClick={() => ajouter(produit.id)}
                      disabled={dansPanier >= produit.stock}
                      className="flex min-h-28 w-full flex-col items-start gap-1.5 rounded-carte bg-surface p-4 text-left shadow-carte enabled:hover:bg-surface-relevee disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <span className="text-courant font-semibold text-texte">{produit.nom}</span>
                      <span className="text-courant font-bold tabular-nums text-texte">{formatMontant(produit.prix)}</span>
                      {etat === "rupture" && <Badge ton="danger">Rupture</Badge>}
                      {etat === "bas" && <Badge ton="alerte">Plus que {produit.stock}</Badge>}
                      {dansPanier > 0 && <Badge ton="info">{dansPanier} au panier</Badge>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {produits.length === 0 && <EtatVide message="Aucun produit trouvé" description={`Rien ne correspond à « ${recherche} ».`} />}
          </section>

          <div ref={panierRef} className="scroll-mt-4 min-[60rem]:sticky min-[60rem]:top-4">
          <Carte titre="Panier">
            {lignes.length === 0 ? (
              <EtatVide message="Panier vide" description="Touchez un produit pour l'ajouter." />
            ) : (
              <>
                <ul className="m-0 flex list-none flex-col p-0">
                  {lignes.map(({ produit, quantite }) => (
                    <li key={produit.id} className="flex flex-col gap-2 border-b border-bordure py-3 last:border-b-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">{produit.nom}</span>
                        <span className="font-bold tabular-nums">{formatMontant(produit.prix * quantite)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Quantite
                          libelle={produit.nom}
                          valeur={quantite}
                          max={produit.stock}
                          onChange={(q) => changerQuantite(produit.id, q)}
                        />
                        <Bouton variante="discret" aria-label={`Retirer ${produit.nom} du panier`} onClick={() => retirer(produit.id)}>
                          Retirer
                        </Bouton>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline justify-between border-t-2 border-texte pt-3">
                  <span className="text-courant font-semibold">Total</span>
                  <span className="text-chiffre font-bold tabular-nums" data-testid="total">
                    {formatMontant(total)}
                  </span>
                </div>
                <ChoixSegmente legende="Mode de paiement" legendeVisible options={PAIEMENTS} valeur={paiement} onChange={setPaiement} />
                <Bouton grand className="w-full" chargement={statut === "envoi"} onClick={encaisser}>
                  Encaisser {formatMontant(total)}
                </Bouton>
              </>
            )}
          </Carte>
          </div>
        </div>
      </div>

      {/* Sous 960 px, le panier passe sous les produits, hors de vue : une barre
          fixe garde le total sous les yeux et y ramène d'un geste. Sur
          téléphone, elle se pose au-dessus de la barre d'onglets. */}
      {lignes.length > 0 && (
        <>
          <div className="h-20 min-[60rem]:hidden" />
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-bordure bg-surface tablette:bottom-0 tablette:left-[104px] min-[60rem]:hidden">
            <div className="flex items-center gap-4 px-4 py-3">
              <p className="m-0 flex-1 text-libelle" aria-live="polite">
                {nbArticles} article{nbArticles > 1 ? "s" : ""} ·{" "}
                <strong className="tabular-nums">{formatMontant(total)}</strong>
              </p>
              <Bouton onClick={() => panierRef.current?.scrollIntoView({ behavior: "smooth" })}>Voir le panier</Bouton>
            </div>
          </div>
        </>
      )}
    </CoqueBackoffice>
  );
}
