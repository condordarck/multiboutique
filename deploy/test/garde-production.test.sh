#!/usr/bin/env bash
set -euo pipefail

# Teste deploy/ci/garde-production.sh.
#   bash deploy/test/garde-production.test.sh

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
GARDE="$RACINE/deploy/ci/garde-production.sh"
ECHECS=0
verifier() {
  if [ "$1" = "$2" ]; then echo "  ok   $3"; else echo "  ÉCHEC $3 — attendu « $2 », obtenu « $1 »"; ECHECS=$((ECHECS + 1)); fi
}
executer() { if env "$@" bash "$GARDE" "$DEPOT" > "$DEPOT/sortie.log" 2>&1; then echo 0; else echo 1; fi; }

DEPOT="$(mktemp -d)"
mkdir -p "$DEPOT/apps/www" "$DEPOT/apps/backoffice"
for f in www backoffice; do cp "$RACINE/apps/$f/wrangler.jsonc" "$DEPOT/apps/$f/wrangler.jsonc"; done

echo "1. dépôt actuel, sans domaine : refus"
verifier "$(executer API_DOMAIN=)" "1" "refus"
verifier "$(grep -c "API_DOMAIN" "$DEPOT/sortie.log")" "1" "domaine manquant nommé"
verifier "$(grep -c "wrangler.jsonc n'a pas" "$DEPOT/sortie.log")" "2" "env.production manquant nommé pour les deux fronts"

echo "2. domaine mal formé : refus"
verifier "$(executer API_DOMAIN=exemple.org)" "1" "refus"

echo "3. domaine et env.production présents : accepté"
for f in www backoffice; do
  python3 - "$DEPOT/apps/$f/wrangler.jsonc" "$f" <<'PY'
import sys
p, front = sys.argv[1], sys.argv[2]
s = open(p).read()
s = s.replace('"env": {', '"env": {\n    "production": { "name": "mb-%s", "routes": [{ "pattern": "%s.exemple.org", "custom_domain": true }] },' % (front, front), 1)
open(p, "w").write(s)
PY
done
verifier "$(executer API_DOMAIN=api.exemple.org)" "0" "accepté"

if [ "$ECHECS" -ne 0 ]; then
  echo "$ECHECS échec(s)."
  exit 1
fi
echo "Tous les cas passent."
