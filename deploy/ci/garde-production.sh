#!/usr/bin/env bash
set -euo pipefail

# Garde du déploiement de production (job deploy-production du CI).
#
# La production n'existe pas encore (domaine à acquérir) : tant qu'elle n'est pas
# configurée, un tag v* ne doit rien déployer, et le dire clairement.
#   API_DOMAIN=api.<domaine> bash deploy/ci/garde-production.sh [racine du dépôt]

RACINE="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
erreurs=()

case "${API_DOMAIN:-}" in
  "") erreurs+=("la variable API_DOMAIN de l'environnement GitHub « production » est vide") ;;
  api.*) ;;
  *) erreurs+=("API_DOMAIN doit être de la forme api.<domaine> (reçu : « ${API_DOMAIN} »)") ;;
esac

for front in www backoffice; do
  fichier="$RACINE/apps/$front/wrangler.jsonc"
  if ! grep -Eq '"production"[[:space:]]*:' "$fichier"; then
    erreurs+=("apps/$front/wrangler.jsonc n'a pas d'environnement « production » (nom du Worker et domaine)")
  fi
done

if [ "${#erreurs[@]}" -gt 0 ]; then
  echo "La production n'est pas configurée ; rien n'est déployé :"
  for e in "${erreurs[@]}"; do echo "  - $e"; done
  echo "Procédure : docs/bascule-recette.md, section « Production »."
  exit 1
fi
echo "Production configurée pour ${API_DOMAIN}."
