import { EtatVide } from "@multiboutique/ui";
import { Outlet, type RouteObject } from "react-router";
import { CoqueAdmin } from "./coque/CoqueAdmin";
import { CoqueBackoffice } from "./coque/CoqueBackoffice";
import { Accueil } from "./ecrans/Accueil";
import { Connexion } from "./ecrans/Connexion";
import { Produits } from "./ecrans/catalogue/Produits";
import { Stock } from "./ecrans/catalogue/Stock";
import { Clients } from "./ecrans/clients/Clients";
import { Promotions } from "./ecrans/clients/Promotions";
import { Commandes } from "./ecrans/commandes/Commandes";
import { Reservations } from "./ecrans/commandes/Reservations";
import { Achats } from "./ecrans/achats/Achats";
import { PrixConseilles } from "./ecrans/achats/PrixConseilles";
import { Introuvable } from "./ecrans/Introuvable";
import { Rapports } from "./ecrans/rapports/Rapports";
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
  { path: "clients", element: <Clients /> },
  { path: "promotions", element: <Promotions /> },
  { path: "commandes", element: <Commandes /> },
  { path: "reservations", element: <Reservations /> },
  { path: "achats", element: <Achats /> },
  { path: "prix-conseilles", element: <PrixConseilles /> },
  { path: "rapports", element: <Rapports /> },
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
