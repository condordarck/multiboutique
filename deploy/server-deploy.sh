#!/usr/bin/env bash
set -euo pipefail

# Déploiement serveur de MultiBoutique (image GHCR + PostgreSQL + migrations).
#
# Usage (depuis la racine du dépôt, cloné dans /home/<user>/multiboutique) :
#   IMAGE=ghcr.io/condordarck/multiboutique:main bash deploy/server-deploy.sh up
#   bash deploy/server-deploy.sh pull     # ne fait que récupérer l'image
#
# Variables requises (lues dans deploy/.env) :
#   IMAGE, APP_PORT                        (image déployée et port local)
#   POSTGRES_PASSWORD, JWT_SECRET          (bases/app)
#   GHCR_USER, GHCR_TOKEN                  (seulement si le paquet GHCR est privé)
#   API_IMAGE, API_JWT_SECRET, TUNNEL_TOKEN,
#   ORIGINE_WWW, ORIGINE_BACKOFFICE        (API et tunnel ; facultatifs, cf. étape 6)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Charge .env si présent (placé dans deploy/.env)
# API_IMAGE fourni par le CI prime sur deploy/.env (où il est souvent vide).
API_IMAGE_APPELANT="${API_IMAGE:-}"
if [ -f deploy/.env ]; then
  set -a; . deploy/.env; set +a
fi
API_IMAGE="${API_IMAGE_APPELANT:-${API_IMAGE:-}}"

# Aucun défaut : un déploiement sans IMAGE défini tirerait et exécuterait
# l'image d'un compte tiers. Échouer est le seul comportement sûr.
: "${IMAGE:?IMAGE manquant (ex: IMAGE=ghcr.io/condordarck/multiboutique:main)}"
COMPOSE_FILE="deploy/docker-compose.prod.yml"
SOUS_COMMANDE="${1:-up}"

# 1. Connexion au registre GHCR (nécessaire si le dépôt/paquet est privé)
if [ -n "${GHCR_USER:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  echo "[deploy] Connexion GHCR en tant que ${GHCR_USER}"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

export IMAGE

# API et tunnel (phase 2) : déployés seulement si leur configuration est complète.
# Sans elle, le monolithe se déploie seul, comme avant, et on le dit.
API_ACTIVE=0
if [ -n "${API_IMAGE:-}" ] && [ -n "${API_JWT_SECRET:-}" ] && [ -n "${TUNNEL_TOKEN:-}" ] \
   && [ -n "${ORIGINE_WWW:-}" ] && [ -n "${ORIGINE_BACKOFFICE:-}" ]; then
  API_ACTIVE=1
  export API_IMAGE
else
  echo "[deploy] API non déployée : API_IMAGE, API_JWT_SECRET, TUNNEL_TOKEN, ORIGINE_WWW et ORIGINE_BACKOFFICE sont requis (cf. deploy/.env.example)."
fi

if [ "$SOUS_COMMANDE" = "pull" ]; then
  docker compose -f "$COMPOSE_FILE" pull app
  echo "[deploy] Image ${IMAGE} récupérée."
  if [ "$API_ACTIVE" = 1 ]; then
    docker compose -f "$COMPOSE_FILE" --profile api pull api cloudflared
    echo "[deploy] Image ${API_IMAGE} récupérée."
  fi
  exit 0
fi

# 2. Sauvegarde automatique de la base (garde les 10 dernières)
#
# `ps --quiet db` sort en code 0 avec une sortie VIDE quand aucun conteneur
# n'existe : tester son code de retour rendait la condition toujours vraie, et
# le premier déploiement d'un serveur neuf mourait sur le pg_dump avant même
# d'avoir lancé quoi que ce soit. C'est la sortie qu'il faut tester.
if [ -n "$(docker compose -f "$COMPOSE_FILE" ps --quiet --status running db)" ]; then
  mkdir -p backups
  chmod 700 backups
  backup="backups/db-$(date +%Y%m%d-%H%M%S).sql"
  echo "[deploy] Sauvegarde → $backup"
  # Écriture dans un fichier temporaire promu seulement en cas de succès :
  # un dump interrompu ne doit pas entrer dans la rotation et y occuper la
  # place d'une sauvegarde valide.
  if docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U mb multiboutique > "${backup}.partiel"; then
    mv "${backup}.partiel" "$backup"
    chmod 600 "$backup"
  else
    rm -f "${backup}.partiel"
    echo "[deploy] ECHEC de la sauvegarde préalable — déploiement interrompu." >&2
    exit 1
  fi
  ls -1t backups/db-*.sql 2>/dev/null | tail -n +11 | xargs -r rm --
else
  echo "[deploy] Aucune base en cours d'exécution — pas de sauvegarde préalable."
fi

# 3. Récupérer l'image et (re)lancer l'app
docker compose -f "$COMPOSE_FILE" pull app
docker compose -f "$COMPOSE_FILE" up -d --force-recreate app

# 4. Attendre que la base soit prête
# Les apostrophes simples empêchaient la substitution de $COMPOSE_FILE : la
# boucle visait un fichier vide et sortait immédiatement.
timeout 60 bash -c "until docker compose -f '$COMPOSE_FILE' exec -T db pg_isready -U mb -d multiboutique >/dev/null 2>&1; do sleep 2; done"
echo "[deploy] Base de données prête."

# 5. Appliquer les migrations manquantes
bash apps/api/db/migrate.sh

# 6. API et tunnel, une fois la base migrée : l'API ne démarre jamais sur un
# schéma en retard.
if [ "$API_ACTIVE" = 1 ]; then
  docker compose -f "$COMPOSE_FILE" --profile api pull api cloudflared
  docker compose -f "$COMPOSE_FILE" --profile api up -d --force-recreate api cloudflared
  echo "[deploy] API ${API_IMAGE} et tunnel démarrés."
fi

# 7. Nettoyage des images orphelines
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] OK — application et migrations à jour."