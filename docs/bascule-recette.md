# Bascule de la recette et retrait du monolithe

Ce document décrit le passage de la recette au seul couple API + PWA, le retrait du
monolithe Next.js et de son adresse `multiboutique.dev4future.space`, le retour
arrière, puis l'activation future de la production.

**Toutes les étapes sont à exécuter à la main.** Le VPS et la zone DNS
`dev4future.space` sont partagés avec d'autres projets : chaque commande qui
supprime quelque chose est précédée de celle qui montre ce qu'elle va toucher.

Sur le VPS, toutes les commandes partent du dépôt :

```bash
cd /var/www/multiboutique
```

## 1. Avant la fusion

### 1.1 Marquer le dernier état avec monolithe

Depuis un poste de développement, sur `main` à jour, **avant** de fusionner la
branche de la phase 5 :

```bash
git fetch origin
git log -1 --oneline origin/main        # dernier commit qui déploie le monolithe
git tag avant-bascule origin/main
git push origin avant-bascule
```

### 1.2 Relever les images en service

Sur le VPS :

```bash
for c in multiboutique-prod multiboutique-api; do
  docker image inspect "$(docker inspect "$c" --format '{{.Image}}')" \
    --format "$c : {{join .RepoDigests \" \"}}"
done
```

Noter les deux empreintes (`ghcr.io/<compte>/multiboutique@sha256:…` et
`ghcr.io/<compte>/multiboutique-api@sha256:…`) : ce sont `IMAGE` et `API_IMAGE` du
retour arrière. **Pas l'étiquette** (`:main`) : celle de l'API est réécrite par le
déploiement de la bascule, et l'image locale d'avant disparaît au nettoyage qui le
suit. L'empreinte, elle, désigne toujours la même image dans GHCR.

### 1.3 Sauvegarder

```bash
bash deploy/backup.sh
tail -3 backups/backup.log              # dernière ligne : sauvegarde réussie
cp -p deploy/.env deploy/.env.avant-bascule
ls -l deploy/.env.avant-bascule          # -rw------- : même droits que deploy/.env
```

La copie de `deploy/.env` garde `IMAGE`, `APP_PORT`, `JWT_SECRET` et `DOMAIN`, que
le nettoyage de l'étape 3.3 retire et dont le retour arrière a besoin.

### 1.4 Le `.env` du VPS est-il complet ?

Le nouveau `server-deploy.sh` refuse de démarrer, avant tout effet, s'il manque
l'une de ces variables. Les vérifier :

```bash
for v in POSTGRES_PASSWORD API_JWT_SECRET TUNNEL_TOKEN ORIGINE_WWW ORIGINE_BACKOFFICE; do
  grep -q "^$v=." deploy/.env && echo "ok      $v" || echo "MANQUE  $v"
done
```

`API_IMAGE` est fourni par le CI.

Le CI vérifie aussi, avant tout effet, qu'il est sur le bon serveur : `ORIGINE_WWW`
doit valoir `https://www.` suivi du domaine de la variable GitHub `API_DOMAIN`
sans son `api.` (ici `https://www.morpion.cloud`) :

```bash
( set -a; . deploy/.env; echo "$ORIGINE_WWW" )
```

## 2. Fusion et vérification

Fusionner et pousser `main`. Le CI construit l'image de l'API, déploie et publie les
fronts, puis vérifie `https://api.morpion.cloud/health`, `https://www.morpion.cloud/`
et `https://backoffice.morpion.cloud/`.

`server-deploy.sh` :

1. sauvegarde la base ;
2. déplace `public/uploads` vers `donnees/uploads` ;
3. applique les migrations (aucune nouvelle dans cette phase) ;
4. démarre l'API et le tunnel, attend `/health` ;
5. **seulement ensuite**, arrête et supprime `multiboutique-prod`.

Si l'API ne répond pas, le déploiement s'arrête avant l'étape 5 : le monolithe
continue de tourner et le CI est rouge.

Vérifier ensuite, sur le VPS :

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep multiboutique
# attendu : multiboutique-db, multiboutique-api, multiboutique-tunnel ; plus de multiboutique-prod
ls donnees/uploads | head; ls public 2>/dev/null || echo "public/ supprimé"
```

Et dans un navigateur :

- connexion au backoffice (`https://backoffice.morpion.cloud`) ;
- une vente, et un produit dont l'image s'affiche ;
- connexion à la vitrine (`https://www.morpion.cloud`) ;
- une réservation, puis sa validation dans le backoffice.

## 3. Retirer l'ancienne adresse

À faire une fois la recette vérifiée. Ces étapes rendent le retour arrière plus
long (vhost, certificat et DNS à recréer), pas impossible.

### 3.1 Apache et certbot

Relever d'abord les noms exacts : **ne rien supprimer d'autre**.

```bash
sudo apache2ctl -S 2>/dev/null | grep -i multiboutique
ls /etc/apache2/sites-enabled/ /etc/apache2/sites-available/ | grep -i multiboutique
sudo certbot certificates 2>/dev/null | grep -A2 -i multiboutique
```

Typiquement, deux fichiers (`multiboutique.dev4future.space.conf` et
`multiboutique.dev4future.space-le-ssl.conf`) et un certificat
`multiboutique.dev4future.space`. Avec les noms relevés :

```bash
sudo a2dissite multiboutique.dev4future.space.conf multiboutique.dev4future.space-le-ssl.conf
sudo apache2ctl configtest              # doit afficher « Syntax OK » avant le reload
sudo systemctl reload apache2
sudo certbot delete --cert-name multiboutique.dev4future.space
sudo rm /etc/apache2/sites-available/multiboutique.dev4future.space.conf \
        /etc/apache2/sites-available/multiboutique.dev4future.space-le-ssl.conf
sudo apache2ctl -S 2>/dev/null | grep -i multiboutique || echo "plus aucun vhost multiboutique"
```

Les autres sites de la machine doivent toujours répondre : vérifier au moins l'un
d'eux après le reload.

### 3.2 DNS chez OVH

Zone `dev4future.space` (partagée) : supprimer **uniquement** l'enregistrement
`multiboutique` (A, et AAAA s'il existe). Puis, après propagation :

```bash
dig +short multiboutique.dev4future.space   # vide
```

### 3.3 `.env` du VPS

```bash
grep -nE '^(IMAGE|APP_PORT|JWT_SECRET|DOMAIN|CERTBOT_EMAIL)=' deploy/.env
sed -i -E '/^(IMAGE|APP_PORT|JWT_SECRET|DOMAIN|CERTBOT_EMAIL)=/d' deploy/.env
grep -cE '^(IMAGE|APP_PORT|JWT_SECRET|DOMAIN|CERTBOT_EMAIL)=' deploy/.env   # 0
```

`deploy/.env.avant-bascule` reste jusqu'à la fin de la période de retour arrière
(section 4), puis se supprime : il contient des secrets.

### 3.4 GitHub

Settings → Environments → `recette` : supprimer la variable `DOMAIN`. Le CI ne la
lit plus ; `API_DOMAIN` suffit.

## 4. Retour arrière

Si l'API pose un problème bloquant dans les sept jours qui suivent la bascule.

**Ne rien pousser sur `main` pendant le retour arrière** : le CI redéploierait la
version sans monolithe.

### 4.1 Revenir au code et au `.env` d'avant

```bash
cd /var/www/multiboutique
cp -p deploy/.env deploy/.env.apres-bascule
cp -p deploy/.env.avant-bascule deploy/.env
git fetch origin --tags
git checkout --detach avant-bascule
```

### 4.2 Remettre les images où le monolithe les attend

`git checkout` a recréé `public/uploads/produits` (deux images suivies par Git). Les
images ajoutées depuis sont dans `donnees/uploads` :

```bash
mkdir -p public/uploads
cp -a donnees/uploads/. public/uploads/
find donnees/uploads -type f | wc -l; find public/uploads -type f | wc -l   # le second ≥ le premier
rm -rf donnees/uploads
```

`donnees/uploads` doit disparaître : sinon, à la re-bascule, `server-deploy.sh`
trouverait des fichiers aux deux endroits et refuserait de choisir.

### 4.3 Redéployer le monolithe et l'API d'avant

L'ancien script relit `deploy/.env` **après** l'environnement : une `IMAGE` passée
sur la ligne de commande serait ignorée. Elle se corrige donc dans le `.env` (remis
à l'étape 4.1) ; `API_IMAGE`, elle, se passe sur la ligne de commande. Avec les deux
empreintes relevées à l'étape 1.2 :

```bash
sed -i 's|^IMAGE=.*|IMAGE=ghcr.io/<compte>/multiboutique@sha256:<empreinte>|' deploy/.env
grep '^IMAGE=' deploy/.env
API_IMAGE=ghcr.io/<compte>/multiboutique-api@sha256:<empreinte> \
  bash deploy/server-deploy.sh up
docker ps --format '{{.Names}}\t{{.Status}}' | grep multiboutique
curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:$(grep '^APP_PORT=' deploy/.env | cut -d= -f2)/api/health"   # 200
```

### 4.4 Adresse publique (si l'étape 3 a été faite)

Dans cet ordre : le script du vhost vérifie que le DNS pointe sur la machine avant
de demander le certificat.

1. Chez OVH, recréer l'enregistrement A `multiboutique` de `dev4future.space` vers
   l'adresse du VPS ; attendre que `dig +short multiboutique.dev4future.space` la
   renvoie.
2. Sur le VPS, avec le script **du tag** (le dépôt y est déjà) :

   ```bash
   sudo bash deploy/setup-vhost.sh
   curl -sI https://multiboutique.dev4future.space | head -1
   ```

3. Dans GitHub, remettre la variable `DOMAIN` de l'environnement `recette`, si une
   correction doit ensuite repartir de la branche d'avant.

### 4.5 Repartir vers la version sans monolithe

Une fois le problème corrigé sur `main` :

```bash
cp -p deploy/.env.apres-bascule deploy/.env
git checkout main
```

puis pousser la correction : le CI redéploie et `server-deploy.sh` redéplace les
images vers `donnees/uploads`. Refaire ensuite l'étape 3.

## 5. Production

Le pipeline de production existe mais refuse de partir : sur un tag `v*`, le job
« Garde production » (`deploy/ci/garde-production.sh`) échoue tant que les points
ci-dessous ne sont pas faits.

1. **Domaine** : l'acquérir et l'ajouter comme zone Cloudflare (même démarche que
   `morpion.cloud`, spec §9). Dans la suite, `<base>` désigne ce domaine.
2. **Second tunnel** (Zero Trust → Networks → Tunnels), nom d'hôte public
   `api.<base>` → `http://api:4000`. Garder son jeton.
3. **Serveur de production** : préparé comme dans le README (« Préparer un
   serveur »), avec un `deploy/.env` propre à la production :
   `POSTGRES_PASSWORD` et `API_JWT_SECRET` neufs, le `TUNNEL_TOKEN` du second tunnel,
   `ORIGINE_WWW=https://www.<base>`, `ORIGINE_BACKOFFICE=https://backoffice.<base>`,
   sauvegardes vers un dépôt restic distinct de la recette. Lancer
   `bash deploy/rotate-seed-passwords.sh` au premier déploiement.
4. **`env.production`** dans `apps/www/wrangler.jsonc` et
   `apps/backoffice/wrangler.jsonc`, sur le modèle de `recette` :

   ```jsonc
   "production": {
     "name": "mb-www",
     "routes": [{ "pattern": "www.<base>", "custom_domain": true }]
   }
   ```

   (`mb-backoffice` et `backoffice.<base>` pour le backoffice.) Le jeton Cloudflare
   doit couvrir la nouvelle zone (Workers Routes, DNS).
5. **Environnement GitHub `production`** :
   - variables : `API_DOMAIN=api.<base>`, `APP_DIR` si le chemin diffère ;
   - secrets : `SERVER_HOST`, `SERVER_PORT`, `SERVER_USER`, `SERVER_SSH_KEY`,
     `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` ;
   - *Deployment branches and tags* limité à `v*`, au moins un *Required reviewer*.
6. **Premier déploiement** :

   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```

   La garde passe, l'API et les fronts se déploient, puis « Santé production »
   vérifie `https://api.<base>/health`, `https://www.<base>/` et
   `https://backoffice.<base>/`.

La production n'a pas d'en-tête `X-Robots-Tag` ; les pages gardent leur meta robots
`noindex` (référencement non requis, spec §6.4).
