import { useSyncExternalStore } from "react";
import { Accueil } from "./ecrans/Accueil";
import { Catalogue } from "./ecrans/Catalogue";
import { NouvelleVente } from "./ecrans/NouvelleVente";
import { Stock } from "./ecrans/Stock";

// Routage par le fragment d'URL : trois écrans, pas besoin d'un routeur, et
// tout lien profond fonctionne sans configuration du serveur.
function abonner(rappel: () => void) {
  window.addEventListener("hashchange", rappel);
  return () => window.removeEventListener("hashchange", rappel);
}

function routeCourante() {
  return window.location.hash.replace(/^#/, "") || "/";
}

export function App() {
  const route = useSyncExternalStore(abonner, routeCourante);
  switch (route) {
    case "/vente":
      return <NouvelleVente />;
    case "/stock":
      return <Stock />;
    case "/catalogue":
      return <Catalogue />;
    default:
      return <Accueil />;
  }
}
