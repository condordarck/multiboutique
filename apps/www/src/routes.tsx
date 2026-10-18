import { BandeauHorsLigne, FournisseurSession, GardeProprietaire, MiseAJour } from "@multiboutique/front";
import { Outlet, type RouteObject } from "react-router";
import { CoqueVitrine } from "./coque/CoqueVitrine";
import { Introuvable } from "./ecrans/Introuvable";
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
        children: [{ path: "*", element: <Introuvable /> }],
      },
    ],
  },
];
