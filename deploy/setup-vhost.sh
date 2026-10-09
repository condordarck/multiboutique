#!/usr/bin/env bash
set -euo pipefail

# Crée le vhost Apache de MultiBoutique et son certificat Let's Encrypt.
#
# À LANCER À LA MAIN, AVEC SUDO, UNE SEULE FOIS PAR SERVEUR :
#   sudo bash deploy/setup-vhost.sh
#
# Le CI ne peut pas l'exécuter : sudo exige un mot de passe sur la cible.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f deploy/.env ] && { set -a; . deploy/.env; set +a; }

: "${DOMAIN:?DOMAIN manquant dans deploy/.env}"
: "${APP_PORT:?APP_PORT manquant dans deploy/.env}"

[ "$(id -u)" -eq 0 ] || { echo "Ce script doit être lancé avec sudo." >&2; exit 1; }

# --- Contrôles préalables -------------------------------------------------

# 1. Le DNS doit déjà pointer sur cette machine, sinon certbot échouera.
IP_LOCALE="$(curl -fsS -m 10 https://api.ipify.org || echo "")"
IP_DNS="$(getent hosts "$DOMAIN" | awk '{print $1; exit}' || echo "")"
if [ -z "$IP_DNS" ]; then
  echo "ERREUR : $DOMAIN ne résout pas. Créer l'enregistrement DNS d'abord." >&2
  exit 1
fi
if [ -n "$IP_LOCALE" ] && [ "$IP_DNS" != "$IP_LOCALE" ]; then
  echo "ERREUR : $DOMAIN résout vers $IP_DNS, or cette machine est $IP_LOCALE." >&2
  exit 1
fi

# 2. Le port applicatif ne doit pas être déjà pris par un autre projet.
if ss -tln | grep -qE "[:.]${APP_PORT}\b"; then
  echo "ATTENTION : le port $APP_PORT est déjà écouté." >&2
  echo "S'il ne s'agit pas de multiboutique-prod, changer APP_PORT." >&2
  ss -tlnp 2>/dev/null | grep -E "[:.]${APP_PORT}\b" || true
fi

# 3. Les modules Apache requis.
for module in proxy proxy_http headers ssl; do
  a2enmod -q "$module" 2>/dev/null || true
done

# --- Vhost ----------------------------------------------------------------

VHOST="/etc/apache2/sites-available/${DOMAIN}.conf"

if [ -f "$VHOST" ]; then
  echo "Le vhost $VHOST existe déjà — rien à créer."
else
  cat > "$VHOST" <<VHOSTEOF
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
    Header always set X-Content-Type-Options "nosniff"
    Header setifempty Referrer-Policy "strict-origin-when-cross-origin"
    ErrorLog  \${APACHE_LOG_DIR}/error.${DOMAIN}.log
    CustomLog \${APACHE_LOG_DIR}/access.${DOMAIN}.log combined
</VirtualHost>
VHOSTEOF
  echo "Vhost créé : $VHOST"
fi

a2ensite -q "${DOMAIN}.conf"
apache2ctl configtest
systemctl reload apache2

# --- Certificat -----------------------------------------------------------

if [ -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  echo "Certificat déjà présent pour ${DOMAIN}."
else
  certbot --apache -d "${DOMAIN}" --redirect --non-interactive --agree-tos \
    --email "${CERTBOT_EMAIL:-arnaud.lokonon@asin.bj}"
fi

apache2ctl configtest
systemctl reload apache2

echo "OK — https://${DOMAIN} est servi vers 127.0.0.1:${APP_PORT}."
