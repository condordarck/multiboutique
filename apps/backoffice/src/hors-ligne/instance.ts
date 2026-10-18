import { creerPersistance } from "@multiboutique/front";

/** La persistance de l'application (une seule base IndexedDB par origine). */
export const persistance = creerPersistance();
