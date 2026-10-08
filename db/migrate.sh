#!/usr/bin/env bash
set -euo pipefail

# Applique les migrations db/migrations/*.sql dans l'ordre, sans jamais
# ré-appliquer une migration déjà enregistrée dans la table schema_migrations.
#
# Usage :
#   ./db/migrate.sh                     # docker exec sur le conteneur multiboutique-db
#   ./db/migrate.sh --baseline          # marque l'état actuel comme déjà migré
#                                       #   (adoption d'une base préexistante migrée à la main)
#
# Variables optionnelles : CONTAINER, DB_USER, DB_NAME

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${CONTAINER:-multiboutique-db}"
DB_USER="${DB_USER:-mb}"
DB_NAME="${DB_NAME:-multiboutique}"

psql_cmd() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" "$@"
}

psql_cmd -q -c "CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);" >/dev/null

# ----- Baseline : ne modifie rien, enregistre les fichiers actuels -----
if [ "${1:-}" = "--baseline" ]; then
  n=0
  for f in "$DIR"/migrations/*.sql; do
    v="$(basename "$f" .sql)"
    psql_cmd -q -c "INSERT INTO schema_migrations (version) VALUES ('$v') ON CONFLICT DO NOTHING;" >/dev/null
    n=$((n + 1))
  done
  echo "[migrate] Baseline : $n migrations enregistrées comme déjà appliquées."
  exit 0
fi

# ----- Applique les migrations manquantes -----
applied=0
for f in "$DIR"/migrations/*.sql; do
  v="$(basename "$f" .sql)"
  if [ "$(psql_cmd -tAc "SELECT 1 FROM schema_migrations WHERE version = '$v'")" = "1" ]; then
    continue
  fi
  echo "[migrate] → $v"
  psql_cmd -1 < "$f"
  psql_cmd -q -c "INSERT INTO schema_migrations (version) VALUES ('$v');" >/dev/null
  applied=$((applied + 1))
done

if [ "$applied" -eq 0 ]; then
  echo "[migrate] À jour."
else
  echo "[migrate] $applied migration(s) appliquée(s)."
fi