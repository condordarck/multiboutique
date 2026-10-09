#!/usr/bin/env bash
set -euo pipefail

# Restauration de contrôle : restaure le dernier snapshot dans un PostgreSQL
# jetable et vérifie que les données sont réellement exploitables.
#
#   bash deploy/restore-test.sh
#
# Une sauvegarde jamais restaurée n'est pas une sauvegarde : c'est une
# hypothèse. Ce script la transforme en fait vérifié, tous les mois.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f deploy/.env ] && { set -a; . deploy/.env; set +a; }

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY manquant}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD manquant}"

export RESTIC_REPOSITORY RESTIC_PASSWORD
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"

IMAGE_RESTIC="${RESTIC_IMAGE:-restic/restic:0.17.3}"
CONTENEUR="multiboutique-restore-test"
# db/init.sql alimente toujours ces deux tables ; `produits` peut légitimement
# être vide sur une instance neuve et ne constitue donc pas un témoin fiable.
TABLES=(boutiques utilisateurs)

mkdir -p backups
chmod 700 backups 2>/dev/null || true
JOURNAL="backups/restore-test.log"
SCRATCH="$(mktemp -d)"

nettoyer() {
  docker rm -f "$CONTENEUR" >/dev/null 2>&1 || true
  rm -rf "$SCRATCH"
}
# INT et TERM en plus d'EXIT : sans eux, un SIGTERM laisse tourner un PostgreSQL
# jetable et un dump en clair sur une machine qui n'a pas la place pour.
trap nettoyer EXIT INT TERM

journaliser() { echo "[$(date -Is)] $*" | tee -a "$JOURNAL"; }

journaliser "Début du test de restauration"

# 1. Restaurer le dernier snapshot.
montage=()
[ -n "${RESTIC_VOLUME:-}" ] && montage=(-v "$RESTIC_VOLUME")
if ! docker run --rm \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -v "$SCRATCH:/restore" \
  "${montage[@]}" \
  "$IMAGE_RESTIC" restore latest --tag multiboutique --target /restore; then
  journaliser "ECHEC : restic restore (dépôt vide ou injoignable)"
  exit 1
fi

DUMP="$(find "$SCRATCH" -name '*.dump' -type f | sort | tail -1)"
[ -n "$DUMP" ] || { journaliser "ECHEC : aucun dump dans le snapshot"; exit 1; }
journaliser "Dump restauré : $(basename "$DUMP") ($(stat -c%s "$DUMP") octets)"

# Les photos produits représentent la moitié de ce que la sauvegarde stocke et
# n'ont aucune autre copie : une preuve mensuelle qui les ignore n'en est pas une.
PHOTOS="$(find "$SCRATCH" -path '*/uploads/*' -type f | wc -l)"
journaliser "Uploads présents dans le snapshot : ${PHOTOS} fichier(s)"

# 2. Base jetable.
docker run -d --name "$CONTENEUR" \
  -e POSTGRES_USER=mb -e POSTGRES_PASSWORD=restore-test \
  -e POSTGRES_DB=multiboutique postgres:16-alpine >/dev/null

PRET=0
for _ in $(seq 1 30); do
  if docker exec "$CONTENEUR" pg_isready -U mb -d multiboutique >/dev/null 2>&1; then
    PRET=1
    break
  fi
  sleep 2
done
[ "$PRET" -eq 1 ] || { journaliser "ECHEC : la base jetable n'a pas démarré"; exit 1; }

# 3. Restaurer le dump dedans.
docker cp "$DUMP" "$CONTENEUR:/tmp/restore.dump"
docker exec "$CONTENEUR" pg_restore -U mb -d multiboutique --no-owner /tmp/restore.dump \
  || journaliser "Avertissement : pg_restore a signalé des erreurs non bloquantes"

# 4. Vérifier que les tables clés contiennent des données.
ECHEC=0
for table in "${TABLES[@]}"; do
  n="$(docker exec "$CONTENEUR" psql -U mb -d multiboutique -tAc "SELECT count(*) FROM ${table};" 2>/dev/null || echo "erreur")"
  if [ "$n" = "erreur" ] || [ "$n" = "0" ]; then
    journaliser "ECHEC : table ${table} absente ou vide (${n})"
    ECHEC=1
  else
    journaliser "OK : ${table} — ${n} ligne(s)"
  fi
done

if [ "$ECHEC" -ne 0 ]; then
  journaliser "TEST DE RESTAURATION EN ÉCHEC"
  exit 1
fi

journaliser "Test de restauration réussi"
