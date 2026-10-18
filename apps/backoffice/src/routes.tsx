import { EtatVide } from "@multiboutique/ui";
import { Outlet, type RouteObject } from "react-router";
import { CoqueAdmin } from "./coque/CoqueAdmin";
import { CoqueBackoffice } from "./coque/CoqueBackoffice";
import { Accueil } from "./ecrans/Accueil";
import { Connexion } from "./ecrans/Connexion";
import { Introuvable } from "./ecrans/Introuvable";
import { GardeSession } from "./session/GardeSession";
import { FournisseurSession } from "./session/Session";

const sectionIntrouvable = <EtatVide message="Page introuvable" description="Cette section n'existe pas." />;

/** Écrans d'une boutique, sous /b/:boutiqueId. */
export const routesBoutique: RouteObject[] = [{ path: "*", element: sectionIntrouvable }];

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
            children: [{ path: "b/:boutiqueId", children: routesBoutique }],
          },
          { path: "admin", element: <CoqueAdmin />, children: routesAdmin },
        ],
      },
      { path: "*", element: <Introuvable /> },
    ],
  },
];
