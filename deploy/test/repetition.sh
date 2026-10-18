#!/usr/bin/env bash
set -euo pipefail

# Répétition locale de la bascule de la recette (docs/bascule-recette.md), sur une
# pile Docker qui reproduit le VPS. Non lancée par le CI : à exécuter à la main
# avant de fusionner une modification du déploiement.
#
#   bash deploy/test/repetition.sh
#
# 1. Clone du dépôt à AVANT (défaut : main), monolithe + API + base lancés par
#    l'ancien server-deploy.sh, une image produit ajoutée dans public/uploads.
# 2. Bascule : checkout de APRES (défaut : la branche courante), nouveau
#    server-deploy.sh. Vérifie l'ordre (monolithe retiré après la santé de
#    l'API), les images, la base, puis qu'une seconde exécution ne change rien.
# 3. Retour arrière, avec les commandes de docs/bascule-recette.md (section 4) :
#    le monolithe répond de nouveau et sert l'image.
#
# Le tunnel est remplacé par un conteneur inerte (aucun jeton réel) ; les images
# ne sont pas tirées d'un registre (l'API est construite localement). Les noms
# des conteneurs sont ceux du VPS : la répétition refuse de démarrer s'ils
# existent déjà sur cette machine.
#
# Variables : AVANT, APRES, IMAGE_MONOLITHE (défaut : l'image de recette publiée),
# API_IMAGE_LOCALE (saute le build), APP_PORT_REPETITION (défaut 3902),
# GARDER=1 (laisse la pile et le clone pour inspection).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AVANT="$(git -C "$ROOT" rev-parse "${AVANT:-main}")"
APRES="$(git -C "$ROOT" rev-parse "${APRES:-HEAD}")"
IMAGE_MONOLITHE="${IMAGE_MONOLITHE:-ghcr.io/condordarck/multiboutique:main}"
APP_PORT_REPETITION="${APP_PORT_REPETITION:-3902}"
CONTENEURS=(multiboutique-db multiboutique-prod multiboutique-api multiboutique-tunnel)

echec() { echo "ÉCHEC : $*" >&2; exit 1; }
etape() { printf '\n=== %s\n' "$*"; }

# --- Garde-fous ------------------------------------------------------------
for c in "${CONTENEURS[@]}"; do
  if docker inspect "$c" >/dev/null 2>&1; then echec "le conteneur $c existe déjà sur cette machine."; fi
done
if docker volume inspect multiboutique_pgdata >/dev/null 2>&1; then
  echec "le volume multiboutique_pgdata existe déjà sur cette machine."
fi
if ss -tln | grep -qE "[:.]${APP_PORT_REPETITION}\b"; then
  echec "le port ${APP_PORT_REPETITION} est occupé (APP_PORT_REPETITION)."
fi

TRAVAIL="$(mktemp -d "${TMPDIR:-/tmp}/mb-repetition-XXXXXX")"
DEPOT="$TRAVAIL/multiboutique"
nettoyer() {
  if [ "${GARDER:-0}" = 1 ]; then
    echo "Pile et clone conservés : $DEPOT"
    return
  fi
  docker rm -f "${CONTENEURS[@]}" >/dev/null 2>&1 || true
  docker volume rm multiboutique_pgdata >/dev/null 2>&1 || true
  docker network rm multiboutique_multiboutique >/dev/null 2>&1 || true
  # Les fichiers écrits par les conteneurs (uploads, sauvegardes) peuvent
  # appartenir à root : un conteneur jetable les supprime.
  if [ -n "${API_IMAGE_LOCALE:-}" ]; then
    docker run --rm --user 0 --entrypoint rm -v "$TRAVAIL:/t" "$API_IMAGE_LOCALE" -rf /t/multiboutique >/dev/null 2>&1 || true
  fi
  rm -rf "$TRAVAIL"
}
trap nettoyer EXIT

# --- docker du VPS, sans registre ni tunnel ---------------------------------
# Les scripts appellent `docker compose -f deploy/docker-compose.prod.yml …` :
# l'enveloppe ajoute la surcharge du tunnel et ignore les `pull` (images locales).
mkdir -p "$TRAVAIL/bin"
# Le tunnel inerte réutilise l'image de l'API (déjà locale) : aucun registre
# n'est nécessaire. Écrite plus bas, une fois cette image connue.
cat > "$TRAVAIL/bin/docker" <<EOF
#!/usr/bin/env bash
VRAI_DOCKER="$(command -v docker)"
if [ "\${1:-}" = compose ] && [ "\${2:-}" = -f ]; then
  for arg in "\$@"; do [ "\$arg" = pull ] && exit 0; done
  fichier="\$3"; shift 3
  exec "\$VRAI_DOCKER" compose -f "\$fichier" -f "$TRAVAIL/surcharge.yml" "\$@"
fi
exec "\$VRAI_DOCKER" "\$@"
EOF
chmod +x "$TRAVAIL/bin/docker"
export PATH="$TRAVAIL/bin:$PATH"

dans_depot() { (cd "$DEPOT" && "$@"); }
compose() { dans_depot docker compose -f deploy/docker-compose.prod.yml "$@"; }
psql_vps() { docker exec -i multiboutique-db psql -U mb -d multiboutique -tA "$@"; }

comptages() {
  psql_vps -c "SELECT table_name FROM information_schema.tables
               WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1" |
    while read -r table; do
      # < /dev/null : sinon docker exec -i lit la suite de la liste des tables.
      echo "$table $(psql_vps -c "SELECT count(*) FROM \"$table\"" < /dev/null)"
    done
}

# Statut HTTP d'une URL de l'API, vue depuis son conteneur (aucun port publié).
http_api() {
  docker exec multiboutique-api node -e \
    "fetch('http://127.0.0.1:4000$1').then(r=>console.log(r.status)).catch(()=>console.log(0))"
}

attendre() {
  local description="$1"; shift
  for _ in $(seq 1 60); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  echec "$description"
}

# --- Images ----------------------------------------------------------------
etape "Images : monolithe ${IMAGE_MONOLITHE}, API"
docker image inspect "$IMAGE_MONOLITHE" >/dev/null 2>&1 || docker pull -q "$IMAGE_MONOLITHE"
git clone -q "$ROOT" "$DEPOT"
git -C "$DEPOT" checkout -q --detach "$APRES"
if [ -z "${API_IMAGE_LOCALE:-}" ]; then
  API_IMAGE_LOCALE="mb-repetition-api:local"
  docker build -q -f "$DEPOT/apps/api/Dockerfile" -t "$API_IMAGE_LOCALE" "$DEPOT" >/dev/null
fi
echo "API : $API_IMAGE_LOCALE"
cat > "$TRAVAIL/surcharge.yml" <<EOF
services:
  cloudflared:
    image: ${API_IMAGE_LOCALE}
    entrypoint: ["sleep", "infinity"]
    command: []
EOF

# --- 1. État d'avant -------------------------------------------------------
etape "1. Avant la bascule (${AVANT:0:7}) : monolithe, API, base"
git -C "$DEPOT" checkout -q --detach "$AVANT"
cat > "$DEPOT/deploy/.env" <<EOF
POSTGRES_PASSWORD=repetition-$(openssl rand -hex 8)
IMAGE=${IMAGE_MONOLITHE}
APP_PORT=${APP_PORT_REPETITION}
JWT_SECRET=$(openssl rand -hex 32)
DOMAIN=multiboutique.exemple.invalid
API_JWT_SECRET=$(openssl rand -hex 32)
TUNNEL_TOKEN=jeton-factice
ORIGINE_WWW=https://www.exemple.invalid
ORIGINE_BACKOFFICE=https://backoffice.exemple.invalid
EOF
chmod 600 "$DEPOT/deploy/.env"

# Base prête en TCP avant l'ancien script : sur un volume neuf, son attente par
# le socket Unix laisserait partir les migrations pendant l'init (cf. le
# correctif de la phase 5). Sur le VPS, le volume existe déjà.
compose up -d db >/dev/null 2>&1
attendre "la base ne démarre pas" docker exec multiboutique-db pg_isready -h 127.0.0.1 -U mb -d multiboutique

dans_depot env API_IMAGE="$API_IMAGE_LOCALE" bash deploy/server-deploy.sh up > "$TRAVAIL/avant.log" 2>&1 \
  || { cat "$TRAVAIL/avant.log"; echec "déploiement d'avant"; }
monolithe_sain() { curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT_REPETITION}/api/health"; }
attendre "le monolithe ne répond pas" monolithe_sain
attendre "l'API d'avant ne répond pas" bash -c "[ \"\$(docker exec multiboutique-api node -e \"fetch('http://127.0.0.1:4000/health').then(r=>console.log(r.status)).catch(()=>console.log(0))\")\" = 200 ]"
echo "monolithe et API en service"

IMAGE_PRODUIT="$(cat /proc/sys/kernel/random/uuid).png"
mkdir -p "$DEPOT/public/uploads/produits"
cp "$ROOT/deploy/images-suivies/produits/7f103e59-f241-4d94-a1e0-cb3452b6797f.png" "$DEPOT/public/uploads/produits/$IMAGE_PRODUIT"
[ "$(http_api "/uploads/produits/$IMAGE_PRODUIT")" = 200 ] || echec "l'API d'avant ne sert pas l'image ajoutée"
NB_FICHIERS_AVANT="$(find "$DEPOT/public/uploads" -type f | wc -l)"
comptages > "$TRAVAIL/comptages-avant.txt"
echo "image ${IMAGE_PRODUIT} servie ; ${NB_FICHIERS_AVANT} fichiers ; $(wc -l < "$TRAVAIL/comptages-avant.txt") tables comptées"

# Section 1.2 de la procédure : empreinte du monolithe en service (l'API,
# construite ici, n'en a pas : elle garde son étiquette locale).
EMPREINTE_MONOLITHE="$(docker image inspect "$(docker inspect multiboutique-prod --format '{{.Image}}')" \
  --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
EMPREINTE_MONOLITHE="${EMPREINTE_MONOLITHE:-$IMAGE_MONOLITHE}"
echo "monolithe en service : ${EMPREINTE_MONOLITHE}"

# Section 1.3 de la procédure.
cp -p "$DEPOT/deploy/.env" "$DEPOT/deploy/.env.avant-bascule"

# --- 2. Bascule ------------------------------------------------------------
etape "2. Bascule (${APRES:0:7})"
git -C "$DEPOT" checkout -q --detach "$APRES"
dans_depot env API_IMAGE="$API_IMAGE_LOCALE" bash deploy/server-deploy.sh up > "$TRAVAIL/bascule.log" 2>&1 \
  || { cat "$TRAVAIL/bascule.log"; echec "bascule"; }
sed 's/^/  │ /' "$TRAVAIL/bascule.log" | grep -v "^  │ \(CREATE\|ALTER\|INSERT\|NOTICE\|UPDATE\)" || true

ligne_sante="$(grep -n "saine, tunnel démarré" "$TRAVAIL/bascule.log" | cut -d: -f1)"
ligne_retrait="$(grep -n "multiboutique-prod (monolithe) arrêté" "$TRAVAIL/bascule.log" | cut -d: -f1)"
{ [ -n "$ligne_sante" ] && [ -n "$ligne_retrait" ]; } || echec "santé ou retrait du monolithe absents du journal"
[ "$ligne_sante" -lt "$ligne_retrait" ] || echec "monolithe retiré avant la santé de l'API"
echo "ok   monolithe retiré après la santé de l'API (lignes $ligne_sante < $ligne_retrait)"

if docker inspect multiboutique-prod >/dev/null 2>&1; then echec "multiboutique-prod existe encore"; fi
for c in multiboutique-db multiboutique-api multiboutique-tunnel; do
  [ "$(docker inspect -f '{{.State.Running}}' "$c")" = true ] || echec "$c ne tourne pas"
done
echo "ok   conteneurs : db, api, tunnel ; plus de multiboutique-prod"

[ ! -e "$DEPOT/public" ] || echec "public/ subsiste : $(find "$DEPOT/public" | head -5 | tr '\n' ' ')"
NB_FICHIERS_APRES="$(find "$DEPOT/donnees/uploads" -type f | wc -l)"
[ "$NB_FICHIERS_APRES" -ge "$NB_FICHIERS_AVANT" ] || echec "fichiers perdus : ${NB_FICHIERS_APRES} < ${NB_FICHIERS_AVANT}"
[ "$(http_api "/uploads/produits/$IMAGE_PRODUIT")" = 200 ] || echec "l'API ne sert plus l'image après la bascule"
for suivie in "$ROOT"/deploy/images-suivies/produits/*; do
  [ "$(http_api "/uploads/produits/$(basename "$suivie")")" = 200 ] || echec "image suivie $(basename "$suivie") non servie"
done
echo "ok   images dans donnees/uploads (${NB_FICHIERS_APRES} fichiers), servies par l'API"

comptages > "$TRAVAIL/comptages-apres.txt"
diff -u "$TRAVAIL/comptages-avant.txt" "$TRAVAIL/comptages-apres.txt" || echec "la base a changé pendant la bascule"
echo "ok   base intacte ($(wc -l < "$TRAVAIL/comptages-apres.txt") tables, mêmes comptages)"

etape "2 bis. Seconde exécution"
find "$DEPOT/donnees" -type f -printf '%P %s\n' | sort > "$TRAVAIL/fichiers-1.txt"
dans_depot env API_IMAGE="$API_IMAGE_LOCALE" bash deploy/server-deploy.sh up > "$TRAVAIL/bascule-2.log" 2>&1 \
  || { cat "$TRAVAIL/bascule-2.log"; echec "seconde exécution"; }
find "$DEPOT/donnees" -type f -printf '%P %s\n' | sort > "$TRAVAIL/fichiers-2.txt"
diff -u "$TRAVAIL/fichiers-1.txt" "$TRAVAIL/fichiers-2.txt" || echec "la seconde exécution a modifié les images"
comptages | diff -u "$TRAVAIL/comptages-apres.txt" - || echec "la seconde exécution a modifié la base"
grep -q "\[migrate\] À jour" "$TRAVAIL/bascule-2.log" || echec "la seconde exécution a rejoué des migrations"
if grep -q "multiboutique-prod" "$TRAVAIL/bascule-2.log"; then echec "la seconde exécution a vu un monolithe"; fi
echo "ok   seconde exécution sans effet (images, base, migrations)"

# Section 3.3 de la procédure : nettoyage du .env.
sed -i -E '/^(IMAGE|APP_PORT|JWT_SECRET|DOMAIN|CERTBOT_EMAIL)=/d' "$DEPOT/deploy/.env"
[ "$(grep -cE '^(IMAGE|APP_PORT|JWT_SECRET|DOMAIN|CERTBOT_EMAIL)=' "$DEPOT/deploy/.env" || true)" = 0 ] || echec "nettoyage du .env"
dans_depot env API_IMAGE="$API_IMAGE_LOCALE" bash deploy/server-deploy.sh up > "$TRAVAIL/bascule-3.log" 2>&1 \
  || { cat "$TRAVAIL/bascule-3.log"; echec "déploiement après nettoyage du .env"; }
if grep -q "IMAGE (monolithe) est ignorée" "$TRAVAIL/bascule-3.log"; then echec "IMAGE encore lue après nettoyage"; fi
echo "ok   déploiement après nettoyage du .env"

# --- 3. Retour arrière (section 4 de la procédure) ---------------------------
etape "3. Retour arrière vers ${AVANT:0:7}"
(
  cd "$DEPOT"
  cp -p deploy/.env deploy/.env.apres-bascule
  cp -p deploy/.env.avant-bascule deploy/.env
  git checkout -q --detach "$AVANT"
  mkdir -p public/uploads
  cp -a donnees/uploads/. public/uploads/
  [ "$(find public/uploads -type f | wc -l)" -ge "$(find donnees/uploads -type f | wc -l)" ]
  rm -rf donnees/uploads
  # IMAGE se corrige dans le .env : l'ancien script le relit par-dessus l'environnement.
  sed -i "s|^IMAGE=.*|IMAGE=${EMPREINTE_MONOLITHE}|" deploy/.env
  API_IMAGE="$API_IMAGE_LOCALE" bash deploy/server-deploy.sh up
) > "$TRAVAIL/retour.log" 2>&1 || { cat "$TRAVAIL/retour.log"; echec "retour arrière"; }
attendre "le monolithe ne répond pas après le retour arrière" monolithe_sain
[ "$(docker inspect multiboutique-prod --format '{{.Config.Image}}')" = "$EMPREINTE_MONOLITHE" ] \
  || echec "le monolithe relancé n'est pas l'image relevée (${EMPREINTE_MONOLITHE})"
echo "ok   monolithe de nouveau en service, image relevée (http://127.0.0.1:${APP_PORT_REPETITION}/api/health)"
attendre "l'API ne répond pas après le retour arrière" bash -c "[ \"\$(docker exec multiboutique-api node -e \"fetch('http://127.0.0.1:4000/health').then(r=>console.log(r.status)).catch(()=>console.log(0))\")\" = 200 ]"
[ "$(http_api "/uploads/produits/$IMAGE_PRODUIT")" = 200 ] || echec "l'image n'est plus servie après le retour arrière"
code_monolithe="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT_REPETITION}/uploads/produits/$IMAGE_PRODUIT")"
[ "$code_monolithe" = 200 ] || echec "le monolithe ne sert pas l'image (HTTP $code_monolithe)"
echo "ok   image servie par l'API et par le monolithe"
comptages | diff -u "$TRAVAIL/comptages-avant.txt" - || echec "la base a changé pendant le retour arrière"
echo "ok   base intacte"

etape "3 bis. Re-bascule après retour arrière"
(
  cd "$DEPOT"
  cp -p deploy/.env.apres-bascule deploy/.env
  git checkout -q --detach "$APRES"
  API_IMAGE="$API_IMAGE_LOCALE" bash deploy/server-deploy.sh up
) > "$TRAVAIL/rebascule.log" 2>&1 || { cat "$TRAVAIL/rebascule.log"; echec "re-bascule"; }
if docker inspect multiboutique-prod >/dev/null 2>&1; then echec "multiboutique-prod existe encore après la re-bascule"; fi
[ "$(http_api "/uploads/produits/$IMAGE_PRODUIT")" = 200 ] || echec "image non servie après la re-bascule"
echo "ok   re-bascule : monolithe retiré, image servie"

etape "Répétition réussie."
