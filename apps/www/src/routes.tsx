import { BandeauHorsLigne, FournisseurSession, GardeProprietaire, MiseAJour } from "@multiboutique/front";
import { Outlet, type RouteObject } from "react-router";
import { CoqueVitrine } from "./coque/CoqueVitrine";
import { Accueil } from "./ecrans/Accueil";
import { Catalogue } from "./ecrans/catalogue/Catalogue";
import { Connexion } from "./ecrans/Connexion";
import { Inscription } from "./ecrans/Inscription";
import { Espace } from "./ecrans/Espace";
import { Introuvable } from "./ecrans/Introuvable";
import { Reservation } from "./ecrans/Reservation";
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
          { path: "boutiques/:boutiqueId", element: <Catalogue /> },
          { path: "reservations/:reservationId", element: <Reservation /> },
          { path: "connexion", element: <Connexion /> },
          { path: "inscription", element: <Inscription /> },
          {
            element: <GardeClient />,
            children: [{ path: "espace", element: <Espace /> }],
          },
          { path: "*", element: <Introuvable /> },
        ],
      },
    ],
  },
];
