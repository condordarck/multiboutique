# Durcissement du déploiement VPS — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre MultiBoutique exploitable en HTTPS sur deux environnements (recette sur `carrefoot-dev`, production ultérieure) avec sauvegardes chiffrées délocalisées, détection de panne et secrets rotés.

**Architecture :** Le reverse proxy sort du compose et revient à l'Apache déjà installé sur l'hôte. Un unique `docker-compose.prod.yml` paramétré par `deploy/.env` sert les deux environnements. Les sauvegardes passent par restic conteneurisé vers Cloudflare R2, chiffrées côté client.

**Tech Stack :** Next.js 15 (standalone), PostgreSQL 16, Docker Compose v2, Apache 2 + certbot, restic (conteneur), GitHub Actions.

**Spec :** `docs/superpowers/specs/2026-10-09-deploiement-vps-design.md`

## Global Constraints

- **Aucun framework de test dans le dépôt** et la spec (§4) exclut d'en introduire un. Le cycle rouge/vert de chaque tâche s'appuie donc sur des **commandes de vérification exécutables** : on lance la commande avant la modification pour la voir échouer, puis après pour la voir réussir. Le principe TDD est conservé, le support change.
- **Instance applicative unique.** `lib/rate-limit.ts:7` garde son registre en mémoire : ne jamais introduire de réplique ni de `deploy.replicas`.
- **Aucun port sur `0.0.0.0`.** Tous les `ports:` du compose de production sont préfixés `127.0.0.1:`.
- **`sudo` est interactif sur la cible.** Aucun script appelé par le CI ne doit invoquer `sudo`. Seul `deploy/setup-vhost.sh` le fait, et il est lancé à la main.
- **Alias d'import TypeScript :** `@/*` → racine du projet (`tsconfig.json`).
- **Colonne des mots de passe :** `utilisateurs.password_hash`, bcrypt via `pgcrypto`.
- **Nommage :** le code et les messages de ce dépôt sont en français. Les messages de commit suivent le style existant (`Préfixe : description`).
- **Valeurs de recette :** `DOMAIN=multiboutique.dev4future.space`, `APP_PORT=3002`, `SERVER_HOST=51.77.221.201`, `SERVER_PORT=22020`, `SERVER_USER=arnaud`, `APP_DIR=/home/arnaud/multiboutique`.

## Review Focus

Cinq classes d'entrées que la spec implique sans qu'aucune tâche ne les exerce spontanément. Chacune reçoit sa vérification dans la tâche qui détient le code.

1. **Base injoignable pendant que l'app tourne** — `/api/health` doit répondre 503, pas lever une exception non capturée ni pendre indéfiniment. → Tâche 1, étape 6.
2. **`public/uploads` absent ou vide au moment de la sauvegarde** — `backup.sh` doit produire un snapshot valide malgré tout, pas s'interrompre. → Tâche 6, étape 7.
3. **`pg_dump` qui échoue en produisant un fichier vide** — le script ne doit jamais envoyer un dump de 0 octet sur R2 en signalant un succès. → Tâche 6, étape 8.
4. **Conteneur durablement `unhealthy`** — `healthcheck-cron.sh` doit cesser de redémarrer après 3 tentatives en 30 minutes, sinon la boucle de redémarrage masque la panne. → Tâche 8, étape 6.
5. **`IMAGE` non défini au déploiement** — `server-deploy.sh` doit échouer bruyamment plutôt que tirer l'image d'un tiers. → Tâche 9, étape 2.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `app/api/health/route.ts` | *Créé.* Sonde de vivacité applicative + base | 1 |
| `deploy/docker-compose.prod.yml` | *Modifié.* Topologie : plus de nginx, ports locaux, limites, healthcheck | 2 |
| `deploy/.env.example` | *Créé.* Documentation des variables, sans valeur exploitable | 2 |
| `docker-compose.yml` | *Modifié.* Suppression du défaut `mbpassword` | 3 |
| `lib/db.ts` | *Modifié.* Suppression de la chaîne de connexion en repli | 3 |
| `deploy/setup-vhost.sh` | *Créé.* Vhost Apache + certbot, lancé à la main avec sudo | 4 |
| `deploy/rotate-seed-passwords.sh` | *Créé.* Rotation des comptes seed | 5 |
| `deploy/backup.sh` | *Créé.* Dump + uploads → restic → R2, avec journal et alerte | 6 |
| `deploy/restore-test.sh` | *Créé.* Restauration de contrôle dans un Postgres jetable | 7 |
| `deploy/healthcheck-cron.sh` | *Créé.* Redémarrage sur `unhealthy`, avec garde anti-boucle | 8 |
| `deploy/server-deploy.sh` | *Modifié.* `IMAGE` obligatoire, chemins corrigés | 9 |
| `.github/workflows/ci-cd.yml` | *Modifié.* Deux environnements + smoke test | 10 |
| `README.md`, `docs/CAHIER_DES_CHARGES.md` | *Modifiés.* Documentation d'exploitation | 11 |

---

### Task 1: Route de santé

**Files:**
- Create: `app/api/health/route.ts`

**Interfaces:**
- Consumes: `pool` exporté par `lib/db.ts`
- Produces: `GET /api/health` → `200 {"status":"ok"}` ou `503 {"status":"degraded"}`. Consommé par le healthcheck du compose (tâche 2), par `healthcheck-cron.sh` (tâche 8) et par le smoke test CI (tâche 10).

- [ ] **Step 1: Lancer la base et l'app en local**

```bash
cd /home/fifonsi/WebstormProjects/multiboutique
docker compose up -d db
DATABASE_URL=postgresql://mb:mbpassword@localhost:5432/multiboutique \
  JWT_SECRET=$(openssl rand -hex 32) npm run dev &
sleep 15
```

- [ ] **Step 2: Vérifier que la route n'existe pas (rouge)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health`
Expected: `404`

- [ ] **Step 3: Écrire la route**

```typescript
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// Jamais mise en cache : la sonde doit refléter l'état courant.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("SELECT 1");
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    // Aucun détail d'erreur : la route est publique.
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
```

- [ ] **Step 4: Vérifier le cas nominal (vert)**

Run: `curl -s -w "\n%{http_code}\n" http://localhost:3000/api/health`
Expected: `{"status":"ok"}` puis `200`

- [ ] **Step 5: Vérifier qu'aucune donnée métier ne fuit**

Run: `curl -s http://localhost:3000/api/health | grep -Eq '^\{"status":"(ok|degraded)"\}$' && echo CONFORME || echo FUITE`
Expected: `CONFORME` — la réponse ne contient ni version, ni nom d'hôte, ni trace d'erreur.

- [ ] **Step 6: Vérifier le cas base injoignable (Review Focus #1)**

```bash
docker compose stop db
sleep 2
curl -s -m 15 -w "\n%{http_code}\n" http://localhost:3000/api/health
docker compose start db
```
Expected: `{"status":"degraded"}` puis `503`, en moins de 15 secondes et sans que le serveur Next ne plante. Si la commande atteint le délai de 15 s, c'est que `connectionTimeoutMillis` (`lib/db.ts`) ne borne pas l'attente — à corriger avant de continuer.

- [ ] **Step 7: Arrêter l'app de développement**

```bash
kill %1 2>/dev/null || true
docker compose down
```

- [ ] **Step 8: Commit**

```bash
git add app/api/health/route.ts
git commit -m "Sonde de santé : route /api/health (base + applicatif)"
```

---

### Task 2: Topologie du compose de production

**Files:**
- Modify: `deploy/docker-compose.prod.yml`
- Create: `deploy/.env.example`

**Interfaces:**
- Consumes: `GET /api/health` (tâche 1)
- Produces: les variables `APP_PORT`, `IMAGE`, `POSTGRES_PASSWORD`, `JWT_SECRET` consommées par `server-deploy.sh` (tâche 9) et `backup.sh` (tâche 6). Conteneurs nommés `multiboutique-prod` (app) et `multiboutique-db` (base), noms utilisés par les tâches 5 à 8.

- [ ] **Step 1: Vérifier l'état actuel (rouge)**

```bash
cd /home/fifonsi/WebstormProjects/multiboutique
IMAGE=exemple:latest POSTGRES_PASSWORD=x JWT_SECRET=y \
  docker compose -f deploy/docker-compose.prod.yml config | grep -E "nginx|published|0\.0\.0\.0"
```
Expected: le service `nginx` apparaît et le port `5432` de la base est publié. C'est ce qu'on supprime.

- [ ] **Step 2: Réécrire le fichier**

```yaml
# Application — profil PRODUCTION et RECETTE.
# Le reverse proxy n'est PAS dans ce fichier : il est fourni par l'hôte
# (Apache + certbot en recette, cf. deploy/setup-vhost.sh).
# Secrets et valeurs par environnement : deploy/.env (jamais commité).

services:
  db:
    image: postgres:16-alpine
    container_name: multiboutique-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: mb
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant (ex: openssl rand -hex 16)}"
      POSTGRES_DB: multiboutique
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    # Aucun port publié : la base n'est joignable que par le réseau Docker.
    # Les pg_dump passent par `docker compose exec`.
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mb -d multiboutique"]
      interval: 5s
      timeout: 5s
      retries: 12
    mem_limit: 512m
    networks:
      - multiboutique

  app:
    image: "${IMAGE:?IMAGE manquant (ex: ghcr.io/fiflokonon/multiboutique:main)}"
    container_name: multiboutique-prod
    restart: unless-stopped
    ports:
      # Jamais 0.0.0.0 : c'est le reverse proxy de l'hôte qui expose l'app.
      - "127.0.0.1:${APP_PORT:?APP_PORT manquant (recette: 3002)}:3000"
    environment:
      DATABASE_URL: "postgresql://mb:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant}@db:5432/multiboutique"
      JWT_SECRET: "${JWT_SECRET:?JWT_SECRET manquant (ex: openssl rand -hex 32)}"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ../public/uploads:/app/public/uploads
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    mem_limit: 640m
    networks:
      - multiboutique

networks:
  multiboutique:
    driver: bridge

volumes:
  pgdata:
```

- [ ] **Step 3: Vérifier que la configuration est valide et conforme (vert)**

```bash
IMAGE=exemple:latest POSTGRES_PASSWORD=x JWT_SECRET=y APP_PORT=3002 \
  docker compose -f deploy/docker-compose.prod.yml config > /tmp/mb-config.yml
grep -q nginx /tmp/mb-config.yml && echo "ECHEC: nginx present" || echo "OK: nginx supprime"
grep -q "0.0.0.0" /tmp/mb-config.yml && echo "ECHEC: bind public" || echo "OK: aucun bind public"
grep -c "mem_limit\|memory" /tmp/mb-config.yml
```
Expected: `OK: nginx supprime`, `OK: aucun bind public`, et au moins 2 limites mémoire.

- [ ] **Step 4: Vérifier que l'absence d'une variable fait échouer le démarrage**

```bash
IMAGE=exemple:latest POSTGRES_PASSWORD=x JWT_SECRET=y \
  docker compose -f deploy/docker-compose.prod.yml config >/dev/null 2>&1 \
  && echo "ECHEC: APP_PORT absent toléré" || echo "OK: APP_PORT requis"
```
Expected: `OK: APP_PORT requis`

- [ ] **Step 5: Écrire `deploy/.env.example`**

```bash
# Copier vers deploy/.env sur le serveur et renseigner. JAMAIS commité.

# --- Image et exposition ---
IMAGE=ghcr.io/fiflokonon/multiboutique:main
APP_PORT=3002
DOMAIN=multiboutique.dev4future.space

# --- Secrets applicatifs ---
# openssl rand -hex 16
POSTGRES_PASSWORD=
# openssl rand -hex 32 (32 caractères minimum)
JWT_SECRET=

# --- Sauvegardes restic vers Cloudflare R2 ---
RESTIC_REPOSITORY=s3:https://<account_id>.r2.cloudflarestorage.com/<bucket>
# ATTENTION : clé de chiffrement du dépôt. En conserver une copie HORS
# du serveur (gestionnaire de mots de passe). Perdue = sauvegardes
# définitivement irrécupérables.
RESTIC_PASSWORD=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# --- Optionnel : alerte si la sauvegarde n'a pas lieu ---
BACKUP_PING_URL=

# --- Optionnel : uniquement si le paquet GHCR est privé ---
GHCR_USER=
GHCR_TOKEN=
```

- [ ] **Step 6: Vérifier que `.env` reste ignoré par git**

Run: `git check-ignore -v deploy/.env && echo OK || echo "ECHEC: .env serait commité"`
Expected: `OK`. Si ça échoue, ajouter `deploy/.env` à `.gitignore` dans ce même commit.

- [ ] **Step 7: Supprimer le service nginx du compose racine**

Dans `docker-compose.yml` (racine), supprimer intégralement le service `nginx`
(de la ligne `  nginx:` jusqu'à sa clé `networks:` incluse). Il monte
`./nginx/conf.d`, supprimé à l'étape suivante : les deux changements doivent
tenir dans le même commit, sinon le compose racine référence un dossier absent.

- [ ] **Step 8: Supprimer la configuration nginx devenue morte**

```bash
git rm -r --quiet nginx
```

- [ ] **Step 9: Vérifier que le compose racine reste valide**

```bash
POSTGRES_PASSWORD=x JWT_SECRET=y docker compose config >/dev/null \
  && echo "OK: compose racine valide" || echo "ECHEC"
grep -c nginx docker-compose.yml || true
```
Expected: `OK: compose racine valide` et aucune occurrence de `nginx`.

> `POSTGRES_PASSWORD` n'est rendu obligatoire qu'en tâche 3 : à ce stade la
> commande passe avec ou sans la variable.

- [ ] **Step 10: Commit**

```bash
git add deploy/docker-compose.prod.yml deploy/.env.example docker-compose.yml .gitignore
git commit -m "Compose : reverse proxy délégué à l'hôte, ports locaux, limites mémoire"
```

---

### Task 3: Suppression des secrets par défaut

**Files:**
- Modify: `docker-compose.yml`
- Modify: `lib/db.ts:8-12`

**Interfaces:**
- Produces: `DATABASE_URL` devient obligatoire au démarrage de l'application.

- [ ] **Step 1: Constater le défaut en dur (rouge)**

```bash
grep -n "mbpassword" docker-compose.yml lib/db.ts
```
Expected: plusieurs occurrences — c'est ce qu'on supprime.

- [ ] **Step 2: Rendre `POSTGRES_PASSWORD` obligatoire dans `docker-compose.yml`**

Remplacer dans le service `db` :

```yaml
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant (ex: openssl rand -hex 16)}"
```

et dans les services `app` et `dev`, remplacer la valeur en dur de `DATABASE_URL` par :

```yaml
      DATABASE_URL: "postgresql://mb:${POSTGRES_PASSWORD:?POSTGRES_PASSWORD manquant}@db:5432/multiboutique"
```

- [ ] **Step 3: Supprimer le repli en dur dans `lib/db.ts`**

Remplacer le bloc de construction du pool par :

```typescript
const chaineConnexion = process.env.DATABASE_URL;

if (!chaineConnexion) {
  // Échec bruyant : se rabattre silencieusement sur une base locale masque
  // une erreur de configuration jusqu'à ce qu'elle devienne une panne.
  throw new Error(
    "DATABASE_URL est requis. Voir .env.local.example (développement) ou deploy/.env.example (serveur)."
  );
}

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: chaineConnexion,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
```

- [ ] **Step 4: Vérifier qu'aucun secret en dur ne subsiste (vert)**

```bash
grep -rn "mbpassword" --include="*.ts" --include="*.yml" --include="*.yaml" . | grep -v node_modules
```
Expected: aucune sortie.

- [ ] **Step 5: Vérifier que le build passe toujours**

Run: `npm run build`
Expected: compilation réussie. Le build Next ne doit pas évaluer `lib/db.ts` au point de lever l'erreur — s'il échoue avec « DATABASE_URL est requis », c'est qu'une page force l'évaluation au build : exporter `dynamic = "force-dynamic"` sur la page fautive plutôt que de réintroduire le repli.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml lib/db.ts
git commit -m "Secrets : suppression des mots de passe par défaut et du repli de connexion"
```

---

### Task 4: Vhost Apache et certificat

**Files:**
- Create: `deploy/setup-vhost.sh`

**Interfaces:**
- Consumes: `DOMAIN` et `APP_PORT` depuis `deploy/.env` (tâche 2)
- Produces: un vhost Apache en HTTPS mandatant `127.0.0.1:${APP_PORT}`. Prérequis du smoke test (tâche 10).

- [ ] **Step 1: Écrire le script**

```bash
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
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `bash -n deploy/setup-vhost.sh && echo "syntaxe OK"`
Expected: `syntaxe OK`

- [ ] **Step 3: Vérifier le garde-fou root**

Run: `bash deploy/setup-vhost.sh; echo "code=$?"`
Expected: `Ce script doit être lancé avec sudo.` et `code=1`. (Si `deploy/.env` est absent en local, l'échec sur `DOMAIN manquant` est également acceptable — il survient avant.)

- [ ] **Step 4: Rendre le script exécutable et commiter**

```bash
chmod +x deploy/setup-vhost.sh
git add deploy/setup-vhost.sh
git commit -m "Vhost : script d'installation Apache + certbot (exécution manuelle)"
```

---

### Task 5: Rotation des comptes seed

**Files:**
- Create: `deploy/rotate-seed-passwords.sh`

**Interfaces:**
- Consumes: conteneur `multiboutique-db` (tâche 2)
- Produces: mots de passe aléatoires pour `admin@multiboutique.com` et `proprietaire@multiboutique.com`, affichés une seule fois.

- [ ] **Step 1: Écrire le script**

```bash
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
  # correctement la valeur. Le mot de passe n'est jamais concaténé dans le SQL.
  docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U mb -d multiboutique -v ON_ERROR_STOP=1 -q \
         --set=nouveau="$motdepasse" --set=cible="$email" \
         -c "UPDATE utilisateurs SET password_hash = crypt(:'nouveau', gen_salt('bf', 10)) WHERE email = :'cible';"

  printf '  %-34s %s\n' "$email" "$motdepasse"
done

echo
echo "Noter ces mots de passe maintenant, puis les changer depuis l'interface."
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `bash -n deploy/rotate-seed-passwords.sh && echo "syntaxe OK"`
Expected: `syntaxe OK`

- [ ] **Step 3: Monter une base jetable pour l'essai (rouge)**

```bash
docker run -d --name mb-essai -e POSTGRES_USER=mb -e POSTGRES_PASSWORD=essai \
  -e POSTGRES_DB=multiboutique \
  -v "$PWD/db/init.sql:/docker-entrypoint-initdb.d/init.sql:ro" postgres:16-alpine
sleep 20
docker exec mb-essai psql -U mb -d multiboutique -tAc \
  "SELECT (password_hash = crypt('admin123', password_hash)) FROM utilisateurs WHERE email='admin@multiboutique.com';"
```
Expected: `t` — le mot de passe public fonctionne encore.

- [ ] **Step 4: Appliquer la rotation sur la base jetable**

```bash
docker exec mb-essai psql -U mb -d multiboutique -q \
  --set=nouveau="motdepasse-de-test-24car" --set=cible="admin@multiboutique.com" \
  -c "UPDATE utilisateurs SET password_hash = crypt(:'nouveau', gen_salt('bf', 10)) WHERE email = :'cible';"
```
Expected: `UPDATE 1`

- [ ] **Step 5: Vérifier que l'ancien mot de passe est révoqué (vert)**

```bash
docker exec mb-essai psql -U mb -d multiboutique -tAc \
  "SELECT (password_hash = crypt('admin123', password_hash)) FROM utilisateurs WHERE email='admin@multiboutique.com';"
docker exec mb-essai psql -U mb -d multiboutique -tAc \
  "SELECT (password_hash = crypt('motdepasse-de-test-24car', password_hash)) FROM utilisateurs WHERE email='admin@multiboutique.com';"
```
Expected: `f` puis `t` — l'ancien ne passe plus, le nouveau passe.

- [ ] **Step 6: Nettoyer**

```bash
docker rm -f mb-essai
```

- [ ] **Step 7: Commit**

```bash
chmod +x deploy/rotate-seed-passwords.sh
git add deploy/rotate-seed-passwords.sh
git commit -m "Secrets : rotation des mots de passe des comptes par défaut"
```

---

### Task 6: Sauvegarde chiffrée vers R2

**Files:**
- Create: `deploy/backup.sh`

**Interfaces:**
- Consumes: conteneur `multiboutique-db` (tâche 2), variables `RESTIC_*` et `AWS_*` (tâche 2)
- Produces: des snapshots restic étiquetés `multiboutique`, consommés par `restore-test.sh` (tâche 7). Journal dans `backups/backup.log`.

- [ ] **Step 1: Écrire le script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Sauvegarde quotidienne : base PostgreSQL + photos produits, chiffrées
# par restic avant d'être envoyées sur le stockage distant.
#
#   bash deploy/backup.sh
#
# restic tourne EN CONTENEUR : sudo est interactif sur la cible, donc
# `apt install restic` n'est pas automatisable. Docker l'est (groupe docker).

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f deploy/.env ] && { set -a; . deploy/.env; set +a; }

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY manquant dans deploy/.env}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD manquant dans deploy/.env}"

COMPOSE_FILE="deploy/docker-compose.prod.yml"
IMAGE_RESTIC="${RESTIC_IMAGE:-restic/restic:0.17.3}"
HORODATAGE="$(date +%Y%m%d-%H%M%S)"

mkdir -p backups
JOURNAL="backups/backup.log"

SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

journaliser() { echo "[$(date -Is)] $*" | tee -a "$JOURNAL"; }

echouer() {
  journaliser "ECHEC : $1"
  if [ -n "${BACKUP_PING_URL:-}" ]; then
    curl -fsS -m 10 --retry 3 "${BACKUP_PING_URL}/fail" >/dev/null 2>&1 || true
  fi
  exit 1
}

restic_exec() {
  local montage=()
  # RESTIC_VOLUME permet de viser un dépôt local (essais hors ligne).
  [ -n "${RESTIC_VOLUME:-}" ] && montage=(-v "$RESTIC_VOLUME")
  docker run --rm \
    -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
    -v "$SCRATCH:/data:ro" \
    "${montage[@]}" \
    "$IMAGE_RESTIC" "$@"
}

journaliser "Début de la sauvegarde"

# 1. Base de données, format custom (compressé, restaurable par pg_restore).
docker compose -f "$COMPOSE_FILE" exec -T db \
  pg_dump -U mb -Fc multiboutique > "$SCRATCH/multiboutique-${HORODATAGE}.dump" \
  || echouer "pg_dump a échoué"

# Un dump vide signale un échec que pg_dump n'a pas remonté. Ne jamais
# l'envoyer : un snapshot vide qui remonte « succès » est pire que rien.
[ -s "$SCRATCH/multiboutique-${HORODATAGE}.dump" ] || echouer "dump vide"

TAILLE="$(stat -c%s "$SCRATCH/multiboutique-${HORODATAGE}.dump")"
journaliser "Dump produit : ${TAILLE} octets"

# 2. Photos produits : aucune autre copie n'existe, elles ne sont pas en base.
mkdir -p "$SCRATCH/uploads"
if [ -d public/uploads ]; then
  cp -a public/uploads/. "$SCRATCH/uploads/" 2>/dev/null || true
fi
journaliser "Uploads inclus : $(find "$SCRATCH/uploads" -type f | wc -l) fichier(s)"

# 3. Envoi chiffré puis application de la rétention.
restic_exec backup /data --tag multiboutique --host multiboutique \
  || echouer "restic backup"

restic_exec forget --tag multiboutique \
  --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune \
  || echouer "restic forget"

journaliser "Sauvegarde terminée"

if [ -n "${BACKUP_PING_URL:-}" ]; then
  curl -fsS -m 10 --retry 3 "$BACKUP_PING_URL" >/dev/null 2>&1 || true
fi
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `bash -n deploy/backup.sh && echo "syntaxe OK"`
Expected: `syntaxe OK`

- [ ] **Step 3: Vérifier que l'image restic choisie existe**

Run: `docker pull restic/restic:0.17.3`
Expected: téléchargement réussi. Si le tag n'existe pas, choisir la dernière version stable publiée sur Docker Hub et mettre à jour `IMAGE_RESTIC` ainsi que `deploy/restore-test.sh` (tâche 7) — les deux doivent épingler **la même** version.

- [ ] **Step 4: Monter un environnement d'essai complet**

```bash
cd /home/fifonsi/WebstormProjects/multiboutique
mkdir -p /tmp/mb-restic-repo
export POSTGRES_PASSWORD=essai JWT_SECRET=$(openssl rand -hex 32) APP_PORT=3999
export IMAGE=exemple:latest
docker compose -f deploy/docker-compose.prod.yml up -d db
sleep 20
```

- [ ] **Step 5: Initialiser un dépôt restic local et lancer la sauvegarde (vert)**

```bash
export RESTIC_REPOSITORY=/repo RESTIC_PASSWORD=essai-chiffrement
export RESTIC_VOLUME=/tmp/mb-restic-repo:/repo
docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -v /tmp/mb-restic-repo:/repo restic/restic:0.17.3 init
bash deploy/backup.sh
```
Expected: le journal affiche « Dump produit : N octets » avec N > 0, puis « Sauvegarde terminée ».

- [ ] **Step 6: Vérifier que le snapshot existe**

```bash
docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -v /tmp/mb-restic-repo:/repo restic/restic:0.17.3 snapshots --tag multiboutique
```
Expected: au moins une ligne de snapshot.

- [ ] **Step 7: Vérifier le cas `public/uploads` absent (Review Focus #2)**

```bash
mv public/uploads /tmp/mb-uploads-sauve 2>/dev/null || true
bash deploy/backup.sh && echo "OK: sauvegarde réussie sans uploads"
mv /tmp/mb-uploads-sauve public/uploads 2>/dev/null || true
```
Expected: `Uploads inclus : 0 fichier(s)` puis `OK: sauvegarde réussie sans uploads`. Le script ne doit pas s'interrompre.

- [ ] **Step 8: Vérifier le refus d'un dump vide (Review Focus #3)**

```bash
docker compose -f deploy/docker-compose.prod.yml stop db
bash deploy/backup.sh; echo "code=$?"
docker compose -f deploy/docker-compose.prod.yml start db
```
Expected: le journal contient `ECHEC :` et `code=1`. Aucun nouveau snapshot ne doit apparaître dans `restic snapshots`.

- [ ] **Step 9: Nettoyer**

```bash
docker compose -f deploy/docker-compose.prod.yml down -v
rm -rf /tmp/mb-restic-repo
```

- [ ] **Step 10: Commit**

```bash
chmod +x deploy/backup.sh
git add deploy/backup.sh
git commit -m "Sauvegardes : dump base + uploads chiffrés via restic vers R2"
```

---

### Task 7: Test de restauration

**Files:**
- Create: `deploy/restore-test.sh`

**Interfaces:**
- Consumes: les snapshots produits par `backup.sh` (tâche 6)
- Produces: un verdict journalisé dans `backups/restore-test.log`

- [ ] **Step 1: Écrire le script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Restauration de contrôle : restaure le dernier snapshot dans un PostgreSQL
# jetable et vérifie que les données sont réellement exploitables.
#
#   bash deploy/restore-test.sh
#
# Une sauvegarde jamais restaurée n'est pas une sauvegarde : c'est une
# hypothèse. Ce script la transforme en fait vérifié, tous les mois.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f deploy/.env ] && { set -a; . deploy/.env; set +a; }

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY manquant}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD manquant}"

IMAGE_RESTIC="${RESTIC_IMAGE:-restic/restic:0.17.3}"
CONTENEUR="multiboutique-restore-test"
TABLES=(boutiques utilisateurs produits)

mkdir -p backups
JOURNAL="backups/restore-test.log"
SCRATCH="$(mktemp -d)"

nettoyer() {
  docker rm -f "$CONTENEUR" >/dev/null 2>&1 || true
  rm -rf "$SCRATCH"
}
trap nettoyer EXIT

journaliser() { echo "[$(date -Is)] $*" | tee -a "$JOURNAL"; }

journaliser "Début du test de restauration"

# 1. Restaurer le dernier snapshot.
montage=()
[ -n "${RESTIC_VOLUME:-}" ] && montage=(-v "$RESTIC_VOLUME")
docker run --rm \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -v "$SCRATCH:/restore" \
  "${montage[@]}" \
  "$IMAGE_RESTIC" restore latest --tag multiboutique --target /restore

DUMP="$(find "$SCRATCH" -name '*.dump' -type f | sort | tail -1)"
[ -n "$DUMP" ] || { journaliser "ECHEC : aucun dump dans le snapshot"; exit 1; }
journaliser "Dump restauré : $(basename "$DUMP") ($(stat -c%s "$DUMP") octets)"

# 2. Base jetable.
docker run -d --name "$CONTENEUR" \
  -e POSTGRES_USER=mb -e POSTGRES_PASSWORD=restore-test \
  -e POSTGRES_DB=multiboutique postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  docker exec "$CONTENEUR" pg_isready -U mb -d multiboutique >/dev/null 2>&1 && break
  sleep 2
done

# 3. Restaurer le dump dedans.
docker cp "$DUMP" "$CONTENEUR:/tmp/restore.dump"
docker exec "$CONTENEUR" pg_restore -U mb -d multiboutique --no-owner /tmp/restore.dump \
  || journaliser "Avertissement : pg_restore a signalé des erreurs non bloquantes"

# 4. Vérifier que les tables clés contiennent des données.
ECHEC=0
for table in "${TABLES[@]}"; do
  n="$(docker exec "$CONTENEUR" psql -U mb -d multiboutique -tAc "SELECT count(*) FROM ${table};" 2>/dev/null || echo "erreur")"
  if [ "$n" = "erreur" ] || [ "$n" = "0" ]; then
    journaliser "ECHEC : table ${table} absente ou vide (${n})"
    ECHEC=1
  else
    journaliser "OK : ${table} — ${n} ligne(s)"
  fi
done

if [ "$ECHEC" -ne 0 ]; then
  journaliser "TEST DE RESTAURATION EN ÉCHEC"
  exit 1
fi

journaliser "Test de restauration réussi"
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `bash -n deploy/restore-test.sh && echo "syntaxe OK"`
Expected: `syntaxe OK`

- [ ] **Step 3: Reconstituer un dépôt restic d'essai avec des données**

```bash
cd /home/fifonsi/WebstormProjects/multiboutique
mkdir -p /tmp/mb-restic-repo
export POSTGRES_PASSWORD=essai JWT_SECRET=$(openssl rand -hex 32) APP_PORT=3999 IMAGE=exemple:latest
export RESTIC_REPOSITORY=/repo RESTIC_PASSWORD=essai-chiffrement RESTIC_VOLUME=/tmp/mb-restic-repo:/repo
docker compose -f deploy/docker-compose.prod.yml up -d db
sleep 20
docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD -v /tmp/mb-restic-repo:/repo restic/restic:0.17.3 init
bash deploy/backup.sh
```
Expected: `Sauvegarde terminée`

- [ ] **Step 4: Lancer le test de restauration (vert)**

Run: `bash deploy/restore-test.sh`
Expected: trois lignes `OK : boutiques — 3 ligne(s)`, `OK : utilisateurs — ...`, `OK : produits — ...` puis `Test de restauration réussi`.

> Si `produits` est vide sur une base fraîchement initialisée, c'est un
> résultat légitime : retirer `produits` de `TABLES` et conserver
> `boutiques` et `utilisateurs`, que `db/init.sql` alimente toujours.

- [ ] **Step 5: Vérifier la détection d'un dépôt vide**

```bash
rm -rf /tmp/mb-restic-repo-vide && mkdir -p /tmp/mb-restic-repo-vide
RESTIC_VOLUME=/tmp/mb-restic-repo-vide:/repo bash deploy/restore-test.sh; echo "code=$?"
```
Expected: `code=1` — le script échoue franchement au lieu d'annoncer une réussite sur un dépôt sans snapshot.

- [ ] **Step 6: Nettoyer**

```bash
docker compose -f deploy/docker-compose.prod.yml down -v
rm -rf /tmp/mb-restic-repo /tmp/mb-restic-repo-vide
```

- [ ] **Step 7: Commit**

```bash
chmod +x deploy/restore-test.sh
git add deploy/restore-test.sh
git commit -m "Sauvegardes : test de restauration mensuel dans un PostgreSQL jetable"
```

---

### Task 8: Redémarrage sur panne applicative

**Files:**
- Create: `deploy/healthcheck-cron.sh`

**Interfaces:**
- Consumes: le `healthcheck` du conteneur `multiboutique-prod` (tâche 2)
- Produces: journal `backups/healthcheck.log`

- [ ] **Step 1: Écrire le script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Redémarre l'application lorsqu'elle est signalée « unhealthy ».
#
#   bash deploy/healthcheck-cron.sh     (toutes les 2 minutes via cron)
#
# Docker ne redémarre PAS un conteneur unhealthy de lui-même : `restart:
# unless-stopped` ne couvre que les arrêts du processus, pas les blocages.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CONTENEUR="multiboutique-prod"
MAX_REDEMARRAGES=3
FENETRE_MIN=30

mkdir -p backups
JOURNAL="backups/healthcheck.log"

journaliser() { echo "[$(date -Is)] $*" >> "$JOURNAL"; }

ETAT="$(docker inspect -f '{{.State.Health.Status}}' "$CONTENEUR" 2>/dev/null || echo "absent")"

case "$ETAT" in
  healthy)
    exit 0
    ;;
  starting)
    # Le start_period du healthcheck n'est pas écoulé : laisser démarrer.
    exit 0
    ;;
  absent)
    journaliser "Conteneur ${CONTENEUR} introuvable — rien à faire"
    exit 0
    ;;
esac

# Garde anti-boucle : au-delà de MAX_REDEMARRAGES dans la fenêtre, on cesse
# de redémarrer. Un redémarrage en boucle masque la panne au lieu de la
# traiter, et empêche de lire les journaux du conteneur fautif.
DEPUIS="$(date -d "${FENETRE_MIN} minutes ago" -Is)"
RECENTS="$(awk -v depuis="$DEPUIS" '$0 ~ /Redemarrage declenche/ { gsub(/[][]/, "", $1); if ($1 > depuis) n++ } END { print n+0 }' "$JOURNAL" 2>/dev/null || echo 0)"

if [ "$RECENTS" -ge "$MAX_REDEMARRAGES" ]; then
  journaliser "ETAT=${ETAT} — ${RECENTS} redemarrages en ${FENETRE_MIN} min, abandon (intervention manuelle requise)"
  exit 1
fi

journaliser "ETAT=${ETAT} — Redemarrage declenche (${RECENTS} precedents dans la fenetre)"
docker restart "$CONTENEUR" >/dev/null
journaliser "Redemarrage termine"
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `bash -n deploy/healthcheck-cron.sh && echo "syntaxe OK"`
Expected: `syntaxe OK`

- [ ] **Step 3: Vérifier le cas conteneur absent (vert partiel)**

```bash
rm -f backups/healthcheck.log
bash deploy/healthcheck-cron.sh && echo "code=0"
cat backups/healthcheck.log
```
Expected: `code=0` et une ligne `Conteneur multiboutique-prod introuvable`.

- [ ] **Step 4: Construire l'image et démarrer la pile complète**

```bash
cd /home/fifonsi/WebstormProjects/multiboutique
docker build -t multiboutique:essai .
export IMAGE=multiboutique:essai POSTGRES_PASSWORD=essai APP_PORT=3999
export JWT_SECRET=$(openssl rand -hex 32)
docker compose -f deploy/docker-compose.prod.yml up -d
sleep 60
docker inspect -f '{{.State.Health.Status}}' multiboutique-prod
```
Expected: `healthy` — ce qui valide aussi la route de la tâche 1 et le healthcheck de la tâche 2 dans leur assemblage réel.

- [ ] **Step 5: Vérifier qu'un conteneur sain n'est pas touché**

```bash
AVANT=$(docker inspect -f '{{.State.StartedAt}}' multiboutique-prod)
bash deploy/healthcheck-cron.sh
APRES=$(docker inspect -f '{{.State.StartedAt}}' multiboutique-prod)
[ "$AVANT" = "$APRES" ] && echo "OK: conteneur sain non redémarré" || echo "ECHEC: redémarrage intempestif"
```
Expected: `OK: conteneur sain non redémarré`

- [ ] **Step 6: Vérifier la garde anti-boucle (Review Focus #4)**

```bash
rm -f backups/healthcheck.log
for i in 1 2 3; do
  printf '[%s] ETAT=unhealthy — Redemarrage declenche (0 precedents dans la fenetre)\n' "$(date -Is)" >> backups/healthcheck.log
done
docker pause multiboutique-prod
sleep 95
bash deploy/healthcheck-cron.sh; echo "code=$?"
docker unpause multiboutique-prod
tail -2 backups/healthcheck.log
```
Expected: `code=1` et une ligne contenant `abandon (intervention manuelle requise)`. Le conteneur ne doit **pas** avoir été redémarré.

- [ ] **Step 7: Vérifier un redémarrage réel sur conteneur bloqué**

```bash
rm -f backups/healthcheck.log
docker pause multiboutique-prod
sleep 95
bash deploy/healthcheck-cron.sh
docker inspect -f '{{.State.Status}}' multiboutique-prod
```
Expected: `running` — le conteneur en pause a été redémarré et tourne de nouveau.

- [ ] **Step 8: Nettoyer**

```bash
docker compose -f deploy/docker-compose.prod.yml down -v
docker rmi multiboutique:essai
rm -f backups/healthcheck.log
```

- [ ] **Step 9: Commit**

```bash
chmod +x deploy/healthcheck-cron.sh
git add deploy/healthcheck-cron.sh
git commit -m "Supervision : redémarrage automatique sur conteneur unhealthy"
```

---

### Task 9: Script de déploiement serveur

**Files:**
- Modify: `deploy/server-deploy.sh:22` et le bloc d'attente de la base

**Interfaces:**
- Consumes: `deploy/.env` (tâche 2), `db/migrate.sh` (existant)
- Produces: déploiement idempotent, appelé par le CI (tâche 10)

- [ ] **Step 1: Constater le défaut dangereux (rouge)**

Run: `grep -n "darnoc" deploy/server-deploy.sh`
Expected: la ligne 22, `IMAGE="${IMAGE:-ghcr.io/darnoc/multiboutique:main}"`.

- [ ] **Step 2: Rendre `IMAGE` obligatoire (Review Focus #5)**

Remplacer la ligne 22 par :

```bash
# Aucun défaut : un déploiement sans IMAGE défini tirerait et exécuterait
# l'image d'un compte tiers. Échouer est le seul comportement sûr.
: "${IMAGE:?IMAGE manquant (ex: IMAGE=ghcr.io/fiflokonon/multiboutique:main)}"
```

- [ ] **Step 3: Corriger l'attente de la base**

Le bloc actuel interpole `$COMPOSE_FILE` dans une chaîne `bash -c` entre
apostrophes simples : la variable n'y est pas substituée. Remplacer par :

```bash
timeout 60 bash -c "until docker compose -f '$COMPOSE_FILE' exec -T db pg_isready -U mb -d multiboutique >/dev/null 2>&1; do sleep 2; done"
```

- [ ] **Step 4: Mettre à jour le commentaire d'en-tête**

Remplacer l'exemple d'usage en tête de fichier par :

```bash
# Usage (depuis la racine du dépôt, cloné dans /home/<user>/multiboutique) :
#   IMAGE=ghcr.io/fiflokonon/multiboutique:main bash deploy/server-deploy.sh up
#   bash deploy/server-deploy.sh pull     # ne fait que récupérer l'image
```

- [ ] **Step 5: Vérifier l'échec sans IMAGE (vert)**

```bash
cd /home/fifonsi/WebstormProjects/multiboutique
env -u IMAGE bash deploy/server-deploy.sh pull 2>&1 | head -3; echo "code=${PIPESTATUS[0]}"
```
Expected: le message `IMAGE manquant (ex: ...)` et un code non nul. (Si `deploy/.env` existe localement et définit `IMAGE`, renommer le fichier le temps de l'essai.)

- [ ] **Step 6: Vérifier la syntaxe**

Run: `bash -n deploy/server-deploy.sh && echo "syntaxe OK"`
Expected: `syntaxe OK`

- [ ] **Step 7: Commit**

```bash
git add deploy/server-deploy.sh
git commit -m "Déploiement : IMAGE obligatoire, correction de l'attente de la base"
```

---

### Task 10: Chaîne CI/CD à deux environnements

**Files:**
- Modify: `.github/workflows/ci-cd.yml`

**Interfaces:**
- Consumes: `deploy/server-deploy.sh` (tâche 9), `GET /api/health` (tâche 1)
- Produces: déploiement automatique en recette sur `main`, en production sur tag `v*`

- [ ] **Step 1: Ajouter le déclencheur par tag**

Remplacer le bloc `on:` par :

```yaml
on:
  push:
    branches:
      - main
    tags:
      - "v*"
  pull_request:
    branches:
      - main
```

- [ ] **Step 2: Enrichir les tags d'image**

Dans l'étape `Métadonnées (tags image)`, remplacer le bloc `tags:` par :

```yaml
          tags: |
            type=raw,value=main,enable={{is_default_branch}}
            type=sha,format=short
            type=semver,pattern={{version}}
```

- [ ] **Step 3: Renommer le job de déploiement et le rattacher à l'environnement de recette**

Remplacer l'en-tête du job `deploy` par :

```yaml
  deploy-recette:
    name: Déploiement recette
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: recette
    permissions:
      contents: read
      packages: write
```

- [ ] **Step 4: Ajouter le smoke test à la fin du job de recette**

Après l'étape `Déployer sur le serveur (SSH)` :

```yaml
      - name: Vérifier la santé de l'application
        run: |
          for tentative in 1 2 3 4 5 6; do
            code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
              "https://${{ vars.DOMAIN }}/api/health" || echo "000")
            echo "Tentative ${tentative} : HTTP ${code}"
            if [ "$code" = "200" ]; then
              echo "Application saine."
              exit 0
            fi
            sleep 10
          done
          echo "L'application ne répond pas 200 sur /api/health après déploiement." >&2
          exit 1
```

- [ ] **Step 5: Ajouter le job de production**

À la fin du fichier, en dupliquant intégralement les étapes du job de recette
(checkout, métadonnées, BuildKit, login GHCR, build & push, déploiement SSH,
smoke test) avec cet en-tête :

```yaml
  deploy-production:
    name: Déploiement production
    runs-on: ubuntu-latest
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production
    permissions:
      contents: read
      packages: write
```

Les secrets `SERVER_HOST`, `SERVER_PORT`, `SERVER_USER`, `SERVER_SSH_KEY` et
les variables `APP_DIR` et `DOMAIN` sont résolus **par environnement** : le même
texte d'étape vise deux machines différentes. C'est ce cloisonnement qui garantit
qu'un push sur `main` ne peut pas atteindre la production.

- [ ] **Step 6: Corriger le chemin de déploiement par défaut**

Dans les deux jobs, remplacer `${{ vars.APP_DIR || '/opt/multiboutique' }}` par
`${{ vars.APP_DIR || '/home/arnaud/multiboutique' }}` : `/opt` appartient à root
et `sudo` exige un mot de passe sur la cible.

- [ ] **Step 7: Vérifier que le YAML est valide (vert)**

```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('.github/workflows/ci-cd.yml')); print('jobs:', list(d['jobs'].keys()))"
```
Expected: `jobs: ['build', 'deploy-recette', 'deploy-production']`

- [ ] **Step 8: Vérifier le cloisonnement des environnements**

```bash
python3 - <<'PY'
import yaml
d = yaml.safe_load(open('.github/workflows/ci-cd.yml'))
r = d['jobs']['deploy-recette']
p = d['jobs']['deploy-production']
assert r['environment'] == 'recette', r.get('environment')
assert p['environment'] == 'production', p.get('environment')
assert "refs/heads/main" in r['if']
assert "refs/tags/v" in p['if']
print("OK : cloisonnement recette / production")
PY
```
Expected: `OK : cloisonnement recette / production`

- [ ] **Step 9: Commit**

```bash
git add .github/workflows/ci-cd.yml
git commit -m "CI/CD : environnements recette et production, smoke test après déploiement"
```

---

### Task 11: Documentation d'exploitation

**Files:**
- Modify: `README.md` (section « Déploiement GitHub + CI/CD », tableau des comptes seed, section Nginx)
- Modify: `docs/CAHIER_DES_CHARGES.md` §10

- [ ] **Step 1: Retirer les mots de passe seed du README**

Remplacer le tableau « Comptes seed » par :

```markdown
### Comptes par défaut

`db/init.sql` crée deux comptes : `admin@multiboutique.com` (administrateur) et
`proprietaire@multiboutique.com` (propriétaire).

**Leurs mots de passe initiaux sont publics dans `db/init.sql`.** Sur toute
instance joignable depuis un réseau, lancer `bash deploy/rotate-seed-passwords.sh`
au premier déploiement : le script les remplace par des valeurs aléatoires et les
affiche une seule fois.
```

- [ ] **Step 2: Remplacer la section Nginx**

Remplacer la section « Nginx (optionnel — SSL en production) » par :

```markdown
## Reverse proxy et HTTPS

Le reverse proxy n'est pas dans le compose : il est fourni par l'hôte. Sur le
serveur de recette, Apache et certbot sont déjà installés et servent les autres
projets de la machine.

```bash
sudo bash deploy/setup-vhost.sh
```

Le script lit `DOMAIN` et `APP_PORT` dans `deploy/.env`, vérifie que le DNS
pointe bien sur la machine, crée le vhost sur le modèle des vhosts existants puis
délivre le certificat Let's Encrypt. Il est idempotent : relançable sans risque.
```

- [ ] **Step 3: Réécrire la section de déploiement serveur**

Remplacer l'étape « 3. Préparer le serveur » par :

```markdown
### 3. Préparer le serveur (une seule fois)

```bash
git clone https://github.com/<TOI>/multiboutique.git ~/multiboutique
cd ~/multiboutique

cp deploy/.env.example deploy/.env
# puis renseigner POSTGRES_PASSWORD, JWT_SECRET, APP_PORT, DOMAIN et les
# variables RESTIC_*/AWS_* (cf. section Sauvegardes).

sudo bash deploy/setup-vhost.sh                     # vhost + certificat
IMAGE=ghcr.io/<TOI>/multiboutique:main bash deploy/server-deploy.sh up
bash deploy/rotate-seed-passwords.sh                # noter les identifiants

crontab -e   # ajouter les trois entrées ci-dessous
```

```cron
30 2 * * *   cd ~/multiboutique && bash deploy/backup.sh           >> backups/cron.log 2>&1
*/2 * * * *  cd ~/multiboutique && bash deploy/healthcheck-cron.sh >> backups/cron.log 2>&1
0 4 1 * *    cd ~/multiboutique && bash deploy/restore-test.sh     >> backups/cron.log 2>&1
```

> Le dépôt doit être cloné sous `~` et non sous `/opt` : `/opt` appartient à
> root et `sudo` exige un mot de passe sur la cible.
```

- [ ] **Step 4: Documenter les sauvegardes**

Remplacer la section « Sauvegarde des données » par :

```markdown
## Sauvegardes

`deploy/backup.sh` s'exécute chaque nuit à 02h30 : dump PostgreSQL **et**
`public/uploads` (les photos produits n'ont aucune autre copie), chiffrés par
restic avant envoi sur Cloudflare R2. Rétention : 7 quotidiennes, 4
hebdomadaires, 6 mensuelles.

> **`RESTIC_PASSWORD` doit être conservé hors du serveur** (gestionnaire de mots
> de passe). C'est la clé de chiffrement du dépôt : perdue, les sauvegardes sont
> définitivement irrécupérables.

`deploy/restore-test.sh`, mensuel, restaure le dernier snapshot dans un
PostgreSQL jetable et vérifie que les tables répondent. Journaux dans
`backups/`.

Restauration manuelle :

```bash
docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -v "$PWD/restauration:/restore" restic/restic:0.17.3 \
  restore latest --tag multiboutique --target /restore
docker compose -f deploy/docker-compose.prod.yml exec -T db \
  pg_restore -U mb -d multiboutique --clean --no-owner < restauration/*.dump
```
```

- [ ] **Step 5: Mettre à jour le cahier des charges**

Dans `docs/CAHIER_DES_CHARGES.md` §10 : retirer la ligne `nginx` et le port
3001 du tableau §10.1, y ajouter `APP_PORT` et `DOMAIN` ; compléter §10.2 avec
les variables `RESTIC_*`, `AWS_*` et `BACKUP_PING_URL` ; remplacer §10.5 par la
chaîne à deux environnements ; remplacer §10.6 par la sauvegarde restic vers R2.

- [ ] **Step 6: Vérifier qu'aucun mot de passe ne subsiste dans la documentation**

```bash
grep -rn "admin123\|proprietaire123\|mbpassword" README.md docs/ | grep -v CAHIER_DES_CHARGES.docx
```
Expected: aucune sortie hors `db/init.sql`, qui reste la source du schéma.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/CAHIER_DES_CHARGES.md
git commit -m "Documentation : exploitation, sauvegardes R2 et reverse proxy hôte"
```

---

### Task 12: Mise en service en recette

Cette tâche s'exécute **sur le serveur**, pas en local. Elle demande le mot de
passe sudo pour l'étape vhost : elle ne peut pas être automatisée.

**Files:** aucun fichier du dépôt n'est modifié.

- [ ] **Step 1: Pousser la branche et laisser le CI produire l'image**

```bash
git push origin HEAD
```
Expected: le job `build` passe. Le job `deploy-recette` échouera tant que les
secrets d'environnement GitHub ne sont pas créés — c'est attendu.

- [ ] **Step 2: Créer l'environnement GitHub `recette`**

Dans Settings → Environments → New environment → `recette`, renseigner les
secrets `SERVER_HOST=51.77.221.201`, `SERVER_PORT=22020`, `SERVER_USER=arnaud`,
`SERVER_SSH_KEY` (clé privée PEM), et les variables
`APP_DIR=/home/arnaud/multiboutique`, `DOMAIN=multiboutique.dev4future.space`.

- [ ] **Step 3: Créer le bucket R2 et son jeton**

Dans le tableau de bord Cloudflare → R2 → créer le bucket `multiboutique-backups`,
puis un jeton API avec droits de lecture et écriture sur ce bucket. Relever
`account_id`, `access_key_id` et `secret_access_key`.

- [ ] **Step 4: Préparer le serveur**

```bash
ssh carrefoot-dev
git clone https://github.com/<TOI>/multiboutique.git ~/multiboutique
cd ~/multiboutique
cp deploy/.env.example deploy/.env
```

Renseigner `deploy/.env` : `APP_PORT=3002`,
`DOMAIN=multiboutique.dev4future.space`, `POSTGRES_PASSWORD=$(openssl rand -hex 16)`,
`JWT_SECRET=$(openssl rand -hex 32)`, les variables R2 et
`RESTIC_PASSWORD=$(openssl rand -hex 24)`.

**Copier `RESTIC_PASSWORD` dans un gestionnaire de mots de passe avant de
continuer.**

- [ ] **Step 5: Initialiser le dépôt restic**

```bash
set -a; . deploy/.env; set +a
docker run --rm -e RESTIC_REPOSITORY -e RESTIC_PASSWORD \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY restic/restic:0.17.3 init
```
Expected: `created restic repository ... at s3:...`

- [ ] **Step 6: Installer le vhost et le certificat**

```bash
sudo bash deploy/setup-vhost.sh
```
Expected: `OK — https://multiboutique.dev4future.space est servi vers 127.0.0.1:3002.`

- [ ] **Step 7: Premier déploiement**

```bash
IMAGE=ghcr.io/<TOI>/multiboutique:main bash deploy/server-deploy.sh up
```

- [ ] **Step 8: Roter les comptes par défaut**

```bash
bash deploy/rotate-seed-passwords.sh
```
Noter les deux mots de passe affichés.

- [ ] **Step 9: Installer les tâches planifiées**

```bash
crontab -e
```

```cron
30 2 * * *   cd ~/multiboutique && bash deploy/backup.sh           >> backups/cron.log 2>&1
*/2 * * * *  cd ~/multiboutique && bash deploy/healthcheck-cron.sh >> backups/cron.log 2>&1
0 4 1 * *    cd ~/multiboutique && bash deploy/restore-test.sh     >> backups/cron.log 2>&1
```

- [ ] **Step 10: Vérifier les dix critères d'acceptation de la spec**

```bash
# 1 et 2 — HTTPS et santé
curl -sI https://multiboutique.dev4future.space | head -1
curl -s -o /dev/null -w "%{http_code}\n" https://multiboutique.dev4future.space/api/health
curl -sI http://multiboutique.dev4future.space | grep -i "^location:"

# 3 — aucun bind public
ss -tln | grep -E "0\.0\.0\.0:(3002|5432)" && echo "ECHEC" || echo "OK: aucun bind public"

# 4 — non-régression des projets voisins
curl -s -o /dev/null -w "carrefoot: %{http_code}\n" https://carrefoot.dev4future.space
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E "carrefoot|clausefoot"

# 5 et 6 — sauvegarde et restauration
bash deploy/backup.sh && bash deploy/restore-test.sh

# 7 — redémarrage automatique
docker kill multiboutique-prod && sleep 150 \
  && docker inspect -f '{{.State.Status}}' multiboutique-prod

# 8 — comptes seed révoqués
curl -s -X POST https://multiboutique.dev4future.space/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@multiboutique.com","password":"admin123"}' \
  -o /dev/null -w "login admin123: %{http_code}\n"

# 10 — mémoire disponible après mise en service
free -h | head -2
docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}' | grep multiboutique
```

Expected: `200` sur la santé, une redirection `https://` depuis HTTP,
`OK: aucun bind public`, `carrefoot: 200` et les conteneurs voisins toujours
`Up`, une sauvegarde et une restauration réussies, `running` après le kill,
un code **autre que 200** sur le login `admin123`, et une consommation mémoire
des deux conteneurs MultiBoutique inférieure aux limites posées (640 Mo et
512 Mo).

- [ ] **Step 11: Consigner le résultat**

Si la consommation mémoire réelle s'écarte nettement des limites, ajuster
`mem_limit` dans `deploy/docker-compose.prod.yml`, puis commiter la correction
avec les valeurs observées en message de commit. Les limites de la spec étaient
une estimation ; la mise en service est ce qui les valide.
