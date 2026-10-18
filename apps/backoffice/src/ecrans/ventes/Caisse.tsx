import type { ModePaiement, ProduitBoutique } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, ChoixSegmente, EtatVide, Quantite, Selecteur } from "@multiboutique/ui";
import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { disponible, useProduits } from "../../api/catalogue";
import { useClientsActifs } from "../../api/clients";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { creerVente, LIBELLES_PAIEMENT } from "../../api/ventes";
import { EnTeteEcran } from "../../commun/EnTeteEcran";
import { formatMontant, formatNombre } from "../../commun/formats";
import { Lecture } from "../../commun/Lecture";
import { LienBouton } from "../../commun/LienBouton";
import { correspond } from "../../commun/recherche";
import { useEcriture } from "../../commun/useEcriture";
import { useSession, useUtilisateur } from "../../session/Session";
import { Ticket, type TicketProps } from "./Ticket";

const MODES: { valeur: ModePaiement; libelle: string }[] = [
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "mobile_money", libelle: "Mobile Money" },
  { valeur: "carte", libelle: "Carte" },
];

interface Ligne {
  produit: ProduitBoutique;
  quantite: number;
}

/** Montant saisi (virgule ou point décimal) ; 0 si vide ou invalide. */
const lireMontant = (texte: string) => Number(texte.replace(",", ".")) || 0;

/**
 * Caisse : la maquette « Nouvelle vente » avec toutes les fonctions de
 * components/dashboard/VenteForm.tsx (client et crédit, code promo, monnaie
 * rendue, reçu imprimable).
 */
export function Caisse() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const autorise = peut("ventes:creer");
  const produits = useProduits(boutiqueId);

  if (!autorise) {
    return (
      <EtatVide
        message="Encaissement non autorisé"
        description="Votre profil ne permet pas d'enregistrer des ventes."
      />
    );
  }
  return (
    <Lecture requete={produits}>
      {(liste) => <SaisieVente boutiqueId={boutiqueId} produits={liste} />}
    </Lecture>
  );
}

function SaisieVente({ boutiqueId, produits }: { boutiqueId: string; produits: ProduitBoutique[] }) {
  const utilisateur = useUtilisateur();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const clients = useClientsActifs(boutiqueId);
  const vente = useEcriture({
    appel: creerVente,
    invalide: [["boutiques", boutiqueId]],
  });

  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [mode, setMode] = useState<ModePaiement>("especes");
  const [clientId, setClientId] = useState("");
  const [montantPaye, setMontantPaye] = useState("");
  const [montantRecu, setMontantRecu] = useState("");
  const [codePromo, setCodePromo] = useState("");
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const [recu, setRecu] = useState<TicketProps | null>(null);
  const panierRef = useRef<HTMLDivElement>(null);

  const client = clients.data?.find((c) => c.id === clientId) ?? null;
  const total = useMemo(() => lignes.reduce((s, l) => s + l.quantite * Number(l.produit.prix_vente), 0), [lignes]);
  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);
  const reste = mode === "especes" ? lireMontant(montantRecu) - total : 0;
  const visibles = produits.filter((p) => correspond(`${p.produit_nom} ${p.produit_reference}`, recherche));

  function ajouter(p: ProduitBoutique) {
    setLignes((actuelles) => {
      const existante = actuelles.find((l) => l.produit.produit_id === p.produit_id);
      if ((existante?.quantite ?? 0) >= disponible(p)) return actuelles;
      if (existante) return actuelles.map((l) => (l === existante ? { ...l, quantite: l.quantite + 1 } : l));
      return [...actuelles, { produit: p, quantite: 1 }];
    });
  }

  function changerQuantite(produitId: string, quantite: number) {
    setLignes((a) => a.map((l) => (l.produit.produit_id === produitId ? { ...l, quantite } : l)));
  }

  function retirer(produitId: string) {
    setLignes((a) => a.filter((l) => l.produit.produit_id !== produitId));
  }

  function toutEffacer() {
    setLignes([]);
    setMontantRecu("");
    setMontantPaye("");
    setCodePromo("");
    setClientId("");
    setMode("especes");
    setErreurSaisie(null);
    setRecu(null);
    vente.reinitialiser();
  }

  async function encaisser() {
    // Contrôles de VenteForm, avant tout appel.
    if (lignes.length === 0) return setErreurSaisie("Ajoutez au moins un article au panier");
    const paye = lireMontant(montantPaye);
    if (clientId && paye <= 0) return setErreurSaisie("Indiquez le montant payé par le client");
    if (!clientId && mode === "especes" && !codePromo.trim() && reste < 0) {
      return setErreurSaisie(`Montant reçu insuffisant (il manque ${formatMontant(-reste, monnaie)})`);
    }
    setErreurSaisie(null);

    const promo = codePromo.trim();
    const resultat = await vente.envoyer({
      boutiqueId,
      mode_paiement: mode,
      ...(promo ? { code_promo: promo } : {}),
      ...(clientId ? { client_id: clientId, montant_paye: paye } : {}),
      lignes: lignes.map((l) => ({
        produit_id: l.produit.produit_id,
        quantite: l.quantite,
        prix_unitaire: Number(l.produit.prix_vente),
      })),
    });
    if (!resultat) return;
    setRecu({
      boutique: boutique.data ?? { nom: "" },
      reference: resultat.reference,
      date: new Date().toLocaleString("fr-FR"),
      vendeur: utilisateur.nom_complet,
      paiement: LIBELLES_PAIEMENT[mode] ?? mode,
      client: client?.nom ?? null,
      lignes: lignes.map((l) => ({
        nom: l.produit.produit_nom,
        code: l.produit.produit_code || l.produit.produit_reference,
        quantite: l.quantite,
        prix: Number(l.produit.prix_vente),
      })),
      monnaie,
      total: resultat.montantTotal,
      remise: resultat.remise,
      codePromo: promo || undefined,
      ...(client
        ? { paye, reste: resultat.reste }
        : mode === "especes"
          ? { rendu: lireMontant(montantRecu) - resultat.montantTotal }
          : {}),
    });
  }

  if (recu) {
    return (
      <div className="flex flex-col gap-5 pb-6">
        <EnTeteEcran
          titre="Vente enregistrée"
          actions={
            <>
              <Bouton onClick={() => window.print()}>Imprimer le reçu</Bouton>
              <Bouton variante="secondaire" onClick={toutEffacer}>
                Nouvelle vente
              </Bouton>
            </>
          }
        />
        <Ticket {...recu} />
      </div>
    );
  }

  const erreur = erreurSaisie ?? vente.erreur;

  return (
    <div className="flex flex-col gap-5 pb-6">
      <EnTeteEcran
        titre="Nouvelle vente"
        actions={<LienBouton to={`/b/${boutiqueId}/ventes`}>Historique</LienBouton>}
      />
      <div className="grid gap-5 min-[60rem]:grid-cols-[minmax(0,1fr)_380px] min-[60rem]:items-start">
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
            {visibles.map((p) => {
              const dispo = disponible(p);
              const auPanier = lignes.find((l) => l.produit.produit_id === p.produit_id)?.quantite ?? 0;
              const seuil = Number(p.seuil_alerte ?? 0);
              return (
                <li key={p.produit_id}>
                  <button
                    type="button"
                    onClick={() => ajouter(p)}
                    disabled={auPanier >= dispo}
                    className="flex min-h-28 w-full flex-col items-start gap-1.5 rounded-carte bg-surface p-4 text-left shadow-carte enabled:hover:bg-surface-relevee disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <span className="text-courant font-semibold text-texte">{p.produit_nom}</span>
                    <span className="text-courant font-bold tabular-nums text-texte">{formatMontant(p.prix_vente, monnaie)}</span>
                    {dispo <= 0 ? (
                      <Badge ton="danger">Rupture</Badge>
                    ) : dispo <= seuil ? (
                      <Badge ton="alerte">{`Plus que ${formatNombre(dispo)}`}</Badge>
                    ) : (
                      <span className="text-mention text-texte-discret">{`${formatNombre(dispo)} dispo.`}</span>
                    )}
                    {auPanier > 0 && <Badge ton="info">{`${auPanier} au panier`}</Badge>}
                  </button>
                </li>
              );
            })}
          </ul>
          {visibles.length === 0 && (
            <EtatVide
              message="Aucun produit trouvé"
              description={recherche ? `Rien ne correspond à « ${recherche} ».` : "Aucun produit n'a de prix dans cette boutique."}
            />
          )}
        </section>

        <div ref={panierRef} className="scroll-mt-4 min-[60rem]:sticky min-[60rem]:top-4">
          <Carte
            titre="Panier"
            action={
              lignes.length > 0 && (
                <Bouton variante="discret" onClick={toutEffacer}>
                  Tout effacer
                </Bouton>
              )
            }
          >
            {lignes.length === 0 ? (
              <EtatVide message="Panier vide" description="Touchez un produit pour l'ajouter." />
            ) : (
              <ul className="m-0 flex list-none flex-col p-0">
                {lignes.map(({ produit: p, quantite }) => (
                  <li key={p.produit_id} className="flex flex-col gap-2 border-b border-bordure py-3 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{p.produit_nom}</span>
                      <span className="font-bold tabular-nums">{formatMontant(quantite * Number(p.prix_vente), monnaie)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Quantite
                        libelle={p.produit_nom}
                        valeur={quantite}
                        max={disponible(p)}
                        onChange={(q) => changerQuantite(p.produit_id, q)}
                      />
                      <Bouton variante="discret" aria-label={`Retirer ${p.produit_nom} du panier`} onClick={() => retirer(p.produit_id)}>
                        Retirer
                      </Bouton>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-baseline justify-between border-t-2 border-texte pt-3">
              <span className="text-courant font-semibold">Total</span>
              <span className="text-chiffre font-bold tabular-nums" data-testid="total">
                {formatMontant(total, monnaie)}
              </span>
            </div>

            <Selecteur
              libelle="Client (facultatif)"
              optionVide="— Vente comptant —"
              aide="Renseignez un client pour accepter un paiement partiel (crédit)."
              options={(clients.data ?? []).map((c) => ({
                valeur: c.id,
                libelle: Number(c.encours) > 0 ? `${c.nom} (encours : ${formatNombre(c.encours)})` : c.nom,
              }))}
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setMontantPaye("");
              }}
            />
            {clientId && (
              <Champ
                libelle="Montant payé"
                type="montant"
                value={montantPaye}
                onChange={(e) => setMontantPaye(e.target.value)}
                aide={`La différence (${formatMontant(total, monnaie)} au total) sera portée au crédit du client.`}
              />
            )}

            <ChoixSegmente legende="Mode de paiement" legendeVisible options={MODES} valeur={mode} onChange={setMode} />

            {mode === "especes" && !clientId && (
              <div className="flex flex-col gap-1.5">
                <Champ
                  libelle={`Montant reçu (${monnaie})`}
                  type="montant"
                  value={montantRecu}
                  onChange={(e) => setMontantRecu(e.target.value)}
                />
                <p aria-live="polite" className={`m-0 text-libelle font-semibold ${reste < 0 ? "text-danger" : "text-succes"}`}>
                  {reste < 0 ? `Manque ${formatMontant(-reste, monnaie)}` : `Rendu : ${formatMontant(reste, monnaie)}`}
                </p>
              </div>
            )}

            <Champ
              libelle="Code promo (optionnel)"
              placeholder="Ex : GROSSISTE10"
              value={codePromo}
              onChange={(e) => setCodePromo(e.target.value.toUpperCase())}
            />

            {erreur && (
              <p role="alert" className="m-0 rounded-bouton bg-danger-fond px-4 py-3 font-semibold text-danger">
                {erreur}
              </p>
            )}
            {vente.desactivee && (
              <p className="m-0 text-mention font-semibold text-alerte">Hors ligne : l'encaissement reprendra avec la connexion.</p>
            )}
            <Bouton
              grand
              className="w-full"
              chargement={vente.enCours}
              disabled={lignes.length === 0 || vente.desactivee}
              onClick={() => void encaisser()}
            >
              {`Encaisser ${formatMontant(total, monnaie)}`}
            </Bouton>
          </Carte>
        </div>
      </div>

      {/* Sous 960 px, le panier passe sous les produits : une barre fixe garde
          le total sous les yeux et y ramène d'un geste (maquette). */}
      {lignes.length > 0 && (
        <>
          <div className="h-20 min-[60rem]:hidden" />
          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-bordure bg-surface tablette:bottom-0 tablette:left-[104px] min-[60rem]:hidden">
            <div className="flex items-center gap-4 px-4 py-3">
              <p className="m-0 flex-1 text-libelle" aria-live="polite">
                {nbArticles} article{nbArticles > 1 ? "s" : ""} · <strong className="tabular-nums">{formatMontant(total, monnaie)}</strong>
              </p>
              <Bouton onClick={() => panierRef.current?.scrollIntoView({ behavior: "smooth" })}>Voir le panier</Bouton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
