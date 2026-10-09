#!/usr/bin/env bash
set -euo pipefail

# Redémarre l'application lorsqu'elle est signalée « unhealthy ».
#
#   bash deploy/healthcheck-cron.sh     (toutes les 2 minutes via cron)
#
# Docker ne redémarre PAS un conteneur unhealthy de lui-même. Vérifié sur
# Docker 29.7 : `restart: unless-stopped` n'a pas relancé le conteneur après un
# `docker kill` non plus (RestartCount resté à 0). Ce script est donc le seul
# filet, aussi bien pour un conteneur bloqué que pour un conteneur sorti — un
# conteneur `exited` rapporte `Health.Status=unhealthy` et est repris ici.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONTENEUR="multiboutique-prod"
MAX_REDEMARRAGES=3
FENETRE_MIN=30

mkdir -p backups
JOURNAL="backups/healthcheck.log"
touch "$JOURNAL"

journaliser() { echo "[$(date -Is)] $*" >> "$JOURNAL"; }

if ! docker inspect "$CONTENEUR" >/dev/null 2>&1; then
  journaliser "Conteneur ${CONTENEUR} introuvable — rien à faire"
  exit 0
fi

ETAT="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sans-sonde{{end}}' "$CONTENEUR" 2>/dev/null)"

case "$ETAT" in
  healthy)
    exit 0
    ;;
  starting)
    # Le start_period du healthcheck n'est pas écoulé : laisser démarrer.
    exit 0
    ;;
  sans-sonde)
    journaliser "Conteneur ${CONTENEUR} sans healthcheck — rien à surveiller"
    exit 0
    ;;
esac

# Garde anti-boucle : au-delà de MAX_REDEMARRAGES dans la fenêtre, on cesse
# de redémarrer. Un redémarrage en boucle masque la panne au lieu de la
# traiter, et empêche de lire les journaux du conteneur fautif.
DEPUIS="$(date -d "${FENETRE_MIN} minutes ago" -Is)"
RECENTS="$(awk -v depuis="$DEPUIS" '/Redemarrage declenche/ { horodatage = substr($1, 2, length($1) - 2); if (horodatage > depuis) n++ } END { print n+0 }' "$JOURNAL")"

if [ "$RECENTS" -ge "$MAX_REDEMARRAGES" ]; then
  journaliser "ETAT=${ETAT} — ${RECENTS} redemarrages en ${FENETRE_MIN} min, abandon (intervention manuelle requise)"
  exit 1
fi

journaliser "ETAT=${ETAT} — Redemarrage declenche (${RECENTS} precedents dans la fenetre)"
docker restart "$CONTENEUR" >/dev/null
journaliser "Redemarrage termine"
