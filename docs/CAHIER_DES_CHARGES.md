# Cahier des charges — MultiBoutique

**Application de gestion multi-boutiques (alimentaire)**
Version du document : 1.0 · Date : 2026-10-09 · État de l'application : v3 (production locale)

---

## Table des matières

1. [Présentation et contexte](#1-présentation-et-contexte)
2. [Objectifs et périmètre](#2-objectifs-et-périmètre)
3. [Acteurs, rôles et habilitations](#3-acteurs-rôles-et-habilitations)
4. [Architecture technique](#4-architecture-technique)
5. [Modèle de données](#5-modèle-de-données)
6. [Exigences fonctionnelles par module](#6-exigences-fonctionnelles-par-module)
7. [Règles de gestion transverses](#7-règles-de-gestion-transverses)
8. [Exigences non fonctionnelles](#8-exigences-non-fonctionnelles)
9. [Sécurité](#9-sécurité)
10. [Déploiement et exploitation](#10-déploiement-et-exploitation)
11. [Recette et critères d'acceptation](#11-recette-et-critères-dacceptation)
12. [Annexes](#12-annexes)

---

## 1. Présentation et contexte

MultiBoutique est une **application web** de gestion d'un réseau de boutiques de détail
alimentaire (type supérette). Elle couvre le cycle complet : **catalogue produit, prix par
boutique, stock, ventes au comptoir, ventes à crédit, réservations en ligne, commandes
grossistes (B2B), achats fournisseurs, rapports et consolidation siège**, avec une
**traçabilité intégrale** des opérations (« qui a fait quoi, quand »).

L'application est **auto-hébergée à 100 %** : l'application et la base de données
PostgreSQL tournent dans des conteneurs Docker sur le propre serveur de l'exploitant.
Aucune donnée commerciale (coûts, marges, ventes) ne quitte l'infrastructure.

---

## 2. Objectifs et périmètre

### 2.1 Objectifs

- Centraliser la gestion de **plusieurs boutiques** au sein d'une même instance.
- Garantir la **fiabilité des chiffres** (prix officiels, stock atomique, journal d'audit).
- Permettre une **gestion commerciale par boutique** (gérant) et une **vision consolidée**
  (propriétaire, direction de groupe/région).
- Séparer strictement la **configuration du système** (administrateur) des **données
  commerciales**.
- Offrir un **canal public** (catalogue + réservation) et un **espace client**.

### 2.2 Périmètre fonctionnel

| Domaine | Inclus |
|---|---|
| Authentification / comptes | Oui (login, inscription client, sessions JWT) |
| Catalogue & réservations publiques | Oui |
| Ventes comptoir (paiement, remise, crédit, reçu, annulation) | Oui |
| Stock multi-boutiques (entrée, ajustement, transfert, alertes) | Oui |
| Clients grossistes/détaillants & crédit VIP | Oui |
| Commandes B2B (grossistes) | Oui |
| Achats & fournisseurs | Oui |
| Promotions (codes promo) | Oui |
| Prix conseillés (siège) | Oui |
| Rapports & consolidation | Oui |
| Administration (utilisateurs, boutiques, catégories, organisation, paramètres, rôles) | Oui |
| Paiement en ligne, comptabilité, paie, e-commerce avec livraison | **Hors périmètre** |

### 2.3 Utilisateurs cibles

Exploitant/propriétaire, équipes de boutique (gérant, magasinier, vendeur, comptable),
encadrement siège (direction groupe/région), administrateur technique, clients finaux.

---

## 3. Acteurs, rôles et habilitations

### 3.1 Rôles système

| Rôle (code) | Libellé | Portée |
|---|---|---|
| `administrateur` | Administrateur | Configuration globale. **Aucun accès aux données commerciales**. |
| `proprietaire` | Propriétaire | **Toutes les boutiques**, toutes fonctionnalités. |
| `directeur_groupe` | Directeur de groupe | Toutes les boutiques de **son groupe**, lecture + consolidation. |
| `directeur_region` | Directeur de région | Toutes les boutiques de **sa région**, lecture + consolidation. |
| `gerant` | Gérant | **Sa/ses boutique(s)** : opérationnel complet (hors publication des prix conseillés). |
| `gerant_stock` | Magasinier / Gérant de stock | **Lecture seule** du stock et des produits. |
| `comptable` | Comptable | Lecture ventes/réservations/rapports + **gestion des crédits**. |
| `vendeur` | Vendeur | Encaisse les **ventes** uniquement. |
| `client` | Client | Espace client : catalogue, réservations. |

### 3.2 Rattachement obligatoire

- `gerant`, `gerant_stock`, `comptable`, `vendeur` → **au moins une boutique**.
- `directeur_groupe` → **un groupe** obligatoire.
- `directeur_region` → **une région** obligatoire.
- `administrateur`, `proprietaire`, `client` → aucun rattachement boutique requis.

### 3.3 Permissions

Les permissions sont de la forme `<domaine>:<action>` :
`ventes`, `reservations`, `stock`, `produits`, `prix`, `rapports`, `promos`, `clients`,
`credits`, `commandes`, `achats`, `consolidation`, `prix_conseilles`
(actions `voir` / `gerer` / `creer` / `annuler` selon le domaine).

Deux niveaux coexistent :

1. **Matrice par défaut** (code `lib/permissions.ts`) — filet de sécurité.
2. **Table `roles_permissions`** — source de vérité en exécution, **éditable** par
   l'administrateur via `/admin/roles` (case à cocher par couple rôle/permission).

Extraits de la grille par défaut :

| Rôle | Permissions clés |
|---|---|
| proprietaire | Toutes |
| gerant | Tout l'opérationnel boutique **sauf** `prix_conseilles:gerer` |
| gerant_stock | `stock:voir`, `produits:voir` (lecture seule) |
| comptable | Lecture ventes/résa/stock/rapports/... + `credits:voir`, `credits:gerer` |
| vendeur | `ventes:voir`, `ventes:creer`, `stock:voir`, `produits:voir` |
| directeur_groupe / directeur_region | Périmètre « siège » : lecture + `consolidation:voir` |
| administrateur, client | Aucune permission opérationnelle |

> **Règle forte** : même avec la bonne permission, l'utilisateur doit avoir **accès à la
> boutique** concernée (sauf `proprietaire` = toutes, direction = son périmètre).

---

## 4. Architecture technique

### 4.1 Pile technologique

| Couche | Technologie |
|---|---|
| Front / Serveur | **Next.js 15.3.6** (App Router, React Server Components, Server Actions) |
| UI | React 19, TailwindCSS 3, `clsx` + `tailwind-merge` |
| Langage | TypeScript 5.7 |
| Base de données | **PostgreSQL 16** (pgcrypto, uuid-ossp, unaccent) |
| Accès BDD | `pg` (Pool Node) — requêtes **100 % paramétrées** |
| Sessions | JWT **HS256** signé via **WebCrypto** (`crypto.subtle`), cookie `mb_session` |
| Mots de passe | **bcrypt** (pgcrypto `crypt`/`gen_salt`, coût 10) côté PostgreSQL |
| Déploiement | Docker / Docker Compose, image `standalone` Next.js, Nginx (option SSL) |
| CI/CD | GitHub Actions → GHCR + déploiement SSH |

### 4.2 Organisation du code

```
multiboutique/
├── app/
│   ├── (auth)/         # /login, /register
│   ├── (admin)/        # /admin/* (réservé administrateur)
│   ├── (dashboard)/    # /dashboard, /dashboard/[boutiqueId]/*
│   ├── (client)/       # /client (espace client)
│   ├── (public)/       # /boutique (catalogue public + réservation)
│   ├── api/auth/       # login, logout, register
│   ├── api/upload/     # upload d'images produit
│   └── uploads/[...path]/ # service des images uploadées
├── components/         # admin/, dashboard/, client/
├── lib/
│   ├── db.ts           # pool PostgreSQL
│   ├── session.ts      # signature/vérification JWT (WebCrypto) — Node + Edge
│   ├── auth.ts         # session serveur, portée, garde-fous
│   ├── permissions.ts  # matrice par défaut
│   ├── monnaie.ts      # paramètres (monnaie, nom, seuil)
│   ├── rate-limit.ts   # anti force-brute en mémoire
│   ├── utils.ts        # formatage montant/date
│   └── actions/index.ts # Server Actions (toute la logique métier)
├── db/
│   ├── init.sql        # schéma initial (source de vérité)
│   └── migrations/     # 002 → 011 (idempotentes, table schema_migrations)
├── deploy/             # compose prod, script de déploiement
├── middleware.ts       # protection des routes + redirections par rôle
└── Dockerfile          # build multi-étapes, image standalone
```

### 4.3 Flux applicatifs

- **Rendu** : pages majoritairement **Server Components** (lecture directe en base) ;
  les interactions passent par des **Server Actions** (`lib/actions`) ou de petites
  routes API (`/api/auth/*`, `/api/upload`).
- **Sécurité des mutations** : chaque Server Action vérifie
  *(session → permission → accès boutique)* **avant** toute écriture.
- **Auth** : `POST /api/auth/login` vérifie le mot de passe **dans PostgreSQL**
  (`crypt(mdp, hash) = hash`), signe un JWT et pose le cookie `httpOnly`.
- **Middleware** : protège les routes (`/dashboard`, `/admin`, `/client`, `/api` hors
  `/api/auth`) et applique les redirections par rôle.

---

## 5. Modèle de données

### 5.1 Enums

| Enum | Valeurs |
|---|---|
| `role_utilisateur` | `administrateur`, `proprietaire`, `directeur_groupe`, `directeur_region`, `gerant`, `gerant_stock`, `comptable`, `vendeur`, `client` |
| `type_mouvement_stock` | `entree`, `sortie`, `ajustement`, `transfert` |
| `statut_reservation` | `en_attente`, `prete`, `payee`, `retiree`, `annulee` |
| `statut_vente` | `validee`, `annulee`, `corrigee` |
| `mode_paiement` | `especes`, `mobile_money`, `carte`, `autre` |
| `statut_commande` (B2B) | `en_attente`, `confirmee`, `livree`, `annulee` |
| `statut_cmd_fournisseur` | `en_attente`, `partielle`, `recue`, `annulee` |
| `type_client` | `grossiste`, `detaillant` |
| `terme_paiement` | `comptant`, `credit` |

### 5.2 Utilisateurs, boutiques et organisation

| Table | Rôle | Colonnes remarquables |
|---|---|---|
| `utilisateurs` | Comptes | `email` (unique), `password_hash`, `role`, `boutique_ids` (uuid[]), `region_id`, `groupe_id`, `actif` |
| `boutiques` | Boutiques | `nom`, `adresse`, `telephone`, `email`, `region_id`, `statut` (`active`/`inactive`) |
| `groupes` / `regions` | Organisation (siège) | `regions.groupe_id` |
| `parametres` | Réglages globaux | `monnaie`, `nom_application`, `seuil_alerte_defaut`, `relance_delai_jours` |
| `roles_permissions` | Habilitations éditables | `(role, permission, active)` |

**Catalogue & stock**

| Table | Rôle | Colonnes remarquables |
|---|---|---|
| `categories` | Catégories | `nom`, `description`, `parent_id`, `code` (préfixe SKU) |
| `produits` | Catalogue **global** | `reference` (unique), `nom`, `categorie_id`, `image_url`, `code` (SKU, unique), `actif` |
| `prix_boutique` | **Prix par boutique** | `prix_vente`, `cout_revient`, `(produit_id, boutique_id)` unique |
| `stocks` | Stock par boutique | `quantite`, `quantite_reservee`, `seuil_alerte` ; contraintes `>=0` et `quantite ≥ quantite_reservee` |
| `mouvements_stock` | Historique des mouvements | `type`, `quantite`, `quantite_avant/apres`, `motif`, `boutique_destination_id`, `auteur_id` |

**Ventes, réservations, clients**

| Table | Rôle | Colonnes remarquables |
|---|---|---|
| `ventes` | En-tête de vente | `reference_vente` (unique), `vendeur_id`, `mode_paiement`, `montant_total`, `remise`, `code_promo_id`, `client_id`, `montant_paye`, `commande_id`, `statut`, `motif_annulation` |
| `lignes_vente` | Lignes de vente | `quantite>0`, `prix_unitaire`, `cout_unitaire` |
| `reservations` / `lignes_reservation` | Réservations | `reference_reservation`, `statut`, `date_retrait_*`, `utilisateur_id` |
| `clients` | Clients | `type_client`, `plafond_credit`, `encours`, `est_vip`, `boutique_id` |
| `registre_credits` | Journal des créances | `type` (`vente`/`versement`/`annulation`), `montant` (signé), `solde_apres` |

### 5.3 Commandes, achats, promotions et audit

| Table | Rôle |
|---|---|
| `commandes` / `lignes_commandes` | Commandes grossistes (B2B) |
| `fournisseurs` | Fournisseurs par boutique |
| `commandes_fournisseur` / `lignes_cmd_fournisseur` | Commandes d'achat & réceptions |
| `prix_reference` | Prix conseillés publiés par le siège |
| `codes_promo` | Codes promotionnels par boutique |
| `journal_audit` | **Journal immuable** (auteur, action, entité, avant/après JSONB) |

### 5.4 Fonctions SQL atomiques

| Fonction | Rôle |
|---|---|
| `deduire_stock(produit, boutique, qté)` | Déduit le stock si `quantite - reservee ≥ qté` (verrou `FOR UPDATE`). |
| `reserver_stock(...)` | Incrémente `quantite_reservee` (réservation en ligne). |
| `valider_reservation(resa, validateur)` | Déduit le stock et marque `payee`. |
| `ajouter_stock(...)` | Entrée de stock idempotente (upsert `ON CONFLICT`). |

### 5.5 Vues

- `stock_disponible` : stock + `disponible = quantite - reservee` + `statut_stock`
  (`rupture` / `alerte` / `ok`) + prix.
- `ventes_journalieres` : CA et nombre de ventes valides par boutique/jour/mode.
- `resume_jour` : synthèse du jour par boutique (ventes, CA, réservations, alertes).

### 5.6 Triggers d'audit

- `trg_audit_vente` (INSERT/UPDATE sur `ventes`) et `trg_audit_stock` (INSERT sur
  `mouvements_stock`) alimentent automatiquement `journal_audit`. Les créations de
  comptes et de comptes par défaut sont journalisées par les Server Actions.

---

## 6. Exigences fonctionnelles par module

### 6.1 Authentification, comptes et sessions

- **EF-AUTH-1** Connexion par email + mot de passe (`POST /api/auth/login`).
- **EF-AUTH-2** Vérification du mot de passe en base (bcrypt) ; message identique pour
  email inconnu et mot de passe erroné (anti-énumération).
- **EF-AUTH-3** Session = JWT HS256 (durée **7 jours**), cookie `httpOnly`,
  `sameSite=lax`, `secure` en production.
- **EF-AUTH-4** Inscription publique (`/register`) : crée **uniquement** des comptes
  `client`.
- **EF-AUTH-5** Anti force-brute : login **5 tentatives / 15 min / IP**, inscription
  **3 / heure / IP** (HTTP 429 + `Retry-After`).
- **EF-AUTH-6** Déconnexion (`POST /api/auth/logout`) supprime le cookie.
- **EF-AUTH-7** Le périmètre de boutiques (direction groupe/région) est **recalculé** à
  chaque requête côté serveur.
- **EF-AUTH-8** Un compte désactivé (`actif=false`) est refusé même avec un JWT valide.

### 6.2 Catalogue public et réservations en ligne

- **EF-PUB-1** Page `/boutique` : liste des boutiques actives.
- **EF-PUB-2** Catalogue d'une boutique : produits actifs avec prix, catégories, photos.
- **EF-RES-1** Création d'une réservation (visiteur anonyme ou client connecté) : nom,
  téléphone, email optionnel, date de retrait prévue, lignes (produit + quantité).
- **EF-RES-2** Le stock est **réservé** dès la création (fonction atomique, contrôle de
  disponibilité) ; les prix sont ceux de la boutique.
- **EF-RES-3** Anti-IDOR : un **membre du personnel** ne peut créer une réservation que
  dans une boutique de son périmètre (`reservations:gerer`). Le **public** et
  l'**espace client** restent ouverts.
- **EF-RES-4** Cycle de vie (côté boutique) :
  `en_attente → prete` (confirmer) `→ retiree` (encaisser → **génère la vente**) ;
  `en_attente`/`prete → annulee` (libère le stock réservé).
- **EF-RES-5** L'encaissement d'une réservation crée une vente avec les **prix
  officiels**, déduit le stock, libère la réservation et la passe à `retiree`.

### 6.3 Espace client (`/client`)

- **EF-CL-1** Liste des réservations du client connecté (référence, boutique, statut,
  montant, nombre d'articles, date de retrait prévue).

### 6.4 Tableau de bord boutique — vue d'ensemble

- **EF-DB-1** Synthèse du jour (`resume_jour`) : ventes, CA, réservations, alertes.
- **EF-CLD-2** Dernières ventes (avec nom du vendeur).
- **EF-DB-3** Réservations en attente et **alertes de stock** (produits sous seuil).

### 6.5 Produits et prix

- **EF-PROD-1** Création de produit : référence, nom, description, catégorie, image,
  **code produit** (fourni ou généré).
- **EF-PROD-2** Code produit « nomenclature » : `PREFIXE-CATÉGORIE-0001` (préfixe = 3
  lettres de la catégorie, ex. `HYG-0002`). Auto-incrément par préfixe, **unique**,
  format `[A-Z0-9-]`.
- **EF-PROD-3** Lors de la création, un produit existant (même `reference`) est réutilisé
  au lieu d'être dupliqué ; le prix et le stock de la boutique sont initialisés.
- **EF-PRIX-1** Un produit a un **prix de vente et un coût de revient par boutique**
  (`prix_boutique`). La modification de prix requiert `prix:gerer`.
- **EF-PROD-4** Upload d'image : JPG/PNG/WebP/GIF, **≤ 5 Mo**, session requise.

### 6.6 Stock

- **EF-STK-1** Consulter le stock (disponible, réservé, seuil, statut, prix).
- **EF-STK-2** **Entrée** de stock (réception marchandise) → mouvement `entree`.
- **EF-STK-3** **Ajustement** manuel (quantité cible) ; interdit si la cible serait
  inférieure au **stock réservé**.
- **EF-STK-4** **Transfert inter-boutiques** : déduction source + ajout destination,
  deux mouvements `transfert` liés. Accès requis sur **les deux** boutiques.
- **EF-STK-5** Toute variation génère un **mouvement** (`quantite_avant`/`apres`),
  journalisé et auditable.
- **EF-STK-6** **Filtre des mouvements** par période (`jour`/`semaine`/`mois`/`année`),
  par type et par produit ; liste limitée à **500** lignes.
- **EF-STK-7** Alerte lorsque `disponible ≤ seuil_alerte` (vue `stock_disponible`).

### 6.7 Ventes comptoir

- **EF-VEN-1** Enregistrer une vente (au moins une ligne) avec un mode de paiement.
- **EF-VEN-2** Prix appliqués = **prix officiels** `prix_boutique` (jamais saisis par le
  vendeur) ; stock **déduit atomiquement** ; mouvement `sortie` créé.
- **EF-VEN-3** Référence auto `VTE-AAAAMMJJ-XXXXXX`.
- **EF-VEN-4** Code promo appliqué (voir 6.10) ; remise **pourcentage** ou **montant**
  (borné au total).
- **EF-VEN-5** **Vente à crédit** (client rattaché + paiement partiel) :
  `reste = total - payé` ; contrôle du **plafond** (`encours + reste ≤ plafond`) ;
  incrément de l'`encours` et écriture au **registre des créances** (`type=vente`).
- **EF-VEN-6** Sans client rattaché : `montant_paye = montant_total` (comptant).
- **EF-VEN-7** **Annulation** (permission `ventes:annuler`) avec **motif obligatoire** :
  rétablit le stock (mouvement `entree`), solde la créance éventuelle
  (`registre_credits` `type=annulation`, montant négatif) et passe la vente à `annulee`.
- **EF-VEN-8** **Reçu imprimable** par vente (`/ventes/[venteId]`) : référence, date,
  vendeur, lignes, total, mode de paiement, payé/reste ; lien « Reçu » dans la liste.

### 6.8 Clients, crédit & VIP

- **EF-CLT-1** CRUD clients par boutique : nom, contacts, `type_client`
  (grossiste/détaillant), `plafond_credit`, VIP.
- **EF-CLT-2** Fiche client : `encours`, statut VIP (★), actions (modifier, activer/
  désactiver, basculer VIP, versement).
- **EF-CRE-1** **Registre des créances** par client (date, libellé, montant signé, solde
  après, auteur).
- **EF-CRE-2** **Règlement d'encours** : transactionnel, plafonné à l'encours, écrit un
  `versement` (montant négatif) et recalcule le solde.
- **EF-CLT-3** **Relance** : un client dont l'`encours > 0` et sans activité depuis
  `relance_delai_jours` (paramètre, défaut 30 j) est signalé par un bandeau sur la page
  clients.

### 6.9 Commandes B2B (commandes grossistes)

- **EF-B2B-1** Créer une commande pour un client de la boutique (au moins un article).
- **EF-B2B-2** Une commande `en_attente` **ne déduit pas** le stock.
- **EF-B2B-3** Remise via code promo (pourcentage/montant) ; `montant_brut` et
  `montant_total` conservés.
- **EF-B2B-4** Terme de paiement `comptant` ou `credit`.
- **EF-B2B-5** Cycle : `en_attente → confirmee → livree` ou `→ annulee` (une commande
  livrée ne peut être annulée).
- **EF-B2B-6** **Livraison** : déduit le stock (mouvements `sortie`) ; si `credit`, ajoute
  le montant à l'`encours` du client **après contrôle du plafond** et de l'activité du
  client.

### 6.10 Promotions (codes promo)

- **EF-PRO-1** Créer/modifier/supprimer/activer un code promo par boutique.
- **EF-PRO-2** Paramètres : `code` (unique), `type_reduction` (`pourcentage`/`montant`),
  `valeur_reduction`, `max_utilisations`, `date_debut`, `date_fin`, `actif`.
- **EF-PRO-3** Validation à l'usage : boutique correspondante, actif, dans la période,
  limite d'utilisation non atteinte ; incrément de `nombre_utilisations`.
- **EF-PRO-4** Un code supprimé **ne casse pas** l'historique des ventes
  (FK `ON DELETE SET NULL`).

### 6.11 Achats & fournisseurs

- **EF-ACH-1** Gérer les fournisseurs d'une boutique (CRUD + actif/inactif).
- **EF-ACH-2** Créer une commande fournisseur (`ACH-AAAAMMJJ-XXXXXX`) avec lignes
  (produit, quantité commandée, prix).
- **EF-ACH-3** **Réception** (totale ou partielle) par ligne : ajoute le stock (fonction
  atomique `ajouter_stock`), crée un mouvement `entree`, met à jour `quantite_recue`.
  Statut → `recue` si tout est reçu, sinon `partielle`.
- **EF-ACH-4** Annulation possible tant que la commande n'a pas été (partiellement)
  réceptionnée.

### 6.12 Prix conseillés (siège)

- **EF-PC-1** Le **siège** (`prix_conseilles:gerer`, réservé au propriétaire) **publie** un
  prix conseillé par produit (prix de vente, coût de revient, actif).
- **EF-PC-2** Une boutique applique les prix conseillés actifs (individuellement ou en
  masse) → met à jour `prix_boutique`.

### 6.13 Rapports

- **EF-RAP-1** Rapport par période : **journalier, hebdomadaire, mensuel, annuel**
  (et période personnalisée).
- **EF-RAP-2** Contenu : nombre de ventes, chiffre d'affaires, **détail par jour**,
  répartition par **mode de paiement**, **top produits** (quantité + CA), synthèse
  réservations.

### 6.14 Consolidation siège

- **EF-CON-1** Vue consolidée (propriétaire/direction) par **boutique**, par **région** et
  par **groupe** : CA du jour, encours clients, commandes en attente.
- **EF-CON-2** Totaux CA et encours réseau.

### 6.15 Administration (réservé `administrateur`)

- **EF-ADM-U-1** **Utilisateurs** : créer (rôle, boutiques, région/groupe, téléphone),
  valider les règles de rattachement, activer/désactiver (interdit sur soi-même),
  réinitialiser le mot de passe.
- **EF-ADM-B-1** **Boutiques** : créer, modifier, activer/désactiver ; consulter leurs
  comptes.
- **EF-ADM-B-2** **Comptes par défaut** : à la création d'une boutique, générer
  automatiquement un compte pour chaque profil opérationnel (**Gérant, Magasinier,
  Comptable, Vendeur**), avec email déterministe
  `<role>.<slug-boutique>-<id>@defaut.multiboutique.com` et **mot de passe aléatoire
  affiché une seule fois**. Un bouton « Créer les profils par défaut manquants » permet de
  compléter une boutique existante. Les mots de passe ne sont **jamais** stockés en clair.
- **EF-ADM-C-1** **Catégories** : créer/modifier/supprimer ; suppression interdite si des
  produits y sont rattachés. Le nom génère un **préfixe de code** produit.
- **EF-ADM-O-1** **Organisation** : gérer **groupes** et **régions**.
- **EF-ADM-P-1** **Paramètres généraux** : `monnaie` (symbole/devise, ex. FCFA),
  `nom_application`, `seuil_alerte_defaut`, `relance_delai_jours`.
- **EF-ADM-R-1** **Rôles & permissions** : matrice éditable (activer/désactiver chaque
  permission par rôle).

### 6.16 Interface et navigation

- **EF-UX-1** Navigation par boutique : la barre latérale liste les boutiques accessibles
  et, pour chacune, les entrées **filtrées par permission** (Vue d'ensemble, Produits,
  Stock, Ventes, Clients, Commandes B2B, Réservations, Rapports, Promotions, Achats &
  fournisseurs, Prix conseillés).
- **EF-UX-2** Entrée « Consolidation siège » visible si `consolidation:voir`.
- **EF-UX-3** Reçu de vente imprimable (page dédiée).
- **EF-UX-4** Badges de statut (stock bas, VIP, statuts de réservation/commande) et code
  couleur (rouge = alerte/rupture/inactif, vert = succès, bleu = info/actif).

---

## 7. Règles de gestion transverses

- **RG-1 — Prix officiels.** Les prix de vente proviennent toujours de `prix_boutique` ;
  aucune saisie manuelle de prix dans les ventes comptoir.
- **RG-2 — Atomicité & concurrence.** Toute opération sensible (vente, réservation,
  transfert, réception, versement) s'exécute dans une **transaction** PostgreSQL avec
  `SELECT ... FOR UPDATE` et fonctions SQL atomiques. En cas d'erreur : `ROLLBACK`.
- **EF-RG-3 — Stock.** `quantite ≥ 0`, `quantite_reservee ≥ 0`,
  `quantite ≥ quantite_reservee`. La disponibilité = `quantite - quantite_reservee`.
- **EF-CRE-3** `reste = montant_total - montant_paye`. Le crédit n'est possible que pour
  un **client rattaché**. Le solde ne peut jamais devenir négatif (`GREATEST(0, ...)`).
- **EF-AUD-1** Tout mouvement de stock et toute vente sont journalisés dans
  `journal_audit` ; toute variation de stock porte l'`auteur_id`.
- **EF-SEC-1** Aucune action sur une boutique hors périmètre (anti-IDOR) ; contrôle côté
  serveur systématique.
- **EF-SEC-2** Séparation configuration/commercial : l'administrateur ne voit aucune
  donnée commerciale ; le personnel n'accède pas à `/admin`.
- **EF-INF-2** Monnaie paramétrable : l'affichage des montants utilise le paramètre
  `monnaie`.

---

## 8. Exigences non fonctionnelles

| Réf. | Exigence | Cible |
|---|---|---|
| **ENF-1** | Performance | Pages de lecture directe (Server Components) ; index sur clés étrangères et dates ; listes plafonnées (ex. mouvements 500). |
| **ENF-2** | Intégrité | Transactions ACID ; stock jamais négatif ; crédit plafonné. |
| **ENF-3** | Traçabilité | Audit append-only exploitable (journal alimenté par triggers + actions). |
| **ENF-4** | Disponibilité | Conteneurs `restart: unless-stopped` ; attente de la santé `db` (`healthcheck`) avant l'app. |
| **ENF-5** | Configuration | Devise, nom d'app, seuil d'alerte et délai de relance paramétrables. |
| **ENF-6** | Portabilité | 100 % Docker, aucune donnée hors du serveur. |
| **ENF-7** | i18n / formats | Interface en **français** ; montants via `Intl.NumberFormat`, dates `JJ/MM/AAAA`. |
| **ENF-8** | Volumétrie des listes | Plafonds/pagination maîtrisés (ex. mouvements limités à 500). |

---

## 9. Sécurité

Synthèse des mesures en place (voir aussi `RAPPORT_SAST_DAST.md`) :

| Mesure | Détail |
|---|---|
| Secrets | `JWT_SECRET` **obligatoire**, ≥ 32 caractères, échec explicite (fail-closed) s'il est absent/faible/défaut connu. `.env` hors dépôt et hors image. |
| Sessions | JWT HS256 (WebCrypto), signature vérifiée en **temps constant**, cookie `httpOnly`/`sameSite=lax`/`secure` en prod. |
| Mots de passe | bcrypt (pgcrypto) coût 10, vérification **en base**. |
| Injection SQL | ~100 % des requêtes paramétrées (`$1`, `$2`…). |
| Contrôle d'accès | Double contrôle *permission* **et** *accès boutique* sur chaque action ; anti-IDOR. |
| Rate limiting | Login 5/15 min ; inscription 3/h ; `429` + `Retry-After`. |
| Upload | Types MIME restreints, taille ≤ 5 Mo, noms UUID, service par route dédiée (pas d'accès direct au `public`). |
| Traversée de chemin | Bloquée sur la route `/uploads/[...path]`. |
| Séparation | Administrateur sans accès aux données commerciales ; personnel sans accès `/admin`. |
| Audits | ZAP baseline + tests actifs : 0 injection SQL, 0 XSS exploitable, 0 path traversal, 0 CSRF sur Server Actions. |

Correctifs majeurs déjà intégrés : forge de session (C1), IDOR réservation (C2),
identifiants par défaut (H1), rate-limit (H2), cookie Secure (H3), révocabilité de session
et durée (M1), code bcrypt (M5).

---

## 10. Déploiement et exploitation

### 10.1 Environnements

| Service | Image / build | Port hôte | Rôle |
|---|---|---|---|
| `db` | `postgres:16-alpine` | 5432 | Base de données (volume `pgdata`) |
| `app` | `multiboutique:latest` (conteneur `multiboutique-prod`) | 3001 → 3000 | Application production |
| `dev` | `Dockerfile.dev` | 3002 → 3000 | Développement (hot reload) |
| `nginx` | `nginx:alpine` | 80/443 | Reverse proxy (SSL optionnel) |

### 10.2 Variables d'environnement

- `DATABASE_URL` — chaîne de connexion PostgreSQL.
- `JWT_SECRET` — secret de signature (≥ 32 car., obligatoire).
- `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB` (service `db`).
- `NODE_ENV=production`, `NODE_OPTIONS=--max-old-space-size=4096` (build).

### 10.3 Build & image

- `Dockerfile` multi-étapes (`deps` → `builder` → `runner`), sortie Next.js
  **`standalone`**, exécution sous utilisateur non privilégié **uid 1001**.
- Le dossier `public/uploads` est monté en **volume** ; il doit appartenir à l'**uid
  1001** (sinon erreur d'écriture `EACCES`).

### 10.4 Migrations

- `db/init.sql` est joué au **premier** démarrage de la base (schéma + seed).
- Les évolutions `db/migrations/002 → 011` sont **idempotentes** et appliquées par
  `db/migrate.sh` (suivi dans la table `schema_migrations`, transaction atomique). Option
  `--baseline` pour adopter une base migrée manuellement.

### 10.5 CI/CD (GitHub Actions)

1. `push`/`PR` sur `main` → **job `build`** (`npm ci` + `npm run build`, inclut le
   typecheck).
2. Sur `main` → **job `deploy`** : build & push de l'image sur **GHCR** (`main`, `sha`),
   puis **SSH** sur le serveur : `git pull` →
   `IMAGE=... bash deploy/server-deploy.sh up` (sauvegarde BDD + migrations + redémarrage).

Secrets Actions requis : `SERVER_HOST`, `SERVER_PORT`, `SERVER_USER`, `SERVER_SSH_KEY`
(+ `GHCR_USER`/`GHCR_TOKEN` si dépôt privé). Variable optionnelle `APP_DIR`.

### 10.6 Sauvegarde / restauration

```bash
# Sauvegarde
docker exec multiboutique-db pg_dump -U mb multiboutique > sauvegarde.sql
# Restauration
docker exec -i multiboutique-db psql -U mb multiboutique < sauvegarde.sql
```

---

### 10.7 Commandes utiles

```bash
# Démarrage production
docker compose up -d db app

# Vérifier l'état
docker compose ps
docker logs multiboutique-prod --tail 50

# Appliquer les migrations
bash db/migrate.sh
```

### 10.8 Documentation de référence

- `README.md` — démarrage, comptes seed, CI/CD.
- `RAPPORT_SAST_DAST.md` — audit de sécurité.
- Le présent `docs/CAHIER_DES_CHARGES.md` — spécifications.

---

## 11. Recette et critères d'acceptation

Scénarios vérifiés de bout en bout (environnement local `:3001`).

| # | Scénario | Résultat attendu | Statut |
|---|---|---|---|
| R1 | Connexion admin / propriétaire / personnel | Accès aux espaces selon le rôle | ✅ |
| R2 | Création d'une vente comptoir | Stock déduit, mouvement `sortie`, référence `VTE-…` | ✅ |
| R3 | Vente à crédit partielle + plafond | `reste` calculé, encours + registre (`type=vente`), refus si plafond dépassé | ✅ |
| R4 | Versement client | Encours diminué, registre `versement` (négatif) | ✅ |
| R5 | Annulation de vente | Stock rétabli, créance soldée, statut `annulee` | ✅ |
| R6 | Magasinier (`gerant_stock`) | Consultation stock/produits, **pas** de modification | ✅ |
| R7 | Génération de codes produits | `PREFIXE-0001` (ex. `HYG-0003`), unicité | ✅ |
| R8 | Upload + affichage photo produit | Upload ≤ 5 Mo, affichage via `/uploads/...` | ✅ |
| R9 | Mouvements de stock filtrés | Filtres période/type/produit, total correct | ✅ |
| R10 | Reçu de vente | Page imprimable avec total, vendeur, paiement | ✅ |
| R11 | Relance client | Bandeau affiché si activité ancienne + encours > 0 | ✅ |
| R12 | Création de boutique | 4 comptes par défaut générés + retour des identifiants | ✅ |
| R13 | Génération des comptes manquants | Complète les profils absents d'une boutique | ✅ |
| R14 | Gestion rôles & permissions | Matrice modifiable, effet immédiat | ✅ |
| R15 | Réservations (public → boutique) | Réservation → confirmation → encaissement → vente | ✅ |

**Critères d'acceptation généraux :**

- Toute mutation respecte *(session + permission + accès boutique)*.
- Aucune opération ne peut laisser le stock négatif ou un encours supérieur au plafond.
- Chaque vente, mouvement et création de compte est traçable dans `journal_audit`.
- Les montants sont affichés avec la devise configurée.

---

## 12. Annexes

### 12.1 Comptes seed (à changer impérativement)

| Rôle | Email | Mot de passe |
|---|---|---|
| Administrateur | `admin@multiboutique.com` | `admin123` |
| Propriétaire | `proprietaire@multiboutique.com` | `proprietaire123` |

### 12.2 Boutiques seed

- `11111111-1111-1111-1111-111111111111` — *Boutique 1* (renommable)
- `22222222-2222-2222-2222-222222222222` — *Boutique 2*
- `33333333-3333-3333-3333-333333333333` — *Boutique 3*

### 12.3 Paramètres système

| Clé | Défaut | Rôle |
|---|---|---|
| `monnaie` | `$` | Symbole/devise affiché (ex. `FCFA`) |
| `nom_application` | `MultiBoutique` | Nom affiché |
| `seuil_alerte_defaut` | `10` | Seuil d'alerte stock par défaut |
| `relance_delai_jours` | `30` | Délai de relance d'un client en cours |

### 12.4 Arborescence des routes

| Préfixe | Accès |
|---|---|
| `/`, `/boutique/*` | Public (catalogue, réservation) |
| `/login`, `/register` | Public |
| `/client` | Rôle `client` |
| `/dashboard`, `/dashboard/[boutiqueId]/*` | Personnel + propriétaire + direction |
| `/dashboard/consolidation` | `consolidation:voir` |
| `/admin/*` | `administrateur` |

### 12.5 Codes des Server Actions (principales)

`creerVente`, `annulerVente`, `creerReservation`, `validerReservation`,
`confirmerReservation`, `encaisserReservation`, `annulerReservation`, `creerProduit`,
`entrerStock`, `ajusterStock`, `transfertStock`, `modifierPrix`, `creerUtilisateur`,
`toggleActifUtilisateur`, `reinitialiserMotDePasse`, `creerBoutique`,
`listerComptesBoutique`, `creerUtilisateursDefaut`, `modifierBoutique`,
`mettreAJourParametres`, `creerCodePromo`, `modifierCodePromo`, `toggleActifCodePromo`,
`supprimerCodePromo`, `creerGroupe`, `modifierGroupe`, `creerRegion`, `modifierRegion`,
`creerClient`, `modifierClient`, `toggleActifClient`, `basculerVip`, `listerRegistre`,
`reglerEncours`, `creerCommande`, `confirmerCommande`, `livrerCommande`,
`annulerCommande`, `creerFournisseur`, `modifierFournisseur`, `toggleActifFournisseur`,
`creerCommandeFournisseur`, `recevoirCommandeFournisseur`, `annulerCommandeFournisseur`,
`publierPrixReference`, `appliquerPrixConseilles`, `creerCategorie`, `modifierCategorie`,
`supprimerCategorie`, `togglePermissionRole`.

### 12.6 Glossaire

- **CA** : chiffre d'affaires.
- **SKU / code produit** : identifiant lisible `PREFIXE-0001`.
- **Encours** : montant total dû par un client (crédit en cours).
- **Plafond de crédit** : encours maximal autorisé pour un client.
- **Registre des créances** : journal chronologique des dettes/versements d'un client.
- **Prix conseillé** : prix de référence publié par le siège, applicable par boutique.
