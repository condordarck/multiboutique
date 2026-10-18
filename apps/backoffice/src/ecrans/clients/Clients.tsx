import type { Client } from "@multiboutique/shared";
import { Badge, Bouton, Carte, Champ, Panneau, TuileChiffre } from "@multiboutique/ui";
import { clsx } from "clsx";
import { useState } from "react";
import { useParams } from "react-router";
import {
  basculerVip,
  creerClient,
  modifierClient,
  reglerEncours,
  toggleActifClient,
  useDossiersClients,
  useRegistre,
} from "../../api/clients";
import { useMonnaie } from "../../api/generales";
import { useBoutique } from "../../api/tableaux";
import { EnTeteEcran, formatMontant, formatNombre, Formulaire, lireNombre, ListeChargee, useEcriture, useSession } from "@multiboutique/front";
import { FormulaireClient } from "./FormulaireClient";

const somme = (clients: Client[], champ: "encours" | "plafond_credit") => clients.reduce((s, c) => s + (Number(c[champ]) || 0), 0);

/** Dossiers clients, crédit et encours (app/(dashboard)/dashboard/[boutiqueId]/clients/page.tsx). */
export function Clients() {
  const { boutiqueId = "" } = useParams();
  const { peut } = useSession();
  const monnaie = useMonnaie();
  const boutique = useBoutique(boutiqueId);
  const dossiers = useDossiersClients(boutiqueId);
  const [creation, setCreation] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const peutGerer = peut("clients:gerer");

  const clients = dossiers.data?.clients ?? [];
  const relances = (dossiers.data?.relances ?? []).flatMap((r) => {
    const c = clients.find((x) => x.id === r.client_id);
    return c ? [{ client: c, jours: r.jours }] : [];
  });
  const dossierOuvert = clients.find((c) => c.id === ouvert) ?? null;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <EnTeteEcran
        titre={`Clients — ${boutique.data?.nom ?? ""}`}
        sousTitre="Grossistes et détaillants : dossiers, crédit et encours"
        actions={peutGerer && <Bouton onClick={() => setCreation(true)}>Nouveau client</Bouton>}
      />
      <div className="grid grid-cols-2 gap-3 tablette:gap-4 bureau:grid-cols-4">
        <TuileChiffre libelle="Clients" valeur={formatNombre(clients.length)} />
        <TuileChiffre libelle="Encours total" valeur={formatMontant(somme(clients, "encours"), monnaie)} />
        <TuileChiffre libelle="Crédit plafonné alloué" valeur={formatMontant(somme(clients, "plafond_credit"), monnaie)} />
        <TuileChiffre libelle="Clients VIP" valeur={formatNombre(clients.filter((c) => c.est_vip).length)} />
      </div>

      {relances.length > 0 && (
        <section aria-labelledby="titre-relances" className="rounded-carte bg-danger-fond px-5 py-4 text-danger">
          <h2 id="titre-relances" className="m-0 text-courant font-bold">
            {`Relances — ${relances.length} client${relances.length > 1 ? "s" : ""} au-delà de ${dossiers.data?.delai_relance ?? 30} jours sans activité`}
          </h2>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
            {relances.map(({ client: c, jours }) => (
              <li key={c.id} className="flex justify-between gap-3 text-libelle">
                <span className="font-semibold">{c.nom}</span>
                <span className="tabular-nums">{`${formatMontant(c.encours, monnaie)} · ${jours} j`}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 text-mention">Délai configurable dans les paramètres généraux (administration).</p>
        </section>
      )}

      <Carte titre="Dossiers clients">
        {!peutGerer && (
          <p className="m-0 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle text-texte-discret">
            Lecture seule — modification réservée au gérant et au propriétaire.
          </p>
        )}
        <ListeChargee
          legende="Dossiers clients"
          requete={{ ...dossiers, data: dossiers.data?.clients }}
          cleLigne={(c) => c.id}
          vide="Aucun client, utilisez « Nouveau client » pour en créer un"
          colonnes={[
            {
              cle: "client",
              libelle: "Client",
              principale: true,
              rendu: (c) => (
                <span className="flex flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    {c.nom}
                    {c.est_vip && <Badge ton="alerte">VIP</Badge>}
                  </span>
                  <span className="text-mention font-normal text-texte-discret">
                    {[c.telephone, c.email].filter(Boolean).join(" · ")}
                  </span>
                </span>
              ),
            },
            { cle: "type", libelle: "Type", rendu: (c) => (c.type_client === "grossiste" ? "Grossiste" : "Détaillant") },
            { cle: "plafond", libelle: "Plafond", rendu: (c) => formatMontant(Number(c.plafond_credit) || 0, monnaie), alignement: "fin" },
            {
              cle: "encours",
              libelle: "Encours",
              alignement: "fin",
              rendu: (c) => {
                const encours = Number(c.encours) || 0;
                const plafond = Number(c.plafond_credit) || 0;
                if (encours <= 0) return "—";
                // À risque : 90 % du plafond atteint.
                return (
                  <span className={clsx("font-bold", plafond > 0 && encours >= plafond * 0.9 ? "text-danger" : "text-alerte")}>
                    {formatMontant(encours, monnaie)}
                  </span>
                );
              },
            },
            {
              cle: "disponible",
              libelle: "Disponible",
              alignement: "fin",
              rendu: (c) => {
                const plafond = Number(c.plafond_credit) || 0;
                return plafond > 0 ? formatMontant(Math.max(0, plafond - (Number(c.encours) || 0)), monnaie) : "Comptant";
              },
            },
            { cle: "statut", libelle: "Statut", rendu: (c) => (c.actif ? <Badge ton="succes">Actif</Badge> : <Badge ton="danger">Bloqué</Badge>) },
          ]}
          libelleAction="Dossier"
          action={(c) => (
            <Bouton variante="discret" aria-label={`Ouvrir le dossier de ${c.nom}`} onClick={() => setOuvert(c.id)}>
              Dossier
            </Bouton>
          )}
        />
      </Carte>

      {creation && <NouveauClient boutiqueId={boutiqueId} onFermer={() => setCreation(false)} />}
      {dossierOuvert && (
        <DossierClient boutiqueId={boutiqueId} client={dossierOuvert} peutGerer={peutGerer} onFermer={() => setOuvert(null)} />
      )}
    </div>
  );
}

function NouveauClient({ boutiqueId, onFermer }: { boutiqueId: string; onFermer: () => void }) {
  const creation = useEcriture({ appel: creerClient, invalide: [["boutiques", boutiqueId]], succes: "Client créé avec succès" });
  return (
    <Panneau ouvert titre="Nouveau client" onFermer={onFermer}>
      <FormulaireClient
        libelleEnvoyer="Créer le client"
        enCours={creation.enCours}
        desactivee={creation.desactivee}
        erreur={creation.erreur}
        onEnvoyer={async (c) => {
          if (await creation.envoyer({ ...c, boutiqueId })) onFermer();
        }}
      />
    </Panneau>
  );
}

const LIBELLES_REGISTRE = { vente: "Vente à crédit", versement: "Versement", annulation: "Annulation" };

/** Actions et registre de ClientActions.tsx, réunis dans le dossier du client. */
function DossierClient({
  boutiqueId,
  client: c,
  peutGerer,
  onFermer,
}: {
  boutiqueId: string;
  client: Client;
  peutGerer: boolean;
  onFermer: () => void;
}) {
  const monnaie = useMonnaie();
  const registre = useRegistre(boutiqueId, c.id);
  const invalide = [["boutiques", boutiqueId]];
  const ref = { boutiqueId, clientId: c.id };
  const vip = useEcriture({ appel: basculerVip, invalide });
  const activation = useEcriture({ appel: toggleActifClient, invalide });
  const modification = useEcriture({ appel: modifierClient, invalide, succes: "Client modifié" });
  const reglement = useEcriture({ appel: reglerEncours, invalide, succes: "Règlement enregistré" });
  const [edition, setEdition] = useState(false);
  const [montant, setMontant] = useState("");
  const [erreurMontant, setErreurMontant] = useState<string | null>(null);
  const encours = Number(c.encours) || 0;
  const plafond = Number(c.plafond_credit) || 0;
  const erreurAction = vip.erreur ?? activation.erreur;

  async function regler() {
    const m = lireNombre(montant);
    if (!m || m <= 0) return setErreurMontant("Montant invalide");
    setErreurMontant(null);
    if (await reglement.envoyer({ ...ref, montant: m })) setMontant("");
  }

  return (
    <Panneau ouvert titre={c.nom} onFermer={onFermer}>
      <div className="flex flex-col gap-5">
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
          {[
            ["Type", c.type_client === "grossiste" ? "Grossiste" : "Détaillant"],
            ["Statut", c.actif ? "Actif" : "Bloqué"],
            ["Encours", formatMontant(encours, monnaie)],
            ["Disponible", plafond > 0 ? formatMontant(Math.max(0, plafond - encours), monnaie) : "Comptant"],
            ["Téléphone", c.telephone || "—"],
            ["E-mail", c.email || "—"],
          ].map(([libelle, valeur]) => (
            <div key={libelle}>
              <dt className="text-mention text-texte-discret">{libelle}</dt>
              <dd className="m-0 font-semibold">{valeur}</dd>
            </div>
          ))}
        </dl>

        {peutGerer && !edition && (
          <div className="flex flex-wrap gap-2">
            <Bouton variante="secondaire" onClick={() => setEdition(true)}>
              Modifier
            </Bouton>
            <Bouton variante="secondaire" chargement={vip.enCours} disabled={vip.desactivee} onClick={() => void vip.envoyer(ref)}>
              {c.est_vip ? "Retirer le statut VIP" : "Marquer VIP"}
            </Bouton>
            <Bouton
              variante={c.actif ? "danger" : "secondaire"}
              chargement={activation.enCours}
              disabled={activation.desactivee}
              onClick={() => void activation.envoyer(ref)}
            >
              {c.actif ? "Désactiver" : "Réactiver"}
            </Bouton>
          </div>
        )}
        {erreurAction && (
          <p role="alert" className="m-0 font-semibold text-danger">
            {erreurAction}
          </p>
        )}

        {edition && (
          <FormulaireClient
            initial={c}
            libelleEnvoyer="Enregistrer"
            enCours={modification.enCours}
            desactivee={modification.desactivee}
            erreur={modification.erreur}
            actions={
              <Bouton variante="secondaire" onClick={() => setEdition(false)}>
                Annuler
              </Bouton>
            }
            onEnvoyer={async (donnees) => {
              if (await modification.envoyer({ ...donnees, ...ref })) setEdition(false);
            }}
          />
        )}

        {peutGerer && encours > 0 && !edition && (
          <Formulaire
            libelleEnvoyer="Enregistrer le règlement"
            onEnvoyer={() => void regler()}
            erreur={erreurMontant ?? reglement.erreur}
            enCours={reglement.enCours}
            desactivee={reglement.desactivee}
          >
            <Champ
              libelle="Montant réglé"
              type="montant"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              aide={`Encours : ${formatMontant(encours, monnaie)} ; au-delà de l'encours, seul l'encours est réglé.`}
            />
          </Formulaire>
        )}

        <section aria-labelledby="titre-registre" className="flex flex-col gap-2">
          <h3 id="titre-registre" className="m-0 font-titre text-courant font-bold">
            Registre des créances
          </h3>
          {registre.isPending ? (
            <p className="m-0 text-texte-discret">Chargement…</p>
          ) : !registre.data?.length ? (
            <p className="m-0 text-texte-discret">Aucune opération enregistrée.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {registre.data.map((l) => {
                const detail = l.type !== "versement" ? l.libelle.split("—")[1]?.trim() : undefined;
                return (
                  <li key={l.id} className="flex items-start justify-between gap-3 rounded-bouton bg-surface-relevee px-4 py-3 text-libelle">
                    <span className="flex flex-col">
                      <span className="font-semibold">{LIBELLES_REGISTRE[l.type] + (detail ? ` — ${detail}` : "")}</span>
                      <span className="text-mention text-texte-discret">
                        {new Date(l.createdAt).toLocaleString("fr-FR")}
                        {l.auteurNom ? ` · ${l.auteurNom}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-col items-end tabular-nums">
                      <span className={clsx("font-bold", l.montant > 0 ? "text-danger" : "text-succes")}>
                        {`${l.montant > 0 ? "+" : ""}${formatNombre(l.montant)}`}
                      </span>
                      <span className="text-mention text-texte-discret">{`Solde : ${formatNombre(l.soldeApres)}`}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Panneau>
  );
}
