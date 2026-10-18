#!/usr/bin/env bash
set -euo pipefail

# Santé d'un environnement après déploiement : l'API (par le tunnel) et les deux
# PWA, déduites de API_DOMAIN (api.<base> → www.<base>, backoffice.<base>).
#   API_DOMAIN=api.morpion.cloud bash deploy/ci/verifier-sante.sh

: "${API_DOMAIN:?API_DOMAIN est requis (ex. api.morpion.cloud)}"
case "$API_DOMAIN" in
  api.*) BASE="${API_DOMAIN#api.}" ;;
  *) echo "API_DOMAIN doit être de la forme api.<base> (reçu : « $API_DOMAIN »)" >&2; exit 1 ;;
esac
TENTATIVES="${TENTATIVES:-6}"
PAUSE="${PAUSE:-10}"

attendre_200() {
  local url="$1" code
  for tentative in $(seq 1 "$TENTATIVES"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)"
    echo "${url} — tentative ${tentative} : HTTP ${code}"
    [ "$code" = "200" ] && return 0
    sleep "$PAUSE"
  done
  echo "${url} ne répond pas 200 après déploiement." >&2
  return 1
}

attendre_200 "https://${API_DOMAIN}/health"
attendre_200 "https://www.${BASE}/"
attendre_200 "https://backoffice.${BASE}/"
echo "API et fronts en bonne santé."
