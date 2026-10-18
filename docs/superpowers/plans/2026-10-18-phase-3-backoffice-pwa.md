# Phase 3 : Backoffice PWA — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline-one-shot-execution (choisi par l'utilisateur) ou superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** `backoffice.morpion.cloud` remplace le tableau de bord et l'administration du
monolithe : les 20 écrans du personnel (13 de `(dashboard)`, 7 de `(admin)`) et la
connexion, branchés sur l'API de la phase 2, avec l'identité « Comptoir ». La PWA
s'installe, garde les lectures en cache 24 h et interdit les écritures hors ligne. Le
monolithe reste en service, inchangé.

**Spec :** `docs/superpowers/specs/2026-10-17-separation-front-api-pwa-design.md` (§3.2,
§4.2, §6, §7, §8) ; identité : `docs/superpowers/specs/2026-10-17-identite-visuelle.md`.

**Tech Stack :** Vite 8, React 19, React Router 7 (mode bibliothèque), TanStack Query 5
(+ `persistQueryClient`, `idb-keyval`), Tailwind 4, `packages/ui`, `vite-plugin-pwa`
(Workbox), Vitest 5 + Testing Library, Playwright (Chromium), wrangler 4.151.1.

## Décisions de conception

Elles précisent la spec ; chacune y est reportée à la tâche 16.

1. **Parité fonctionnelle, pas parité d'écran.** Chaque écran reprend les données, les
   actions et les contrôles de la page du monolithe, mais pas sa mise en page : il suit
   les maquettes validées (tablette d'abord, `ListeAdaptative`, panneaux plutôt que pages
   de formulaire). Rien n'est ajouté ni retiré au métier ; un défaut du monolithe signalé
   en phase 2 n'est pas recopié quand l'API l'a déjà corrigé.
2. **L'API est l'autorité, le front ne fait que du confort.** Le menu et les boutons
   suivent `utilisateur.permissions` (renvoyé par `/auth/session`, lu en base à chaque
   requête), avec la même matrice que `components/dashboard/Sidebar.tsx`. Un 403 de l'API
   s'affiche tel quel ; le front n'invente aucune règle.
3. **Une seule couche d'accès à l'API** : `src/api/client.ts` (`fetch`,
   `credentials: "include"`, JSON) et un module par domaine (`src/api/ventes.ts`, …) qui
   expose une fonction par route. Aucun écran n'appelle `fetch`. Les types de réponse
   vivent dans `packages/shared/src/reponses.ts` (types seuls), à côté des schémas de
   requête de la phase 2.
4. **Garde de complétude côté front**, sur le modèle de la phase 2 : un test vérifie que
   chacun des services de `packages/metier` destinés au personnel a exactement une
   fonction d'appel, et que chaque page du monolithe sous `(dashboard)` et `(admin)` a
   une route. Exclus, et listés dans le test : `creerReservation` (vitrine, phase 4).
5. **URL** : `/b/:boutiqueId/<section>` pour les écrans d'une boutique,
   `/tableau-de-bord` (propriétaire), `/consolidation`, `/admin/<section>`, `/connexion`.
   La racine redirige selon le rôle, comme `app/(dashboard)/dashboard/page.tsx`.
6. **Formulaires dans un panneau** (`Panneau` : feuille du bas sur téléphone, panneau
   latéral sur tablette et bureau), jamais dans une page à part : la liste reste visible,
   et l'URL porte l'état ouvert (`?panneau=nouveau`, `?panneau=<id>`) pour que retour
   arrière ferme le panneau.
7. **Développement local et tests de bout en bout sur `http://localhost`.** `lireConfig`
   n'accepte que des origines https. Elle accepte en plus `http://localhost:<port>`, et
   rien d'autre en http : un `.env` de serveur n'a aucune raison de contenir `localhost`,
   et Chromium accepte les cookies `Secure` (donc `__Host-`) sur `localhost`.
8. **`_headers` produit au build**, plus versionné tel quel : la CSP dépend de l'hôte de
   l'API (`connect-src` et `img-src` pour les images servies par `/uploads`). Un plugin
   Vite l'écrit dans `dist/` à partir de `VITE_API_URL`. Le CI ajoute toujours
   `X-Robots-Tag: noindex` en recette. Deux en-têtes CSP cumulés se combinent par
   intersection : il ne doit y en avoir qu'un.

## Global Constraints

- **Branche dédiée** `phase-3-backoffice`, dans un worktree. Rien sur `main` avant la revue.
- **Le monolithe ne change pas.** Aucun fichier sous `app/`, `components/`, `lib/` n'est
  modifié. `next build` passe à la fin.
- **L'API ne change que pour les besoins listés** (origines `localhost`, routes de lecture
  manquantes découvertes en route) ; toute modification de l'API suit les règles de la
  phase 2 (test d'intégration sur PostgreSQL réel d'abord) et figure dans le rapport.
- **TDD** : chaque écran naît d'un test Testing Library qui échoue (route absente, texte
  attendu introuvable). Les tests d'écran remplacent `fetch` par un faux serveur en
  mémoire (`test/faux-api.ts`) dont les réponses sont typées par `reponses.ts` ; le
  métier, lui, est déjà couvert par les tests de l'API.
- **Chaque écran d'écriture a au moins trois tests** : cas nominal (la bonne route est
  appelée avec le bon corps, la liste est rafraîchie), erreur de l'API affichée
  (message et erreurs de champ zod), bouton absent sans la permission.
- **Parcours de bout en bout** (Playwright, tâche 4 puis à chaque tâche d'écran) contre
  la vraie API et une base clonée de `mb_modele`, en CI : c'est le filet de la parité.
- **Accessibilité** : cibles ≥ 44 px, focus visible, libellés de champ, `axe` sans
  violation sur chaque écran (via `vitest-axe`).
- **Formats** : chaque écran est vérifié à 390, 820 (portrait tablette), 1180 et 1440 px
  dans Playwright (capture et absence de défilement horizontal).
- **Nommage** : français ; commits `Préfixe : description` + ligne `Co-Authored-By`.
- **Versions** : dernières stables au moment de l'exécution ; TypeScript reste en 5.

## Review Focus

1. **Parité des données et des actions** : chaque page du monolithe a son écran, chaque
   bouton son appel. → Garde de complétude (tâche 5), tâches 7 à 14.
2. **Permissions** : le menu et les actions masquées correspondent exactement à la
   matrice du monolithe ; un vendeur ne voit jamais `cout_revient`. → Tâches 5, 9.
3. **Session** : déconnexion = purge du cache IndexedDB et de TanStack Query ; un 401
   renvoie à la connexion sans boucle. → Tâches 4, 15.
4. **Hors ligne** : aucune écriture n'est envoyée ni mise en file hors connexion ; le
   service worker ne met en cache aucune réponse de l'API. → Tâche 15.
5. **CSP** : une seule politique, l'API seule autorisée en `connect-src`. → Tâche 16.
6. **Atomicité perçue de la caisse** : une vente refusée (stock insuffisant, plafond de
   crédit, code promo) laisse le panier intact et affiche la raison. → Tâche 8.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `packages/ui/src/composants/{Panneau,Dialogue,Selecteur,ZoneTexte,Notification,Bandeau}.tsx` | Composants manquants aux écrans | 2 |
| `packages/ui/src/theme/{theme.ts,SelecteurTheme.tsx}` | Thème clair/sombre/système, déplacé des maquettes | 2 |
| `packages/shared/src/reponses.ts` | Types des réponses de l'API | 3, puis 7–14 |
| `apps/backoffice/src/api/client.ts` | `fetch`, erreurs, 401 | 3 |
| `apps/backoffice/src/api/<domaine>.ts` | Une fonction par route | 3, 7–14 |
| `apps/backoffice/src/session/*` | Session, garde de route, permissions | 4 |
| `apps/backoffice/src/coque/*` | Navigation, choix de boutique | 5 |
| `apps/backoffice/src/commun/*` | `useEcriture`, formulaire, montants | 6 |
| `apps/backoffice/src/ecrans/<section>/*` | Écrans | 7–14 |
| `apps/backoffice/src/hors-ligne/*` | Persistance, bandeau, mise à jour | 15 |
| `apps/backoffice/e2e/*`, `playwright.config.ts` | Parcours de bout en bout | 4, 7–14 |
| `apps/backoffice/vite.config.ts` | PWA, `_headers` généré | 1, 15, 16 |
| `apps/api/src/config.ts` | Origines `localhost` | 4 |
| `.github/workflows/ci-cd.yml` | e2e, `VITE_API_URL` | 4, 16 |

## Correspondance des écrans

| Page du monolithe | Route du backoffice | Lectures | Écritures (services `metier`) |
|---|---|---|---|
| `(auth)/login` (personnel) | `/connexion` | — | `/auth/connexion` |
| `dashboard/page.tsx` | `/tableau-de-bord` | `/resume`, `/me/boutiques` | — |
| `dashboard/consolidation` | `/consolidation` | `/consolidation` | — |
| `[boutiqueId]/page.tsx` | `/b/:id` | `/boutiques/:id`, `…/resume` | — |
| `[boutiqueId]/ventes` | `/b/:id/ventes` | `…/ventes`, `…/ventes/statistiques` | `creerVente` |
| `[boutiqueId]/ventes/[venteId]` | `/b/:id/ventes/:venteId` | `…/ventes/:venteId` | `annulerVente` |
| `[boutiqueId]/produits` | `/b/:id/produits` | `…/produits`, `/categories` | `creerProduit`, `modifierProduit`, `definirPrix`, upload |
| `[boutiqueId]/stock` | `/b/:id/stock` | `…/stock`, `…/mouvements-stock` | entrée, ajustement, transfert |
| `[boutiqueId]/clients` | `/b/:id/clients` | `…/clients`, registre | client, VIP, activation, règlement |
| `[boutiqueId]/promotions` | `/b/:id/promotions` | `…/codes-promo` | codes promo (4) |
| `[boutiqueId]/commandes` | `/b/:id/commandes` | `…/commandes` | commande, confirmation, livraison, annulation |
| `[boutiqueId]/reservations` | `/b/:id/reservations` | `…/reservations` | validation, confirmation, encaissement, annulation |
| `[boutiqueId]/achats` | `/b/:id/achats` | `…/fournisseurs`, `…/commandes-fournisseurs` | fournisseurs (3), commandes fournisseurs (3) |
| `[boutiqueId]/prix-conseilles` | `/b/:id/prix-conseilles` | `…/prix-conseilles` | prix de référence, application |
| `[boutiqueId]/rapports` | `/b/:id/rapports` | `…/rapports` | — |
| `admin/page.tsx` | `/admin` | `/admin/statistiques` | — |
| `admin/utilisateurs` | `/admin/utilisateurs` | `/admin/utilisateurs` | création, activation, mot de passe |
| `admin/boutiques` | `/admin/boutiques` | `/admin/boutiques`, comptes | boutique, comptes par défaut |
| `admin/organisation` | `/admin/organisation` | `/admin/organisation` | groupes, régions |
| `admin/categories` | `/admin/categories` | `/admin/categories` | catégories (3) |
| `admin/roles` | `/admin/roles` | `/admin/roles` | permission de rôle |
| `admin/parametres` | `/admin/parametres` | `/parametres` | paramètres |

Les noms exacts des services et des chemins sont ceux du registre de l'API
(`apps/api/src/routes/*.ts`) ; la garde de complétude de la tâche 5 fait foi.

---

### Task 1: Socle du backoffice

**Files:** Modify `apps/backoffice/{package.json,vite.config.ts,index.html,src/main.tsx,src/App.tsx,src/App.test.tsx,tsconfig.json}` ;
Create `apps/backoffice/src/styles.css`, `apps/backoffice/src/test-preparation.ts`.

- Dépendances : `@multiboutique/ui`, `react-router`, `@tanstack/react-query`,
  `@tailwindcss/vite`, `tailwindcss`, `clsx`, `@testing-library/user-event`, `vitest-axe`.
- `vite.config.ts` : comme `apps/maquettes/vite.config.ts` (Tailwind, **PostCSS vide**,
  jsdom, fichier de préparation), plus `envPrefix: "VITE_"`.
- `styles.css` : `@import "tailwindcss"; @import "@multiboutique/ui/theme.css";` et les
  polices `@fontsource-variable`, comme les maquettes.
- `App.tsx` : `QueryClientProvider` + `RouterProvider` ; route `*` → page « Introuvable ».

- [ ] **Step 1 — test rouge** `App.test.tsx` : `/inconnu` affiche « Page introuvable » et
  un lien vers l'accueil.
- [ ] **Step 2** — implémenter ; `npm run build -w @multiboutique/backoffice` passe et le
  CSS produit contient les tokens (`--color-primaire`).
- [ ] **Step 3** — commit `Backoffice : socle Vite, routeur, TanStack Query et thème`.

### Task 2: Composants manquants dans `packages/ui`

**Files:** Create dans `packages/ui/src/composants/` : `Panneau`, `Dialogue`, `Selecteur`,
`ZoneTexte`, `Notification`, `Bandeau` (+ tests) ; Move `apps/maquettes/src/{theme.ts,SelecteurTheme.tsx}`
→ `packages/ui/src/theme/` (les maquettes l'importent depuis `@multiboutique/ui`) ;
Modify `packages/ui/src/index.ts`.

- `Panneau` : `<dialog>` natif modal ; feuille du bas sous `tablette`, panneau latéral de
  28 rem au-delà ; titre obligatoire (`aria-labelledby`), fermeture par Échap, bouton et
  clic sur le voile ; focus rendu à l'élément d'ouverture.
- `Dialogue` : confirmation courte (titre, texte, bouton destructeur ou principal).
- `Selecteur` et `ZoneTexte` : mêmes props d'erreur et d'aide que `Champ`.
- `Notification` : fournisseur + `useNotifier()` ; région `aria-live="polite"` ; succès 4 s,
  erreur jusqu'à fermeture.
- `Bandeau` : message pleine largeur (tons `info`, `alerte`), pour le hors-ligne et la
  mise à jour.

- [ ] **Step 1 — tests rouges** : focus piégé et rendu du `Panneau`, Échap, `axe` sans
  violation pour chaque composant, contraste des tons (réutiliser `contraste.ts`).
- [ ] **Step 2** — implémenter ; tests `ui` et maquettes verts.
- [ ] **Step 3** — commit `UI : panneau, dialogue, sélecteur, notification et thème partagé`.

### Task 3: Client de l'API

**Files:** Create `apps/backoffice/src/api/client.ts`, `client.test.ts`,
`apps/backoffice/test/faux-api.ts`, `packages/shared/src/reponses.ts` ; Modify
`packages/shared/src/index.ts`.

- `appeler<T>(methode, chemin, corps?)` : `fetch(VITE_API_URL + chemin, { method,
  credentials: "include", headers: corps ? { "content-type": "application/json" } : {},
  body })`. Toujours un corps JSON sur les écritures, même vide (`{}`) : l'API exige le
  type de contenu.
- `ErreurApi { statut, message, champs?: Record<string, string[]> }` construite depuis
  `{ erreur, champs }` de l'API ; réseau injoignable → `ErreurApi(0, "Connexion impossible")`.
- 401 sur une requête autre que `/auth/*` → événement `session-expiree` (écouté par la
  tâche 4).
- `televerser(fichier)` : `FormData`, sans `content-type` manuel, vers `/uploads`.
- `faux-api.ts` : remplace `fetch` dans les tests ; `repondre(methode, chemin, statut,
  corps)` et `appels()` pour vérifier chemin et corps.
- `reponses.ts` : `SessionUtilisateur`, `BoutiqueResumee`, puis un type par lecture au fil
  des tâches d'écran.

- [ ] **Step 1 — tests rouges** : URL et options de `fetch` ; corps `{}` par défaut ;
  `ErreurApi` avec `champs` ; 401 → événement ; 401 sur `/auth/connexion` → pas
  d'événement ; erreur réseau.
- [ ] **Step 2** — implémenter ; commit `Backoffice : client de l'API`.

### Task 4: Session, connexion et parcours de bout en bout

**Files:** Create `apps/backoffice/src/session/{Session.tsx,GardeSession.tsx,permissions.ts}`,
`apps/backoffice/src/ecrans/Connexion.tsx` (+ tests), `apps/backoffice/playwright.config.ts`,
`apps/backoffice/e2e/{preparation.ts,connexion.spec.ts}` ; Modify `apps/api/src/config.ts`
(+ test), `.github/workflows/ci-cd.yml`.

- `Session` : `useQuery(["session"], GET /auth/session)` ; `useSession()` → `{ utilisateur,
  peut(permission), estAdministrateur, deconnecter() }`. `deconnecter` appelle
  `/auth/deconnexion`, vide le cache TanStack Query (et IndexedDB à la tâche 15), puis
  `/connexion`.
- `GardeSession` : sans session → `/connexion?retour=<chemin>` ; sur `session-expiree`,
  même redirection, une seule fois.
- `Connexion` : logotype, e-mail, mot de passe, bouton de 60 px ; erreurs de l'API
  affichées (401 identifiants, 403 « Ce compte ne se connecte pas ici », 429).
  Après connexion : `retour` s'il est un chemin interne, sinon la racine.
- Racine `/` : propriétaire → `/tableau-de-bord` ; administrateur → `/admin` ; autres →
  première boutique de `/me/boutiques`, ou écran « Aucune boutique » (pas de boucle de
  redirection, défaut du monolithe signalé en phase 2).
- **API** : `origine()` accepte aussi `http://localhost:<port>` ; test : `http://exemple.org`
  toujours refusé, `http://localhost:5174` accepté.
- **Playwright** : `preparation.ts` clone `mb_modele` (réutilise
  `apps/api/test/preparation-globale.ts` et `base.ts`), démarre l'API sur le port 4100 avec
  `ORIGINE_BACKOFFICE=http://localhost:5174`, puis `vite preview --port 5174` avec
  `VITE_API_URL=http://localhost:4100`. Comptes : ceux du seed.
- **CI** : nouveau job `e2e` après `build` (service Postgres comme `build`, `npx playwright
  install --with-deps chromium`, rapport en artefact en cas d'échec) ; les jobs de
  déploiement en dépendent.

- [ ] **Step 1 — tests rouges** : connexion réussie → racine ; erreur 401 affichée ;
  `retour` externe (`//evil.example`) ignoré ; garde → `/connexion?retour=…` ;
  `session-expiree` → une seule redirection.
- [ ] **Step 2** — implémenter.
- [ ] **Step 3 — e2e** `connexion.spec.ts` : le propriétaire du seed se connecte, arrive
  sur `/tableau-de-bord`, recharge la page (session conservée), se déconnecte ; un compte
  client est refusé avec le message de l'API.
- [ ] **Step 4** — commit `Backoffice : session, connexion et tests de bout en bout`.

### Task 5: Navigation, choix de boutique et garde de complétude

**Files:** Create `apps/backoffice/src/coque/{CoqueBackoffice.tsx,navigation.ts,ChoixBoutique.tsx}`
(+ tests), `apps/backoffice/src/completude.test.ts`, `apps/backoffice/src/icones.tsx`
(depuis les maquettes).

- `navigation.ts` : `entreesBoutique(boutiqueId, peut)` reprend `LIENS_BOUTIQUE` de
  `Sidebar.tsx` (mêmes permissions, mêmes libellés), plus « Tableau de bord » (propriétaire),
  « Consolidation » (`consolidation:voir`) et « Administration » (administrateur). Ordre
  sur téléphone : Accueil, Ventes, Stock, Clients, puis « Plus ».
- `ChoixBoutique` : dans l'en-tête, la boutique courante ; un `Selecteur` si l'utilisateur
  en a plusieurs. Changer de boutique garde la section courante.
- En-tête : boutique, date du jour, `SelecteurTheme`, menu du compte (nom, rôle avec les
  libellés de `LIBELLES_ROLE`, déconnexion).
- `/b/:id` d'une boutique absente de `/me/boutiques` → écran « Boutique inaccessible »
  (l'API répondrait 403 de toute façon).
- `completude.test.ts` :
  1. chaque service exporté par `packages/metier` (sauf la liste d'exclusion de la
     décision 4) apparaît exactement une fois dans `src/api/*.ts` (convention : commentaire
     `// service: <nom>` au-dessus de chaque fonction d'appel, ou table exportée ; choisir
     la table, plus simple à tester) ;
  2. chaque page du monolithe de la table « Correspondance des écrans » a sa route dans
     le routeur.
  Le test est rouge jusqu'à la tâche 14 : il est ajouté avec la liste des manques
  attendus (`MANQUES_ATTENDUS`), que chaque tâche d'écran réduit ; la tâche 14 la vide.
  Une entrée présente à la fois dans les appels et dans `MANQUES_ATTENDUS` fait échouer
  le test.

- [ ] **Step 1 — tests rouges** : un vendeur ne voit ni Rapports ni Achats ; un gérant les
  voit selon la matrice ; `consolidation:voir` fait apparaître Consolidation ; changement de
  boutique conservant la section ; rôle libellé.
- [ ] **Step 2** — implémenter ; capture Playwright aux quatre largeurs.
- [ ] **Step 3** — vérifier la garde par mutation : retirer une entrée de la table des
  appels → échec qui nomme le service.
- [ ] **Step 4** — commit `Backoffice : navigation par permissions et garde de complétude`.

### Task 6: Briques communes des écrans

**Files:** Create `apps/backoffice/src/commun/{useEcriture.ts,Formulaire.tsx,montants.ts,dates.ts,useEnLigne.ts,ListeChargee.tsx}` (+ tests).

- `useEcriture({ appel, invalide, succes })` : `useMutation` ; invalide les clés listées ;
  notifie le succès ; renvoie `erreurs` (message général + `champs`) ; refuse d'appeler
  hors ligne (`useEnLigne`) et expose `desactivee`.
- `Formulaire` : `<form>` dont le bouton principal est désactivé pendant l'envoi et hors
  ligne ; affiche le message général en tête et passe `champs[nom]` à chaque champ.
- `montants.ts` : format de `lib/monnaie.ts` (FCFA, espaces insécables ` `) ;
  `dates.ts` : `date-fns` en français, comme le monolithe.
- `ListeChargee` : chargement (squelette), erreur (message + « Réessayer »), vide
  (`EtatVide`), sinon `ListeAdaptative`.

- [ ] **Step 1 — tests rouges** : invalidation après succès ; erreurs de champ remontées ;
  pas d'appel hors ligne ; formats de montant identiques à `lib/monnaie.ts` sur 10 valeurs.
- [ ] **Step 2** — implémenter ; commit `Backoffice : écritures, formulaires et formats communs`.

### Task 7: Tableau de bord, consolidation et vue d'ensemble

**Files:** Create `apps/backoffice/src/ecrans/{TableauDeBord,Consolidation,VueBoutique}.tsx`
(+ tests), `apps/backoffice/src/api/{resume,boutiques}.ts`, `e2e/tableaux.spec.ts`.

Mêmes indicateurs que `dashboard/page.tsx`, `consolidation/page.tsx` et
`[boutiqueId]/page.tsx` (lire chaque page, lister ses chiffres et tableaux dans le test).
`TuileChiffre` pour les chiffres clés ; alerte stock en tuile `accent`, comme la maquette
d'accueil. `cout_revient` et marges : seulement si l'API les renvoie.

- [ ] **Step 1 — tests rouges** : chaque chiffre de la page d'origine est présent, formaté ;
  consolidation par groupe et par région.
- [ ] **Step 2** — implémenter ; e2e : le propriétaire voit les 3 boutiques du seed.
- [ ] **Step 3** — commit `Backoffice : tableau de bord, consolidation et vue d'ensemble`.

### Task 8: Ventes et caisse

**Files:** Create `apps/backoffice/src/ecrans/ventes/{Ventes,NouvelleVente,DetailVente,Ticket}.tsx`
(+ tests), `apps/backoffice/src/api/ventes.ts`, `e2e/ventes.spec.ts`.

- `NouvelleVente` reprend la maquette (recherche, panier, `Quantite`, `ChoixSegmente` du
  mode de paiement) et **toutes** les fonctions de `components/dashboard/VenteForm.tsx` :
  client et vente à crédit, code promo, remise, monnaie rendue, etc. (lire le composant et
  en faire la liste dans le test).
- Refus de l'API (409 stock insuffisant, plafond de crédit, code promo) : message affiché,
  panier conservé.
- `Ventes` : liste, filtres et statistiques de la page d'origine (`/ventes/statistiques`,
  qui corrige le calcul du monolithe).
- `DetailVente` : lignes, annulation (motif, `Dialogue`), impression du ticket
  (`Ticket` + `window.print()` avec une feuille `@media print`, comme `ImprimerBouton`).

- [ ] **Step 1 — tests rouges** : corps envoyé à `creerVente` pour une vente au comptant,
  à crédit, avec code promo ; panier conservé après 409 ; annulation avec motif ; bouton
  « Annuler la vente » absent sans la permission.
- [ ] **Step 2** — implémenter.
- [ ] **Step 3 — e2e** : un vendeur fait une vente de 2 produits ; le stock affiché baisse ;
  la vente apparaît dans la liste ; un gérant l'annule ; le stock remonte.
- [ ] **Step 4** — commit `Backoffice : caisse, ventes et ticket`.

### Task 9: Produits et stock

**Files:** Create `apps/backoffice/src/ecrans/{produits,stock}/*` (+ tests),
`apps/backoffice/src/api/{catalogue,uploads}.ts`, `e2e/stock.spec.ts`.

- Produits : liste, création et modification en `Panneau`, image (téléversement, aperçu
  servi par `/uploads/…`), prix de la boutique ; `cout_revient` visible seulement si
  l'API l'a renvoyé.
- Stock : maquette « Stock » ; entrée, ajustement (motif), transfert vers une autre
  boutique ; mouvements avec les filtres de `MouvementsFiltres.tsx`.

- [ ] **Step 1 — tests rouges** : création de produit (corps), téléversement puis
  enregistrement de l'URL ; ajustement exige un motif ; un vendeur ne voit pas la colonne
  coût ; transfert vers la boutique courante impossible.
- [ ] **Step 2** — implémenter ; e2e : entrée de stock puis transfert, quantités vérifiées
  dans les deux boutiques.
- [ ] **Step 3** — commit `Backoffice : produits, images et stock`.

### Task 10: Clients et promotions

**Files:** Create `apps/backoffice/src/ecrans/{clients,promotions}/*` (+ tests),
`apps/backoffice/src/api/{clients,promotions}.ts`, `e2e/clients.spec.ts`.

Clients : liste, fiche en `Panneau`, VIP, activation, registre de crédit, règlement
(plafonné par l'API au montant de l'encours : afficher l'encours et le montant retenu).
Promotions : codes promo, activation, suppression (`Dialogue`).

- [ ] **Step 1 — tests rouges** : règlement → registre rafraîchi ; suppression demandée
  par `Dialogue` ; actions masquées sans permission.
- [ ] **Step 2** — implémenter ; e2e : vente à crédit (tâche 8) puis règlement, encours à 0.
- [ ] **Step 3** — commit `Backoffice : clients, crédit et codes promo`.

### Task 11: Commandes B2B et réservations

**Files:** Create `apps/backoffice/src/ecrans/{commandes,reservations}/*` (+ tests),
`apps/backoffice/src/api/{commandes,reservations}.ts`, `e2e/reservations.spec.ts`.

Actions par statut, comme `CommandeActions.tsx` et `ReservationActions.tsx` (un bouton
n'apparaît que dans les statuts où l'action d'origine l'offrait). Encaissement d'une
réservation : `ChoixSegmente` du mode de paiement.

- [ ] **Step 1 — tests rouges** : boutons proposés pour chaque statut ; livraison à
  crédit ; encaissement.
- [ ] **Step 2** — implémenter ; e2e : réservation créée par l'API publique (`POST
  /reservations` avec l'origine `www`) puis validée, confirmée, encaissée.
- [ ] **Step 3** — commit `Backoffice : commandes B2B et réservations`.

### Task 12: Achats, fournisseurs et prix conseillés

**Files:** Create `apps/backoffice/src/ecrans/{achats,prix-conseilles}/*` (+ tests),
`apps/backoffice/src/api/achats.ts` (et prix dans `catalogue.ts`), `e2e/achats.spec.ts`.

- Fournisseurs (création, modification, activation) ; commandes fournisseurs (création,
  réception partielle ou totale, annulation). La réception d'une commande annulée n'est
  pas proposée (défaut du monolithe signalé en phase 2 : l'API l'accepte encore, le front
  ne l'offre pas, et le rapport le rappelle).
- Prix conseillés : prix de référence, application à la boutique, comme
  `PrixConseillesActions.tsx` et `PrixConseillesPublisher.tsx`.

- [ ] **Step 1 — tests rouges** : réception partielle (corps) ; pas de réception sur une
  commande annulée ; application des prix conseillés.
- [ ] **Step 2** — implémenter ; e2e : commande fournisseur reçue, stock augmenté.
- [ ] **Step 3** — commit `Backoffice : achats, fournisseurs et prix conseillés`.

### Task 13: Rapports

**Files:** Create `apps/backoffice/src/ecrans/Rapports.tsx` (+ test),
`apps/backoffice/src/api/rapports.ts`.

Mêmes périodes, tableaux et totaux que `rapports/page.tsx` (420 lignes : lister chaque
bloc dans le test). Pas de graphique : le monolithe n'en a pas. Impression comme le ticket.

- [ ] **Step 1 — test rouge** : chaque bloc présent, période transmise à l'API.
- [ ] **Step 2** — implémenter ; commit `Backoffice : rapports`.

### Task 14: Administration

**Files:** Create `apps/backoffice/src/ecrans/admin/*` (+ tests),
`apps/backoffice/src/api/administration.ts`, `e2e/admin.spec.ts`.

Section `/admin`, garde `estAdministrateur` (sinon « Accès réservé »). Sept écrans :
statistiques, utilisateurs (création avec mot de passe généré affiché une fois,
activation, nouveau mot de passe), boutiques (création, modification, comptes par défaut
avec identifiants affichés une fois), organisation (groupes, régions), catégories,
rôles (matrice de cases à cocher, une écriture par case), paramètres.

- [ ] **Step 1 — tests rouges** : mot de passe affiché une seule fois puis effacé à la
  fermeture du panneau ; matrice des rôles : une case = un appel ; non-administrateur
  refusé.
- [ ] **Step 2** — implémenter ; `MANQUES_ATTENDUS` est vide, la garde de complétude passe.
- [ ] **Step 3 — e2e** : l'administrateur crée un vendeur, qui se connecte et ne voit que
  sa boutique.
- [ ] **Step 4** — commit `Backoffice : administration`.

### Task 15: PWA et hors-ligne

**Files:** Modify `apps/backoffice/vite.config.ts`, `src/main.tsx`, `src/session/Session.tsx` ;
Create `apps/backoffice/src/hors-ligne/{persistance.ts,BandeauHorsLigne.tsx,MiseAJour.tsx}`
(+ tests), `e2e/hors-ligne.spec.ts`.

- `vite-plugin-pwa` : `registerType: "prompt"`, manifeste (nom « MultiBoutique Backoffice »,
  `display: standalone`, couleurs `fond` et `primaire`, icônes de `packages/ui/assets`),
  précache du shell, `navigateFallback: "/index.html"`, **aucun `runtimeCaching`** :
  l'API, autre origine, n'est jamais mise en cache par le service worker.
- `persistance.ts` : `persistQueryClient` vers IndexedDB (`idb-keyval`), `maxAge` 24 h,
  `buster` = version du build ; `purger()` vide IndexedDB et le cache. Appelée par
  `deconnecter()` et quand `/auth/session` renvoie un autre utilisateur que celui du cache.
- `BandeauHorsLigne` : « Hors ligne — données du <heure de la dernière mise à jour> » ;
  toutes les écritures désactivées par `useEnLigne` (tâche 6).
- `MiseAJour` : `Bandeau` « Nouvelle version disponible » + « Recharger ».

- [ ] **Step 1 — tests rouges** : déconnexion → IndexedDB vide ; changement d'utilisateur →
  purge ; bandeau hors ligne ; boutons d'écriture désactivés hors ligne.
- [ ] **Step 2** — implémenter.
- [ ] **Step 3 — e2e** : stock consulté, contexte passé hors ligne, rechargement : la liste
  s'affiche depuis le cache avec le bandeau, « Enregistrer » est désactivé ; manifeste et
  service worker valides (Lighthouse « installable » via `playwright` + vérification du
  manifeste).
- [ ] **Step 4** — commit `Backoffice : PWA installable et lecture hors ligne`.

### Task 16: CSP, déploiement et mise en recette

**Files:** Create `apps/backoffice/outils/en-tetes.ts` (plugin Vite) (+ test) ; Delete
`apps/backoffice/public/_headers` ; Modify `.github/workflows/ci-cd.yml`,
`docs/superpowers/specs/2026-10-17-separation-front-api-pwa-design.md`.

- Plugin `en-tetes` : écrit `dist/_headers` avec les en-têtes actuels et la CSP
  `default-src 'self'; img-src 'self' data: <API>; style-src 'self'; script-src 'self';
  connect-src 'self' <API>; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none';
  base-uri 'self'; form-action 'self'`, où `<API>` est l'origine de `VITE_API_URL`. Le
  build échoue si `VITE_API_URL` manque ou n'est pas une origine https (hors `localhost`).
  `index.html` et `sw.js` en `Cache-Control: no-cache` ; `/assets/*` en `immutable`.
- CI, job des fronts : `VITE_API_URL=https://${{ vars.API_DOMAIN }}` pour `backoffice`
  (et `www`, sans effet tant que la phase 4 n'est pas faite) ; dépend de `e2e`.
- Spec : décisions 1 à 8 reportées ; §8, phase 3 marquée réalisée.

- [ ] **Step 1 — tests rouges** : une seule ligne `Content-Security-Policy` ; origine de
  l'API présente dans `connect-src` et `img-src` ; build refusé sans `VITE_API_URL`.
- [ ] **Step 2** — implémenter ; `action-validator` sur le workflow.
- [ ] **Step 3 — vérification complète** : tests de tous les workspaces, typecheck, builds
  (`build:workspaces`, `next build`), e2e, garde de complétude vérifiée par mutation.
- [ ] **Step 4** — commit `Déploiement : CSP du backoffice et mise en recette`.
- [ ] **Step 5 — en recette (après fusion, décision humaine)** : sur
  `https://backoffice.morpion.cloud`, sur tablette, téléphone et ordinateur : connexion,
  une vente, une entrée de stock, l'installation de la PWA, la consultation hors ligne ;
  aucune erreur CSP dans la console. Désactiver l'injection de Cloudflare Web Analytics
  si elle est encore active (bloquée par la CSP).

---

## Hors périmètre

- La vitrine, l'inscription et l'espace client (`www`) : phase 4.
- Les défauts du monolithe signalés en phase 2 : le monolithe n'est pas modifié ; ceux
  qui relèvent de l'API (réception d'une commande annulée, unicité des catégories,
  sondage des codes de commande) restent à décider et ne sont pas corrigés ici.
- La bascule et le retrait des pages du monolithe : phase 5.
