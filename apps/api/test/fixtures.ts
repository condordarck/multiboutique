import { tmpdir } from "node:os";
import type { Config } from "../src/config";

export const ORIGINES = {
  www: "https://www.exemple.test",
  backoffice: "https://backoffice.exemple.test",
} as const;

export const CONFIG_TEST: Config = {
  port: 0,
  databaseUrl: "inutilisee-par-les-tests",
  jwtSecret: "s".repeat(64),
  origines: { ...ORIGINES },
  uploadsDir: tmpdir(),
};

/** En-têtes d'une requête venant d'un front : Origin et, pour une écriture, JSON. */
export function depuis(audience: keyof typeof ORIGINES, cookie?: string) {
  return {
    origin: ORIGINES[audience],
    ...(cookie ? { cookie } : {}),
  };
}
