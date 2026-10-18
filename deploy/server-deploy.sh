#!/usr/bin/env bash
set -euo pipefail

# Déploiement serveur de MultiBoutique : PostgreSQL, API et Cloudflare Tunnel.
# Les PWA sont servies par Cloudflare ; le monolithe Next a été retiré (phase 5).
#
# Usage (depuis la racine du dépôt cloné sur le serveur) :
#   API_IMAGE=ghcr.io/condordarck/multiboutique-api:main bash deploy/server-deploy.sh up
#   bash deploy/server-deploy.sh pull     # ne fait que récupérer les images
#
# Variables requises (lues dans deploy/.env ; API_IMAGE fourni par le CI prime) :
#   POSTGRES_PASSWORD, API_IMAGE, API_JWT_SECRET, TUNNEL_TOKEN,
#   ORIGINE_WWW, ORIGINE_BACKOFFICE
# Facultatives : GHCR_USER, GHCR_TOKEN (paquet GHCR privé).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# shellcheck source=deploy/lib/uploads.sh
. deploy/lib/uploads.sh

API_IMAGE_APPELANT="${API_IMAGE:-}"
if [ -f deploy/.env ]; then
  # shellcheck disable=SC1091
  set -a; . deploy/.env; set +a
fi
API_IMAGE="${API_IMAGE_APPELANT:-${API_IMAGE:-}}"

COMPOSE_FILE="deploy/docker-compose.prod.yml"
SOUS_COMMANDE="${1:-up}"
# Attente de la santé de l'API (réglable pour les tests).
SANTE_TENTATIVES="${SANTE_TENTATIVES:-30}"
SANTE_PAUSE="${SANTE_PAUSE:-3}"
MONOLITHE="multiboutique-prod"

# 1. Configuration : tout manque est nommé, avant le moindre effet.
manquantes=()
for variable in POSTGRES_PASSWORD API_IMAGE API_JWT_SECRET TUNNEL_TOKEN ORIGINE_WWW ORIGINE_BACKOFFICE; do
  [ -n "${!variable:-}" ] || manquantes+=("$variable")
done
if [ "${#manquantes[@]}" -gt 0 ]; then
  echo "[deploy] Configuration incomplète, rien n'a été fait. Manquant : ${manquantes[*]} (cf. deploy/.env.example)." >&2
  exit 1
fi
if [ -n "${IMAGE:-}" ]; then
  echo "[deploy] IMAGE (monolithe) est ignorée depuis la phase 5 ; elle peut être retirée de deploy/.env."
fi
export API_IMAGE

if [ -n "${GHCR_USER:-}" ] && [ -n "${GHCR_TOKEN:-}" ]; then
  echo "[deploy] Connexion GHCR en tant que ${GHCR_USER}"
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
fi

if [ "$SOUS_COMMANDE" = "pull" ]; then
  docker compose -f "$COMPOSE_FILE" pull api cloudflared
  echo "[deploy] Image ${API_IMAGE} récupérée."
  exit 0
fi

# 2. Sauvegarde de la base si elle tourne (les 10 dernières sont gardées).
#
# `ps --quiet` sort en code 0 avec une sortie VIDE quand aucun conteneur
# n'existe : c'est la sortie qu'il faut tester, pas le code de retour.
if [ -n "$(docker compose -f "$COMPOSE_FILE" ps --quiet --status running db)" ]; then
  mkdir -p backups
  chmod 700 backups
  backup="backups/db-$(date +%Y%m%d-%H%M%S).sql"
  echo "[deploy] Sauvegarde → $backup"
  # Fichier temporaire promu seulement en cas de succès : un dump interrompu
  # ne doit pas entrer dans la rotation à la place d'une sauvegarde valide.
  if docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U mb multiboutique > "${backup}.partiel"; then
    mv "${backup}.partiel" "$backup"
    chmod 600 "$backup"
  else
    rm -f "${backup}.partiel"
    echo "[deploy] ECHEC de la sauvegarde préalable — déploiement interrompu." >&2
    exit 1
  fi
  find backups -maxdepth 1 -name 'db-*.sql' -printf '%T@ %p\n' | sort -rn | tail -n +11 | cut -d' ' -f2- | xargs -r rm --
else
  echo "[deploy] Aucune base en cours d'exécution — pas de sauvegarde préalable."
fi

# 3. Images des produits : public/uploads (monolithe) → donnees/uploads.
deplacer_uploads "$ROOT"

# 4. Base démarrée et prête. En TCP : au premier démarrage, le serveur
# temporaire qui joue init.sql répond déjà sur le socket Unix, et des migrations
# lancées à ce moment seraient coupées par son arrêt.
docker compose -f "$COMPOSE_FILE" up -d db
timeout 60 bash -c "until docker compose -f '$COMPOSE_FILE' exec -T db pg_isready -h 127.0.0.1 -U mb -d multiboutique >/dev/null 2>&1; do sleep 2; done"
echo "[deploy] Base de données prête."

# 5. Migrations manquantes : l'API ne démarre jamais sur un schéma en retard.
bash apps/api/db/migrate.sh

# 6. API et tunnel.
docker compose -f "$COMPOSE_FILE" pull api cloudflared
docker compose -f "$COMPOSE_FILE" up -d --force-recreate api cloudflared

# 7. Santé de l'API, vue depuis son conteneur (aucun port n'est publié).
sante_api() {
  docker compose -f "$COMPOSE_FILE" exec -T api node -e \
    "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
}
saine=0
for _ in $(seq 1 "$SANTE_TENTATIVES"); do
  if sante_api; then saine=1; break; fi
  sleep "$SANTE_PAUSE"
done
if [ "$saine" != 1 ]; then
  echo "[deploy] ECHEC : L'API ne répond pas sur /health. Le monolithe éventuel est laissé en place." >&2
  exit 1
fi
echo "[deploy] API ${API_IMAGE} saine, tunnel démarré."

# 8. Seulement maintenant : retrait de l'ancien monolithe Next, s'il tourne encore.
if docker inspect "$MONOLITHE" >/dev/null 2>&1; then
  docker stop "$MONOLITHE" >/dev/null
  docker rm -f "$MONOLITHE" >/dev/null
  echo "[deploy] Ancien conteneur ${MONOLITHE} (monolithe) arrêté et supprimé."
  # Jusqu'ici, le monolithe tournait encore : redémarré dans l'intervalle, il a
  # pu recréer public/uploads (source de son montage). Second passage : les
  # restes vides disparaissent ; une image écrite là entre-temps fait refuser.
  deplacer_uploads "$ROOT"
fi

# 9. Nettoyage des images orphelines.
docker image prune -f >/dev/null 2>&1 || true

echo "[deploy] OK — base, API et tunnel à jour."
