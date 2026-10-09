# MultiBoutique — Application de Gestion Multi-Boutiques

Application web de gestion de 3 boutiques alimentaires : ventes, stock, réservations en ligne, avec traçabilité complète (« qui a fait quoi ») pour le propriétaire.

**Hébergement : 100% local.** La base de données PostgreSQL tourne dans un conteneur Docker sur ton propre serveur. Aucune donnée (coûts de revient, marges, ventes) ne quitte ta machine.

## Prérequis

- Docker + Docker Compose
- Un port libre pour l'application (`APP_PORT`, 3002 en recette)
- Le reverse proxy (80/443) est fourni par l'hôte, pas par le compose

## Démarrage rapide (production)

```bash
docker compose up -d db app
```

L'application est accessible sur `http://localhost:3001`

> Note : le port 3000 de l'hôte est déjà utilisé (Grafana), l'app est exposée sur 3001.

### Comptes par défaut

`db/init.sql` crée deux comptes : `admin@multiboutique.com` (administrateur) et
`proprietaire@multiboutique.com` (propriétaire).

**Leurs mots de passe initiaux sont publics dans `db/init.sql`.** Sur toute
instance joignable depuis un réseau, lancer `bash deploy/rotate-seed-passwords.sh`
au premier déploiement : le script les remplace par des valeurs aléatoires et les
affiche une seule fois.

### Rôles et interfaces

| Rôle | Accès |
|------|-------|
| `administrateur` | `/admin` : utilisateurs, boutiques, paramètres généraux (monnaie, seuil d'alerte). Pas d'accès aux données commerciales. |
| `proprietaire` | `/dashboard` : vue globale + gestion de toutes les boutiques (ventes, stock, réservations). |
| `gerant`, `gerant_stock`, `comptable`, `vendeur` | `/dashboard/[boutique]` : uniquement **sa** boutique (ajout produit, prix, stock). |
| `client` | `/client` : « Mes réservations ». Compte créable via `/register`. |

## Configuration

### Variable `JWT_SECRET`

Le secret de session est **requis** (absence de défaut) et lu par le conteneur **au démarrage** (`${JWT_SECRET:?...}` dans `docker-compose.yml`). Il doit faire au moins 32 caractères :

```bash
openssl rand -hex 32   # à placer dans .env (JWT_SECRET=...)
```

> ⚠️ Le secret ne doit **jamais** être commité : `.env` est dans `.gitignore` et `.dockerignore`.

### Identifiants de connexion à la base

- Hôte : `db` (dans le réseau Docker), `localhost` (depuis l'hôte)
- Base : `multiboutique`
- Utilisateur : `mb`
- Mot de passe : valeur de `POSTGRES_PASSWORD` (aucun défaut, à définir dans `deploy/.env`)

## Sauvegardes

`deploy/backup.sh` s'exécute chaque nuit à 02h30 : dump PostgreSQL **et**
`public/uploads` (les photos produits n'ont aucune autre copie), chiffrés par
restic avant envoi sur Cloudflare R2. Rétention : 7 quotidiennes, 4
hebdomadaires, 6 mensuelles.

> **`RESTIC_PASSWORD` doit être conservé hors du serveur** (gestionnaire de mots
> de passe). C'est la clé de chiffrement du dépôt : perdue, les sauvegardes sont
> définitivement irrécupérables.

`deploy/restore-test.sh`, mensuel, restaure le dernier snapshot dans un
PostgreSQL jetable et vérifie que les tables répondent. Journaux dans
`backups/`.

Restauration manuelle :

```bash
set -a; . deploy/.env; set +a
docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -v "$PWD/restauration:/restore" restic/restic:0.17.3 \
  restore latest --tag multiboutique --target /restore
docker compose -f deploy/docker-compose.prod.yml exec -T db \
  pg_restore -U mb -d multiboutique --clean --no-owner < restauration/*.dump
```

## Mode développement (hot reload)

```bash
docker compose up -d db dev
```

Accessible sur `http://localhost:3002` — le code local est monté dans le conteneur, les modifications sont rechargées automatiquement. Ne pas lancer `dev` et `app` en même temps.

## Schéma de la base

`db/init.sql` est exécuté automatiquement au **premier** démarrage du conteneur `db` (création des tables, fonctions SQL, triggers d'audit, vues et données de départ).

Pour réinitialiser la base : `docker compose down -v` puis relancer.

## Rôles

| Rôle | Description |
|------|-------------|
| `proprietaire` | Vue globale sur toutes les boutiques |
| `gerant` | Gère sa boutique (ventes, stock, prix) |
| `gerant_stock` | Suit les stocks et mouvements |
| `comptable` | Lecture seule sur ventes et mouvements |
| `vendeur` | Enregistre les ventes au comptoir |
| `client` | Consulte le catalogue et réserve en ligne |

## Structure du projet

```
multiboutique/
├── app/
│   ├── (auth)/            # Connexion / inscription
│   ├── (dashboard)/       # Dashboard protégé (gérant + propriétaire)
│   │   └── dashboard/     # URLs /dashboard et /dashboard/[boutiqueId]
│   ├── (public)/          # Catalogue public + réservation
│   └── api/auth/          # API login / register / logout
├── lib/
│   ├── db.ts              # Connexion PostgreSQL (pool pg)
│   ├── session.ts         # JWT signé (WebCrypto HMAC-SHA256)
│   ├── auth.ts            # Sessions, permissions par rôle
│   └── actions/           # Server Actions (ventes, stock, réservations)
├── db/init.sql            # Schéma PostgreSQL complet (source de vérité)
├── components/dashboard/  # Composants du dashboard
├── types/                 # Types TypeScript
└── hooks/                 # Hooks React custom
```

## Reverse proxy et HTTPS

Le reverse proxy n'est pas dans le compose : il est fourni par l'hôte. Sur le
serveur de recette, Apache et certbot sont déjà installés et servent les autres
projets de la machine.

```bash
sudo bash deploy/setup-vhost.sh
```

Le script lit `DOMAIN` et `APP_PORT` dans `deploy/.env`, vérifie que le DNS
pointe bien sur la machine, crée le vhost sur le modèle des vhosts existants puis
délivre le certificat Let's Encrypt. Il est idempotent : relançable sans risque.

## Déploiement GitHub + CI/CD

Chaîne de bout en bout : **push sur `main` → GitHub Actions build l'image → push sur GHCR → SSH sur le serveur → sauvegarde BDD + migrations + redémarrage → vérification de `/api/health`**. Un tag `v*` suit le même chemin vers l'environnement de production.

### 1. Pousser le code

```bash
cd multiboutique
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<TOI>/multiboutique.git
git branch -M main
git push -u origin main
```

### 2. Environnements GitHub (repo → Settings → Environments)

La chaîne distingue deux environnements : **`recette`** (déclenché par un push sur
`main`) et **`production`** (déclenché par un tag `v*`). Les secrets sont portés
par environnement, jamais au niveau du dépôt : c'est ce cloisonnement qui empêche
un push sur `main` d'atteindre la production.

| Secret / variable | Valeur |
|---|---|
| `SERVER_HOST` | IP du serveur |
| `SERVER_PORT` | Port SSH |
| `SERVER_USER` | Utilisateur SSH |
| `SERVER_SSH_KEY` | Clé privée SSH (format PEM) |
| `APP_DIR` *(variable)* | Chemin du dépôt sur le serveur, ex. `/home/arnaud/multiboutique` |
| `DOMAIN` *(variable)* | Hôte interrogé par le smoke test, ex. `multiboutique.dev4future.space` |
| `GHCR_USER` / `GHCR_TOKEN` | **Optionnel** : uniquement si le paquet GHCR est privé |

Après déploiement, le job interroge `https://$DOMAIN/api/health` et échoue si la
réponse n'est pas 200 : un déploiement qui laisse l'application cassée ne passe
plus en vert.

### 3. Préparer le serveur (une seule fois)

```bash
# Sur un VPS Linux avec Docker + compose plugin, dépôt cloné sous ~ :
cd ~/multiboutique

cp deploy/.env.example deploy/.env
# puis renseigner POSTGRES_PASSWORD, JWT_SECRET, APP_PORT, DOMAIN et les
# variables RESTIC_*/AWS_* (cf. section Sauvegardes).

sudo bash deploy/setup-vhost.sh                      # vhost Apache + certificat
IMAGE=ghcr.io/<TOI>/multiboutique:main bash deploy/server-deploy.sh up
bash deploy/rotate-seed-passwords.sh                 # noter les identifiants

crontab -e   # ajouter les trois entrées ci-dessous
```

```cron
30 2 * * *   cd ~/multiboutique && bash deploy/backup.sh           >> backups/cron.log 2>&1
*/2 * * * *  cd ~/multiboutique && bash deploy/healthcheck-cron.sh >> backups/cron.log 2>&1
0 4 1 * *    cd ~/multiboutique && bash deploy/restore-test.sh     >> backups/cron.log 2>&1
```

> Le dépôt doit être cloné sous `~` et non sous `/opt` : `/opt` appartient à root
> et `sudo` exige un mot de passe sur la cible, ce que le CI ne peut pas fournir.

> ⚠️ `POSTGRES_PASSWORD` n'est lu qu'au **premier** démarrage du volume `pgdata`.

### 4. Migrations automatiques

Les migrations `db/migrations/*.sql` sont appliquées automatiquement à chaque déploiement par `db/migrate.sh` (table `schema_migrations`, transaction atomique). Pour adopter une base existante migrée à la main : `bash db/migrate.sh --baseline`.

### 5. Vérifier

```bash
curl -sI https://$DOMAIN | head -1                                  # 200 ou 301
curl -s -o /dev/null -w "%{http_code}\n" https://$DOMAIN/api/health # 200
ss -tln | grep -E "0\.0\.0\.0:($APP_PORT|5432)" && echo ECHEC || echo "aucun bind public"
bash deploy/backup.sh && bash deploy/restore-test.sh                # sauvegarde + restauration
```

- Catalogue et connexion : `https://$DOMAIN`
- Tableau de bord : `https://$DOMAIN/login`