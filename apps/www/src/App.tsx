import { creerApplication } from "@multiboutique/front";
import { persistance } from "./hors-ligne/instance";
import { routes } from "./routes";

export { routes };

export const App = creerApplication(routes, persistance);
