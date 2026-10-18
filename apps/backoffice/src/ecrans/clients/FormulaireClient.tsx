import type { Client, TypeClient } from "@multiboutique/shared";
import { CaseACocher, Champ, Selecteur } from "@multiboutique/ui";
import { useState, type ReactNode } from "react";
import type { ClientSaisi } from "../../api/clients";
import { Formulaire, lireNombre } from "@multiboutique/front";

interface Props {
  initial?: Client;
  libelleEnvoyer: string;
  enCours: boolean;
  desactivee: boolean;
  erreur: string | null;
  actions?: ReactNode;
  onEnvoyer: (client: ClientSaisi) => void;
}

/** Champs de ClientForm.tsx et du mode édition de ClientActions.tsx. */
export function FormulaireClient({ initial, libelleEnvoyer, enCours, desactivee, erreur, actions, onEnvoyer }: Props) {
  const [f, setF] = useState({
    nom: initial?.nom ?? "",
    telephone: initial?.telephone ?? "",
    email: initial?.email ?? "",
    adresse: initial?.adresse ?? "",
    type_client: (initial?.type_client ?? "grossiste") as TypeClient,
    plafond: initial ? String(initial.plafond_credit) : "",
    est_vip: initial?.est_vip ?? false,
  });
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value }));

  function envoyer() {
    if (!f.nom.trim()) return setErreurSaisie("Le nom est requis");
    // Vide : au comptant (0). Mal saisi : refusé, plutôt que de remettre le plafond à 0.
    const plafond = f.plafond.trim() ? lireNombre(f.plafond) : 0;
    if (!(plafond >= 0)) return setErreurSaisie("Le plafond de crédit doit être un nombre positif ou nul");
    setErreurSaisie(null);
    onEnvoyer({
      nom: f.nom,
      ...(f.telephone ? { telephone: f.telephone } : {}),
      ...(f.email ? { email: f.email } : {}),
      ...(f.adresse ? { adresse: f.adresse } : {}),
      type_client: f.type_client,
      plafond_credit: plafond,
      est_vip: f.est_vip,
    });
  }

  return (
    <Formulaire
      libelleEnvoyer={libelleEnvoyer}
      onEnvoyer={envoyer}
      erreur={erreurSaisie ?? erreur}
      enCours={enCours}
      desactivee={desactivee}
      actions={actions}
    >
      <Champ libelle="Nom" required value={f.nom} onChange={maj("nom")} />
      <Champ libelle="Téléphone" inputMode="tel" value={f.telephone} onChange={maj("telephone")} />
      <Champ libelle="E-mail" type="email" value={f.email} onChange={maj("email")} />
      <Champ libelle="Adresse" value={f.adresse} onChange={maj("adresse")} />
      <Selecteur
        libelle="Type de client"
        options={[
          { valeur: "grossiste", libelle: "Grossiste" },
          { valeur: "detaillant", libelle: "Détaillant" },
        ]}
        value={f.type_client}
        onChange={maj("type_client")}
      />
      <Champ libelle="Plafond de crédit (0 = au comptant)" type="montant" placeholder="0" value={f.plafond} onChange={maj("plafond")} />
      <CaseACocher
        libelle="Client VIP ★"
        aide="Paiement partiel autorisé à la vente (créance suivie au registre)"
        checked={f.est_vip}
        onChange={(e) => setF((x) => ({ ...x, est_vip: e.target.checked }))}
      />
    </Formulaire>
  );
}
