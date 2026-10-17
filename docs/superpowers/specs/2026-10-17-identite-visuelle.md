# Identité visuelle — Comptoir, primaire bleue

Date : 2026-10-17 · État : retenue (tâche 7 du plan des phases 0 et 1)

Source des tokens de `packages/ui` (tâche 8). Toute couleur modifiée pour passer un test
de contraste est reportée ici.

## 1. Caractère

Direction A « Comptoir » des trois directions présentées, avec une **primaire bleue** au
lieu du vert forêt. Fonds chauds couleur sable, bleu franc pour agir, safran pour signaler.
Formes généreuses, gros chiffres, rien d'intimidant pour un vendeur sur tablette.

Le vert est réservé au succès, pour ne pas concurrencer la couleur d'action. Le
paiement « Mobile money », bleu dans l'exploration, passe en bleu-vert (`info`).

## 2. Couleurs

Contraste vérifié selon WCAG 2.x : 4,5:1 pour tout texte, 3:1 pour les bordures et
indicateurs d'interface.

### 2.1 Tokens

| Token | Clair | Sombre | Usage |
|---|---|---|---|
| `fond` | `#F4F0E8` | `#16130F` | Fond de page |
| `surface` | `#FFFFFF` | `#211D18` | Cartes, panneaux, rail de navigation |
| `surfaceRelevee` | `#FBF8F3` | `#2B261F` | Surfaces imbriquées, survol de ligne |
| `texte` | `#1F1B16` | `#F3EEE6` | Texte principal |
| `texteDiscret` | `#5E564C` | `#B5AA9B` | Libellés, dates, texte secondaire |
| `bordure` | `#E2DACD` | `#3A332B` | Séparateurs décoratifs (pas d'exigence de contraste) |
| `bordureForte` | `#8C8174` | `#7A6F62` | Contour des champs et boutons secondaires (≥ 3:1) |
| `primaire` | `#2B50D9` | `#8AA8FF` | Action principale, lien, élément actif |
| `primaireSurvol` | `#1F3DAE` | `#A9C0FF` | Survol et appui de l'action principale |
| `surPrimaire` | `#FFFFFF` | `#0E1630` | Texte sur `primaire` |
| `primaireFond` | `#E6ECFA` | `#1C2340` | Entrée de navigation active, sélection |
| `accent` | `#E0A526` | `#F0BC4C` | Safran : mise en avant (tuile d'alerte stock) |
| `surAccent` | `#1F1B16` | `#16130F` | Texte sur `accent` |
| `succes` | `#1F7A4D` | `#6CCB97` | Texte et icône de succès |
| `succesFond` | `#E3F1E9` | `#173323` | Fond de badge de succès |
| `alerte` | `#8F5300` | `#F0BC4C` | Texte d'alerte |
| `alerteFond` | `#FBEFD6` | `#3A2C10` | Fond de badge d'alerte |
| `danger` | `#B3261E` | `#FF8A80` | Texte et bouton destructeurs |
| `surDanger` | `#FFFFFF` | `#2A0D0B` | Texte sur `danger` |
| `dangerFond` | `#F8E1DF` | `#3D1A17` | Fond de badge de danger |
| `info` | `#0E6B6B` | `#6FD3CB` | Information neutre (mode de paiement) |
| `infoFond` | `#DDF0EE` | `#143331` | Fond de badge d'information |
| `neutreFond` | `#EDE7DD` | `#2B261F` | Fond de badge neutre (texte : `texteDiscret`) |
| `focus` | `#2B50D9` | `#8AA8FF` | Anneau de focus, 2 px, décalé de 2 px |

### 2.2 Contrastes de référence

| Paire | Clair | Sombre |
|---|---|---|
| `surPrimaire` sur `primaire` | 6,46 | 7,76 |
| `surPrimaire` sur `primaireSurvol` | 8,99 | 9,92 |
| `primaire` sur `fond` | 5,68 | 8,05 |
| `primaire` sur `primaireFond` | 5,46 | 6,69 |
| `texteDiscret` sur `surface` | 7,21 | 7,33 |
| `info` sur `infoFond` | 5,33 | 7,66 |
| `succes` sur `succesFond` | 4,56 | 6,93 |
| `danger` sur `dangerFond` | 5,24 | 6,77 |

La tâche 8 rend ces vérifications automatiques ; ce tableau n'en est qu'un aperçu.

## 3. Typographie

| Rôle | Police | Graisses | Paquet auto-hébergé |
|---|---|---|---|
| Titres | Bricolage Grotesque (axe `opsz`) | 600 à 800 | `@fontsource-variable/bricolage-grotesque` |
| Texte et interface | Figtree | 400 à 700 | `@fontsource-variable/figtree` |
| Montants, heures, quantités | Figtree, `font-variant-numeric: tabular-nums` | 700 | — |

Échelle (px) : 13 (mention), 15 (libellé), 17 (texte courant), 21 (titre de panneau),
32 (chiffre clé), 38 (titre d'écran), 56 (titre d'accueil). Titres d'écran en
`letter-spacing: -0.02em`. Libellés de section en capitales espacées (`0.08em`).

## 4. Formes et espacement

| Élément | Valeur |
|---|---|
| Rayon des cartes | 16 px |
| Rayon des boutons et champs | 14 px |
| Rayon des badges | pastille (999 px) |
| Ombre de carte | `0 1px 2px rgb(31 27 22 / 5%), 0 6px 18px rgb(31 27 22 / 5%)` |
| Ombre du bouton principal | `0 6px 16px rgb(43 80 217 / 25%)` |
| Hauteur des boutons | 52 px ; action principale d'écran : 60 px |
| Entrées du rail de navigation | 84 × 64 px |
| Espacements | multiples de 2 : 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 48 |

En thème sombre, les ombres disparaissent : la hiérarchie passe par `surface` et
`surfaceRelevee`.

## 5. Logotype

Proposition « Étiquette », retenue parmi trois :

- **Logotype** : « MultiBoutique » en Bricolage Grotesque 800, taille optique 96,
  approche -0,02 em, couleur `texte`. Variante `currentColor` pour fond sombre et impression.
- **Icône** : « M » blanc sur carré `primaire` aux coins arrondis (22,5 %), avec une
  pastille `accent` dans le coin supérieur droit, qui évoque l'œillet d'une étiquette
  de prix.

Les lettres sont vectorisées : les SVG ne dépendent d'aucune police. Ils sont produits
par `packages/ui/outils/logotype.py` (fontTools), et les icônes de la PWA par
`npm run icones -w @multiboutique/ui` à partir de `assets/icone.svg`.

| Fichier (`packages/ui/assets/`) | Usage |
|---|---|
| `logo.svg`, `logo-monochrome.svg` | En-têtes, écran de connexion, documents |
| `icone.svg` | Source des icônes |
| `favicon.ico`, `pwa-64x64.png` | Onglet du navigateur |
| `pwa-192x192.png`, `pwa-512x512.png` | Manifeste de la PWA |
| `maskable-icon-512x512.png` | Android : fond bleu plein, monogramme dans la zone de sécurité de 80 % |
| `apple-touch-icon-180x180.png` | iOS : fond bleu plein, marge réduite à 12 % |

## 6. Référence visuelle

Canevas des trois directions, avec les planches A mises à jour en bleu :
https://claude.ai/artifact/4auUPuhCZKw547ZbTgaXZB
