#!/usr/bin/env bash
set -euo pipefail

# Teste deploy/server-deploy.sh avec un faux `docker` qui journalise ses appels,
# dans une copie du dépôt (deploy/ et apps/api/db/).
#   bash deploy/test/server-deploy.test.sh

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
ECHECS=0
verifier() {
  if [ "$1" = "$2" ]; then echo "  ok   $3"; else echo "  ÉCHEC $3 — attendu « $2 », obtenu « $1 »"; ECHECS=$((ECHECS + 1)); fi
}

# Prépare une copie du dépôt et un faux docker. Comportement réglé par :
#   FAUX_API_SAINE=1|0   l'API répond-elle sur /health ?
#   FAUX_MONOLITHE=1|0   le conteneur multiboutique-prod existe-t-il ?
preparer() {
  DEPOT="$(mktemp -d)"
  mkdir -p "$DEPOT/apps/api" "$DEPOT/bin"
  cp -r "$RACINE/deploy" "$DEPOT/deploy"
  cp -r "$RACINE/apps/api/db" "$DEPOT/apps/api/db"
  rm -f "$DEPOT/deploy/.env"
  JOURNAL="$DEPOT/docker.log"
  : > "$JOURNAL"
  cat > "$DEPOT/bin/docker" <<'FAUX'
#!/usr/bin/env bash
echo "docker $*" >> "$JOURNAL"
case "$*" in
  *"ps --quiet --status running db"*) echo "id-db" ;;
  *"exec -T db pg_dump"*) echo "-- dump" ;;
  *"exec -T api node"*) [ "${FAUX_API_SAINE:-1}" = 1 ] || exit 1 ;;
  "inspect multiboutique-prod"*) [ "${FAUX_MONOLITHE:-1}" = 1 ] || exit 1 ;;
esac
exit 0
FAUX
  chmod +x "$DEPOT/bin/docker"
  export JOURNAL
}

# Environnement complet d'une recette (valeurs factices).
ENV_COMPLET=(
  POSTGRES_PASSWORD=pg
  API_IMAGE=ghcr.io/x/multiboutique-api:sha-1
  API_JWT_SECRET=0123456789abcdef0123456789abcdef
  TUNNEL_TOKEN=jeton
  ORIGINE_WWW=https://www.exemple.org
  ORIGINE_BACKOFFICE=https://backoffice.exemple.org
)

deployer() { env PATH="$DEPOT/bin:$PATH" SANTE_TENTATIVES=2 SANTE_PAUSE=0 "$@" bash "$DEPOT/deploy/server-deploy.sh" up; }
rang() { grep -n -m1 -- "$1" "$JOURNAL" | cut -d: -f1 || echo 0; }

echo "1. déploiement nominal : ordre des opérations, monolithe retiré en dernier"
preparer
mkdir -p "$DEPOT/public/uploads/produits" && printf 'img' > "$DEPOT/public/uploads/produits/a.png"
if deployer "${ENV_COMPLET[@]}" > "$DEPOT/sortie.log" 2>&1; then CODE=0; else CODE=$?; fi
verifier "$CODE" "0" "succès"
SAUVEGARDE="$(rang 'pg_dump')"; BASE="$(rang 'up -d db')"; API="$(rang 'up -d --force-recreate api cloudflared')"
SANTE="$(rang 'exec -T api node')"; RETRAIT="$(rang 'rm -f multiboutique-prod')"
verifier "$([ "$SAUVEGARDE" -lt "$BASE" ] && [ "$BASE" -lt "$API" ] && [ "$API" -lt "$SANTE" ] && [ "$SANTE" -lt "$RETRAIT" ] && echo ordre || echo désordre)" "ordre" "sauvegarde → base → API → santé → retrait du monolithe"
verifier "$(cat "$DEPOT/donnees/uploads/produits/a.png")" "img" "images déplacées avant le démarrage de l'API"
verifier "$(grep -c 'pull app\|up -d --force-recreate app' "$JOURNAL" || true)" "0" "plus aucun appel au service app"

echo "2. API malade : le monolithe n'est pas touché, échec"
preparer
if deployer "${ENV_COMPLET[@]}" FAUX_API_SAINE=0 > "$DEPOT/sortie.log" 2>&1; then CODE=0; else CODE=$?; fi
verifier "$([ "$CODE" -ne 0 ] && echo echec || echo succes)" "echec" "code de sortie non nul"
verifier "$(grep 'multiboutique-prod' "$JOURNAL" | grep -vc inspect || true)" "0" "aucune commande sur multiboutique-prod"
verifier "$(grep -c "L'API ne répond pas" "$DEPOT/sortie.log")" "1" "message explicite"

echo "3. configuration incomplète : arrêt avant toute sauvegarde"
preparer
if deployer POSTGRES_PASSWORD=pg API_IMAGE=x > "$DEPOT/sortie.log" 2>&1; then CODE=0; else CODE=$?; fi
verifier "$([ "$CODE" -ne 0 ] && echo echec || echo succes)" "echec" "code de sortie non nul"
verifier "$([ -s "$JOURNAL" ] && echo appels || echo aucun)" "aucun" "docker jamais appelé"
verifier "$(grep -c 'TUNNEL_TOKEN' "$DEPOT/sortie.log")" "1" "la variable manquante est nommée"

echo "4. sans monolithe (déjà retiré) : rien à supprimer, succès"
preparer
if deployer "${ENV_COMPLET[@]}" FAUX_MONOLITHE=0 > "$DEPOT/sortie.log" 2>&1; then CODE=0; else CODE=$?; fi
verifier "$CODE" "0" "succès"
verifier "$(grep -c 'rm -f multiboutique-prod' "$JOURNAL" || true)" "0" "aucune suppression"

echo "5. IMAGE (monolithe) encore dans l'environnement : signalée, ignorée"
preparer
deployer "${ENV_COMPLET[@]}" IMAGE=ghcr.io/x/multiboutique:main > "$DEPOT/sortie.log" 2>&1 || true
verifier "$(grep -c 'IMAGE (monolithe) est ignorée' "$DEPOT/sortie.log")" "1" "avertissement"

if [ "$ECHECS" -ne 0 ]; then
  echo "$ECHECS échec(s)."
  exit 1
fi
echo "Tous les cas passent."
