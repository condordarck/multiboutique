# Rapport SAST + DAST — MultiBoutique

Date : 2026-09-14 — Cible : `http://localhost:3001` (Next.js 15.3.6, PostgreSQL 16)
Méthodologie : revue statique du code source (4 axes) + scans dynamiques (OWASP ZAP baseline + tests actifs manuels).

---

## Synthèse

| Sévérité | Nb | Réf. |
|---|---|---|
| CRITIQUE | 2 | C1 (forge de session), C2 (IDOR réservation) |
| ÉLEVÉE | 3 | H1 (identifiants par défaut), H2 (pas de rate-limit), H3 (cookie Secure/HTTP) |
| MOYENNE | 6 | M1 (revocation session), M2 (énumération), M3 (open redirect), M4 (leak consolidation), M5 (bcrypt cost 6), M6 (CSRF logout) |
| BASSE / INFO | 8 | L1…L8 (validation entrées, headers, en-tête X-Powered-By, datetime…) |

Points forts confirmés : **0 injection SQL** (~165 requêtes 100 % paramétrées), **0 XSS exploitable**, **0 path traversal**, **0 CORS ouvert**, **0 CSRF sur les Server Actions** (protection Next.js), signatures JWT en temps constant, secrets absents du dépôt public.

---

## CRITIQUES

### C1 — Forge de session (secret JWT faible) — *confirmé en DAST, **CORRIGÉ*** ✅
- `lib/session.ts:9-10` : `process.env.JWT_SECRET || "change-me-super-secret-please"`.
- `docker-compose.yml` : `JWT_SECRET: ${JWT_SECRET:-change-me-super-secret-please}` (défaut actif).
- **Preuve** : un JWT signé avec le secret fallback et `role:"administrateur"` return **HTTP 200 sur `/admin/organisation`**.
- **Correctif approuvé** : `JWT_SECRET` requis (fail-closed) — `verifierSecret()` throw si absent, si égale au défaut connu, si < 32 car. ; `docker-compose.yml` impose `${JWT_SECRET:?…}` sur `app` et `dev` ; `.env` généré via `openssl rand -hex 32`.
- **Re-test DAST 2026-09-14** : JWT forgé (ancien secret par défaut) → **307 (redirigé login)** ; JWT forgé (secret arbitraire 64 hex) → **307**. Plus aucun 200.

### C2 — IDOR sur `creerReservation` (création de réservation cross-boutique) — *confirmé en DAST, **CORRIGÉ*** ✅
- `lib/actions/index.ts:356` : aucun appel à `exigerAccesBoutique()` / permission ; `data.boutique_id` est fourni par le client.
- **Preuve** : un `vendeur` rattaché à la Boutique 3 a créé une réservation **RES-20260914-W3EWKL (26 000 F)** dans la Boutique 1111 (stock réservé via `reserver_stock`), dont il ne gère pas. Vecteur ensuite purgé (état restauré).
- **Correctif approuvé** : `creerReservation` gate `exigerAccesBoutique(data.boutique_id, ["reservations:gerer"])` pour tout membre du personnel (flux anonyme/client conservé) ; `annulerReservation` requiert `reservations:gerer`.
- **Re-test DAST 2026-09-14** : `vendeur` Boutique 3 → réservation en Boutique 1111 = **rejeté** (error digest, aucune ligne en base) ; **anonyme** → réservation créée normalement (flux public intact, purgée ensuite).

---

## ÉLEVÉES

### H1 — Identifiants par défaut en base
- `db/init.sql:471-479` et `migrations/002` : `admin@/admin123`, `proprietaire@/proprietaire123` actifs et documentés dans le README.
- Mitigation : mot de passe temporaire + forçage de changement, ou retrait du seed en prod.

### H2 — Pas de protection contre la force brute / spam — *CORRIGÉ* ✅
- `/api/auth/login` ne throttles rien : 15 POST rapides → 15×401, aucun 429. `/api/auth/register` est ouvert, crée des comptes sans limite (**preuve** : `spam@bot.com` créé, ensuite supprimé).
- **Correctif approuvé** : `lib/rate-limit.ts` (fenêtre glissante en mémoire) — login **5 tentatives / 15 min / IP** (429 + `Retry-After`), register **3 / heure / IP**.
- **Re-test DAST 2026-09-14** : 6 POST login → 401×5 puis **429** ; 4 POST register → 3×201 puis **429**.

### H3 — Cookie `Secure` sur transport HTTP (login cassé)
- `app/api/auth/login/route.ts:92` : `secure: NODE_ENV==="production"`, or on sert en HTTP pur sur :3001 → le navigateur refuse le cookie magistral et le login casse passivement. Aucun TLS ni HSTS (nginx : `listen 80`, bloc SSL commenté, `X-Forwarded-Proto $scheme`).
- Preuve : `Set-Cookie: mb_session=…; Secure; HttpOnly; SameSite=lax` au-dessus de HTTP.
- Mitigation : TLS au reverse-proxy + `X-Forwarded-Proto https`, ou `secure` conditionné à un header réel.

---

## MOYENNES

| Réf | Problème | Lieu | Détail/preuve |
|---|---|---|---|
| M1 | Pas de révocation de session | `lib/session.ts` | JWT sans `jti`, validation signature+exp uniquement, durée 7 j ; logout = simple suppression de cookie. Un token volé reste valable après déconnexion. |
| M2 | Énumération d'utilisateurs | `login/route.ts:51-57` | Timing mesuré : email existant ~0,010 s vs inconnu ~0,006 s (répétable) + 409 sur register. |
| M3 | Open redirect | `app/(auth)/login/page.tsx:44` — **CORRIGÉ** ✅ | `redirectSain()` : chemins internes uniquement, refus `//`, CRLF/`\0-\x1f`, schéma `\w+:` dans un chemin, longueur > 300. Renvoi vers page par rôle sinon. Présent dans le bundle déployé. |
| M4 | Leak cross-boutique (consolidation) | `dashboard/consolidation/page.tsx:27-42` — **CORRIGÉ** ✅ | Filtré par `boutique_ids` du périmètre effectif (seul le `proprietaire` voit tout). Re-test : directeur Région Ouest → seuls les chiffres **WARA** rendus. |
| M5 | Bcrypt cost 6 | pgcrypto `gen_salt('bf')` — **CORRIGÉ** ✅ | Tous les sites (register, `creerUtilisateur`, `reinitialiserMotDePasse`, seeds `init.sql`/002) passés à `gen_salt('bf', 10)`. Ajout : borne 72 car. mot de passe, validation email. |
| M6 | CSRF logout | `logout/route.ts` | POST sans cookie → 200 + `Set-Cookie` de suppression → déconnexion forcée d'une victime. |

---

## BASSES / INFO

L1 mots de passe min. 6 car., pas de complexité (`register/route.ts:15`) ·
L2 taille des champs non bornées (`nom`, `note`, `adresse`, `motif`…) dans `lib/actions/index.ts` ·
L3 emails/téléphones sans validation format côté serveur ·
L4 valeurs numériques (prix, quantités, remises) sans borne haute ·
L5 UUID non validés en entrée (défense en profondeur) ·
L6 `image_url` stockée sans validation (dormant — rien ne la rend) ·
L7 JWT : header `alg` non vérifié, `iat`/`nbf` non validés ·
L8 headers serveur : `X-Powered-By: Next.js`, absence de `X-Frame-Options`, `X-Content-Type-Options`, CSP, Permissions-Policy, CORP (ZAP : 6 WARN, 60 PASS).

---

## Résultats ZAP (baseline, 53 URLs)

```
PASS: 60   WARN-NEW: 6   FAIL: 0
WARN — Anti-clickjacking (8), X-Content-Type-Options (11), X-Powered-By (10),
      CSP (10), Permissions-Policy (11), Cross-Origin-Resource-Policy (14)
```
Aucune alerte passive XSS/SQLi/Injection — cohérent avec la revue statique.

---

## Recommandations prioritaires
1. ✅ **C1 fermé** — `JWT_SECRET` randomisé + fail-closed (vérifié DAST).
2. ✅ **C2 fermé** — gate RBAC `creerReservation`/`annulerReservation` (vérifié DAST).
3. ✅ **M3 fermé** — redirect interne uniquement (présent dans le bundle).
4. ✅ **M4 fermé** — consolidation filtrée par périmètre (vérifié DAST).
5. ✅ **H2/M5 fermés** — rate-limit login/register + bcrypt cost 10 (vérifié DAST).
6. **Restant — H1** : tourner les identifiants seed `admin123`/`proprietaire123` (rotations + forçage de changement au 1er login, retrait du README pour la prod).
7. **Restant — H3/M6/M1** : TLS au nginx + `X-Forwarded-Proto` (Secure/HSTS), CSRF logout (vérif token double-submit ou POST + même-site), sessions révocables (jti en DB).