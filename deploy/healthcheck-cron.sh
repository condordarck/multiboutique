#!/usr/bin/env bash
set -euo pipefail

# Redémarre l'application lorsqu'elle est bloquée, arrêtée ou « unhealthy ».
#
#   bash deploy/healthcheck-cron.sh     (toutes les 2 minutes via cron)
#
# Ce que couvre la politique `restart: unless-stopped`, et ce qu'elle ne couvre
# pas — mesuré sur Docker 29.7 :
#   - processus qui sort de lui-même (vrai crash) : Docker redémarre. OK.
#   - conteneur bloqué mais vivant (`unhealthy`)  : Docker ne fait RIEN.
#   - arrêt externe (`docker kill`)               : Docker ne fait RIEN.
# Les deux derniers cas sont la raison d'être de ce script.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f deploy/.env ] && { set -a; . deploy/.env; set +a; }

CONTENEUR_APP="multiboutique-prod"
CONTENEUR_DB="multiboutique-db"
MAX_REDEMARRAGES=3
FENETRE_MIN=30

mkdir -p backups
chmod 700 backups 2>/dev/null || true
JOURNAL="backups/healthcheck.log"
touch "$JOURNAL"

journaliser() { echo "[$(date -Is)] $*" >> "$JOURNAL"; }

alerter() {
  # Sans notification, « j'ai renoncé » n'est qu'une ligne dans un fichier que
  # personne ne lit. HEALTH_PING_URL est optionnel mais fortement conseillé.
  [ -n "${HEALTH_PING_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 3 "${HEALTH_PING_URL}/fail" >/dev/null 2>&1 || true
}

# Nombre de redémarrages déjà déclenchés dans la fenêtre glissante.
compter_recents() {
  local depuis
  depuis="$(date -d "${FENETRE_MIN} minutes ago" -Is)"
  awk -v depuis="$depuis" '
    /Redemarrage declenche/ {
      horodatage = substr($1, 2, length($1) - 2)
      if (horodatage > depuis) n++
    }
    END { print n+0 }' "$JOURNAL"
}

# Garde anti-boucle : un redémarrage en boucle masque la panne au lieu de la
# traiter, et empêche de lire les journaux du conteneur fautif.
redemarrer() {
  local conteneur="$1" motif="$2" recents
  recents="$(compter_recents)"

  if [ "$recents" -ge "$MAX_REDEMARRAGES" ]; then
    journaliser "${conteneur} : ${motif} — ${recents} redemarrages en ${FENETRE_MIN} min, abandon (intervention manuelle requise)"
    alerter
    return 1
  fi

  journaliser "${conteneur} : ${motif} — Redemarrage declenche (${recents} precedents dans la fenetre)"
  docker restart "$conteneur" >/dev/null
  journaliser "${conteneur} : redemarrage termine"
  return 0
}

# La base d'abord : elle porte mem_limit 512m sur une machine partagée, donc un
# OOM kill est un scénario réaliste. Si on ne regardait que l'app, on la
# redémarrerait trois fois pendant que la vraie victime reste à terre.
for conteneur in "$CONTENEUR_DB" "$CONTENEUR_APP"; do
  if ! docker inspect "$conteneur" >/dev/null 2>&1; then
    journaliser "Conteneur ${conteneur} introuvable — rien à faire"
    continue
  fi

  STATUT="$(docker inspect -f '{{.State.Status}}' "$conteneur")"

  # Vivacité avant santé : un conteneur arrêté n'a pas de sonde en cours, et on
  # ne veut pas dépendre de la valeur que Docker laisse dans Health.Status.
  if [ "$STATUT" != "running" ]; then
    redemarrer "$conteneur" "conteneur ${STATUT}" || exit 1
    continue
  fi

  SANTE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}sans-sonde{{end}}' "$conteneur")"

  case "$SANTE" in
    healthy|sans-sonde)
      ;;
    starting)
      # Le start_period n'est pas écoulé : laisser démarrer.
      ;;
    *)
      redemarrer "$conteneur" "sonde ${SANTE}" || exit 1
      ;;
  esac
done
