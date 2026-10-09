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

  # Le mot de passe est défini par \set DANS le flux SQL, jamais en argument de
  # commande : sur une machine partagée, --set=nouveau=... exposerait le
  # cleartext dans `ps` et dans la requête exec transmise au démon Docker.
  # Il passe par l'entrée standard car psql -c n'interpole pas les :'variables'.
  # openssl rand -base64 puis suppression de /+= ne laisse que [A-Za-z0-9] :
  # aucune apostrophe à échapper. Vérifié ci-dessous plutôt que supposé.
  case "$motdepasse" in
    *[!A-Za-z0-9]*)
      echo "ERREUR : mot de passe généré avec un caractère inattendu, abandon." >&2
      exit 1
      ;;
  esac

  resultat="$(docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U mb -d multiboutique -v ON_ERROR_STOP=1 -q -tA <<SQL
\set nouveau '${motdepasse}'
\set cible '${email}'
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
