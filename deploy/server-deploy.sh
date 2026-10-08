#!/usr/bin/env bash
set -euo pipefail

# Déploiement serveur de MultiBoutique (image GHCR + PostgreSQL + migrations).
#
# Usage (depuis la racine du dépôt, cloné sur le serveur) :
#   IMAGE=ghcr.io/vous/multiboutique:main bash deploy/server-deploy.sh up
#   bash deploy/server-deploy.sh pull     # ne fait que récupérer l'image
#
# Variables requises (lues dans deploy/.env) :
#   POSTGRES_PASSWORD, JWT_SECRET          (bases/app)
#   GHCR_USER, GHCR_TOKEN                  (seulement si le paquet GHCR est privé)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Charge .env si présent (placé dans deploy/.env)
if [ -f deploy/.env ]; then
  set -a; . deploy/.env; set +a
fi

IMAGE="${IMAGE:-ghcr.io/darnoc/multiboutique:main}"
COMPOSE_FILE="deploy/docker-compose.prod.yml"
SOUS_COMMANDE="${1:-up}"

# 1. Connexion au registre GHCR (nécessaire si le dépôt/paquet est privé)
if [ -n "${GHCR_USER:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  echo "[deploy] Connexion GHCR en tant que ${GHCR_USER}"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

export IMAGE

if [ "$SOUS_COMMANDE" = "pull" ]; then
  docker compose -f "$COMPOSE_FILE" pull app
  echo "[deploy] Image ${IMAGE} récupérée."
  exit 0
fi

# 2. Sauvegarde automatique de la base (garde les 10 dernières)
if docker compose -f "$COMPOSE_FILE" ps --quiet db >/dev/null 2>&1; then
  mkdir -p backups
  backup="backups/db-$(date +%Y%m%d-%H%M%S).sql"
  echo "[deploy] Sauvegarde → $backup"
  docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U mb multiboutique > "$backup"
  ls -1t backups/db-*.sql 2>/dev/null | tail -n +11 | xargs -r rm --
fi

# 3. Récupérer l'image et (re)lancer l'app
docker compose -f "$COMPOSE_FILE" pull app
docker compose -f "$COMPOSE_FILE" up -d --force-recreate app

# 4. Attendre que la base soit prête
timeout 60 bash -c 'until docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U mb -d multiboutique >/dev/null 2>&1; do sleep 2; done'
echo "[deploy] Base de données prête."

# 5. Appliquer les migrations manquantes
bash db/migrate.sh

# 6. Nettoyage des images orphelines
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] OK — application et migrations à jour."