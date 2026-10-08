# MultiBoutique — Application de Gestion Multi-Boutiques

Application web de gestion de 3 boutiques alimentaires : ventes, stock, réservations en ligne, avec traçabilité complète (« qui a fait quoi ») pour le propriétaire.

**Hébergement : 100% local.** La base de données PostgreSQL tourne dans un conteneur Docker sur ton propre serveur. Aucune donnée (coûts de revient, marges, ventes) ne quitte ta machine.

## Prérequis

- Docker + Docker Compose
- Ports libres : **3001** (application), **5432** (postgres), 80/443 (nginx optionnel)

## Démarrage rapide (production)

```bash
docker compose up -d db app
```

L'application est accessible sur `http://localhost:3001`

> Note : le port 3000 de l'hôte est déjà utilisé (Grafana), l'app est exposée sur 3001.

### Comptes seed

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur (configuration générale) | `admin@multiboutique.com` | `admin123` |
| Propriétaire (gestion commerciale) | `proprietaire@multiboutique.com` | `proprietaire123` |

**Change ces mots de passe immédiatement** via le login une fois connecté.

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
- Mot de passe : `mbpassword`

## Sauvegarde des données

Les données vivent dans le volume Docker `multiboutique_pgdata`. Pour sauvegarder :

```bash
# Image / fichier SQL
docker exec multiboutique-db pg_dump -U mb multiboutique > sauvegarde.sql

# Restaurer
docker exec -i multiboutique-db psql -U mb multiboutique < sauvegarde.sql
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

## Nginx (optionnel — SSL en production)

Si tu veux exposer l'app sur Internet avec HTTPS :

1. Mets ta config dans `nginx/conf.d/default.conf`
2. Mets tes certificats dans `nginx/ssl/`
3. Lance `docker compose up -d nginx`

## Déploiement GitHub + CI/CD

Chaîne de bout en bout : **push sur `main` → GitHub Actions build l'image → push sur GHCR → SSH sur le serveur → sauvegarde BDD + migrations + redémarrage**.

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

### 2. Secrets GitHub Actions (repo → Settings → Secrets and variables → Actions)

| Secret | Valeur |
|---|---|
| `SERVER_HOST` | IP du serveur |
| `SERVER_PORT` | Port SSH (défaut `22`) |
| `SERVER_USER` | Utilisateur SSH (ex. `deploy`) |
| `SERVER_SSH_KEY` | Clé privée SSH (format PEM) |
| `GHCR_USER` / `GHCR_TOKEN` | **Optionnel** : uniquement si le dépôt est privé (token `read:packages`) |

> Le paquet GHCR `ghcr.io/<TOI>/multiboutique` est public si le dépôt est public (pull serveur sans login).
> Variable optionnelle : `APP_DIR` (chemin du dépôt sur le serveur, défaut `/opt/multiboutique`).

### 3. Préparer le serveur (une seule fois)

```bash
# Sur un VPS Linux avec Docker + compose plugin :
git clone https://github.com/<TOI>/multiboutique.git /opt/multiboutique
cd /opt/multiboutique

# Secrets de production locaux (NON commités)
cat > deploy/.env <<'EOF'
POSTGRES_PASSWORD=<openssl rand -hex 16>
JWT_SECRET=<openssl rand -hex 32>
EOF

# Si le dépôt / paquet GHCR est privé, ajouter aussi :
#   GHCR_USER=<TOI>
#   GHCR_TOKEN=<token read:packages>

# Marquage des migrations déjà appliquées (base fraîche : inutile, sauter cette étape)
bash db/migrate.sh   # sur une base neuve, applique 002→008 dans l'ordre

# Premier lancement :
IMAGE=ghcr.io/<TOI>/multiboutique:main bash deploy/server-deploy.sh up
```

> ⚠️ `POSTGRES_PASSWORD` n'est lu qu'au **premier** démarrage du volume `pgdata`. Pour changer après coup, voir la section *Sauvegarde des données*.

### 4. Migrations automatiques

Les migrations `db/migrations/*.sql` sont appliquées automatiquement à chaque déploiement par `db/migrate.sh` (table `schema_migrations`, transaction atomique). Pour adopter une base existante migrée à la main : `bash db/migrate.sh --baseline`.

### 5. Vérifier

- Serveur : `http://<IP>` (nginx 80/443) → catalogue et login
- Tableau de bord : `http://<IP>/login`