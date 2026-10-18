# Séparation front / API, PWA et refonte visuelle — Design

Date : 2026-10-17 · État : choix validés en échange, spec à relire avant planification

## 1. Objectif

Sortir MultiBoutique du monolithe Next.js pour obtenir :

- **deux PWA** statiques hébergées sur **Cloudflare Workers** (fichiers statiques, sans code serveur) : la vitrine/espace client
  (`www`) et le backoffice (`backoffice`) ;
- **une API dédiée** sur le VPS (`api`), seule à parler à PostgreSQL, **sans aucun port
  public** : elle n'est joignable qu'à travers Cloudflare ;
- trois **sous-domaines distincts** (`www`, `backoffice`, `api`), pour qu'une saturation de l'un n'emporte pas l'autre,
  et que les fronts restent servis même si le VPS tombe ;
- une **refonte visuelle** complète, mobile d'abord, orientée tablette, responsive partout.

Choix arrêtés :

| Sujet | Décision |
|---|---|
| Fronts | Vite + React SPA, `vite-plugin-pwa` |
| Backend | API Fastify (TypeScript) reprenant la logique de `lib/actions` |
| Hôtes | `www` / `backoffice` / `api` sous un même domaine ; recette : `morpion.cloud`, production : domaine à acquérir |
| Accès à l'API | `fetch` direct du navigateur vers `api.<base>`, cookie `HttpOnly` ; VPS joint par Cloudflare Tunnel |
| Référencement de la vitrine | non requis |
| Hors-ligne backoffice | Installable + lecture en cache ; écritures en ligne uniquement |
| Visuel backoffice | Mobile d'abord, tactile, **cible principale tablette**, responsive téléphone → bureau |
| Charte | Aucune existante, à créer |

## 2. État des lieux

| Élément | Emplacement | Conséquence pour la séparation |
|---|---|---|
| 50 server actions (ventes, stock, commandes, admin…) | `lib/actions/index.ts` (2 552 lignes) | Deviennent des routes `POST/PATCH/DELETE` de l'API ; le SQL se reprend tel quel |
| 25 pages qui lisent la base directement (server components) | `app/**/page.tsx`, `app/(dashboard)/layout.tsx` | Chacune exige un ou plusieurs `GET` dans l'API |
| Contrôle d'accès par rôle | `middleware.ts`, `lib/permissions.ts` | Passe **dans l'API** (autorité) ; les fronts ne font que du confort de navigation |
| Session JWT HMAC maison, cookie `mb_session` 7 j | `lib/session.ts` | Réutilisable côté API ; le cookie change d'hôte (§4.2) |
| Uploads sur disque local, servis par `app/uploads/[...path]` | `app/api/upload/route.ts` | Restent sur le volume du VPS, servis par l'API |
| Rate-limit en mémoire, une seule instance | `lib/rate-limit.ts` | Conservé (une instance d'API), clé = IP réelle Cloudflare |
| Aucun test automatisé | — | L'API naît avec des tests d'intégration ; c'est le filet de la migration |

## 3. Architecture cible

```
                         Cloudflare (proxy, WAF, rate limiting, cache)
   ┌─────────────────────┬─────────────────────────┬──────────────────────────┐
   │ www.<base>          │ backoffice.<base>       │ api.<base>               │
   │ Worker : SPA PWA    │ Worker : SPA PWA        │ hôte public du Tunnel    │
   └─────────┬───────────┴────────────┬────────────┴────────────┬─────────────┘
             └──── fetch credentials: include ──────────────────┘
                                                                │ Cloudflare Tunnel
                                                                │ (connexion sortante du VPS)
                                          VPS : cloudflared → API Fastify → PostgreSQL 16
```

| Environnement | `<base>` |
|---|---|
| recette | `morpion.cloud` (zone Cloudflare, domaine enregistré chez OVH) |
| production | domaine à acquérir |

Chaque front est un **Worker sans code qui ne sert que des fichiers statiques**
(`apps/<front>/wrangler.jsonc`), un par environnement (`mb-<front>-recette`, puis
`mb-<front>`). Le domaine personnalisé (`www.<base>`, `backoffice.<base>`) est déclaré
dans ce fichier : le déploiement crée lui-même l'enregistrement DNS. Les adresses
`*.workers.dev` et les URL de prévisualisation sont désactivées.

Cloudflare Pages a été écarté à l'exécution : depuis wrangler 4.15x, la création d'un
projet Pages est redirigée vers Workers, que Cloudflare présente comme la nouvelle
version de Pages. Partir sur l'ancienne aurait imposé une migration plus tard.

**Pourquoi un même domaine parent.** Les trois hôtes sont alors *same-site* : le cookie de
session de l'API, `HttpOnly`, accompagne les `fetch` des fronts sans être un cookie tiers.
Sur `*.pages.dev` ou `*.workers.dev` (Public Suffix List), chaque front serait un site distinct et Safari,
donc tout navigateur sur iPad, bloquerait ce cookie.

### 3.1 Dépôt : monorepo npm workspaces

```
apps/api          Fastify, routes, accès pg, migrations (db/ déplacé ici)
apps/www          SPA vitrine + espace client
apps/backoffice   SPA tableau de bord + administration
packages/shared   types métier, schémas zod (validation partagée front/API),
                  permissions, formatage monétaire (lib/monnaie.ts)
packages/ui       design system : tokens, composants React + Tailwind
```

Le monolithe actuel reste en place et déployé jusqu'à la bascule (§8).

### 3.2 Répartition des écrans

| Écran actuel | Destination |
|---|---|
| `/` , `(public)/boutique`, catalogue, `reservation/[id]` | `www` |
| `(auth)/login`, `register` côté client, `(client)/client` | `www` |
| `(dashboard)/**`, consolidation | `backoffice` |
| `(admin)/**` | `backoffice`, section réservée au rôle `administrateur` |
| login du personnel | `backoffice` |

## 4. API (`apps/api`)

### 4.1 Forme

- Fastify + `@fastify/cors` + `@fastify/cookie` + `@fastify/rate-limit` ; validation par
  les schémas zod de `packages/shared`.
- Routes REST regroupées par domaine : `/auth`, `/boutiques/:id/ventes`, `/stock`,
  `/commandes`, `/fournisseurs`, `/clients`, `/promotions`, `/rapports`, `/admin/*`,
  `/public/*` (vitrine, sans session), `/uploads/*`, `/health`.
- Le corps SQL des 50 actions est **déplacé, pas réécrit**, dans `packages/metier`, que
  le monolithe et l'API appellent tous deux (décision de la phase 2 : une seule copie
  des règles de gestion tant que le monolithe tourne). `lib/actions/index.ts` n'est
  plus qu'une couche mince : session, service, `revalidatePath`. Les services lèvent
  `ErreurMetier(message, statut)` ; l'API la traduit en code HTTP.
- Les lectures des pages sont recopiées dans l'API (`apps/api/src/lectures`), pas
  partagées : les pages disparaissent en phase 5.
- Montants (`numeric`) et comptages (`bigint`) sont renvoyés en nombres JSON.
- Chaque route est inscrite dans un registre avec sa garde (`public`, `connexion`,
  `boutique`, `administrateur`) ; l'utilisateur est rechargé à chaque requête (actif,
  périmètre région/groupe, permissions de `roles_permissions`). Un test vérifie que
  chacun des 50 services a exactement une route et qu'aucune écriture n'est publique,
  hormis la réservation de la vitrine.
- Le jeton de l'API est signé avec `API_JWT_SECRET`, distinct du `JWT_SECRET` du
  monolithe.

### 4.2 Session et CSRF

- Les fronts appellent `https://api.<base>` avec `fetch(..., { credentials: "include" })`.
- L'API émet **un cookie par front**, sur son propre hôte (sans attribut `Domain`) :
  `mb_session_www` et `mb_session_bo`, `HttpOnly; Secure; SameSite=Lax`. Elle choisit le
  cookie à lire d'après l'`Origin` de la requête. Une session sur `www` n'ouvre donc
  rien sur `backoffice`, et se connecter sur l'un ne déconnecte pas l'autre.
- Le jeton porte une **audience** (`www` ou `backoffice`), fixée au login d'après
  l'`Origin`. Un client ne peut se connecter que sur `www`, le personnel que sur
  `backoffice` ; un jeton dont l'audience ne correspond pas à l'`Origin` est refusé.
- `SameSite` ne protège pas entre sous-domaines d'un même site. Défense CSRF :
  1. CORS en liste blanche stricte (`www.<base>`, `backoffice.<base>`), avec
     `credentials` ;
  2. toute requête qui modifie exige `Content-Type: application/json` (donc un preflight
     CORS) et un `Origin` présent et autorisé, sinon 403.

### 4.3 Uploads

Inchangés sur le fond (volume du VPS, mêmes contrôles MIME et taille), servis par
`GET /uploads/*` avec `Cache-Control: public, max-age=31536000, immutable` (noms en UUID) :
Cloudflare les met en cache, le VPS ne les sert qu'une fois. Une migration vers R2
reste possible plus tard sans toucher aux fronts.

## 5. Protection contre le déni de service

Séparer les sous-domaines ne protège l'API **que si le VPS n'est joignable qu'à travers
Cloudflare**. Sinon un attaquant contourne le proxy en visant directement l'IP.

- L'API n'écoute sur **aucun port public**. Un conteneur `cloudflared` du compose de
  production ouvre une connexion **sortante** vers Cloudflare (Tunnel), qui publie
  `api.<base>`. Il n'y a ni vhost Apache ni règle de pare-feu à créer sur le serveur
  partagé.
- Règles Cloudflare : rate limiting sur `/auth/*` et sur les écritures, WAF managé.
- L'API lit l'IP réelle dans `CF-Connecting-IP`, fiable puisque seul Cloudflare peut
  l'atteindre, pour son propre rate-limit.
- Les fronts étant statiques sur Cloudflare, ils restent servis même VPS à terre ; la PWA
  affiche alors les données en cache (§6.3).

## 6. Fronts PWA

### 6.1 Socle commun

Vite, React 19, React Router, TanStack Query, Tailwind, `packages/ui`.
`VITE_API_URL` injectée au build (une valeur par environnement).
Routage SPA par `not_found_handling: "single-page-application"` (toute route inconnue
renvoie `index.html`). `_headers` (CSP et en-têtes de sécurité) est **écrit au build**
à partir de `VITE_API_URL` : `connect-src` et `img-src` n'autorisent que `api.<base>`,
en une seule politique ; le build échoue sans `VITE_API_URL` en https (http accepté
pour `localhost` seulement). Les déploiements de recette portent `X-Robots-Tag: noindex`.

Décisions de la phase 3 (backoffice) :

- **Parité fonctionnelle, pas d'écran** : chaque page du monolithe a son écran, avec
  ses données, ses actions et ses contrôles, mais la mise en page suit les maquettes
  (listes adaptatives, formulaires en panneau). Les services sans écran dans le
  monolithe (`annulerVente`, `transfertStock`, `annulerReservation`, `modifierGroupe`,
  `modifierRegion`) en ont un ; `validerReservation` reste sans écran, à décider.
- **Une seule couche d'accès** : `src/api/client.ts` et un module par domaine ;
  aucun écran n'appelle `fetch`. Types des réponses dans `packages/shared/src/reponses.ts`.
- **Garde de complétude** (`apps/backoffice/src/completude.test.ts`) : chaque service
  de `packages/metier` destiné au personnel a exactement une fonction d'appel, et
  chaque page du personnel dans le monolithe a son écran.
- **Le menu suit les permissions** (`aPermission`, même matrice que le monolithe) ;
  l'API reste l'autorité.
- **Adresses** : `/b/:boutiqueId/<section>`, `/tableau-de-bord`, `/consolidation`,
  `/admin/<section>`, `/connexion`.
- **Développement et parcours de bout en bout** sur `http://localhost` : l'API
  accepte `http://localhost:<port>` comme origine, et aucun autre http. Les parcours
  Playwright tournent en CI contre la vraie API, une vraie base et la vraie CSP, et
  conditionnent le déploiement.

### 6.2 PWA

`vite-plugin-pwa` (Workbox) : manifeste, icônes, précache du shell, mise à jour avec
invite « nouvelle version disponible ». Le service worker **ne met jamais en cache les
réponses de l'API** : le cache de données est géré par TanStack Query, où il est
contrôlable et effaçable.

### 6.3 Hors-ligne (backoffice)

- Les requêtes `GET` réussies sont persistées dans IndexedDB
  (`persistQueryClient`), avec une durée de vie bornée (24 h) ; une nouvelle version
  de l'application jette le cache de l'ancienne. Une session vide n'est pas
  persistée, et la session est relue à chaque ouverture (l'API reste juge).
- Un autre utilisateur qui ouvre une session sur l'appareil vide le cache du
  précédent avant de le voir.
- Hors connexion : bandeau « hors ligne — données du <heure> », boutons d'écriture
  désactivés. Aucune file d'écritures différées.
- **Déconnexion = purge** de IndexedDB : les tablettes de boutique sont partagées.

### 6.4 Vitrine et référencement

Non requis : la vitrine reste une SPA, sans pré-rendu (`noindex`).

Décisions de la phase 4 (vitrine) :

- **Paquet commun `packages/front`** : client de l'API, session, écritures, formats
  et saisie, formulaires, persistance hors ligne et bandeaux, amorçage de
  l'application (`creerApplication`), en-têtes et CSP, configuration Vite partagée,
  outils de test et serveur des parcours (un ou deux fronts, une seule API). Les deux
  fronts n'ont plus en propre que leurs écrans, leur coque et leurs gardes.
- **Pages** : `/` (accueil et boutiques réunis), `/boutiques/:id` (catalogue, panier,
  réservation), `/reservations/:id` (suivi public, sans téléphone ni e-mail),
  `/connexion`, `/inscription`, `/espace` (seule page protégée).
- **Comptes du personnel refusés sur `www`**, avec un lien vers le backoffice
  (`VITE_BACKOFFICE_URL`, exigée au build comme `VITE_API_URL`).
- **Panier** : par boutique, dans `sessionStorage` ; il survit à un rechargement et
  ne quitte jamais l'appareil.
- **Gardes** : `apps/www/src/completude.test.ts` (la vitrine appelle exactement ses
  services ; chaque page publique ou client du monolithe a sa route) et
  `packages/front/src/couverture.test.ts` (tout service de `metier` est couvert par
  un front, sauf `validerReservation`, en attente de décision).

## 7. Refonte visuelle

### 7.1 Principes

- **Tablette d'abord** (768–1180 px, portrait et paysage), puis téléphone, puis bureau.
- Cibles tactiles ≥ 44 px, actions principales atteignables au pouce.
- Responsive partout : aucun écran réservé à un format.

| Largeur | Navigation | Listes |
|---|---|---|
| < 640 px (téléphone) | barre d'onglets en bas, 4–5 entrées + « Plus » | cartes |
| 640–1180 px (tablette, cible) | rail latéral à icônes + libellés | cartes ou tableau selon l'espace |
| > 1180 px (bureau) | barre latérale complète | tableaux denses, filtres en colonne |

### 7.2 Identité

Créée de zéro, livrée dans `packages/ui` sous forme de tokens (couleurs, typo,
espacements, rayons, ombres), en thèmes clair et sombre. Livrables avant tout
développement d'écran : palette, typographie, logotype MultiBoutique, et maquettes de
trois écrans représentatifs (caisse/nouvelle vente, stock, vitrine catalogue) sur les
trois formats. Les maquettes sont validées avant de généraliser.

## 8. Migration par phases

Chaque phase se déploie en recette et laisse l'application utilisable.

| Phase | Contenu | Fin de phase |
|---|---|---|
| 0 | Monorepo, `packages/shared`, CI à trois cibles | build vert, rien ne change pour l'utilisateur |
| 1 | Design system et maquettes | maquettes validées |
| 2 | API : auth, lectures, écritures, tests d'intégration sur Postgres réel en CI | parité fonctionnelle avec les 50 actions et les 25 pages — **réalisée** (branche `phase-2-api`) ; mise en ligne après création du tunnel |
| 3 | Backoffice PWA | parcours métier complets en recette — **réalisée** (branche `phase-3-backoffice`), mise en recette après fusion |
| 4 | www PWA | vitrine, réservation, espace client en recette — **réalisée** (branche `phase-4-www`), mise en recette après fusion |
| 5 | Bascule : tunnel en production, retrait du monolithe Next | ancien domaine redirigé vers `www.<base>` |

Déploiement : l'image de l'API s'ajoute à celle du monolithe dans
`deploy/docker-compose.prod.yml` (profil `api`, avec le service `cloudflared`), sans port
publié ; elle la remplacera en phase 5. `server-deploy.sh` n'active ce profil que si
`API_IMAGE`, `API_JWT_SECRET` et `TUNNEL_TOKEN` sont fournis : un `.env` incomplet ne
bloque pas le monolithe. `db/` reste à la racine jusqu'à la bascule. Les
fronts sont publiés par `wrangler deploy --env <environnement>` depuis le workflow, un
Worker par front et par environnement, avec les environnements GitHub `recette` et `production` existants.

## 9. Prérequis et questions ouvertes

Prérequis de la recette :

1. Créer la zone `morpion.cloud` sur Cloudflare (offre gratuite), puis remplacer chez OVH
   ses serveurs DNS par ceux qu'indique Cloudflare. Le domaine reste enregistré chez
   OVH. Les enregistrements par défaut d'OVH (parking, MX, SPF) sont inutilisés et
   peuvent être abandonnés.
2. Un jeton API Cloudflare pour le CI : **Workers Scripts : Edit** sur le compte ;
   **Workers Routes : Edit** et **DNS : Edit** sur la zone (domaines personnalisés) ;
   Tunnel en phase 2.

Question ouverte :

3. **Domaine de production** : à acquérir, puis à ajouter comme zone Cloudflare.
   `dev4future.space` (DNS chez OVH, partagé avec d'autres services) n'est plus utilisé
   par MultiBoutique après la bascule.
