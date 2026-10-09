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
# Les dumps en clair et les journaux ne regardent pas les autres comptes de
# cette machine partagée.
chmod 700 backups 2>/dev/null || true
JOURNAL="backups/backup.log"

SCRATCH="$(mktemp -d)"
# INT et TERM en plus d'EXIT : bash n'exécute pas le trap EXIT sur un SIGTERM
# non capturé, ce qui laisserait un dump en clair dans /tmp après un timeout
# cron ou un redémarrage de la machine.
trap 'rm -rf "$SCRATCH"' EXIT INT TERM

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
  # Les fichiers sont écrits par le conteneur (uid 1001) et la sauvegarde
  # tourne sous l'utilisateur de déploiement : une photo illisible doit faire
  # échouer la sauvegarde, pas disparaître en silence du snapshot.
  if ! cp -a public/uploads/. "$SCRATCH/uploads/" 2>"$SCRATCH/cp.err"; then
    journaliser "Copie des uploads en échec : $(tr '\n' ' ' < "$SCRATCH/cp.err")"
    echouer "copie des uploads"
  fi
  rm -f "$SCRATCH/cp.err"

  ATTENDUS="$(find public/uploads -type f | wc -l)"
  COPIES="$(find "$SCRATCH/uploads" -type f | wc -l)"
  if [ "$COPIES" -ne "$ATTENDUS" ]; then
    echouer "uploads incomplets : ${COPIES} fichiers copiés sur ${ATTENDUS}"
  fi
else
  ATTENDUS=0
  COPIES=0
fi
journaliser "Uploads inclus : ${COPIES} fichier(s)"

# 3. Envoi chiffré puis application de la rétention.
restic_exec backup /data --tag multiboutique --host multiboutique \
  || echouer "restic backup"

journaliser "Snapshot envoyé"

# Un échec de rétention n'invalide pas le snapshot, qui est déjà stocké : on le
# signale sans transformer une sauvegarde réussie en échec. Cause la plus
# fréquente : un verrou laissé par une exécution interrompue (`restic unlock`).
if ! restic_exec forget --tag multiboutique \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune; then
  journaliser "AVERTISSEMENT : rétention non appliquée (snapshot bien enregistré). Si le dépôt est verrouillé : restic unlock"
fi

journaliser "Sauvegarde terminée"

if [ -n "${BACKUP_PING_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$BACKUP_PING_URL" >/dev/null 2>&1 || true
fi
