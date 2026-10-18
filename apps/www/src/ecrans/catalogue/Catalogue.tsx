import type { CataloguePublic } from "@multiboutique/shared";
import { correspond, formatMontant, formatNombre, Formulaire, Lecture, urlImage, useEcriture, useMonnaie, useSession } from "@multiboutique/front";
import { Badge, Bouton, Carte, Champ, ChoixSegmente, EtatVide, Quantite, Selecteur } from "@multiboutique/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { cles, creerReservation, useCatalogue } from "../../api/vitrine";
import { ecrirePanier, lirePanier, viderPanier, type LignePanier } from "../../panier";

type Article = CataloguePublic["produits"][number];
type Tri = "nom" | "prix_asc" | "prix_desc" | "dispo_desc";

const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: "nom", libelle: "Nom (A → Z)" },
  { valeur: "prix_asc", libelle: "Prix croissant" },
  { valeur: "prix_desc", libelle: "Prix décroissant" },
  { valeur: "dispo_desc", libelle: "Plus de stock" },
];

// Seuils de la vitrine du monolithe : plus de 20, plus de 5, sinon.
function disponibilite(n: number) {
  if (n > 20) return <Badge ton="succes">{`${formatNombre(n)} disponibles`}</Badge>;
  if (n > 5) return <Badge ton="alerte">{`${formatNombre(n)} disponibles`}</Badge>;
  return <Badge ton="danger">{`Plus que ${formatNombre(n)}`}</Badge>;
}

/** Catalogue d'une boutique (boutique/[id]/catalogue et CatalogueReservation.tsx). */
export function Catalogue() {
  const { boutiqueId = "" } = useParams();
  const catalogue = useCatalogue(boutiqueId);
  // La clé repart de zéro si l'on passe d'une boutique à une autre (panier, filtres).
  return <Lecture requete={catalogue}>{(c) => <Contenu key={boutiqueId} boutiqueId={boutiqueId} catalogue={c} />}</Lecture>;
}

function Contenu({ boutiqueId, catalogue }: { boutiqueId: string; catalogue: CataloguePublic }) {
  const monnaie = useMonnaie();
  const [parametres] = useSearchParams();
  const categoriesVisibles = catalogue.categories.filter((c) => c.nb_produits > 0);
  const initiale = parametres.get("categorie");
  const [categorie, setCategorie] = useState(initiale && categoriesVisibles.some((c) => c.id === initiale) ? initiale : "tous");
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<Tri>("nom");
  const [lignes, setLignes] = useState<LignePanier[]>(() => lirePanier(boutiqueId));
  const panierRef = useRef<HTMLElement>(null);

  useEffect(() => ecrirePanier(boutiqueId, lignes), [boutiqueId, lignes]);

  function ajouter(a: Article) {
    setLignes((actuelles) => {
      const existante = actuelles.find((l) => l.produit_id === a.produit_id);
      if (existante) {
        return existante.quantite >= a.disponible ? actuelles : actuelles.map((l) => (l === existante ? { ...l, quantite: l.quantite + 1 } : l));
      }
      return [...actuelles, { produit_id: a.produit_id, produit_nom: a.produit_nom, quantite: 1, disponible: a.disponible, prix_vente: Number(a.prix_vente) }];
    });
  }

  // Le panier suit le catalogue lu : prix et disponible à jour, quantités
  // ramenées au disponible, articles qui ne sont plus proposés retirés.
  useEffect(() => {
    setLignes((actuelles) =>
      actuelles.flatMap((l) => {
        const a = catalogue.produits.find((p) => p.produit_id === l.produit_id);
        if (!a) return [];
        const quantite = Math.min(l.quantite, a.disponible);
        return quantite > 0 ? [{ ...l, produit_nom: a.produit_nom, prix_vente: Number(a.prix_vente), disponible: a.disponible, quantite }] : [];
      })
    );
  }, [catalogue.produits]);

  // ?reserve=<produit> : l'article arrive au panier (lien partagé), une seule fois :
  // le retirer ensuite ne doit pas le voir revenir à la relecture du catalogue.
  const reserve = parametres.get("reserve");
  const reserveTraite = useRef<string | null>(null);
  useEffect(() => {
    if (!reserve || reserveTraite.current === reserve) return;
    const article = catalogue.produits.find((p) => p.produit_id === reserve);
    if (!article) return;
    reserveTraite.current = reserve;
    setLignes((actuelles) => (actuelles.some((l) => l.produit_id === article.produit_id) ? actuelles : [...actuelles, { produit_id: article.produit_id, produit_nom: article.produit_nom, quantite: 1, disponible: article.disponible, prix_vente: Number(article.prix_vente) }]));
  }, [reserve, catalogue.produits]);

  const affiches = useMemo(() => {
    const liste = catalogue.produits.filter(
      (a) => (categorie === "tous" || a.categorie_id === categorie) && correspond(`${a.produit_nom} ${a.produit_reference} ${a.categorie_nom ?? ""}`, recherche)
    );
    return [...liste].sort((a, b) => {
      switch (tri) {
        case "prix_asc":
          return a.prix_vente - b.prix_vente;
        case "prix_desc":
          return b.prix_vente - a.prix_vente;
        case "dispo_desc":
          return b.disponible - a.disponible;
        default:
          return a.produit_nom.localeCompare(b.produit_nom, "fr");
      }
    });
  }, [catalogue.produits, categorie, recherche, tri]);

  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);
  const total = lignes.reduce((s, l) => s + l.quantite * l.prix_vente, 0);
  const q = recherche.trim();

  return (
    <div className="flex flex-col gap-5 py-6">
      <nav aria-label="Fil d'Ariane" className="text-libelle text-texte-discret">
        <Link to="/" className="font-semibold text-primaire">
          Boutiques
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{catalogue.boutique.nom}</span>
      </nav>
      <div>
        <h1 className="m-0 font-titre text-[1.875rem] font-extrabold tracking-[-0.02em] tablette:text-ecran">{catalogue.boutique.nom}</h1>
        {catalogue.boutique.adresse && <p className="m-0 mt-1 text-courant text-texte-discret">{catalogue.boutique.adresse}</p>}
      </div>

      <div className="grid gap-5 min-[60rem]:grid-cols-[minmax(0,1fr)_380px] min-[60rem]:items-start">
        <section aria-labelledby="titre-articles" className="flex flex-col gap-4">
          {categoriesVisibles.length > 0 && (
            <ChoixSegmente
              legende="Catégorie"
              options={[{ valeur: "tous", libelle: "Tous" }, ...categoriesVisibles.map((c) => ({ valeur: c.id, libelle: `${c.nom} (${c.nb_produits})` }))]}
              valeur={categorie}
              onChange={setCategorie}
            />
          )}
          <div className="grid grid-cols-1 gap-3 tablette:grid-cols-[minmax(0,1fr)_14rem] tablette:items-end">
            <Champ libelle="Rechercher un article" type="recherche" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            <Selecteur libelle="Trier les articles" options={TRIS} value={tri} onChange={(e) => setTri(e.target.value as Tri)} />
          </div>
          <h2 id="titre-articles" className="m-0 text-courant font-semibold text-texte-discret">
            {`${affiches.length} article${affiches.length > 1 ? "s" : ""}${q ? ` pour « ${q} »` : ""}`}
          </h2>
          {affiches.length === 0 ? (
            <EtatVide message="Aucun article" description="Aucun article ne correspond à ces critères." />
          ) : (
            <ul aria-label="Articles" className="m-0 grid list-none grid-cols-1 gap-3 p-0 min-[30rem]:grid-cols-2 bureau:grid-cols-3">
              {affiches.map((a) => {
                const auPanier = lignes.find((l) => l.produit_id === a.produit_id)?.quantite ?? 0;
                return (
                  <li key={a.produit_id} className="flex flex-col gap-2 rounded-carte bg-surface p-4 shadow-carte">
                    {/* Pas de cadre vide sans photo : sur téléphone, il doublerait la hauteur de la carte. */}
                    {a.produit_image && <img src={urlImage(a.produit_image)} alt="" className="aspect-[4/3] w-full rounded-bouton object-cover" />}
                    <h3 className="m-0 text-courant font-semibold">{a.produit_nom}</h3>
                    <p className="m-0 text-mention text-texte-discret">{[a.produit_reference, a.produit_code].filter(Boolean).join(" · ")}</p>
                    <p className="m-0 text-panneau font-bold tabular-nums">{formatMontant(a.prix_vente, monnaie)}</p>
                    <div className="flex flex-wrap gap-1">
                      {disponibilite(a.disponible)}
                      {auPanier > 0 && <Badge ton="info">{`${auPanier} au panier`}</Badge>}
                    </div>
                    <Bouton
                      variante={auPanier ? "secondaire" : "primaire"}
                      className="mt-auto"
                      aria-label={`Réserver ${a.produit_nom}`}
                      disabled={auPanier >= a.disponible}
                      onClick={() => ajouter(a)}
                    >
                      {auPanier ? "Ajouter encore" : "Réserver"}
                    </Bouton>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <Panier
          refPanier={panierRef}
          boutiqueId={boutiqueId}
          lignes={lignes}
          setLignes={setLignes}
          total={total}
          nbArticles={nbArticles}
        />
      </div>

      {/* Sous 960 px, le panier passe sous les articles : une barre fixe garde le total sous les yeux. */}
      {lignes.length > 0 && (
        <>
          <div className="h-20 min-[60rem]:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-bordure bg-surface pb-[env(safe-area-inset-bottom)] min-[60rem]:hidden">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
              <p className="m-0 flex-1 text-libelle" aria-live="polite">
                {`${nbArticles} article${nbArticles > 1 ? "s" : ""} · `}
                <strong className="tabular-nums">{formatMontant(total, monnaie)}</strong>
              </p>
              <Bouton onClick={() => panierRef.current?.scrollIntoView({ behavior: "smooth" })}>Voir ma réservation</Bouton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Panier({
  refPanier,
  boutiqueId,
  lignes,
  setLignes,
  total,
  nbArticles,
}: {
  refPanier: React.RefObject<HTMLElement | null>;
  boutiqueId: string;
  lignes: LignePanier[];
  setLignes: React.Dispatch<React.SetStateAction<LignePanier[]>>;
  total: number;
  nbArticles: number;
}) {
  const monnaie = useMonnaie();
  const { utilisateur } = useSession();
  const navigate = useNavigate();
  const reservation = useEcriture({ appel: creerReservation, invalide: [cles.catalogue(boutiqueId), cles.mesReservations] });
  const [f, setF] = useState({ nom: "", telephone: "", email: "", date: "" });
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  // Client connecté : son nom et son e-mail (la session ne porte pas le téléphone).
  useEffect(() => {
    if (utilisateur) setF((x) => ({ ...x, nom: x.nom || utilisateur.nom_complet, email: x.email || utilisateur.email }));
  }, [utilisateur]);

  function quantite(produitId: string, q: number) {
    setLignes((ls) => (q <= 0 ? ls.filter((l) => l.produit_id !== produitId) : ls.map((l) => (l.produit_id === produitId ? { ...l, quantite: q } : l))));
  }

  async function confirmer() {
    if (!f.nom.trim() || !f.telephone.trim()) return setErreur("Le nom et le téléphone sont requis");
    setErreur(null);
    const resultat = await reservation.envoyer({
      client_nom: f.nom.trim(),
      client_telephone: f.telephone.trim(),
      ...(f.email.trim() ? { client_email: f.email.trim() } : {}),
      boutique_id: boutiqueId,
      ...(f.date ? { date_retrait_prevue: f.date } : {}),
      lignes: lignes.map((l) => ({ produit_id: l.produit_id, quantite: l.quantite })),
    });
    if (resultat) {
      viderPanier(boutiqueId);
      navigate(`/reservations/${resultat.reservationId}`);
    }
  }

  return (
    <section ref={refPanier} aria-labelledby="titre-panier" className="scroll-mt-4 min-[60rem]:sticky min-[60rem]:top-4">
      <Carte>
        <div className="flex items-center justify-between gap-3">
          <h2 id="titre-panier" className="m-0 font-titre text-panneau font-bold">
            {`Réservation (${nbArticles} article${nbArticles > 1 ? "s" : ""})`}
          </h2>
          {lignes.length > 0 && (
            <Bouton variante="discret" onClick={() => setLignes([])}>
              Vider
            </Bouton>
          )}
        </div>
        {lignes.length === 0 ? (
          <div className="text-texte-discret">
            <p className="m-0">Votre panier est vide.</p>
            <p className="m-0">Sélectionnez un ou plusieurs articles pour réserver.</p>
          </div>
        ) : (
          <>
            <ul className="m-0 flex list-none flex-col p-0">
              {lignes.map((l) => (
                <li key={l.produit_id} className="flex flex-col gap-2 border-b border-bordure py-3 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{l.produit_nom}</span>
                    <span className="font-bold tabular-nums">{formatMontant(l.prix_vente * l.quantite, monnaie)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Quantite libelle={l.produit_nom} valeur={l.quantite} min={0} max={l.disponible} onChange={(q) => quantite(l.produit_id, q)} />
                    <span className="text-mention text-texte-discret">{`${formatMontant(l.prix_vente, monnaie)}/u`}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-baseline justify-between border-t-2 border-texte pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-chiffre font-bold tabular-nums" data-testid="total">
                {formatMontant(total, monnaie)}
              </span>
            </div>
            <Formulaire
              libelleEnvoyer={`Confirmer (${formatMontant(total, monnaie)})`}
              onEnvoyer={() => void confirmer()}
              erreur={erreur ?? reservation.erreur}
              enCours={reservation.enCours}
              desactivee={reservation.desactivee}
            >
              <Champ libelle="Nom complet" autoComplete="name" required value={f.nom} onChange={maj("nom")} />
              <Champ libelle="Téléphone" inputMode="tel" autoComplete="tel" required value={f.telephone} onChange={maj("telephone")} />
              <Champ libelle="E-mail (optionnel)" type="email" autoComplete="email" placeholder="Pour suivre vos réservations" value={f.email} onChange={maj("email")} />
              <Champ libelle="Date de retrait prévue (optionnel)" type="date" value={f.date} onChange={maj("date")} />
            </Formulaire>
          </>
        )}
        <p className="m-0 text-mention text-texte-discret">
          Aucun compte nécessaire : présentez-vous en boutique avec la référence pour régler et récupérer vos articles.
        </p>
      </Carte>
    </section>
  );
}
