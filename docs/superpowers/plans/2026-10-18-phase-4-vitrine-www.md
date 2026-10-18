# Phase 4 : Vitrine et espace client (www) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline-one-shot-execution (choisi par l'utilisateur) ou superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** `www.morpion.cloud` remplace la partie publique et l'espace client du
monolithe : accueil et liste des boutiques, catalogue avec panier et réservation,
page publique d'une réservation, inscription, connexion des clients et suivi de leurs
réservations. C'est une PWA installable, avec l'identité « Comptoir », branchée sur
l'API. Le monolithe reste en service, inchangé.

**Spec :** `docs/superpowers/specs/2026-10-17-separation-front-api-pwa-design.md` (§3.2,
§4.2, §6, §8) ; identité : `docs/superpowers/specs/2026-10-17-identite-visuelle.md` ;
maquette de référence : `apps/maquettes/src/ecrans/Catalogue.tsx`.

**Tech Stack :** identique au backoffice (Vite 8, React 19, React Router 8, TanStack
Query 5 + persistance IndexedDB, Tailwind 4, `packages/ui`, `vite-plugin-pwa`,
Vitest 5 + Testing Library + axe-core, Playwright).

## Périmètre

| Page du monolithe | Route de `www` | Lecture de l'API | Écriture |
|---|---|---|---|
| `app/page.tsx` et `(public)/boutique/page.tsx` | `/` | `GET /public/boutiques` | — |
| `(public)/boutique/[id]/catalogue/page.tsx` (+ `components/public/CatalogueReservation.tsx`) | `/boutiques/:id` | `GET /public/boutiques/:id/catalogue` | `POST /reservations` (`creerReservation`) |
| `(public)/reservation/[id]/page.tsx` | `/reservations/:id` | `GET /public/reservations/:id` | — |
| `(auth)/login/page.tsx` (côté client) | `/connexion` | — | `POST /auth/connexion` |
| `(auth)/register/page.tsx` | `/inscription` | — | `POST /auth/inscription` |
| `(client)/client/page.tsx` et son layout | `/espace` | `GET /me/reservations` | — |

`components/public/FormulaireReservation.tsx` n'est importé nulle part dans le
monolithe : c'est du code mort, il n'est pas repris.

## Décisions de conception

Chacune est reportée dans la spec à la tâche 12.

1. **Les briques communes deviennent un paquet partagé : `packages/front`.** La phase 3
   les a écrites dans `apps/backoffice`. Les recopier dans `www` dédoublerait la
   sécurité : session, redirection après connexion, purge du cache, CSP. Le paquet
   reçoit :
   - le client de l'API et la session (`FournisseurSession`, `retourSain`) ;
   - `useEcriture`, `useEnLigne`, les formats et la saisie ;
   - `Formulaire`, `Lecture`, `ListeChargee`, `EnTeteEcran` ;
   - la persistance hors ligne et le bandeau hors ligne ;
   - le plugin d'en-têtes ;
   - les outils de test : `fauxApi`, `sansViolation`, le serveur des parcours.

   Ce qui est propre au personnel reste dans le backoffice : coques, navigation,
   garde de complétude. **Aucun comportement du backoffice ne change** : ses 147 tests
   et 24 parcours doivent rester verts.
2. **La vitrine est publique, l'espace client protégé.** Les pages `/`,
   `/boutiques/:id` et `/reservations/:id` s'ouvrent sans session ; seule `/espace`
   l'exige. Un visiteur anonyme réserve comme dans le monolithe ; un client connecté
   voit sa réservation rattachée à son compte (c'est `creerReservation` qui le fait
   d'après la session).
3. **Les comptes du personnel ne se connectent pas sur `www`.** L'API refuse avec
   « Ce compte ne se connecte pas ici » ; la vitrine affiche ce message avec un lien
   vers le backoffice (`VITE_BACKOFFICE_URL`). L'en-tête de la vitrine propose aussi
   un lien « Espace professionnel », qui reprend le « Se connecter » de l'accueil du
   monolithe, commun au personnel et aux clients.
4. **L'accueil fusionne `app/page.tsx` et `/boutique`.** La présentation (nom,
   promesse) et la liste des boutiques actives tiennent sur un seul écran. Les
   chiffres décoratifs du monolithe (« 3 boutiques connectées », « 100 % », « 24/7 »)
   sont remplacés par le nombre réel de boutiques.
5. **Le panier vit dans `sessionStorage`, une entrée par boutique.** Il survit à un
   rechargement ou à un aller-retour vers la connexion. Il est vidé après la
   réservation, et ne passe jamais par l'API ni par IndexedDB. Le monolithe le
   gardait en mémoire et le perdait au moindre rechargement.
6. **Les fonctions du catalogue sont reprises une à une** de
   `CatalogueReservation.tsx` :
   - les catégories avec leur nombre de produits ;
   - la recherche, sur le nom, la référence et la catégorie ;
   - les quatre tris ;
   - les paramètres `?reserve=<produit>` et `?categorie=<id>` ;
   - la quantité limitée au disponible (entre 1 et 200) ;
   - le formulaire : nom et téléphone obligatoires, e-mail et date de retrait
     facultatifs ;
   - la redirection vers la réservation créée.

   Client connecté : le nom et l'e-mail sont préremplis depuis la session, qui ne
   porte pas le téléphone.
7. **La page publique d'une réservation n'affiche ni téléphone ni e-mail**, puisque
   l'API ne les renvoie pas (correction de la phase 2). Le lien de la réservation
   suffit à la consulter, comme dans le monolithe ; la page le rappelle et propose de
   le copier.
8. **Hors ligne, le catalogue et l'espace restent lisibles depuis le cache** ; la
   réservation, elle, exige la connexion. C'est la même persistance que le
   backoffice (24 h, vidée à la déconnexion et au changement d'utilisateur). Le
   service worker ne met en cache que le shell, jamais les réponses de l'API.
9. **Garde de complétude de la vitrine** (`apps/www/src/completude.test.ts`) :
   - `www` appelle exactement les services de `packages/metier` qui lui reviennent,
     soit `creerReservation` aujourd'hui ;
   - chaque page publique ou client du monolithe a sa route.

   Une **garde commune** (`packages/front`) vérifie que tout service de `metier` est
   couvert par le backoffice ou la vitrine. La seule exception déclarée reste
   `validerReservation`, en attente de décision.

## Global Constraints

- **Branche dédiée** `phase-4-www`, dans un worktree. Rien sur `main` avant la revue.
- **Le monolithe ne change pas** : aucun fichier sous `app/`, `components/`, `lib/`
  n'est modifié. `next build` passe à la fin.
- **Le backoffice ne change pas de comportement** : la tâche 1 est un déplacement,
  vérifié par ses tests unitaires et ses parcours, inchangés.
- **L'API ne change que si un manque est découvert** (lecture absente, champ manquant).
  Le cas échéant, on suit les règles de la phase 2 : d'abord un test d'intégration sur
  PostgreSQL réel, puis l'écart est noté dans le rapport.
- **TDD**, et **au moins trois tests par écran qui écrit** : cas nominal (route et
  corps), erreur de l'API affichée, refus hors ligne. Plus `axe` sans violation sur
  chaque écran.
- **Parcours de bout en bout** Playwright pour `www`, contre la vraie API, une vraie
  base et la vraie CSP, aux quatre largeurs (390, 820, 1180, 1440 px). Le job CI
  `e2e` exécute ceux des deux fronts, et le déploiement en dépend.
- **Saisies** : les nombres passent par `lireNombre` et `lireEntier`. Toute bascule
  (bouton qui inverse un état côté serveur) est verrouillée pendant l'appel.
- **Nommage** : français ; commits `Préfixe : description` + ligne `Co-Authored-By`.
- **Versions** : celles déjà en place dans le monolithe et les fronts.

## Review Focus

1. **Le déplacement vers `packages/front`** : le backoffice se comporte exactement
   comme avant (tests et parcours inchangés, mêmes en-têtes). → Tâche 1.
2. **La réservation** : mêmes contrôles, même corps de requête et même redirection
   que le monolithe. Un client connecté voit la réservation dans son espace, un
   visiteur anonyme non. La limite de 20 réservations par heure renvoie un message
   compréhensible. → Tâches 6, 11.
3. **La séparation des sessions** : un compte du personnel est refusé sur `www`, et
   une session `www` n'ouvre rien sur le backoffice. → Tâches 4, 11.
4. **Les données personnelles** : la page publique d'une réservation n'expose ni
   téléphone ni e-mail ; le panier ne quitte jamais l'appareil. → Tâches 6, 7.
5. **La CSP** : une seule politique, avec l'API en `connect-src` et en `img-src` pour
   les photos des produits. → Tâche 12.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `packages/front/src/{api,session,commun,hors-ligne}/*` | Briques communes aux deux fronts | 1 |
| `packages/front/outils/en-tetes.ts` | `_headers` et CSP générés au build | 1 |
| `packages/front/test/*`, `packages/front/e2e/serveurs.ts` | Faux serveur, axe, serveur des parcours (paramétré par front) | 1 |
| `packages/front/src/couverture.test.ts` | Garde commune : tout service est couvert | 10 |
| `apps/www/src/coque/*` | En-tête et pied de la vitrine | 3 |
| `apps/www/src/ecrans/*` | Écrans de la vitrine et de l'espace | 4–8 |
| `apps/www/src/panier.ts` | Panier par boutique (`sessionStorage`) | 6 |
| `apps/www/src/completude.test.ts` | Garde de la vitrine | 10 |
| `apps/www/e2e/*`, `playwright.config.ts` | Parcours de la vitrine | 2, 4–9, 11 |
| `.github/workflows/ci-cd.yml` | e2e des deux fronts, `VITE_*` de `www` | 2, 12 |

---

### Task 1: Paquet `packages/front`

**Files:** Create `packages/front/{package.json,tsconfig.json,vitest.config.ts}` ;
Move from `apps/backoffice` les modules listés en décision 1, ainsi que leurs tests ;
Modify les imports du backoffice, `apps/backoffice/{package.json,vite.config.ts,playwright.config.ts,e2e/serveurs.ts}`.

- `@multiboutique/front` exporte des sources TypeScript, comme `packages/ui`. Les
  dépendances React, TanStack Query et React Router sont déclarées en `peerDependencies`.
- `URL_API` reste lue depuis `import.meta.env.VITE_API_URL`, au build de chaque front.
- `serveurs.ts` est paramétré par le front à servir : racine, port, origine attendue
  par l'API (`ORIGINE_WWW` ou `ORIGINE_BACKOFFICE`). La base `mb_e2e` et le mandataire
  `cf-connecting-ip` sont partagés.

- [ ] **Step 1** — `git mv` des modules ; les tests déplacés passent dans
  `packages/front`.
- [ ] **Step 2** — le backoffice importe `@multiboutique/front` ; ses 147 tests, son
  typecheck, son build et ses 24 parcours passent sans modification de leurs
  attentes. Le `_headers` produit est identique octet pour octet à celui de `main`
  (comparaison des deux fichiers).
- [ ] **Step 3** — commit `Front : paquet commun aux deux PWA`.

### Task 2: Socle de `www`

**Files:** Modify `apps/www/{package.json,vite.config.ts,index.html,src/main.tsx,src/App.tsx,src/App.test.tsx,tsconfig.json}` ;
Create `apps/www/src/{routes.tsx,styles.css,test-preparation.ts}`, `apps/www/playwright.config.ts`,
`apps/www/e2e/{ports.ts,outils.ts}` ; Delete `apps/www/public/_headers` ; Modify `.github/workflows/ci-cd.yml`.

- Même socle que le backoffice : Tailwind 4 avec une configuration PostCSS vide,
  thème, polices, PWA en mode `prompt`, icônes de `packages/ui`, `_headers` généré.
- Manifeste : `name` « MultiBoutique », `short_name` « MultiBoutique »,
  `start_url` « / ».
- Variables de build :
  - `VITE_API_URL` (obligatoire, même règle que le backoffice) ;
  - `VITE_BACKOFFICE_URL` (obligatoire, https sauf `localhost`), pour les liens vers
    l'espace professionnel.
- Parcours : port 5175, API sur 4110. Le serveur commun démarre l'API avec
  `ORIGINE_WWW=http://localhost:5175`.
- CI :
  - le job `e2e` lance aussi `npm run e2e -w @multiboutique/www` ;
  - le job des fronts reçoit `VITE_BACKOFFICE_URL`, qu'une étape calcule à partir de
    `API_DOMAIN` (`api.<base>` devient `backoffice.<base>`). Aucune nouvelle variable
    GitHub n'est donc nécessaire.

- [ ] **Step 1 — test rouge** : `/inconnu` affiche « Page introuvable » ; le build
  échoue sans `VITE_API_URL` ou sans `VITE_BACKOFFICE_URL`.
- [ ] **Step 2** — implémenter ; le build produit `sw.js`, `manifest.webmanifest` et
  un `_headers` contenant une seule CSP.
- [ ] **Step 3** — commit `Vitrine : socle, PWA et en-têtes`.

### Task 3: Coque de la vitrine

**Files:** Create `apps/www/src/coque/{CoqueVitrine.tsx,MenuCompte.tsx}` (+ tests).

- En-tête :
  - le logotype, qui mène à l'accueil ;
  - « Boutiques » ;
  - pour un visiteur, « Connexion » et « Espace professionnel » (lien externe vers
    le backoffice) ;
  - pour un client connecté, « Mes réservations » et un menu de compte (nom,
    déconnexion).
- Sur téléphone, l'en-tête se replie : le logotype, puis un menu en panneau.
- Pied de page : le nom de l'application, tiré du paramètre `nom_application`.
- Le bandeau hors ligne et le bandeau de mise à jour sont repris du paquet commun.

- [ ] **Step 1 — tests rouges** :
  - un visiteur voit « Connexion » et « Espace professionnel », dont le lien pointe
    vers `VITE_BACKOFFICE_URL` ;
  - un client voit son nom et « Mes réservations » ;
  - la déconnexion vide le cache et ramène à l'accueil ;
  - `axe` ne relève aucune violation.
- [ ] **Step 2** — implémenter ; capture des quatre formats dans les parcours.
- [ ] **Step 3** — commit `Vitrine : coque publique et compte client`.

### Task 4: Connexion, inscription et espace protégé

**Files:** Create `apps/www/src/ecrans/{Connexion,Inscription}.tsx` (+ tests),
`apps/www/src/session/GardeClient.tsx`, `apps/www/e2e/compte.spec.ts`.

- Connexion : même écran que le backoffice, dans la coque de la vitrine.
  - Le compte d'un membre du personnel est refusé ; le message de l'API s'affiche
    avec un lien vers l'espace professionnel.
  - Après la connexion, l'utilisateur va vers `retour` s'il est sain, sinon vers
    `/espace`.
  - L'écran propose un lien « Créer un compte ».
- Inscription : mêmes champs et mêmes règles que `register/page.tsx` et que la route
  `/auth/inscription` (nom complet, téléphone facultatif, e-mail, mot de passe de 6
  à 72 caractères).
  - Comme le monolithe, l'inscription mène ensuite à `/connexion`.
  - L'adresse est pré-remplie, et un bandeau dit « Compte créé, connectez-vous ».
- `GardeClient` protège `/espace` : sans session, l'utilisateur va vers
  `/connexion?retour=/espace`.

- [ ] **Step 1 — tests rouges** :
  - le corps envoyé à l'inscription ;
  - le 409 de l'API (« Cet élément existe déjà ») affiché ;
  - le mot de passe trop court refusé avant l'appel ;
  - la connexion d'un compte du personnel affiche le message et le lien ;
  - un `retour` externe est ignoré ;
  - `/espace` sans session mène à la connexion.
- [ ] **Step 2** — implémenter.
- [ ] **Step 3 — e2e** :
  - un visiteur s'inscrit, se connecte, arrive sur `/espace`, puis se déconnecte ;
  - la gérante est refusée sur `www` ;
  - le cookie `www` n'ouvre pas `backoffice` : `GET /auth/session` avec l'origine du
    backoffice renvoie 401.
- [ ] **Step 4** — commit `Vitrine : inscription, connexion et espace protégé`.

### Task 5: Accueil et boutiques

**Files:** Create `apps/www/src/ecrans/Accueil.tsx` (+ test), `apps/www/src/api/vitrine.ts`,
types dans `packages/shared/src/reponses.ts`.

- En-tête de page : le nom de l'application et sa promesse (le texte de `app/page.tsx`).
- Les boutiques actives en cartes (nom, adresse, téléphone), chacune mène à
  `/boutiques/:id`. Sans boutique : « Aucune boutique disponible pour le moment ».

- [ ] **Step 1 — test rouge** :
  - les cartes et leurs liens ;
  - l'état vide ;
  - une erreur de l'API avec « Réessayer » ;
  - `axe` ne relève aucune violation.
- [ ] **Step 2** — implémenter ; commit `Vitrine : accueil et boutiques`.

### Task 6: Catalogue, panier et réservation

**Files:** Create `apps/www/src/ecrans/catalogue/{Catalogue,Panier,FormulaireReservation}.tsx` (+ tests),
`apps/www/src/panier.ts` (+ test), `apps/www/e2e/reservation.spec.ts`.

- Mise en page de la maquette « Catalogue » :
  - des cartes produit avec leur photo, servie par `/uploads` de l'API ;
  - un badge de disponibilité (« Disponible », « Stock limité » sous le seuil du
    produit, « Épuisé » n'apparaît pas puisque l'API ne renvoie que `disponible > 0`) ;
  - le panier dans une colonne latérale à partir de 960 px, et dans une barre de
    résumé fixe en dessous.
- Toutes les fonctions de la décision 6, avec le fil d'Ariane « Boutiques / <nom> ».
- `panier.ts` : `lirePanier(boutiqueId)`, `ecrirePanier(boutiqueId, lignes)`,
  `viderPanier(boutiqueId)`. Il passe par `sessionStorage`, protégé par try/catch (en
  navigation privée, il ne garde le panier qu'en mémoire).
- Réservation : `POST /reservations` avec `{ client_nom, client_telephone,
  client_email?, boutique_id, date_retrait_prevue?, lignes }`. Puis on vide le panier
  et on va vers `/reservations/:reservationId`.
  - Les messages d'erreur de l'API s'affichent tels quels : stock insuffisant (409),
    trop de réservations (429).
  - Hors ligne, le bouton est désactivé et le formulaire l'explique.
- Les quantités passent par `lireEntier`, entre 1 et le disponible (200 au plus,
  comme le monolithe).

- [ ] **Step 1 — tests rouges** :
  - la catégorie filtre, avec ses compteurs ;
  - la recherche ignore accents et casse ;
  - les quatre tris ;
  - `?reserve=` ajoute le produit et `?categorie=` le présélectionne ;
  - la quantité est plafonnée au disponible ;
  - le nom et le téléphone sont exigés avant l'appel ;
  - le corps envoyé, puis la redirection ;
  - le panier est conservé après un rechargement puis vidé après la réservation ;
  - un 409 laisse le panier intact ;
  - un 429 affiche son message ;
  - un client connecté a son nom et son e-mail pré-remplis ;
  - `axe` ne relève aucune violation.
- [ ] **Step 2** — implémenter.
- [ ] **Step 3 — e2e** : un visiteur réserve deux produits, arrive sur la page de la
  réservation. Dans le backoffice, la gérante la voit (lecture par l'API), puis le
  disponible du catalogue a baissé.
- [ ] **Step 4** — commit `Vitrine : catalogue, panier et réservation`.

### Task 7: Page publique d'une réservation

**Files:** Create `apps/www/src/ecrans/Reservation.tsx` (+ test).

- La page reprend `reservation/[id]/page.tsx`, sans téléphone ni e-mail :
  - la référence et le statut, avec les mêmes libellés ;
  - le nom du client ;
  - la boutique de retrait (nom, adresse, téléphone) ;
  - les articles, chacun avec sa référence, sa quantité et son sous-total ;
  - le total à payer ;
  - la date de réservation et, le cas échéant, la date de retrait prévue ;
  - en attente, « Prochaine étape : présentez-vous en boutique avec cette
    référence… ».
- Un bouton « Copier le lien » et un rappel : « Gardez ce lien : il permet de suivre
  la réservation. »
- Une réservation inconnue affiche « Réservation introuvable » (404 de l'API).

- [ ] **Step 1 — test rouge** :
  - chaque bloc est présent, et ni téléphone ni e-mail n'apparaissent ;
  - le 404 est géré ;
  - `axe` ne relève aucune violation.
- [ ] **Step 2** — implémenter ; commit `Vitrine : suivi public d'une réservation`.

### Task 8: Espace client

**Files:** Create `apps/www/src/ecrans/Espace.tsx` (+ test).

- La page reprend `client/page.tsx` :
  - « Bonjour <nom> » ;
  - le nombre de réservations en attente de retrait ;
  - la liste « Mes réservations » (référence, boutique, nombre d'articles, montant,
    statut, date), chaque ligne menant à `/reservations/:id` ;
  - le bloc « Réserver en ligne » vers l'accueil.
- Hors ligne, la liste reste lisible depuis le cache.

- [ ] **Step 1 — test rouge** :
  - les colonnes et les badges de statut ;
  - le compteur des réservations en attente ;
  - l'état vide ;
  - `axe` ne relève aucune violation.
- [ ] **Step 2** — implémenter ; commit `Vitrine : espace client`.

### Task 9: PWA et hors ligne

**Files:** Modify `apps/www/src/App.tsx` ; Create `apps/www/e2e/hors-ligne.spec.ts`.

- Même mécanique que le backoffice, tirée du paquet commun : persistance de 24 h,
  purge à la déconnexion et au changement d'utilisateur, bandeau hors ligne, bandeau
  de mise à jour.

- [ ] **Step 1 — tests** :
  - hors ligne, le catalogue reste affiché et « Réserver » est désactivé ;
  - la déconnexion vide le cache.
- [ ] **Step 2 — e2e** :
  - le manifeste est installable ;
  - un catalogue consulté se recharge hors ligne, avec le bandeau ;
  - la réservation est impossible hors ligne ;
  - la déconnexion vide IndexedDB.
- [ ] **Step 3** — commit `Vitrine : PWA installable et lecture hors ligne`.

### Task 10: Gardes de complétude

**Files:** Create `apps/www/src/completude.test.ts`, `packages/front/src/couverture.test.ts` ;
Modify `apps/backoffice/src/completude.test.ts`.

- Vitrine : `SERVICES` de `www` vaut exactement `{ creerReservation }`, et les six
  pages du tableau « Périmètre » ont leur route. Une page publique ou client ajoutée
  au monolithe fait échouer le test.
- Garde commune : l'union des services du backoffice et de la vitrine, plus
  `validerReservation` (exception déclarée, à décider), égale l'ensemble des services
  de `metier`.
- Backoffice : la justification de son exclusion de `creerReservation` devient
  « couvert par la vitrine (apps/www) ».

- [ ] **Step 1** — écrire les gardes.
- [ ] **Step 2 — mutations** : retirer `creerReservation` de `www`, une route de
  `www`, puis un service du backoffice. Chaque mutation doit faire échouer la garde
  concernée, qui nomme l'élément manquant.
- [ ] **Step 3** — commit `Gardes : complétude de la vitrine et couverture des services`.

### Task 11: Parcours croisés

**Files:** Create `apps/www/e2e/{croise,securite}.spec.ts`.

- Un client inscrit et connecté réserve dans la vitrine.
  - Dans le backoffice, la gérante confirme puis encaisse la réservation.
  - Dans l'espace client, la réservation passe « Prête » puis « Retirée ».
- Une réservation anonyme n'apparaît dans aucun espace client.
- Aucun écran de la vitrine ne viole la CSP (console sans « Refused to »), et
  l'image d'un produit s'affiche.

- [ ] **Step 1** — écrire les parcours ; ils tournent avec les deux fronts et l'API
  (le serveur commun sert les deux fronts sur leurs ports).
- [ ] **Step 2** — commit `Parcours : vitrine, backoffice et espace client`.

### Task 12: Déploiement, spec et vérification

**Files:** Modify `.github/workflows/ci-cd.yml`,
`docs/superpowers/specs/2026-10-17-separation-front-api-pwa-design.md`.

- CI :
  - les fronts reçoivent `VITE_API_URL` et `VITE_BACKOFFICE_URL` ;
  - le job `e2e` installe Chromium une fois et lance les parcours des deux fronts ;
  - le rapport Playwright est publié en artefact si un parcours échoue.
- Spec : décisions 1 à 9 ; §8, phase 4 marquée réalisée.

- [ ] **Step 1 — vérification complète** :
  - tests de tous les workspaces ;
  - typecheck ;
  - `build:workspaces` (avec des `VITE_*` fictifs) ;
  - `next build` ;
  - images Docker du monolithe et de l'API ;
  - parcours des deux fronts ;
  - `action-validator` sur le workflow ;
  - gardes vérifiées par mutation.
- [ ] **Step 2** — commit `Déploiement : vitrine en recette`.
- [ ] **Step 3 — en recette (après fusion, décision humaine)**. Sur
  `https://www.morpion.cloud`, avec un téléphone et une tablette :
  - inscription ;
  - réservation ;
  - suivi dans l'espace ;
  - installation de la PWA ;
  - consultation hors ligne.

  Puis, dans le backoffice, la réservation est confirmée et encaissée.

---

## Hors périmètre

- La bascule, la redirection de l'ancien domaine et le retrait du monolithe : phase 5.
- `validerReservation` : décision attendue (l'exposer, ou le retirer de `metier` et de
  l'API).
- Le référencement : non requis (spec §6.4), la vitrine reste une SPA sans pré-rendu.
- L'annulation d'une réservation par le client lui-même : le monolithe ne la propose
  pas, et aucun service ne l'autorise pour un client.
