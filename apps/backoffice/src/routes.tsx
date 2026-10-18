import { EtatVide } from "@multiboutique/ui";
import { Outlet, type RouteObject } from "react-router";
import { CoqueAdmin } from "./coque/CoqueAdmin";
import { CoqueBackoffice } from "./coque/CoqueBackoffice";
import { Accueil } from "./ecrans/Accueil";
import { Connexion } from "./ecrans/Connexion";
import { Produits } from "./ecrans/catalogue/Produits";
import { Stock } from "./ecrans/catalogue/Stock";
import { Introuvable } from "./ecrans/Introuvable";
import { Consolidation } from "./ecrans/tableaux/Consolidation";
import { TableauDeBord } from "./ecrans/tableaux/TableauDeBord";
import { VueBoutique } from "./ecrans/tableaux/VueBoutique";
import { Caisse } from "./ecrans/ventes/Caisse";
import { DetailVente } from "./ecrans/ventes/DetailVente";
import { Ventes } from "./ecrans/ventes/Ventes";
import { GardeSession } from "./session/GardeSession";
import { FournisseurSession } from "./session/Session";

const sectionIntrouvable = <EtatVide message="Page introuvable" description="Cette section n'existe pas." />;

/** Écrans d'une boutique, sous /b/:boutiqueId. */
export const routesBoutique: RouteObject[] = [
  { index: true, element: <VueBoutique /> },
  { path: "ventes", element: <Ventes /> },
  { path: "ventes/nouvelle", element: <Caisse /> },
  { path: "ventes/:venteId", element: <DetailVente /> },
  { path: "produits", element: <Produits /> },
  { path: "stock", element: <Stock /> },
  { path: "*", element: sectionIntrouvable },
];

/** Écrans de l'administration, sous /admin. */
export const routesAdmin: RouteObject[] = [{ path: "*", element: sectionIntrouvable }];

export const routes: RouteObject[] = [
  {
    element: (
      <FournisseurSession>
        <Outlet />
      </FournisseurSession>
    ),
    children: [
      { path: "/connexion", element: <Connexion /> },
      {
        element: <GardeSession />,
        children: [
          { index: true, element: <Accueil /> },
          {
            element: <CoqueBackoffice />,
            children: [
              { path: "tableau-de-bord", element: <TableauDeBord /> },
              { path: "consolidation", element: <Consolidation /> },
              { path: "b/:boutiqueId", children: routesBoutique },
            ],
          },
          { path: "admin", element: <CoqueAdmin />, children: routesAdmin },
        ],
      },
      { path: "*", element: <Introuvable /> },
    ],
  },
];
