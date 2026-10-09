#!/usr/bin/env bash
set -euo pipefail

# Sauvegarde quotidienne : base PostgreSQL + photos produits, chiffrées
# par restic avant d'être envoyées sur le stockage distant.
#
#   bash deploy/backup.sh
#
# restic tourne EN CONTENEUR : sudo est interactif sur la cible, donc
# `apt install restic` n'est pas automatisable. Docker l'est (groupe docker).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f deploy/.env ] && { set -a; . deploy/.env; set +a; }

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY manquant dans deploy/.env}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD manquant dans deploy/.env}"

export RESTIC_REPOSITORY RESTIC_PASSWORD
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"

COMPOSE_FILE="deploy/docker-compose.prod.yml"
IMAGE_RESTIC="${RESTIC_IMAGE:-restic/restic:0.17.3}"
HORODATAGE="$(date +%Y%m%d-%H%M%S)"

mkdir -p backups
JOURNAL="backups/backup.log"

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

journaliser() { echo "[$(date -Is)] $*" | tee -a "$JOURNAL"; }

echouer() {
  journaliser "ECHEC : $1"
  if [ -n "${BACKUP_PING_URL:-}" ]; then
    curl -fsS -m 10 --retry 3 "${BACKUP_PING_URL}/fail" >/dev/null 2>&1 || true
  fi
  exit 1
}

restic_exec() {
  local montage=()
  # RESTIC_VOLUME permet de viser un dépôt local (essais hors ligne).
  [ -n "${RESTIC_VOLUME:-}" ] && montage=(-v "$RESTIC_VOLUME")
  docker run --rm \
    -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
    -v "$SCRATCH:/data:ro" \
    "${montage[@]}" \
    "$IMAGE_RESTIC" "$@"
}

journaliser "Début de la sauvegarde"

# 1. Base de données, format custom (compressé, restaurable par pg_restore).
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U mb -Fc multiboutique > "$SCRATCH/multiboutique-${HORODATAGE}.dump" \
  || echouer "pg_dump a échoué"

# Un dump vide signale un échec que pg_dump n'a pas remonté. Ne jamais
# l'envoyer : un snapshot vide qui remonte « succès » est pire que rien.
[ -s "$SCRATCH/multiboutique-${HORODATAGE}.dump" ] || echouer "dump vide"

TAILLE="$(stat -c%s "$SCRATCH/multiboutique-${HORODATAGE}.dump")"
journaliser "Dump produit : ${TAILLE} octets"

# 2. Photos produits : aucune autre copie n'existe, elles ne sont pas en base.
mkdir -p "$SCRATCH/uploads"
if [ -d public/uploads ]; then
  cp -a public/uploads/. "$SCRATCH/uploads/" 2>/dev/null || true
fi
journaliser "Uploads inclus : $(find "$SCRATCH/uploads" -type f | wc -l) fichier(s)"

# 3. Envoi chiffré puis application de la rétention.
restic_exec backup /data --tag multiboutique --host multiboutique \
  || echouer "restic backup"

restic_exec forget --tag multiboutique \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune \
  || echouer "restic forget"

journaliser "Sauvegarde terminée"

if [ -n "${BACKUP_PING_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$BACKUP_PING_URL" >/dev/null 2>&1 || true
fi
