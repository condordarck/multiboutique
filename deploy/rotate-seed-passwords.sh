#!/usr/bin/env bash
set -euo pipefail

# Remplace les mots de passe des comptes seed par des valeurs aléatoires.
#
#   bash deploy/rotate-seed-passwords.sh
#
# À lancer au PREMIER déploiement de chaque environnement. Les identifiants
# admin123 / proprietaire123 sont publiés dans le dépôt : tant qu'ils sont
# actifs sur une instance joignable, l'application est ouverte à tous.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="deploy/docker-compose.prod.yml"
COMPTES=("admin@multiboutique.com" "proprietaire@multiboutique.com")

[ -f deploy/.env ] && { set -a; . deploy/.env; set +a; }

echo "Rotation des mots de passe des comptes par défaut."
echo "Les valeurs ci-dessous ne seront affichées QU'UNE FOIS."
echo

for email in "${COMPTES[@]}"; do
  motdepasse="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-24)"

  # --set alimente des variables psql interpolées par :'nom', ce qui échappe
  # correctement la valeur : le mot de passe n'est jamais concaténé dans le SQL.
  # Le SQL passe par l'entrée standard et non par -c, qui n'interpole pas les
  # variables psql.
  resultat="$(docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U mb -d multiboutique -v ON_ERROR_STOP=1 -q -tA \
         --set=nouveau="$motdepasse" --set=cible="$email" <<'SQL'
UPDATE utilisateurs
   SET password_hash = crypt(:'nouveau', gen_salt('bf', 10))
 WHERE email = :'cible'
RETURNING email;
SQL
)"

  if [ -z "$resultat" ]; then
    echo "ATTENTION : aucun compte ${email} en base, rien n'a été changé." >&2
    continue
  fi

  printf '  %-34s %s\n' "$email" "$motdepasse"
done

echo
echo "Noter ces mots de passe maintenant, puis les changer depuis l'interface."
