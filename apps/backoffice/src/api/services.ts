import { SERVICES_CATALOGUE } from "./catalogue";
import { SERVICES_VENTES } from "./ventes";

/**
 * Table des appels d'écriture du backoffice : nom du service de
 * @multiboutique/metier → fonction qui appelle sa route. La garde de
 * complétude (src/completude.test.ts) vérifie qu'aucun service n'y manque.
 */
export const SERVICES: Record<string, (...args: never[]) => Promise<unknown>> = {
  ...SERVICES_VENTES,
  ...SERVICES_CATALOGUE,
};
