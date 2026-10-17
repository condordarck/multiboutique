# Phases 0 et 1 : monorepo et design system — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Poser le monorepo (workspaces, code partagé, squelettes d'API et des deux PWA,
CI et publication des fronts sur Cloudflare Pages en recette), puis créer l'identité
visuelle et le design system, validés sur trois maquettes avant tout développement
d'écran.

**Architecture :** Le monolithe Next.js **reste à la racine et continue d'être déployé**
sans changement visible jusqu'à la phase 5. Les workspaces `apps/*` et `packages/*`
s'ajoutent à côté. Le monolithe consomme déjà `packages/shared` (types et permissions),
ce qui prouve le câblage des workspaces et évite toute duplication pendant la migration.

**Tech Stack :** npm workspaces, TypeScript 5, Vite 7, React 19, Tailwind CSS 4
(`@tailwindcss/vite`), Fastify 5, Vitest 3, Testing Library, wrangler (Cloudflare Pages),
GitHub Actions. Prendre la dernière version stable de chaque paquet au moment de
l'exécution (`npm view <paquet> version`) ; le lockfile les épingle.

**Spec :** `docs/superpowers/specs/2026-10-17-separation-front-api-pwa-design.md`

## Global Constraints

- **Le monolithe ne doit pas bouger.** À la fin de chaque tâche : `npm run build` à la
  racine passe, et l'image Docker du monolithe se construit (`docker build -t mb-test .`).
  Le job `deploy-recette` existant reste intact.
- **Tests :** Vitest, introduit par ce plan. Chaque tâche suit rouge → vert : écrire le
  test, le voir échouer, implémenter, le voir passer. Pour la configuration pure
  (workspaces, CI), le « test » est une commande de vérification lancée avant et après.
- **Code partagé consommé en source TypeScript** : `packages/*` exposent `src/index.ts`
  via `exports`, sans étape de build. Vite le compile nativement ; Next.js via
  `transpilePackages` ; l'API via son bundler (phase 2).
- **Nommage :** code, messages et commits en français ; commits au format
  `Préfixe : description`, terminés par la ligne `Co-Authored-By` en vigueur.
- **Noms des projets Cloudflare Pages :** un projet par front **et par environnement**,
  pour qu'un déploiement de recette ne puisse jamais toucher la production :
  `mb-www-recette`, `mb-backoffice-recette`, `mb-maquettes`. Production (plus tard) :
  `mb-www`, `mb-backoffice`.
- **Domaines de recette :** `www.morpion.cloud`, `backoffice.morpion.cloud`,
  `maquettes.morpion.cloud` (`api.morpion.cloud` arrive en phase 2).
- **Points d'arrêt :** les tâches 7 et 13 attendent une décision de l'utilisateur. Ne pas
  les franchir sans sa réponse.

## Review Focus

1. **Installation Docker avec workspaces** : `npm ci` échoue si le lockfile référence
   des workspaces dont les `package.json` ne sont pas copiés dans l'étape `deps`. →
   Tâche 1, étape 5.
2. **Typecheck du monolithe qui avale les apps** : `tsconfig.json` racine inclut
   `**/*.ts` ; sans exclusion, `next build` type-checke les apps Vite avec une
   configuration qui n'est pas la leur. → Tâche 1, étape 3.
3. **Permissions dupliquées qui divergent** : après la tâche 2, il ne doit exister
   qu'une seule matrice. → Tâche 2, étape 7.
4. **Recette indexée par erreur** : chaque front de recette sert
   `X-Robots-Tag: noindex`. → Tâche 4, étape 4, et Tâche 6, étape 5.
5. **Contraste insuffisant en thème sombre** : chaque paire texte/fond des tokens est
   vérifiée par un test, dans les deux thèmes. → Tâche 8.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `package.json` | *Modifié.* Déclare les workspaces, scripts `test` | 1 |
| `tsconfig.json` | *Modifié.* Exclut `apps/` et `packages/` | 1 |
| `Dockerfile` | *Modifié.* Copie les manifestes des workspaces avant `npm ci` | 1 |
| `tsconfig.base.json` | *Créé.* Options communes aux workspaces | 1 |
| `packages/shared/` | *Créé.* Types métier, matrice de permissions | 2 |
| `types/index.ts`, `lib/permissions.ts` | *Modifiés.* Réexportent `packages/shared` | 2 |
| `next.config.ts` | *Modifié.* `transpilePackages` | 2 |
| `apps/api/` | *Créé.* Squelette Fastify, `GET /health` | 3 |
| `apps/www/`, `apps/backoffice/` | *Créés.* Squelettes Vite + React, `_headers`, `_redirects` | 4 |
| `.github/workflows/ci-cd.yml` | *Modifié.* Tests et builds des workspaces, publication Pages | 5 |
| `packages/ui/` | *Créé.* Tokens, polices, logotype, composants, coque responsive | 8–11 |
| `apps/maquettes/` | *Créé.* Trois écrans de démonstration sur données fictives | 12 |

---

# Phase 0 — Monorepo

### Task 1: Workspaces à la racine

**Files:**
- Modify: `package.json`, `tsconfig.json`, `Dockerfile`, `.gitignore`
- Create: `tsconfig.base.json`, `apps/.gitkeep`, `packages/.gitkeep`

- [ ] **Step 1: Vérification avant**

Run: `npm query .workspace | grep -c '"name"'`
Expected: `0` (aucun workspace).

- [ ] **Step 2: Déclarer les workspaces**

Dans `package.json`, ajouter après `"private": true,` :

```json
  "workspaces": ["apps/*", "packages/*"],
```

et dans `scripts` :

```json
    "test": "npm run test --workspaces --if-present",
    "build:workspaces": "npm run build --workspaces --if-present"
```

Créer `apps/.gitkeep` et `packages/.gitkeep` (vides). Ajouter à `.gitignore` :

```
# Sorties de build des workspaces
apps/*/dist/
packages/*/dist/
```

- [ ] **Step 3: Isoler le typecheck du monolithe**

Dans `tsconfig.json`, remplacer `"exclude": ["node_modules"]` par :

```json
  "exclude": ["node_modules", "apps", "packages"]
```

Les fichiers de `packages/shared` importés par le monolithe restent type-checkés : TypeScript
suit les imports même hors `include`.

Créer `tsconfig.base.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: Installer et vérifier le monolithe**

Run: `npm install && npm run build`
Expected: build Next.js réussi, `package-lock.json` modifié.

- [ ] **Step 5: Adapter l'étape `deps` du Dockerfile**

`npm ci` exige que chaque workspace référencé par le lockfile soit présent. Remplacer
dans l'étape `deps` :

```dockerfile
COPY package.json package-lock.json ./
```

par :

```dockerfile
COPY package.json package-lock.json ./
# Les workspaces doivent exister pour que `npm ci` accepte le lockfile. Seuls
# les manifestes comptent ici ; le code source arrive à l'étape builder.
COPY apps ./apps
COPY packages ./packages
```

Run: `docker build -t mb-test .`
Expected: build réussi.

- [ ] **Step 6: Vérification après**

Run: `npm query .workspace | grep -c '"name"'`
Expected: `0` (toujours aucun workspace, mais la commande ne lève pas d'erreur).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.base.json Dockerfile .gitignore apps/.gitkeep packages/.gitkeep
git commit -m "Monorepo : workspaces npm à côté du monolithe"
```

---

### Task 2: `packages/shared` — types et permissions

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`,
  `packages/shared/src/index.ts`, `packages/shared/src/types.ts`,
  `packages/shared/src/permissions.ts`, `packages/shared/src/permissions.test.ts`
- Modify: `types/index.ts`, `lib/permissions.ts`, `next.config.ts`

- [ ] **Step 1: Manifeste du paquet**

`packages/shared/package.json` :

```json
{
  "name": "@multiboutique/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/shared/tsconfig.json` :

```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [ ] **Step 2: Test rouge de la matrice**

`packages/shared/src/permissions.test.ts` fige le comportement **actuel** de
`lib/permissions.ts`, cas par cas :

```ts
import { describe, expect, it } from "vitest";
import { aPermission, permissionsDuRole } from "./index";

describe("matrice de permissions", () => {
  it("l'administrateur n'a aucune permission commerciale", () => {
    expect(aPermission({ role: "administrateur" }, "ventes:voir")).toBe(false);
    expect(
      aPermission({ role: "administrateur", permissions: ["ventes:voir"] }, "ventes:voir")
    ).toBe(false);
  });

  it("le gérant a tout sauf la publication des prix conseillés", () => {
    expect(permissionsDuRole("gerant")).toContain("stock:gerer");
    expect(permissionsDuRole("gerant")).not.toContain("prix_conseilles:gerer");
  });

  it("le magasinier consulte le stock sans le modifier", () => {
    expect(permissionsDuRole("gerant_stock")).toEqual(["stock:voir", "produits:voir"]);
  });

  it("le vendeur encaisse sans gérer le stock", () => {
    expect(aPermission({ role: "vendeur" }, "ventes:creer")).toBe(true);
    expect(aPermission({ role: "vendeur" }, "stock:gerer")).toBe(false);
  });

  it("les permissions explicites de la session priment sur le rôle", () => {
    expect(aPermission({ role: "vendeur", permissions: ["rapports:voir"] }, "ventes:creer")).toBe(false);
    expect(aPermission({ role: "vendeur", permissions: ["rapports:voir"] }, "rapports:voir")).toBe(true);
  });

  it("une liste explicite vide retombe sur le rôle", () => {
    expect(aPermission({ role: "vendeur", permissions: [] }, "ventes:creer")).toBe(true);
  });

  it("sans session, rien n'est permis", () => {
    expect(aPermission(null, "ventes:voir")).toBe(false);
  });
});
```

Run: `npm install && npm test -w @multiboutique/shared`
Expected: FAIL, `./index` introuvable.

- [ ] **Step 3: Déplacer les types**

`git mv types/index.ts packages/shared/src/types.ts`, puis recréer `types/index.ts` :

```ts
// Les types métier vivent dans packages/shared, partagés avec l'API et les PWA.
export * from "@multiboutique/shared";
```

- [ ] **Step 4: Déplacer la matrice de permissions**

Copier le contenu de `lib/permissions.ts` dans `packages/shared/src/permissions.ts` avec
deux changements, et aucun autre :

1. supprimer les deux imports `@/lib/session` et `@/types` ; importer
   `import type { RoleUtilisateur } from "./types";`
2. remplacer `SessionUser` dans les signatures de `aPermission` et `aToutesPermissions` par
   le type structurel minimal, que `SessionUser` satisfait :

```ts
export interface PorteurPermissions {
  role: RoleUtilisateur;
  permissions?: string[];
}
```

Remplacer ensuite `lib/permissions.ts` par :

```ts
// La matrice vit dans packages/shared : l'API et les PWA l'appliquent à l'identique.
export * from "@multiboutique/shared";
```

`packages/shared/src/index.ts` :

```ts
export * from "./types";
export * from "./permissions";
```

- [ ] **Step 5: Ajouter le paquet aux dépendances du monolithe**

Dans `package.json` racine, `dependencies` : `"@multiboutique/shared": "*"`.
Dans `next.config.ts`, ajouter `transpilePackages: ["@multiboutique/shared"],`.

- [ ] **Step 6: Vert**

Run: `npm install && npm test -w @multiboutique/shared && npm run typecheck -w @multiboutique/shared`
Expected: 7 tests passent, typecheck sans erreur.

- [ ] **Step 7: Une seule matrice**

Run: `grep -rn "PERMISSIONS_PAR_ROLE" --include=*.ts . --exclude-dir=node_modules`
Expected: une seule définition, dans `packages/shared/src/permissions.ts`.

Run: `npm run build && docker build -t mb-test .`
Expected: les deux réussissent.

- [ ] **Step 8: Commit**

```bash
git add -A packages/shared types lib/permissions.ts next.config.ts package.json package-lock.json
git commit -m "Shared : types métier et matrice de permissions en paquet partagé"
```

---

### Task 3: Squelette de l'API

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/app.ts`,
  `apps/api/src/server.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/app.test.ts`

L'application est construite par une fabrique qui reçoit ses dépendances (`pool`), pour
que les tests injectent une base factice sans réseau. La sonde reprend le comportement de
`app/api/health/route.ts` : 200 `{status:"ok"}`, 503 `{status:"degraded"}`, résultat mis en
cache 3 s, erreur journalisée mais jamais renvoyée.

- [ ] **Step 1: Manifeste**

`apps/api/package.json` : nom `@multiboutique/api`, `"type": "module"`, dépendances
`fastify`, `pg`, `@multiboutique/shared`; devDependencies `@types/pg`, `tsx`,
`typescript`, `vitest`. Scripts :

```json
"dev": "tsx watch src/server.ts",
"test": "vitest run",
"typecheck": "tsc -p tsconfig.json",
"build": "tsc -p tsconfig.json"
```

(`build` n'émet rien à ce stade : `noEmit` hérité. Le bundling arrive en phase 2 avec le
Dockerfile de l'API.) `tsconfig.json` : `extends` la base, `lib: ["ES2023"]`,
`types: ["node"]`, `include: ["src"]`.

- [ ] **Step 2: Tests rouges**

`apps/api/src/app.test.ts` :

```ts
import { describe, expect, it, vi } from "vitest";
import { construireApp } from "./app";

function poolFactice(query: () => Promise<unknown>) {
  return { query: vi.fn(query) } as never;
}

describe("GET /health", () => {
  it("répond 200 quand la base répond", async () => {
    const app = construireApp({ pool: poolFactice(async () => ({ rows: [] })) });
    const rep = await app.inject({ method: "GET", url: "/health" });
    expect(rep.statusCode).toBe(200);
    expect(rep.json()).toEqual({ status: "ok" });
  });

  it("répond 503 sans divulguer l'erreur quand la base est injoignable", async () => {
    const app = construireApp({
      pool: poolFactice(async () => { throw new Error("ECONNREFUSED 10.0.0.5:5432"); }),
    });
    const rep = await app.inject({ method: "GET", url: "/health" });
    expect(rep.statusCode).toBe(503);
    expect(rep.body).not.toContain("ECONNREFUSED");
  });

  it("n'interroge la base qu'une fois par fenêtre de 3 secondes", async () => {
    const pool = poolFactice(async () => ({ rows: [] }));
    const app = construireApp({ pool });
    await app.inject({ method: "GET", url: "/health" });
    await app.inject({ method: "GET", url: "/health" });
    expect((pool as { query: ReturnType<typeof vi.fn> }).query).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npm install && npm test -w @multiboutique/api`
Expected: FAIL, `./app` introuvable.

- [ ] **Step 3: Implémentation**

`apps/api/src/routes/health.ts` exporte un plugin Fastify qui reçoit `pool` et porte son
propre cache (variable de fermeture, pas globale de module, pour que chaque instance de
test parte d'un cache vide). Reprendre les commentaires de `app/api/health/route.ts`, qui
expliquent le cache et la journalisation.

`apps/api/src/app.ts` :

```ts
import Fastify from "fastify";
import type { Pool } from "pg";
import { routesSante } from "./routes/health";

export interface Dependances {
  pool: Pick<Pool, "query">;
}

export function construireApp({ pool }: Dependances) {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  app.register(routesSante, { pool });
  return app;
}
```

`apps/api/src/server.ts` crée le `Pool` à partir de `DATABASE_URL` (échec bruyant si absent,
comme `lib/db.ts`), puis `listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 4000) })`.

- [ ] **Step 4: Vert**

Run: `npm test -w @multiboutique/api && npm run typecheck -w @multiboutique/api`
Expected: 3 tests passent, typecheck sans erreur.

- [ ] **Step 5: Commit**

```bash
git add apps/api package.json package-lock.json
git commit -m "API : squelette Fastify et sonde de santé"
```

---

### Task 4: Squelettes des deux PWA

**Files:**
- Create, pour `apps/www` et `apps/backoffice` : `package.json`, `tsconfig.json`,
  `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.test.tsx`,
  `public/_redirects`, `public/_headers`

Les deux apps sont identiques à ce stade, au nom près. Pas encore de PWA ni de design
system : ils arrivent en phases 1 et 3. Ce squelette valide la chaîne build → Pages.

- [ ] **Step 1: Manifeste**

Noms `@multiboutique/www` et `@multiboutique/backoffice`, `"type": "module"`. Dépendances :
`react`, `react-dom`, `@multiboutique/shared`. Dev : `vite`, `@vitejs/plugin-react`,
`typescript`, `vitest`, `jsdom`, `@testing-library/react`, `@types/react`,
`@types/react-dom`. Scripts : `dev`, `build` (`tsc -p tsconfig.json && vite build`),
`test` (`vitest run`). `tsconfig.json` : base + `lib: ["ES2023","DOM","DOM.Iterable"]`,
`jsx: "react-jsx"`, `include: ["src"]`. `vite.config.ts` : plugin React, `test:
{ environment: "jsdom" }`.

- [ ] **Step 2: Test rouge**

`src/App.test.tsx` :

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { App } from "./App";

it("affiche le nom de l'application", () => {
  render(<App />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("MultiBoutique");
});
```

Run: `npm install && npm test -w @multiboutique/www`
Expected: FAIL.

- [ ] **Step 3: Implémentation**

`App.tsx` : un `<main>` avec `<h1>MultiBoutique</h1>` et une ligne « Espace client — en
construction » (www) ou « Backoffice — en construction » (backoffice). `main.tsx` monte
`App` dans `#root`. `index.html` : `lang="fr"`, `<meta name="viewport"
content="width=device-width, initial-scale=1, viewport-fit=cover">`.

- [ ] **Step 4: Fichiers Cloudflare Pages**

`public/_redirects` (routage SPA) :

```
/*  /index.html  200
```

`public/_headers` :

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'
```

Le `connect-src` s'élargira à `api.<base>` en phase 2. L'en-tête `X-Robots-Tag: noindex` de
la recette n'est **pas** dans ce fichier, commun aux environnements : le CI l'ajoute au
moment du build de recette (Tâche 5, étape 3).

- [ ] **Step 5: Vert**

Run: `npm test -w @multiboutique/www -w @multiboutique/backoffice && npm run build -w @multiboutique/www -w @multiboutique/backoffice && ls apps/www/dist/_redirects apps/backoffice/dist/_headers`
Expected: tests verts, les deux fichiers présents dans `dist/`.

- [ ] **Step 6: Commit**

```bash
git add apps/www apps/backoffice package.json package-lock.json
git commit -m "PWA : squelettes Vite + React de la vitrine et du backoffice"
```

---

### Task 5: CI — tests des workspaces et publication sur Pages

**Files:**
- Modify: `.github/workflows/ci-cd.yml`

- [ ] **Step 1: Tests et builds dans le job `build`**

Après « Installer les dépendances », ajouter :

```yaml
      - name: Tests des workspaces
        run: npm test

      - name: Build des workspaces
        run: npm run build:workspaces
```

Le build Next.js existant reste en place.

- [ ] **Step 2: Job de publication des fronts en recette**

Ajouter un job `deploy-fronts-recette`, matrice sur les deux fronts. Il ne remplace pas
`deploy-recette` (monolithe), qui continue de tourner.

```yaml
  # ------------------------------------------------------------------
  # CD recette des PWA : push sur main → Cloudflare Pages
  # ------------------------------------------------------------------
  deploy-fronts-recette:
    name: Pages recette (${{ matrix.front }})
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: recette
    permissions:
      contents: read
    strategy:
      matrix:
        front: [www, backoffice]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - name: Build
        run: npm run build -w @multiboutique/${{ matrix.front }}
      - name: Interdire l'indexation de la recette
        run: |
          printf '/*\n  X-Robots-Tag: noindex\n' >> apps/${{ matrix.front }}/dist/_headers
      - name: Publier
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy apps/${{ matrix.front }}/dist --project-name=mb-${{ matrix.front }}-recette --branch=main
```

Deux blocs `/*` dans `_headers` se cumulent : Pages applique les en-têtes de toutes les
règles qui correspondent.

- [ ] **Step 3: Vérifier la syntaxe**

Run: `npx --yes @action-validator/cli .github/workflows/ci-cd.yml`
Expected: aucune erreur.

- [ ] **Step 4: Commit (sans pousser)**

```bash
git add .github/workflows/ci-cd.yml
git commit -m "CI : tests des workspaces et publication des PWA de recette sur Pages"
```

Ne pas pousser avant la Tâche 6 : sans projets Pages ni secrets, le nouveau job échouerait.

---

### Task 6: Projets Pages et domaines de recette

**Prérequis :** zone `morpion.cloud` **active** sur Cloudflare.

Cette tâche mêle actions manuelles de l'utilisateur (tableau de bord Cloudflare et GitHub)
et vérifications.

- [ ] **Step 1: Vérifier la délégation**

Run: `dig +short NS morpion.cloud`
Expected: `ishaan.ns.cloudflare.com.` et `zelda.ns.cloudflare.com.`

- [ ] **Step 2: Jeton et identifiant de compte (utilisateur)**

Jeton API Cloudflare, droits **Account → Cloudflare Pages : Edit** (le DNS et le Tunnel
viendront en phase 2, avec leur propre jeton). Ajouter dans l'environnement GitHub
`recette` les secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.

Run: `gh api repos/condordarck/multiboutique/environments/recette/secrets -q '.secrets[].name' | grep CLOUDFLARE`
Expected: les deux noms.

- [ ] **Step 3: Créer les projets**

```bash
npx wrangler pages project create mb-www-recette --production-branch=main
npx wrangler pages project create mb-backoffice-recette --production-branch=main
```

(`npx wrangler login` au préalable, ou `CLOUDFLARE_API_TOKEN` exporté.)

- [ ] **Step 4: Pousser et publier**

Run: `git push origin main`, puis `gh run watch --exit-status`
Expected: `build`, `deploy-recette` et les deux `deploy-fronts-recette` au vert.

- [ ] **Step 5: Domaines personnalisés (utilisateur)**

Tableau de bord → Workers & Pages → `mb-www-recette` → Custom domains → `www.morpion.cloud` ;
idem `mb-backoffice-recette` → `backoffice.morpion.cloud`. Cloudflare crée lui-même les
CNAME, la zone étant chez lui.

Run:
```bash
for h in www backoffice; do curl -sI https://$h.morpion.cloud | grep -iE "^HTTP|x-robots-tag|content-security-policy"; done
curl -s https://backoffice.morpion.cloud/une/route/profonde | grep -c MultiBoutique
```
Expected: `HTTP/2 200`, `x-robots-tag: noindex` et la CSP sur les deux hôtes ; la route
profonde renvoie l'app (routage SPA).

---

# Phase 1 — Identité visuelle et design system

### Task 7: Trois directions visuelles — POINT D'ARRÊT

**Files:**
- Create: `docs/superpowers/specs/2026-10-17-identite-visuelle.md` (après le choix)

- [ ] **Step 1: Présenter trois directions**

Publier une page de comparaison (artifact) montrant, pour chaque direction : palette
(primaire, neutres, succès, alerte, danger), clair **et** sombre ; paire typographique
(titres, texte, chiffres tabulaires pour les montants) ; rayons et densité ; un même écran
« tableau de bord boutique » en largeur tablette. Les trois directions doivent différer
réellement de caractère, pas seulement de teinte.

- [ ] **Step 2: Attendre le choix de l'utilisateur**

Ne pas continuer sans réponse. Le choix peut combiner des éléments de plusieurs
directions.

- [ ] **Step 3: Consigner la direction retenue**

`docs/superpowers/specs/2026-10-17-identite-visuelle.md` : valeurs exactes de la palette
(hex, clair et sombre), polices et graisses, échelle typographique, rayons, ombres,
espacements. C'est la source des tokens de la Tâche 8.

```bash
git add docs/superpowers/specs/2026-10-17-identite-visuelle.md
git commit -m "Design : direction visuelle retenue"
```

---

### Task 8: `packages/ui` — tokens et thèmes

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`,
  `packages/ui/src/tokens.ts`, `packages/ui/src/theme.css`,
  `packages/ui/src/contraste.ts`, `packages/ui/src/tokens.test.ts`, `packages/ui/src/index.ts`

Les tokens existent en **une seule source**, `tokens.ts` (objets `clair` et `sombre` aux
mêmes clés). `theme.css` les expose en variables CSS et les relie à Tailwind 4 par
`@theme`. Le test garantit que les deux restent synchronisés et que les contrastes tiennent.

- [ ] **Step 1: Test rouge**

`packages/ui/src/tokens.test.ts` :

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contraste } from "./contraste";
import { tokens } from "./tokens";

// Paires texte/fond réellement utilisées par les composants.
const PAIRES: Array<[texte: string, fond: string, minimum: number]> = [
  ["texte", "fond", 4.5],
  ["texte", "surface", 4.5],
  ["texteDiscret", "surface", 4.5],
  ["surPrimaire", "primaire", 4.5],
  ["surDanger", "danger", 4.5],
  ["bordureForte", "surface", 3], // éléments d'interface (WCAG 1.4.11)
];

describe.each(["clair", "sombre"] as const)("thème %s", (theme) => {
  it.each(PAIRES)("%s sur %s atteint %d:1", (texte, fond, minimum) => {
    const t = tokens[theme] as Record<string, string>;
    expect(contraste(t[texte]!, t[fond]!)).toBeGreaterThanOrEqual(minimum);
  });
});

it("les deux thèmes déclarent les mêmes tokens", () => {
  expect(Object.keys(tokens.sombre).sort()).toEqual(Object.keys(tokens.clair).sort());
});

it("theme.css déclare une variable pour chaque token, dans les deux thèmes", () => {
  const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
  for (const cle of Object.keys(tokens.clair)) {
    const nom = `--mb-${cle.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}`;
    expect(css.split(nom + ":").length - 1, nom).toBeGreaterThanOrEqual(2);
  }
});
```

Run: `npm install && npm test -w @multiboutique/ui`
Expected: FAIL.

- [ ] **Step 2: Contraste WCAG**

`contraste.ts` : luminance relative WCAG 2.x à partir d'un hex `#rrggbb`, ratio
`(L1 + 0.05) / (L2 + 0.05)` avec L1 la plus claire. Ajouter dans le test deux valeurs de
référence : `contraste("#000000", "#ffffff")` vaut 21, `contraste("#777777", "#ffffff")`
vaut environ 4.48.

- [ ] **Step 3: Tokens**

`tokens.ts` : valeurs de la Tâche 7, clés `fond`, `surface`, `surfaceRelevee`, `texte`,
`texteDiscret`, `bordure`, `bordureForte`, `primaire`, `surPrimaire`, `succes`, `alerte`,
`danger`, `surDanger`, `focus`.

`theme.css` :
- `:root { --mb-…: … }` pour le clair ;
- le sombre sous `@media (prefers-color-scheme: dark) { :root:not([data-theme="clair"]) { … } }`
  **et** sous `:root[data-theme="sombre"] { … }`, pour suivre le système tout en
  permettant un choix explicite ;
- `@theme` qui relie les couleurs Tailwind aux variables (`--color-primaire:
  var(--mb-primaire)`, etc.), l'échelle typographique, les rayons, et les **points de
  rupture de la spec** : `--breakpoint-tablette: 40rem` (640 px) et
  `--breakpoint-bureau: 73.75rem` (1180 px).

- [ ] **Step 4: Polices auto-hébergées**

Les polices retenues, en paquets `@fontsource-variable/*` importés par `theme.css` : pas
de requête vers un CDN tiers (la CSP l'interdit, et la PWA doit les avoir hors ligne).

- [ ] **Step 5: Vert, puis commit**

Run: `npm test -w @multiboutique/ui`
Expected: tous les tests passent. Si un contraste échoue, **ajuster la couleur** dans
`tokens.ts` et reporter la nouvelle valeur dans `identite-visuelle.md`, jamais baisser le
seuil.

```bash
git add packages/ui package.json package-lock.json
git commit -m "UI : tokens de design et thèmes clair et sombre"
```

---

### Task 9: Logotype et icônes PWA

**Files:**
- Create: `packages/ui/assets/logo.svg`, `packages/ui/assets/logo-monochrome.svg`,
  `packages/ui/assets/icone.svg`, `packages/ui/pwa-assets.config.ts`

- [ ] **Step 1: Logotype**

Logotype « MultiBoutique » en SVG, construit sur la police de titre de la Tâche 7, texte
vectorisé (aucune dépendance à la police au rendu). Une variante monochrome
(`currentColor`) pour les fonds sombres. Une icône carrée seule (monogramme), lisible à
48 px.

- [ ] **Step 2: Icônes générées**

`@vite-pwa/assets-generator` avec le préréglage `minimal-2023` à partir de `icone.svg` :
favicon, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`,
`apple-touch-icon-180x180.png`.

Run: `npx pwa-assets-generator --config packages/ui/pwa-assets.config.ts && ls packages/ui/assets/*.png`
Expected: les cinq fichiers.

- [ ] **Step 3: Vérifier la zone de sécurité de l'icône masquable**

Ouvrir `maskable-icon-512x512.png` dans https://maskable.app (ou à l'œil) : le monogramme
doit tenir dans le cercle central de 80 %.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/assets packages/ui/pwa-assets.config.ts package.json package-lock.json
git commit -m "UI : logotype et icônes PWA"
```

---

### Task 10: Composants de base

**Files:**
- Create: `packages/ui/src/composants/{Bouton,Carte,Champ,Badge,TuileChiffre,EtatVide}.tsx`
  et un `*.test.tsx` par composant

Exigences communes : cibles tactiles d'au moins 44 × 44 px (`min-h-11 min-w-11`) ; focus
visible avec la couleur `focus` ; aucune couleur codée en dur, uniquement les tokens ;
montants en chiffres tabulaires (`tabular-nums`).

| Composant | Variantes | Ce que le test vérifie |
|---|---|---|
| `Bouton` | `primaire`, `secondaire`, `danger`, `discret` ; `chargement` | rôle `button` ; `disabled` et `aria-busy` pendant le chargement ; un clic pendant le chargement n'appelle pas `onClick` |
| `Carte` | avec ou sans en-tête | rendu des enfants ; titre en `heading` du niveau demandé |
| `Champ` | texte, nombre, montant ; erreur | `label` associé à l'input ; erreur reliée par `aria-describedby` et `aria-invalid` |
| `Badge` | `neutre`, `succes`, `alerte`, `danger` | le texte est lu (pas de sens porté par la seule couleur) |
| `TuileChiffre` | valeur, libellé, variation (hausse ou baisse) | la variation est annoncée en texte (« en hausse de 8 % »), pas seulement par une flèche |
| `EtatVide` | message, action optionnelle | rendu de l'action quand elle est fournie |

- [ ] **Step 1:** pour chaque composant : écrire son test, le voir échouer, l'implémenter, le voir passer.

Run: `npm test -w @multiboutique/ui`
Expected: tous verts.

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/composants packages/ui/src/index.ts
git commit -m "UI : composants de base accessibles et tactiles"
```

---

### Task 11: Coque responsive et listes adaptatives

**Files:**
- Create: `packages/ui/src/coque/Coque.tsx`, `packages/ui/src/coque/Coque.test.tsx`,
  `packages/ui/src/composants/ListeAdaptative.tsx`, `packages/ui/src/composants/ListeAdaptative.test.tsx`

La coque reçoit une liste d'entrées de navigation (`{ libelle, icone, href, actif }`) et
applique la règle de la spec §7.1 **uniquement en CSS** (classes `tablette:` et
`bureau:`), pour qu'aucun calcul JavaScript ne fasse clignoter la mise en page au
chargement :

| Largeur | Rendu |
|---|---|
| < 640 px | barre d'onglets en bas, 4 entrées + « Plus » qui ouvre le reste ; zone de sécurité iOS (`env(safe-area-inset-bottom)`) |
| 640–1180 px | rail latéral, icônes + libellés courts |
| > 1180 px | barre latérale complète, libellés entiers |

`ListeAdaptative<T>` reçoit des colonnes `{ cle, libelle, rendu, principale? }` : en
dessous de `bureau`, chaque ligne devient une carte qui met la colonne `principale` en
titre ; à partir de `bureau`, un vrai `<table>`.

- [ ] **Step 1: Tests rouges**

- la coque expose un seul landmark `navigation` nommé (`aria-label="Navigation
  principale"`) par variante affichée, et l'entrée active porte `aria-current="page"` ;
- avec 7 entrées, la barre du bas en affiche 4 plus « Plus », et « Plus » donne accès aux
  3 restantes ;
- `ListeAdaptative` rend un `table` avec un `columnheader` par colonne, et une carte par
  ligne dont le titre est la colonne `principale`.

- [ ] **Step 2: Implémenter jusqu'au vert, puis commit**

```bash
git add packages/ui/src/coque packages/ui/src/composants/ListeAdaptative*
git commit -m "UI : coque responsive et liste adaptative"
```

---

### Task 12: Maquettes sur données fictives

**Files:**
- Create: `apps/maquettes/` (Vite + React + `@multiboutique/ui`), `apps/maquettes/src/donnees.ts`,
  `apps/maquettes/src/ecrans/{NouvelleVente,Stock,Catalogue}.tsx`
- Modify: `.github/workflows/ci-cd.yml` (ajout de `maquettes` à la matrice Pages, projet `mb-maquettes`)

Trois écrans, choisis pour couvrir les cas difficiles :

1. **Nouvelle vente** (vendeur, tablette, dans la coque backoffice) : recherche de
   produit, panier, quantités au pouce, total, mode de paiement, validation.
2. **Stock** (magasinier puis gérant) : liste adaptative avec alertes de seuil, filtres,
   badge d'état, détail d'un produit.
3. **Catalogue** (vitrine `www`, téléphone d'abord) : boutiques, produits, réservation.

`donnees.ts` : données plausibles (produits du quotidien, montants en `$` comme le
paramètre par défaut, noms de boutiques du seed). Un sélecteur de thème clair/sombre/système
en haut de chaque écran.

- [ ] **Step 1: Construire les écrans**, uniquement avec les composants de `packages/ui`.
  Un besoin non couvert devient un composant de `packages/ui`, testé, pas un style local.

- [ ] **Step 2: Vérifier les trois formats**

Run: `npm run dev -w @multiboutique/maquettes -- --host`, puis ouvrir chaque écran à
390 px, 820 px (tablette portrait), 1180 px (tablette paysage) et 1440 px, dans les deux
thèmes. Aucun défilement horizontal, aucune cible tactile sous 44 px.

- [ ] **Step 3: Publier**

Créer le projet `npx wrangler pages project create mb-maquettes --production-branch=main`,
ajouter `maquettes` à la matrice du job Pages, pousser. Domaine personnalisé
`maquettes.morpion.cloud` (utilisateur).

```bash
git add apps/maquettes .github/workflows/ci-cd.yml package.json package-lock.json
git commit -m "Maquettes : nouvelle vente, stock et catalogue sur données fictives"
```

---

### Task 13: Validation des maquettes — POINT D'ARRÊT

- [ ] **Step 1:** l'utilisateur ouvre `https://maquettes.morpion.cloud` sur une vraie
  tablette, un téléphone et un ordinateur.
- [ ] **Step 2:** chaque retour est corrigé **dans `packages/ui`** (tokens ou composants),
  jamais dans les maquettes seules, puis republié.
- [ ] **Step 3:** une fois les maquettes validées, inscrire dans la spec (§8) la phase 1
  comme terminée, et commiter :

```bash
git add docs/superpowers/specs/2026-10-17-separation-front-api-pwa-design.md
git commit -m "Spec : maquettes validées, fin de la phase 1"
```

La phase 2 (API) fera l'objet de son propre plan.
