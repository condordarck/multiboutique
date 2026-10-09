# Durcissement du déploiement VPS — Design

Date : 2026-10-09 · État : validé en brainstorming, à planifier

## 1. Objectif

Rendre MultiBoutique déployable et exploitable sur deux environnements distincts —
**recette** (serveur partagé `carrefoot-dev`, immédiat) et **production** (cible dédiée,
ultérieure) — en fermant cinq manques qui empêchent aujourd'hui une exposition sur
Internet : absence de HTTPS fonctionnel, sauvegardes non délocalisées, secrets par défaut
publics, aucune détection de panne applicative, et un déploiement supposant des droits
root que le compte de déploiement n'a pas.

Le cahier des charges (§1) impose que les données commerciales ne quittent pas
l'infrastructure. Cette exigence est préservée : les sauvegardes distantes sont chiffrées
côté client par restic, le prestataire de stockage ne détient que du chiffré opaque.

## 2. État des lieux

### 2.1 Dépôt

Déjà en place, et conservé :

- `Dockerfile` multi-étapes, sortie Next.js `standalone`, exécution sous uid 1001.
- `deploy/docker-compose.prod.yml` : app (image GHCR) + PostgreSQL 16 + nginx.
- `deploy/server-deploy.sh` : `pg_dump` local (10 rotations) → migrations → redémarrage.
- `.github/workflows/ci-cd.yml` : build → push GHCR → SSH → `server-deploy.sh up`.
- `db/migrate.sh` : migrations idempotentes suivies dans `schema_migrations`.

Contraintes imposées par le code applicatif, vérifiées :

| Contrainte | Emplacement | Conséquence |
|---|---|---|
| Uploads écrits sur le disque local | `app/api/upload/route.ts:43` | Volume persistant obligatoire ; à inclure dans les sauvegardes |
| Rate-limit en mémoire | `lib/rate-limit.ts:7` | **Une seule instance applicative**, pas de scaling horizontal |
| Pool `pg` persistant | `lib/db.ts` | Runtime Node long-vivant requis |
| Mots de passe bcrypt via `pgcrypto` | `db/init.sql:474` | Rotation des comptes faisable en SQL pur |

### 2.2 Serveur de recette (`carrefoot-dev`)

Relevé par SSH le 2026-10-09. Debian 12 (bookworm), OVH, SSH sur le port 22020,
utilisateur `arnaud` (groupes `sudo`, `docker`).

- **Apache 2 actif sur 80/443**, avec `mod_proxy`, `mod_proxy_http`, `mod_ssl`,
  `mod_headers`, `mod_rewrite`. **certbot installé** et déjà utilisé (vhosts `*-le-ssl.conf`).
- Vhosts existants sur `*.dev4future.space`, motif constant :
  `ProxyPreserveHost On` + `ProxyPass / http://127.0.0.1:<port>/` + en-têtes de sécurité.
- **Port 3001 occupé** par un `next-server` tiers (projet `carrefoot`), exposé sur
  `0.0.0.0`. Ports 3002 à 3005 libres. Port 5432 libre sur l'hôte.
- Conteneurs déjà présents : `carrefoot-app`, `carrefoot-postgres`, `carrefoot-minio`,
  `carrefoot-pgadmin`, et la stack `clausefoot-test` (app, web, queue, scheduler,
  postgres, redis, cloudflared).
- **Ressources : 3,7 Go de RAM dont ~1,9 Go disponibles**, 40 Go de disque à 28 %.
- **`sudo` exige un mot de passe.** Docker est utilisable sans sudo (groupe `docker`).
- `ufw` n'est pas installé.

Ces constats invalident trois hypothèses de départ : un reverse proxy conteneurisé serait
redondant avec Apache, le port 3001 du compose entre en collision, et `/opt/multiboutique`
est inaccessible en écriture au compte de déploiement.

## 3. Décisions d'architecture

| # | Décision | Justification |
|---|---|---|
| D1 | **Un seul compose paramétré** par `deploy/.env`, pas un fichier par environnement | Seuls des *valeurs* diffèrent entre recette et production (port, secrets, image), pas des structures. Deux fichiers divergeraient. |
| D2 | **Le reverse proxy sort du périmètre du compose** | Apache occupe déjà 80/443 sur la recette avec certbot opérationnel. Le compose ne doit dépendre d'aucun proxy particulier pour rester portable vers la future production. |
| D3 | **restic en conteneur** plutôt qu'en paquet système | `sudo` est interactif : `apt install` est impossible depuis un script automatisé. Docker est disponible sans sudo. |
| D4 | **Cloudflare R2** comme cible de sauvegarde | S3-compatible, sans frais d'egress (déterminant pour une restauration depuis le Bénin), 10 Go gratuits. Un compte Cloudflare est déjà utilisé sur la machine (`cloudflared`). Le MinIO local ne peut pas servir : même machine, donc même sinistre. |
| D5 | **Script hôte de redémarrage** plutôt qu'un conteneur `autoheal` | Docker ne redémarre pas un conteneur `unhealthy`. Un conteneur de plus pèse sur une machine à 1,9 Go libre. |
| D6 | **`APP_DIR` sous `/home/arnaud`** | `/opt` appartient à root ; sans sudo non interactif, le CI ne peut pas y écrire. |

## 4. Périmètre

**Inclus** : topologie réseau et vhost, route de santé et redémarrage automatique,
sauvegardes chiffrées délocalisées avec test de restauration, rotation des secrets et
comptes seed, chaîne CI/CD à deux environnements, mise à jour de la documentation.

**Exclus, et pourquoi** :

- **Pare-feu (`ufw`)** : installation et règles exigent un sudo interactif. À traiter en
  session dédiée, en direct sur le serveur.
- **Suite de tests automatisés** : le dépôt n'en contient aucun ; `npm run build` tient
  lieu de typecheck. En introduire une dépasse ce lot.
- **Scaling horizontal** : impossible tant que `lib/rate-limit.ts` garde son registre en
  mémoire. Non requis pour 3 boutiques.
- **Migration des uploads vers un stockage objet** : non nécessaire à instance unique.

## 5. Conception détaillée

### 5.1 Topologie réseau

`deploy/docker-compose.prod.yml` :

- **Suppression du service `nginx`.**
- Service `app` : `ports: ["127.0.0.1:${APP_PORT}:3000"]`. Jamais `0.0.0.0`.
- Service `db` : **plus aucun port publié sur l'hôte**. Accès par le réseau Docker
  uniquement ; les `pg_dump` passent par `docker compose exec`.
- `mem_limit` : 640 Mo (`app`), 512 Mo (`db`). Sans limite, un pic de l'app déclenche
  l'OOM killer sur un conteneur voisin appartenant à un autre projet.
- `healthcheck` sur `app` (cf. 5.2).

**`deploy/setup-vhost.sh`** — exécution manuelle avec sudo, une seule fois par serveur.
Génère le vhost sur le motif exact des vhosts existants :

```apache
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/
    Header always set X-Content-Type-Options "nosniff"
    Header setifempty Referrer-Policy "strict-origin-when-cross-origin"
    ErrorLog  ${APACHE_LOG_DIR}/error.${DOMAIN}.log
    CustomLog ${APACHE_LOG_DIR}/access.${DOMAIN}.log combined
</VirtualHost>
```

puis `a2ensite`, `apache2ctl configtest`, `systemctl reload apache2`, et
`certbot --apache -d ${DOMAIN}` qui produit le pendant `-le-ssl.conf` et la redirection
80 → 443. Le script vérifie au préalable que le port `${APP_PORT}` est libre et que le DNS
de `${DOMAIN}` pointe bien sur la machine ; il s'arrête sinon.

Valeurs de recette : `DOMAIN=multiboutique.dev4future.space`, `APP_PORT=3002`.

### 5.2 Santé et redémarrage

**`app/api/health/route.ts`** (nouveau) :

- `export const dynamic = "force-dynamic"` — jamais mis en cache.
- Exécute `SELECT 1` sur le pool. 200 `{"status":"ok"}` si la base répond, 503
  `{"status":"degraded"}` sinon.
- Aucune donnée métier, aucune information de version : la route est publique.

**Healthcheck compose** sur `app` — `node -e` avec le `fetch` natif de Node 22, ce qui
évite d'ajouter `curl` ou `wget` à l'image :

```yaml
healthcheck:
  test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 40s
```

**`deploy/healthcheck-cron.sh`** — toutes les 2 minutes via crontab utilisateur. Si
`docker inspect` renvoie `unhealthy`, redémarre le conteneur et journalise dans
`backups/healthcheck.log`. Anti-boucle : au-delà de 3 redémarrages en 30 minutes, le
script cesse de redémarrer et se contente de journaliser — un redémarrage en boucle masque
la panne au lieu de la traiter.

### 5.3 Secrets

- `docker-compose.yml` (racine) : `POSTGRES_PASSWORD` devient requis
  (`${POSTGRES_PASSWORD:?...}`), comme `JWT_SECRET` l'est déjà. Le défaut `mbpassword`
  disparaît.
- `lib/db.ts` : suppression de la chaîne de connexion en dur en repli. L'absence de
  `DATABASE_URL` doit échouer bruyamment, pas se rabattre silencieusement sur une base
  locale.
- **`deploy/rotate-seed-passwords.sh`** : génère un mot de passe aléatoire (24 caractères)
  pour `admin@multiboutique.com` et `proprietaire@multiboutique.com`, l'applique via
  `UPDATE utilisateurs SET mot_de_passe = crypt($1, gen_salt('bf', 10))`, et l'affiche
  **une seule fois** sur la sortie standard. À lancer au premier déploiement de chaque
  environnement. Les identifiants `admin123` et `proprietaire123` sont documentés dans un
  README public : tant qu'ils restent actifs sur une instance joignable en HTTPS,
  l'application est ouverte à quiconque lit le dépôt.
- `.env.local.example` et `deploy/.env.example` : documentation des variables sans valeur
  exploitable.

### 5.4 Sauvegardes

**`deploy/backup.sh`**, quotidien à 02h30 (crontab utilisateur, pas de sudo) :

1. `docker compose exec -T db pg_dump -U mb -Fc multiboutique` vers un fichier temporaire.
2. Agrégation de ce dump **et du répertoire `public/uploads`**. Les photos produits n'ont
   aucune autre copie : une restauration limitée au SQL rendrait un catalogue sans images.
3. `restic backup` vers R2, puis
   `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune`.
4. Journalisation du code de sortie dans `backups/backup.log`. Si `BACKUP_PING_URL` est
   renseignée (healthchecks.io ou équivalent), appel en fin de script : une sauvegarde qui
   échoue en silence est plus dangereuse qu'une sauvegarde absente, parce qu'on compte
   dessus.

Dépôt restic : `s3:https://<account_id>.r2.cloudflarestorage.com/<bucket>`, avec
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` et `RESTIC_PASSWORD` lus depuis `deploy/.env`.

> **`RESTIC_PASSWORD` doit être conservé hors du serveur** (gestionnaire de mots de
> passe). C'est la clé de chiffrement du dépôt : perdue, les sauvegardes sont
> définitivement irrécupérables, y compris par leur propriétaire.

**`deploy/restore-test.sh`**, mensuel : restaure le dernier snapshot dans un conteneur
PostgreSQL jetable, vérifie que les tables principales répondent et que le nombre de lignes
est non nul, puis détruit le conteneur. Résultat journalisé. Une sauvegarde jamais
restaurée n'est pas une sauvegarde.

Le `pg_dump` local de `server-deploy.sh` est **conservé** : il couvre le rollback immédiat
après un déploiement raté, là où R2 couvre le sinistre matériel.

### 5.5 CI/CD

`.github/workflows/ci-cd.yml` :

- Job `build` inchangé (`npm ci` + `npm run build`).
- Job `deploy-recette` : `environment: recette`, déclenché sur `push` vers `main`.
- Job `deploy-production` : `environment: production`, déclenché sur tag `v*`
  (`if: startsWith(github.ref, 'refs/tags/v')`).
- Les secrets `SERVER_HOST`, `SERVER_PORT`, `SERVER_USER`, `SERVER_SSH_KEY` et la variable
  `APP_DIR` sont portés **par environnement GitHub**, pas au niveau du dépôt : c'est ce qui
  garantit qu'un push sur `main` ne peut pas atteindre la production.
- Tags d'image : ajout de `type=semver,pattern={{version}}` aux `main` et `sha-` existants.
- **`IMAGE` devient obligatoire dans `deploy/server-deploy.sh:22`.** Le défaut actuel,
  `ghcr.io/darnoc/multiboutique:main`, ne correspond pas au compte GHCR utilisé sur la
  machine (`ghcr.io/fiflokonon/...`). Un déploiement lancé sans `IMAGE` défini tirerait
  et exécuterait silencieusement l'image d'un tiers. Le script doit échouer
  (`${IMAGE:?...}`) plutôt que deviner.
- **Smoke test post-déploiement** : interrogation de `https://${DOMAIN}/api/health`, échec
  du job si la réponse n'est pas 200. Aujourd'hui un déploiement laissant l'application
  cassée affiche un badge vert.

Valeurs de recette : `SERVER_HOST=51.77.221.201`, `SERVER_PORT=22020`,
`SERVER_USER=arnaud`, `APP_DIR=/home/arnaud/multiboutique`.

### 5.6 Documentation

Mise à jour de `README.md` (section « Déploiement GitHub + CI/CD ») et de
`docs/CAHIER_DES_CHARGES.md` §10 : suppression de nginx et du port 3001, chemin
`APP_DIR` corrigé, procédure d'installation initiale, exploitation des sauvegardes,
et retrait des mots de passe seed de la documentation publique.

## 6. Variables d'environnement (`deploy/.env`)

| Variable | Exemple | Rôle |
|---|---|---|
| `IMAGE` | `ghcr.io/fiflokonon/multiboutique:main` | Image à déployer |
| `APP_PORT` | `3002` | Port local écouté par l'app (recette : 3002) |
| `DOMAIN` | `multiboutique.dev4future.space` | Nom d'hôte du vhost et cible du smoke test |
| `POSTGRES_PASSWORD` | `openssl rand -hex 16` | Mot de passe de la base |
| `JWT_SECRET` | `openssl rand -hex 32` | Signature des sessions (≥ 32 caractères) |
| `RESTIC_REPOSITORY` | `s3:https://<id>.r2.cloudflarestorage.com/mb-backups` | Dépôt restic |
| `RESTIC_PASSWORD` | aléatoire, **copie hors serveur** | Clé de chiffrement des sauvegardes |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | jeton R2 | Accès au bucket |
| `BACKUP_PING_URL` | optionnel | Alerte en cas d'échec de sauvegarde |
| `GHCR_USER` / `GHCR_TOKEN` | optionnel | Si le paquet GHCR est privé |

## 7. Procédure d'installation initiale (une fois par serveur)

1. `git clone` du dépôt dans `${APP_DIR}`.
2. Rédaction de `deploy/.env` (secrets générés, jamais commités).
3. Création du bucket R2 et du jeton ; `restic init`.
4. `sudo bash deploy/setup-vhost.sh` — vhost puis certificat.
5. Premier déploiement : `bash deploy/server-deploy.sh up`.
6. `bash deploy/rotate-seed-passwords.sh` — relevé des identifiants affichés.
7. Installation des entrées de crontab (sauvegarde, healthcheck, test de restauration).
8. Vérification selon §8.

## 8. Critères d'acceptation

1. `https://multiboutique.dev4future.space` répond avec un certificat valide ; l'accès en
   HTTP est redirigé vers HTTPS.
2. `curl https://multiboutique.dev4future.space/api/health` renvoie 200.
3. Aucun port de l'application ni de la base n'écoute sur `0.0.0.0`
   (vérification : `ss -tln`).
4. Les vhosts et conteneurs préexistants (`carrefoot`, `clausefoot-test`) restent
   fonctionnels — aucune régression sur les autres projets de la machine.
5. `bash deploy/backup.sh` produit un snapshot visible via `restic snapshots`.
6. `bash deploy/restore-test.sh` restaure ce snapshot et confirme des tables non vides.
7. `docker kill multiboutique-prod` entraîne un redémarrage automatique sous 2 minutes.
8. Les comptes `admin123` et `proprietaire123` ne permettent plus de se connecter.
9. Un push sur `main` déclenche le déploiement de recette et **pas** celui de production.
10. Un déploiement dont l'application ne démarre pas fait échouer le job CI.

## 9. Risques

| Risque | Portée | Traitement |
|---|---|---|
| Pression mémoire sur une machine partagée | Les autres projets peuvent subir un OOM | `mem_limit` sur les deux services ; surveillance de `free -h` après mise en service |
| `sudo` interactif | Ni le vhost ni certbot ne peuvent être automatisés | Séparation nette : installation manuelle une fois, déploiement continu en Docker seul |
| Perte du `RESTIC_PASSWORD` | Sauvegardes irrécupérables | Conservation hors serveur, consignée dans la procédure |
| Recette sur une machine de développement | Redémarrages et travaux tiers peuvent perturber l'instance | Assumé : c'est un environnement de recette, la production ira sur une cible dédiée |
| Absence de pare-feu | Services exposés au-delà du nécessaire | Hors périmètre, planifié en session dédiée |

## 10. Suites

- Mise en place du pare-feu (session dédiée, sudo interactif).
- Installation de la cible de production dédiée, réutilisant le même compose et le même
  pipeline paramétré.
- Si une seconde instance applicative devient nécessaire un jour :
  `lib/rate-limit.ts` devra passer sur un store partagé au préalable.
