import { BandeauHorsLigne, FournisseurSession, GardeProprietaire, MiseAJour } from "@multiboutique/front";
import { Outlet, type RouteObject } from "react-router";
import { CoqueVitrine } from "./coque/CoqueVitrine";
import { Accueil } from "./ecrans/Accueil";
import { Connexion } from "./ecrans/Connexion";
import { Inscription } from "./ecrans/Inscription";
import { Introuvable } from "./ecrans/Introuvable";
import { GardeClient } from "./session/GardeClient";
import { persistance } from "./hors-ligne/instance";

export const routes: RouteObject[] = [
  {
    element: (
      <FournisseurSession>
        <GardeProprietaire purger={persistance.purger} />
        <MiseAJour />
        <BandeauHorsLigne />
        <Outlet />
      </FournisseurSession>
    ),
    children: [
      {
        element: <CoqueVitrine />,
        children: [
          { index: true, element: <Accueil /> },
          { path: "connexion", element: <Connexion /> },
          { path: "inscription", element: <Inscription /> },
          {
            element: <GardeClient />,
            // L'espace client arrive à la tâche 8 du plan.
            children: [{ path: "espace", element: <h1>Mes réservations</h1> }],
          },
          { path: "*", element: <Introuvable /> },
        ],
      },
    ],
  },
];
