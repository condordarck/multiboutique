import axe from "axe-core";
import { expect } from "vitest";

/** Échoue en nommant les règles violées. Le contraste est vérifié par les tests
 *  des tokens : jsdom ne calcule pas les couleurs. */
export async function sansViolation(conteneur: Element) {
  const resultat = await axe.run(conteneur, { rules: { "color-contrast": { enabled: false } } });
  expect(resultat.violations.map((v) => `${v.id} : ${v.help}`)).toEqual([]);
}
