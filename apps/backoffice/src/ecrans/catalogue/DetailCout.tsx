import { calculerCoutRevient, montantFrais, type DetailCout, type ModeFrais, type ProduitBoutique, type TypeFrais } from "@multiboutique/shared";
import { Bouton, Champ, Selecteur } from "@multiboutique/ui";
import { formatMontant, formatPourcentage, lireNombre } from "@multiboutique/front";

export interface FraisEnSaisie {
  type_frais_id: string;
  mode: ModeFrais;
  valeur: string;
}

/** Saisie du coût de revient détaillé : textes bruts, lus à l'envoi. */
export interface SaisieCout {
  prixAchat: string;
  frais: FraisEnSaisie[];
}

const MODES = [
  { valeur: "montant", libelle: "Montant" },
  { valeur: "pourcentage", libelle: "% de l'achat" },
];

/** Saisie initiale : le détail enregistré, vide si le coût a été saisi d'un seul montant. */
export function saisieDe(produit?: ProduitBoutique): SaisieCout {
  return {
    prixAchat: produit?.prix_achat != null ? String(produit.prix_achat) : "",
    frais: (produit?.frais ?? []).map((f) => ({ type_frais_id: f.type_frais_id, mode: f.mode, valeur: String(f.valeur) })),
  };
}

/**
 * Détail à envoyer. Sans prix d'achat ni frais : aucun détail (undefined) ;
 * une saisie invalide : un message, rien n'est envoyé.
 */
export function lireDetail(saisie: SaisieCout): { detail?: DetailCout; erreur?: string } {
  if (!saisie.prixAchat.trim() && saisie.frais.length === 0) return {};
  const prixAchat = lireNombre(saisie.prixAchat);
  if (!(prixAchat >= 0)) return { erreur: "Le prix d'achat doit être un nombre positif ou nul" };
  const frais = [];
  for (const f of saisie.frais) {
    if (!f.type_frais_id) return { erreur: "Choisissez le type de chaque frais" };
    const valeur = lireNombre(f.valeur);
    if (!(valeur >= 0)) return { erreur: "Chaque frais doit avoir une valeur positive ou nulle" };
    frais.push({ type_frais_id: f.type_frais_id, mode: f.mode, valeur });
  }
  return { detail: { prix_achat: prixAchat, frais } };
}

/** Prix d'achat et frais, puis coût de revient, bénéfice et marge calculés en direct. */
export function DetailCoutRevient({
  saisie,
  onSaisie,
  typesFrais,
  prixVente,
  coutActuel,
  monnaie,
}: {
  saisie: SaisieCout;
  onSaisie: (saisie: SaisieCout) => void;
  typesFrais: TypeFrais[];
  /** Prix de vente saisi, texte brut. */
  prixVente: string;
  /** Coût enregistré sans détail, conservé tant que le détail reste vide. */
  coutActuel?: number | null;
  monnaie: string;
}) {
  const majFrais = (index: number, champ: Partial<FraisEnSaisie>) =>
    onSaisie({ ...saisie, frais: saisie.frais.map((f, i) => (i === index ? { ...f, ...champ } : f)) });
  const retirer = (index: number) => onSaisie({ ...saisie, frais: saisie.frais.filter((_, i) => i !== index) });
  const choisis = new Set(saisie.frais.map((f) => f.type_frais_id));
  const disponibles = typesFrais.filter((t) => t.actif && !choisis.has(t.id));
  const libelle = (id: string) => typesFrais.find((t) => t.id === id)?.libelle ?? "frais";

  const achat = lireNombre(saisie.prixAchat);
  const vide = !saisie.prixAchat.trim() && saisie.frais.length === 0;
  const fraisLus = saisie.frais.map((f) => ({ mode: f.mode, valeur: lireNombre(f.valeur) }));
  const calculable = achat >= 0 && fraisLus.every((f) => f.valeur >= 0);
  const cout = vide ? (coutActuel ?? null) : calculable ? calculerCoutRevient(achat, fraisLus) : null;
  const prix = lireNombre(prixVente);
  const benefice = cout != null && prix > 0 ? Math.round((prix - cout) * 100) / 100 : null;

  return (
    // Deux colonnes au plus, quelle que soit la largeur de l'écran : le panneau reste étroit.
    // min-w-0 : un fieldset garde sinon la largeur de son contenu et déborde du panneau.
    <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-carte border border-bordure p-4">
      <legend className="px-1 text-libelle font-semibold text-texte">Coût de revient</legend>
      <Champ
        libelle="Prix d'achat (par unité)"
        type="montant"
        value={saisie.prixAchat}
        onChange={(e) => onSaisie({ ...saisie, prixAchat: e.target.value })}
        aide={vide && coutActuel != null ? `Coût actuel ${formatMontant(coutActuel, monnaie)}, saisi sans détail : conservé si vous laissez vide.` : undefined}
      />
      {saisie.frais.map((f, i) => (
        <div key={i} className="grid grid-cols-2 items-end gap-3 border-t border-bordure pt-3">
          <Selecteur
            libelle={`Frais n°${i + 1}`}
            optionVide="Choisir…"
            // Le type déjà choisi reste dans la liste, même désactivé depuis.
            options={typesFrais
              .filter((t) => t.id === f.type_frais_id || (t.actif && !choisis.has(t.id)))
              .map((t) => ({ valeur: t.id, libelle: t.actif ? t.libelle : `${t.libelle} (désactivé)` }))}
            value={f.type_frais_id}
            onChange={(e) => majFrais(i, { type_frais_id: e.target.value })}
          />
          <Selecteur
            libelle={`Calcul du frais n°${i + 1}`}
            options={MODES}
            value={f.mode}
            onChange={(e) => majFrais(i, { mode: e.target.value as ModeFrais })}
          />
          <Champ
            libelle={f.mode === "pourcentage" ? `Taux du frais n°${i + 1} (%)` : `Montant du frais n°${i + 1}`}
            type="montant"
            value={f.valeur}
            onChange={(e) => majFrais(i, { valeur: e.target.value })}
            aide={f.mode === "pourcentage" && achat >= 0 && lireNombre(f.valeur) >= 0 ? `= ${formatMontant(montantFrais(achat, { mode: f.mode, valeur: lireNombre(f.valeur) }), monnaie)}` : undefined}
          />
          <Bouton variante="discret" aria-label={`Retirer le frais ${f.type_frais_id ? libelle(f.type_frais_id) : `n°${i + 1}`}`} onClick={() => retirer(i)}>
            Retirer
          </Bouton>
        </div>
      ))}
      <div>
        <Bouton
          variante="secondaire"
          disabled={disponibles.length === 0}
          title={disponibles.length === 0 ? "Tous les types de frais sont déjà utilisés" : undefined}
          onClick={() => onSaisie({ ...saisie, frais: [...saisie.frais, { type_frais_id: disponibles[0]?.id ?? "", mode: "montant", valeur: "" }] })}
        >
          Ajouter un frais
        </Bouton>
      </div>
      <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-bordure pt-3 text-libelle" aria-live="polite">
        <dt className="text-texte-discret">Coût de revient</dt>
        <dd className="m-0 text-right font-semibold tabular-nums">{cout != null ? formatMontant(cout, monnaie) : "—"}</dd>
        <dt className="text-texte-discret">Bénéfice par unité</dt>
        <dd className={`m-0 text-right font-semibold tabular-nums${benefice != null && benefice < 0 ? " text-danger" : ""}`}>
          {benefice != null ? formatMontant(benefice, monnaie) : "—"}
        </dd>
        <dt className="text-texte-discret">Marge (sur le coût)</dt>
        <dd className="m-0 text-right font-semibold tabular-nums">{benefice != null && cout ? formatPourcentage((benefice / cout) * 100) : "—"}</dd>
      </dl>
    </fieldset>
  );
}
