# MultiBoutique

Gestion de boutiques alimentaires : ventes, stock, réservations en ligne, avec
traçabilité complète (« qui a fait quoi ») pour le propriétaire. Le cahier des
charges est dans `docs/CAHIER_DES_CHARGES.md`.

## Architecture

```
       Cloudflare Workers (fichiers statiques)                 VPS (Docker)
 ┌───────────────────────────┐  ┌──────────────────────┐   ┌──────────────────────────┐
 │ www.<base>                │  │ backoffice.<base>    │   │ cloudflared ─▶ api:4000  │
 │ apps/www : vitrine,       │  │ apps/backoffice :    │   │ apps/api (Fastify)       │
 │ réservation, espace client│  │ personnel, admin     │   │          │               │
 └─────────────┬─────────────┘  └──────────┬───────────┘   │ PostgreSQL 16 (db)       │
               └──── fetch + cookie ───────┴── api.<base> ▶└──────────────────────────┘
```

- **`apps/api`** : l'API (Fastify), seul point d'accès à la base. Joignable
  uniquement par le tunnel Cloudflare : aucun port n'est ouvert sur le VPS.
  Schéma, seed et migrations dans `apps/api/db/`.
- **`apps/www`** et **`apps/backoffice`** : deux PWA Vite/React, servies par
  Cloudflare Workers. Chacune a son cookie de session (`__Host-mb_session_www`,
  `__Host-mb_session_bo`) et sa CSP, générée au build depuis `VITE_API_URL`.
- **`packages/metier`** : règles métier ; **`packages/shared`** : schémas et types
  communs à l'API et aux fronts ; **`packages/front`** : client API, session,
  cache hors ligne et outils de test des deux PWA ; **`packages/ui`** : composants.
- **`apps/maquettes`** : maquettes de référence de l'interface.

Monorepo en workspaces npm (Node 22).

## Développement local

Prérequis : Node 22, Docker.

```bash
npm ci
npm run db:dev     # PostgreSQL sur 127.0.0.1:55433 : schéma, seed, migrations
npm run dev        # API :4000, backoffice :5174, vitrine :5175 (Ctrl+C arrête tout)
```

- Backoffice : http://localhost:5174, vitrine : http://localhost:5175.
- `npm run dev:api`, `dev:backoffice` et `dev:www` lancent un seul service.
- Au premier lancement, `npm run dev` crée `apps/api/.env` depuis
  `apps/api/.env.exemple`, avec un `API_JWT_SECRET` aléatoire.
- La base vient de `docker-compose.yml` (projet `multiboutique-dev`, distinct de
  celui du serveur). Réinitialiser : `docker compose down -v && npm run db:dev`.
- Images des produits : `donnees/uploads/` (ignoré par git).

### Comptes de départ

`apps/api/db/init.sql` crée `admin@multiboutique.com` (administrateur, mot de passe
`admin123`) et `proprietaire@multiboutique.com` (propriétaire, `proprietaire123`).
**Ces mots de passe sont publics** : sur toute instance joignable depuis un réseau,
`bash deploy/rotate-seed-passwords.sh` les remplace par des valeurs aléatoires,
affichées une seule fois.

### Rôles

| Rôle | Front |
|------|-------|
| `administrateur` | backoffice : utilisateurs, boutiques, rôles, paramètres. Pas de données commerciales. |
| `proprietaire`, `directeur_groupe`, `directeur_region` | backoffice : les boutiques de leur périmètre. |
| `gerant`, `gerant_stock`, `comptable`, `vendeur` | backoffice : leur boutique, selon leurs permissions. |
| `client` | vitrine : catalogue, réservation, « Mes réservations ». |

## Tests

```bash
npm test             # tous les workspaces (Vitest)
npm run typecheck
npm run build:workspaces
```

- Les tests de l'API demandent un PostgreSQL :
  `DATABASE_URL_TEST=postgres://postgres:<mdp>@127.0.0.1:<port>/postgres`
  (une base modèle est construite une fois, puis clonée par fichier de test).
- Parcours de bout en bout (Playwright, Chromium), avec la même variable :
  `npm run e2e -w @multiboutique/backoffice` et `npm run e2e -w @multiboutique/www`.
  Ils construisent les fronts, démarrent l'API sur une base `mb_e2e` neuve et
  servent les fronts avec leurs vrais en-têtes.
- Scripts de déploiement : `bash deploy/test/<script>.test.sh`.

## Variables d'environnement

**API** (`apps/api/.env` en local, `deploy/.env` sur le serveur) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (composée par le compose sur le serveur). |
| `API_JWT_SECRET` | Signature des sessions, 32 caractères minimum (`openssl rand -hex 32`). |
| `ORIGINE_WWW`, `ORIGINE_BACKOFFICE` | Origines des deux fronts. `https` en production ; `http://localhost` seulement hors production. |
| `UPLOADS_DIR` | Dossier des images des produits. |
| `PORT` | 4000 par défaut. |

**Fronts** (lues au build) : `VITE_API_URL` (les deux), `VITE_BACKOFFICE_URL`
(vitrine, lien « Espace professionnel »).

**Serveur** (`deploy/.env`, modèle dans `deploy/.env.example`) :
`POSTGRES_PASSWORD`, `API_IMAGE`, `API_JWT_SECRET`, `TUNNEL_TOKEN`, `ORIGINE_WWW`,
`ORIGINE_BACKOFFICE`, les variables `RESTIC_*` et `AWS_*` des sauvegardes, et en
option `BACKUP_PING_URL`, `HEALTH_PING_URL`, `GHCR_USER` et `GHCR_TOKEN`.

## Déploiement

| Déclencheur | Environnement GitHub | Effet |
|---|---|---|
| push sur `main` | `recette` | image API sur GHCR → SSH → `deploy/server-deploy.sh up` ; fronts publiés sur Cloudflare (`wrangler deploy --env recette`) ; santé de l'API et des fronts vérifiée. |
| tag `v*` | `production` | même chemin, derrière une garde qui refuse tant que la production n'est pas configurée (`docs/bascule-recette.md`, section « Production »). |

Recette : `www.morpion.cloud`, `backoffice.morpion.cloud`, `api.morpion.cloud`.

### Secrets et variables GitHub (par environnement)

| Nom | Valeur |
|---|---|
| `SERVER_HOST`, `SERVER_PORT`, `SERVER_USER`, `SERVER_SSH_KEY` | Accès SSH au serveur. |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Publication des fronts. |
| `API_DOMAIN` *(variable)* | `api.<base>`, dont se déduisent les adresses des fronts. |
| `APP_DIR` *(variable)* | Chemin du dépôt sur le serveur (`/var/www/multiboutique` par défaut). |

> **Protéger l'environnement `production`** : *Deployment branches and tags*
> limité à `v*` et au moins un *Required reviewer*. Sinon un tag poussé depuis
> n'importe quelle branche atteint la production.

### Ce que fait `deploy/server-deploy.sh up`

1. Vérifie les variables obligatoires et nomme celles qui manquent, avant tout effet.
2. Sauvegarde la base (10 dernières dans `backups/`).
3. Déplace les images de `public/uploads` (ancien monolithe) vers `donnees/uploads`.
4. Démarre la base et applique les migrations (`apps/api/db/migrate.sh`).
5. Démarre l'API et le tunnel, puis attend `/health` ; en cas d'échec, s'arrête là.
6. Seulement alors, arrête l'ancien conteneur du monolithe s'il existe encore.

### Préparer un serveur (une fois)

```bash
sudo mkdir -p /var/www/multiboutique && sudo chown -R "$USER":"$USER" /var/www/multiboutique
git clone https://github.com/<compte>/multiboutique.git /var/www/multiboutique
cd /var/www/multiboutique
cp deploy/.env.example deploy/.env && chmod 600 deploy/.env   # puis le renseigner
API_IMAGE=ghcr.io/<compte>/multiboutique-api:main bash deploy/server-deploy.sh up
bash deploy/rotate-seed-passwords.sh                          # noter les identifiants
```

Le tunnel se crée dans Cloudflare Zero Trust (Networks → Tunnels) : nom d'hôte
public `api.<base>` → `http://api:4000`, jeton dans `TUNNEL_TOKEN`.

> `deploy/.env` permet de forger des sessions (`API_JWT_SECRET`) et de déchiffrer
> les sauvegardes (`RESTIC_PASSWORD`) : `chmod 600` n'est pas une option.
> `POSTGRES_PASSWORD` n'est lu qu'au premier démarrage du volume `pgdata`.

```cron
30 2 * * *   cd /var/www/multiboutique && bash deploy/backup.sh           >> backups/cron.log 2>&1
*/2 * * * *  cd /var/www/multiboutique && bash deploy/healthcheck-cron.sh >> backups/cron.log 2>&1
0 4 1 * *    cd /var/www/multiboutique && bash deploy/restore-test.sh     >> backups/cron.log 2>&1
```

### Migrations

`apps/api/db/migrations/*.sql`, appliquées dans l'ordre à chaque déploiement
(table `schema_migrations`). Une migration jouée n'est jamais modifiée : on en
écrit une nouvelle. Adopter une base migrée à la main :
`bash apps/api/db/migrate.sh --baseline`.

## Sauvegardes

`deploy/backup.sh`, chaque nuit : dump PostgreSQL **et** `donnees/uploads` (les
photos produits n'ont aucune autre copie), chiffrés par restic vers Cloudflare R2.
Rétention : 7 quotidiennes, 4 hebdomadaires, 6 mensuelles. `deploy/restore-test.sh`,
chaque mois, restaure le dernier snapshot dans un PostgreSQL jetable et vérifie
que les tables répondent. Journaux dans `backups/`.

> **`RESTIC_PASSWORD` doit être conservé hors du serveur.** Perdu, les
> sauvegardes sont irrécupérables.

Restauration manuelle (restic conserve les chemins absolus : le contenu atterrit
sous `restauration/data/`) :

```bash
set -a; . deploy/.env; set +a
docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -v "$PWD/restauration:/restore" restic/restic:0.17.3 \
  restore latest --tag multiboutique --target /restore

DUMP=$(ls -1 restauration/data/multiboutique-*.dump | tail -1)
docker compose -f deploy/docker-compose.prod.yml exec -T db \
  pg_restore -U mb -d multiboutique --clean --no-owner < "$DUMP"
cp -a restauration/data/uploads/. donnees/uploads/
```

## Bascule et retour arrière

La bascule de la recette (retrait du monolithe Next.js, de son vhost et de son
domaine) et le retour arrière sont décrits dans `docs/bascule-recette.md`.
