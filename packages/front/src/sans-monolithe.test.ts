// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Le monolithe Next a été retiré (phase 5) : il ne doit pas revenir, ni par ses
// dossiers, ni par une dépendance, ni par un import de Next ou de son alias « @/ ».
const RACINE = fileURLToPath(new URL("../../../", import.meta.url));
const fichiers = execFileSync("git", ["ls-files"], { cwd: RACINE, encoding: "utf8" }).split("\n").filter(Boolean);

const CHEMINS_DU_MONOLITHE = [/^app\//, /^components\//, /^lib\//, /^types\//, /^middleware\.ts$/, /^next\.config\./, /^next-env\.d\.ts$/];

describe("plus de monolithe", () => {
  it("aucun fichier du monolithe n'est suivi par Git", () => {
    expect(fichiers.filter((f) => CHEMINS_DU_MONOLITHE.some((m) => m.test(f)))).toEqual([]);
  });

  it("aucun package.json ne dépend de next", () => {
    const fautifs = fichiers
      .filter((f) => f.endsWith("package.json"))
      .filter((f) => {
        const p = JSON.parse(readFileSync(join(RACINE, f), "utf8"));
        return ["dependencies", "devDependencies", "peerDependencies"].some((c) => p[c] && "next" in p[c]);
      });
    expect(fautifs).toEqual([]);
  });

  it("aucun code n'importe next ou l'alias « @/ » du monolithe", () => {
    const code = fichiers.filter((f) => /\.(ts|tsx|mjs|js)$/.test(f) && !f.startsWith("docs/"));
    const fautifs = code.filter((f) => /from ["'](next(\/[^"']*)?|@\/[^"']*)["']/.test(readFileSync(join(RACINE, f), "utf8")));
    expect(fautifs).toEqual([]);
  });
});
