# Phase 5 : Bascule en recette et retrait du monolithe — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline-one-shot-execution (choisi par l'utilisateur) ou superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la recette ne sert plus que l'API (par le tunnel) et les deux PWA. Le
monolithe Next disparaît du VPS, du CI et du dépôt, et l'ancienne adresse
`multiboutique.dev4future.space` est supprimée. Le pipeline de production est préparé
pour l'API et les PWA, paramétré par un domaine encore à acquérir, mais n'est pas
activé.

**Spec :** `docs/superpowers/specs/2026-10-17-separation-front-api-pwa-design.md` (§3, §5, §8).

**Décisions de l'utilisateur (2026-10-18) :**
- la recette d'abord ; la production quand le domaine sera acquis ;
- l'ancienne adresse est **supprimée**, pas redirigée : vhost, certificat et
  enregistrement DNS ;
- le code du monolithe est **supprimé du dépôt** ; l'historique Git le conserve.

## État de départ

- **Sur le VPS** (`/var/www/multiboutique`, compose `deploy/docker-compose.prod.yml`) :
  - `multiboutique-db` (PostgreSQL 16, volume `pgdata`) ;
  - `multiboutique-prod` (monolithe Next, port local 3002, servi par le vhost Apache
    de `multiboutique.dev4future.space`) ;
  - `multiboutique-api` et `multiboutique-tunnel`, dans le profil `api`.
- **Les images** sont partagées par le monolithe et l'API, dans `public/uploads`
  (ignoré par Git).
- **Le CI** :
  - construit l'image du monolithe et vérifie `https://${vars.DOMAIN}/api/health` ;
  - construit l'image de l'API avec `continue-on-error`, sans bloquer le déploiement ;
  - définit un job `deploy-production`, déclenché par un tag `v*`, qui n'a jamais tourné.
    L'environnement GitHub `production` n'existe pas.
- **Les gardes de complétude** du backoffice et de la vitrine lisent les pages du
  monolithe dans `app/` pour vérifier qu'aucune n'est oubliée.

## Décisions de conception

1. **Rien ne disparaît sans que son remplaçant soit vérifié en recette.** La bascule
   tient en un seul déploiement : le compose n'a plus de service `app`, l'API et le
   tunnel deviennent obligatoires, et le contrôle de santé du CI porte sur l'API et
   les fronts. Le conteneur `multiboutique-prod` est arrêté et supprimé par
   `server-deploy.sh` seulement après que l'API a répondu.
2. **La bascule est réversible.** Un tag `avant-bascule` est posé sur le dernier
   commit qui déploie le monolithe ; son image reste dans GHCR sous son étiquette sha.
   La procédure de retour arrière est écrite, testée à blanc et jointe au plan
   (`docs/bascule-recette.md`). Le vhost supprimé se recrée avec le
   `setup-vhost.sh` de ce tag.
3. **La base, son schéma et ses données ne changent pas.** Aucune migration dans cette
   phase. Une sauvegarde est prise avant la bascule ; `server-deploy.sh` la prend déjà
   à chaque déploiement.
4. **Les images sortent de `public/`.** Elles vont dans `donnees/uploads`, ignoré par
   Git. `server-deploy.sh` les déplace une seule fois, de façon idempotente :
   - il refuse si les deux dossiers existent et ne sont pas vides ;
   - il ne déplace rien si l'API tourne encore sur l'ancien chemin et que le nouveau
     montage n'est pas prêt.

   Sans ce déplacement, un dossier `public/` ne contenant que des données resterait
   à la racine du dépôt.
5. **`db/` passe sous `apps/api/db/`**, comme prévu par la spec : seule l'API l'utilise
   désormais. Le compose, `migrate.sh`, la base de test de l'API et le serveur des
   parcours suivent.
6. **Les gardes de complétude gardent la liste des pages, figée.** Ce qui comptait
   était que chaque écran du monolithe ait son équivalent ; c'est acquis. La table
   `PAGES` (page du monolithe → route) reste, comme trace et pour vérifier que chaque
   route existe toujours. Seule la lecture du dossier `app/` disparaît. Les gardes
   des services ne changent pas.
7. **La production est préparée, pas activée.**
   - Le job `deploy-production` déploie l'API (image, tunnel) et les PWA
     (`wrangler deploy --env production`) à partir des variables de l'environnement
     GitHub `production`.
   - Une étape refuse de continuer tant que `API_DOMAIN` n'y est pas défini et que
     les `wrangler.jsonc` n'ont pas d'`env.production`.
   - Le domaine de production et la procédure d'activation sont documentés dans
     `docs/bascule-recette.md` (§ Production).
8. **Le développement local se passe du monolithe.**
   - Un `docker-compose.yml` de développement démarre PostgreSQL avec le seed et les
     migrations.
   - `npm run dev` lance l'API (`tsx watch`), le backoffice et la vitrine en même
     temps.
   - L'API accepte déjà `http://localhost` hors production.
9. **Rien n'est fait à la main sur le VPS par l'agent.** Les gestes sur le serveur
   partagé sont des étapes de `docs/bascule-recette.md`, exécutées par l'utilisateur :
   - suppression du vhost Apache et du certificat certbot ;
   - suppression de l'enregistrement DNS chez OVH (zone `dev4future.space`, partagée) ;
   - nettoyage du `.env` ;
   - pose du tag.

## Global Constraints

- **Branche dédiée** `phase-5-bascule`, dans un worktree. Rien sur `main` avant la revue.
- **Aucune modification de schéma ni de données.**
- **Les parcours de bout en bout des deux fronts passent avant et après chaque tâche**
  qui touche au déploiement ou à `db/`. Ce sont eux, avec les tests de l'API, qui
  prouvent que le monolithe n'est plus nécessaire.
- **Chaque script de `deploy/` modifié** est vérifié par `bash -n` et `shellcheck`
  (s'il est disponible), et exercé sur une pile Docker locale qui reproduit le VPS
  (tâche 8).
- **Nommage** : français ; commits `Préfixe : description` + ligne `Co-Authored-By`.

## Review Focus

1. **Le retour arrière fonctionne** : le tag, l'image conservée et la procédure.
   → Tâches 4, 8, 9.
2. **Le déplacement des images ne perd rien**, même relancé deux fois ou interrompu.
   → Tâche 3.
3. **Aucune référence restante** au monolithe : imports, chemins, variables
   (`IMAGE`, `APP_PORT`, `JWT_SECRET`, `DOMAIN`), scripts, CI. → Tâches 1, 4, 5.
4. **Le CI ne déploie plus rien sans l'API** : image obligatoire, santé vérifiée,
   parcours bloquants. → Tâche 5.
5. **La production ne peut pas partir par accident.** → Tâche 5.

---

### Task 1: Garde « plus de monolithe » et suppression du code

**Files:**
- Delete : `app/`, `components/`, `lib/`, `types/`, `middleware.ts`, `next.config.ts`,
  `next-env.d.ts`, `tailwind.config.ts`, `postcss.config.js`, `tsconfig.json` (racine,
  celui de Next), `Dockerfile`, `Dockerfile.dev`, `Dockerfile.pack`, `docker-compose.yml`
  (remplacé à la tâche 6).
- Modify :
  - `package.json` racine : dépendances Next, React, Tailwind 3, `pg` du monolithe,
    scripts `dev`/`build`/`start`/`lint`/`db:init` ;
  - `.gitignore` : `.next/`, `next-env.d.ts` ;
  - `apps/*/vite.config.ts` : le commentaire et la configuration PostCSS vide
    deviennent sans objet ;
  - `apps/backoffice/src/completude.test.ts`, `apps/www/src/completude.test.ts`
    (décision 6).
- Create : `scripts/sans-monolithe.test.ts`, ou un test Vitest dans `packages/front`.

- La garde vérifie qu'aucun fichier suivi par Git (`git ls-files`) :
  - ne vient du monolithe (`app/`, `components/`, `lib/`, `middleware.ts`, `next.config.*`) ;
  - n'importe `next`, `next/*` ou un alias `@/`.

  Elle vérifie aussi qu'aucune dépendance `next` n'est déclarée dans un `package.json`.
- Avant la suppression, on vérifie que ni `packages/*` ni `apps/*` n'importent
  `types/` ou `lib/`. L'inventaire de la phase 4 n'en a trouvé aucun ; la garde le
  confirme.
- `npm install` régénère le lockfile sans Next ; le build et les tests des workspaces
  passent.

- [ ] **Step 1 — test rouge** : la garde échoue sur `main` en nommant `app/`, `next`…
- [ ] **Step 2** — les gardes de complétude passent au tableau figé ; elles restent
  vertes.
- [ ] **Step 3** — suppression ; la garde passe ; tests, typecheck et builds des
  workspaces passent.
- [ ] **Step 4 — mutation** : recréer un `app/page.tsx` ou ajouter `next` à un
  `package.json` fait échouer la garde.
- [ ] **Step 5** — commit `Monolithe : retrait du code Next`.

### Task 2: `db/` sous `apps/api/db/`

**Files:**
- Move : `db/` → `apps/api/db/` (`git mv`).
- Modify :
  - `deploy/docker-compose.prod.yml` (montage de `init.sql`) ;
  - `deploy/server-deploy.sh` (`bash apps/api/db/migrate.sh`) ;
  - `deploy/restore-test.sh` (commentaire) ;
  - `apps/api/test/preparation-globale.ts` ;
  - `packages/front/e2e/serveurs.ts` ;
  - la documentation qui cite `db/`.

- [ ] **Step 1** — `git mv`, puis correction des chemins.
- [ ] **Step 2** — les tests de l'API (base modèle reconstruite depuis le nouveau
  chemin) et les parcours des deux fronts passent.
- [ ] **Step 3** — `docker compose -f deploy/docker-compose.prod.yml config` (avec un
  `.env` d'exemple) montre le bon chemin ; `grep` ne trouve plus de `db/init.sql` hors
  de `apps/api`.
- [ ] **Step 4** — commit `Base : schéma et migrations sous apps/api`.

### Task 3: Images dans `donnees/uploads`

**Files:** Modify `deploy/docker-compose.prod.yml` (montage `../donnees/uploads`),
`deploy/server-deploy.sh` (fonction `deplacer_uploads`), `.gitignore`, `deploy/backup.sh`
si les images y sont sauvegardées (vérifier) ; Create `deploy/test/deplacer-uploads.test.sh`.

`deplacer_uploads` traite quatre cas :

| Situation | Action |
|---|---|
| `public/uploads` n'existe pas | rien |
| `public/uploads` existe, `donnees/uploads` n'existe pas ou est vide | déplacer : `mv` sur le même système de fichiers, atomique ; puis supprimer `public/` s'il est vide |
| les deux existent et sont non vides | erreur, déploiement interrompu, aucun changement |
| interruption entre deux étapes | relancer donne le même résultat (idempotent) |

- [ ] **Step 1 — test rouge** : `deploy/test/deplacer-uploads.test.sh` exerce les
  quatre cas dans un dossier temporaire. Il compare la liste et la somme de contrôle
  des fichiers avant et après.
- [ ] **Step 2** — implémenter ; le test passe ; `bash -n` et `shellcheck` passent.
- [ ] **Step 3** — `backup.sh` : vérifier qu'il sauvegarde bien les images. Si oui,
  suivre le nouveau chemin. Sinon, consigner l'écart (les images ne sont pas
  sauvegardées aujourd'hui) dans le rapport, sans élargir le périmètre.
- [ ] **Step 4** — commit `Déploiement : images dans donnees/uploads`.

### Task 4: Compose et déploiement sans monolithe

**Files:**
- Modify :
  - `deploy/docker-compose.prod.yml` : le service `app` est retiré ; `api` et
    `cloudflared` sortent du profil et deviennent obligatoires
    (`${API_IMAGE:?…}`, `${TUNNEL_TOKEN:?…}`…) ;
  - `deploy/server-deploy.sh` ;
  - `deploy/.env.example` ;
  - `deploy/healthcheck-cron.sh` ;
  - `deploy/rotate-seed-passwords.sh` (seulement si ses commentaires citent le
    monolithe).
- Delete : `deploy/setup-vhost.sh`.

- `server-deploy.sh`, dans l'ordre :
  1. vérifier la configuration (`API_IMAGE`, `API_JWT_SECRET`, `TUNNEL_TOKEN`,
     `ORIGINE_*`, `POSTGRES_PASSWORD`), en nommant ce qui manque ;
  2. sauvegarde ;
  3. déplacement des images (tâche 3) ;
  4. base prête ;
  5. migrations ;
  6. API et tunnel (`up -d --force-recreate`) ;
  7. attendre que l'API réponde, depuis le réseau Docker (`docker compose exec api`
     sur `/health`) ;
  8. **seulement alors**, arrêter et supprimer `multiboutique-prod` s'il existe, en
     le journalisant ;
  9. `docker image prune`.

  Le cas `IMAGE` (monolithe) disparaît. Une variable `IMAGE` encore présente dans le
  `.env` est signalée, mais ignorée.
- `healthcheck-cron.sh` surveille `multiboutique-api` (santé `/health` interne) et
  `multiboutique-tunnel` (en cours d'exécution) au lieu de `multiboutique-prod`. La
  limite de redémarrages et l'alerte restent identiques.
- `.env.example` : `IMAGE`, `APP_PORT`, `JWT_SECRET` et `DOMAIN` sont retirés ; une
  section dit qu'ils peuvent être effacés du `.env` du VPS après la bascule.

- [ ] **Step 1 — test rouge** : `deploy/test/server-deploy.test.sh` exécute le script
  avec un faux `docker` (une fonction de shell qui journalise les appels).
  - Il vérifie l'ordre des opérations.
  - Il vérifie que `multiboutique-prod` n'est supprimé qu'après la réponse de l'API,
    et jamais si elle ne répond pas.
  - Il vérifie qu'un `.env` incomplet arrête tout avant la sauvegarde.
- [ ] **Step 2** — implémenter ; le test, `bash -n` et `shellcheck` passent.
- [ ] **Step 3** — commit `Déploiement : l'API remplace le monolithe`.

### Task 5: CI et pipeline de production

**Files:** Modify `.github/workflows/ci-cd.yml`.

- Job `build` : l'étape `next build` et son `NODE_OPTIONS` sont retirés ;
  `typecheck`, les tests et le build des workspaces restent.
- Job `deploy-recette` :
  - plus d'image du monolithe ;
  - l'image de l'API devient obligatoire (sans `continue-on-error`) ;
  - le script SSH n'exporte plus `IMAGE` ;
  - la santé est vérifiée sur `https://${API_DOMAIN}/health`, `https://www.<base>/`
    et `https://backoffice.<base>/` (200) ;
  - le contrôle de `vars.DOMAIN` disparaît.
- Job `deploy-production` (tag `v*`, environnement `production`) :
  - il reprend `deploy-recette` (API) ;
  - un job `deploy-fronts-production` reprend le déploiement des fronts avec
    `--env production`, sans `noindex` ;
  - une étape « Garde » échoue avec un message clair si `vars.API_DOMAIN` est vide ou
    si `apps/*/wrangler.jsonc` n'a pas d'`env.production`.
- La structure du workflow est vérifiée par `action-validator`.

- [ ] **Step 1** — modifier ; `action-validator` passe.
- [ ] **Step 2** — test de la garde de production : le script de l'étape est extrait
  dans `deploy/ci/garde-production.sh` et testé localement, sans domaine (échec,
  message) puis avec un domaine et un `env.production` factices (succès).
- [ ] **Step 3** — commit `CI : déploiement sans monolithe, production préparée`.

### Task 6: Développement local

**Files:** Create `docker-compose.yml` (développement : PostgreSQL, seed et migrations
via `apps/api/db`), `apps/api/.env.exemple` ; Modify `package.json` racine (scripts
`dev`, `dev:api`, `dev:backoffice`, `dev:www`, `db:dev`), `README.md` (réécrit).

- `npm run dev` lance en parallèle l'API (port 4000, origines `http://localhost:5174`
  et `5175`), le backoffice (5174) et la vitrine (5175), avec
  `VITE_API_URL=http://localhost:4000` et `VITE_BACKOFFICE_URL=http://localhost:5174`.
  Il s'appuie sur `npm run dev --workspaces` ou sur un petit script
  `scripts/dev.mjs`, sans dépendance nouvelle si possible.
- README : l'architecture en une page, les commandes (installation, base locale,
  développement, tests, parcours), les variables d'environnement et le déploiement.

- [ ] **Step 1** — `docker compose up -d` puis `npm run dev` : vérifier à la main
  (`curl`) que l'API répond, que les deux fronts se chargent et qu'une connexion
  aboutit. Les commandes et leurs sorties sont notées dans le rapport.
- [ ] **Step 2** — commit `Dev : environnement local sans monolithe`.

### Task 7: Procédure de bascule et de retour arrière

**Files:** Create `docs/bascule-recette.md` ; Modify la spec (§8 phase 5 réalisée, §3.1
« le monolithe actuel reste en place » retiré, décisions 1 à 9).

Le document contient les étapes suivantes, toutes à exécuter par l'utilisateur.

**Avant la fusion :**
- tag `avant-bascule` sur `main` (`git tag avant-bascule <sha> && git push origin avant-bascule`) ;
- relevé de l'étiquette de l'image du monolithe en service :
  `docker inspect multiboutique-prod --format '{{.Config.Image}}'` sur le VPS ;
- sauvegarde manuelle (`bash deploy/backup.sh`) et vérification de sa présence.

**Fusion :** le CI déploie ; vérifications à faire :
- `docker ps` (plus de `multiboutique-prod`) ;
- l'API, `www` et `backoffice` répondent ;
- connexion au backoffice et à la vitrine ;
- une vente et une réservation.

**Après, sur le VPS partagé :**
- `sudo a2dissite multiboutique.dev4future.space*.conf` ;
- `sudo systemctl reload apache2` ;
- `sudo certbot delete --cert-name multiboutique.dev4future.space` ;
- suppression des fichiers de vhost.

  Les noms exacts sont relevés d'abord avec `apache2ctl -S`, pour ne toucher aucun
  autre site.

**Chez OVH :** suppression de l'enregistrement `multiboutique` de la zone
`dev4future.space` (zone partagée : ne toucher qu'à lui).

**`.env` du VPS :** suppression de `IMAGE`, `APP_PORT`, `JWT_SECRET` et `DOMAIN`.

**GitHub :** suppression de la variable `DOMAIN` de l'environnement `recette`.

**Retour arrière** (si l'API pose un problème dans les 7 jours) :
1. `git checkout avant-bascule` sur le VPS ;
2. `IMAGE=<étiquette relevée> bash deploy/server-deploy.sh up` ;
3. `bash deploy/setup-vhost.sh` (version du tag), puis certbot ;
4. DNS chez OVH.

Les commandes sont écrites en entier.

**Production (plus tard) :**
- acquisition du domaine et zone Cloudflare ;
- environnement GitHub `production` (variables et secrets listés) ;
- `env.production` dans les deux `wrangler.jsonc` ;
- second tunnel ;
- `.env` du serveur de production ;
- tag `v1.0.0`.

- [ ] **Step 1** — écrire le document ; chaque commande est vérifiée par sa syntaxe et,
  quand c'est possible, sur la pile locale de la tâche 8.
- [ ] **Step 2** — commit `Docs : procédure de bascule, de retour arrière et de production`.

### Task 8: Répétition sur une pile locale

**Files:** Create `deploy/test/repetition.sh` (non utilisé par le CI ; documenté).

La répétition reproduit le VPS dans un dossier temporaire, sans toucher au conteneur
`mb-test-pg` :
1. on clone le dépôt au tag `main` actuel ;
2. on lance le monolithe et la base avec l'ancien compose, puis on crée une image dans
   `public/uploads` ;
3. on bascule le clone sur la branche de la phase ;
4. on lance `server-deploy.sh` avec l'image de l'API construite localement et un faux
   `TUNNEL_TOKEN`. `cloudflared` est remplacé par un conteneur inerte, au moyen d'une
   surcharge de compose propre au test.

On vérifie ensuite :
- `multiboutique-prod` supprimé seulement après la santé de l'API ;
- l'image présente dans `donnees/uploads`, servie par l'API (`/uploads/produits/<uuid>`) ;
- la base intacte (mêmes comptages par table qu'avant) ;
- une seconde exécution sans effet.

Enfin, on rejoue le retour arrière : checkout `avant-bascule`, ancien
`server-deploy.sh`, et le monolithe répond de nouveau.

- [ ] **Step 1** — écrire et exécuter la répétition ; consigner la sortie.
- [ ] **Step 2** — commit `Déploiement : répétition locale de la bascule`.

### Task 9: Vérification complète

- [ ] **Step 1** :
  - tests de tous les workspaces ;
  - typecheck ;
  - build des workspaces ;
  - image Docker de l'API ;
  - parcours des deux fronts ;
  - `action-validator` ;
  - `bash -n` et `shellcheck` sur `deploy/` ;
  - tests de `deploy/test/` ;
  - gardes vérifiées par mutation (« sans monolithe », complétude, couverture).
- [ ] **Step 2** — `git grep` des termes du monolithe (`next`, `multiboutique-prod`,
  `APP_PORT`, `JWT_SECRET`, `dev4future`, `@/`) : chaque occurrence restante est
  justifiée (documentation historique, plans des phases passées) ou supprimée.
- [ ] **Step 3** — revue consolidée, puis rapport.

---

## Hors périmètre

- La production elle-même : domaine, serveur, tunnel, activation du job. Tout est
  préparé et documenté (tâche 7, § Production).
- Les décisions en attente des phases 3 et 4 : `validerReservation`, la casse des
  e-mails dans l'API, la saisie directe des quantités.
- La validation des maquettes et l'application `apps/maquettes`, qui restent.
- Toute modification de schéma ou de données.
