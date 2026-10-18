import { Lecture, useParametres } from "@multiboutique/front";
import { EtatVide } from "@multiboutique/ui";
import { clsx } from "clsx";
import { Link } from "react-router";
import { useBoutiquesPubliques } from "../api/vitrine";

/** app/page.tsx et (public)/boutique/page.tsx, réunis : la vitrine et ses boutiques. */
export function Accueil() {
  const nom = useParametres().data?.nom_application ?? "MultiBoutique";
  const boutiques = useBoutiquesPubliques();

  return (
    <div className="flex flex-col gap-8 py-8">
      <section className="flex flex-col gap-3 rounded-carte bg-primaire px-6 py-10 text-sur-primaire tablette:px-10">
        <h1 className="m-0 font-titre text-[2.25rem] font-extrabold tracking-[-0.02em] tablette:text-accueil">{nom}</h1>
        <p className="m-0 max-w-2xl text-courant">
          Choisissez une boutique pour consulter le catalogue et réserver vos articles, à retirer et régler en boutique.
        </p>
        {boutiques.data && (
          <p className="m-0 text-libelle font-semibold">{`${boutiques.data.length} boutique${boutiques.data.length > 1 ? "s" : ""}`}</p>
        )}
      </section>

      <section aria-labelledby="titre-boutiques" className="flex flex-col gap-4">
        <h2 id="titre-boutiques" className="m-0 font-titre text-panneau font-bold">
          Nos boutiques
        </h2>
        <Lecture requete={boutiques}>
          {(liste) =>
            liste.length === 0 ? (
              <EtatVide message="Aucune boutique disponible pour le moment" />
            ) : (
              <ul aria-label="Nos boutiques" className="m-0 grid list-none grid-cols-1 gap-4 p-0 tablette:grid-cols-2 bureau:grid-cols-3">
                {liste.map((b) => (
                  <li key={b.id}>
                    <Link
                      to={`/boutiques/${b.id}`}
                      className={clsx(
                        "flex h-full flex-col gap-1 rounded-carte bg-surface p-5 text-texte no-underline shadow-carte hover:bg-surface-relevee",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      )}
                    >
                      <span className="font-titre text-panneau font-bold">{b.nom}</span>
                      {b.adresse && <span className="text-libelle text-texte-discret">{b.adresse}</span>}
                      {b.telephone && <span className="text-libelle text-texte-discret">{b.telephone}</span>}
                      <span className="mt-2 font-semibold text-primaire">Voir le catalogue</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        </Lecture>
      </section>
    </div>
  );
}
