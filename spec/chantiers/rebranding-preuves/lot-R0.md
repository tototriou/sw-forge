# Preuve — lot R0 du rebranding : relevé des jetons

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R0.
Relevé seulement : **aucune valeur n'est changée dans ce lot**. Intrant : la
toile (`BsTheme`, `BsCharte`, `BsIcones`), `src/index.css`,
`tailwind.config.js`. Mesures : scripts du scratchpad
`contraste-blacksmith.mjs`, `contraste-propres.mjs`, `replis-blacksmith.mjs`
(ratio WCAG 2, seuil 4,5 pour le texte), 2026-09-28.

## 1. Correspondance des jetons

La toile nomme ses jetons `--bs-*` et en a **quatre surfaces** (`bg`,
`bar`, `surface`, `surface-2`) ; l'app en a **trois** (`bg`, `panel`,
`panel2`). Proposition : `panel` ← `surface`, `panel2` ← `surface-2`, et un
jeton **`bar`** nouveau pour la barre latérale et la barre du haut
(question Q2).

| Jeton de l'app | Jeton de la toile | Forge actuel | Forge toile | Atelier actuel | Atelier toile |
|---|---|---|---|---|---|
| `bg` | `--bs-bg` | `#12131C` | `#161514` | `#F6F6F8` | `#F6F0E4` |
| *(nouveau)* `bar` | `--bs-bar` | — | `#1B1A19` | — | `#FFFDF8` |
| `panel` | `--bs-surface` | `#191A26` | `#232120` | `#FFFFFF` | `#FFFDF8` |
| `panel2` | `--bs-surface-2` | `#212332` | `#2E2C2A` | `#F1F1F4` | `#EFE6D5` |
| `border-soft` | `--bs-border` | `#2D3044` | `#3A3734` | `#E3E3E9` | `#E4D9C6` |
| `border` | `--bs-border-strong` | `#3A3E56` | `#5A544D` | `#C4C6D0` | `#CDBC9E` |
| `ink` | `--bs-text` | `#E9E7F0` | `#EDE3D1` | `#16171F` | `#1B1A19` |
| `ink-dim` | `--bs-text-2` | `#9494AA` | `#CFC3AE` | `#565869` | `#3F3A34` |
| `ink-dimmer` | `--bs-text-3` | `#828398` | `#A89A86` | `#6B6D80` | `#6B6259` |
| `accent` | `--bs-accent` | `#D27A42` | `#FF7A1A` | `#2B36A5` | `#FF7A1A` |
| *(nouveau)* `accent-hover` | `--bs-accent-hover` | — | `#FF9A4D` | — | `#E0620A` |
| `accent-ink` | `--bs-on-accent` | `#12131C` | `#1B1A19` | `#FFFFFF` | `#1B1A19` |
| `star` | `--bs-brass` | `#F2C24C` | `#C9A227` | `#8A570C` | `#8C6D0E` |
| `good` | `--bs-success` | `#7FBE7F` | `#9FD39A` | `#146A41` | `#2F6B36` |
| `warn` | `--bs-warning` | `#D9A441` | `#FF9A4D` | `#8A570C` | `#9A4307` |
| `bad` | `--bs-danger` | `#E27468` | `#E5848A` | `#B01C1C` | `#A3303A` |

**Arrondis** : `--radius` 6 → 6, `--radius-lg` (boutons, champs) 8 → **10**,
`--radius-xl` (cartes) 12 → **14**, `--radius-2xl` (fenêtres) 14 → **20**.
**Polices** : Cinzel (titres) et JetBrains Mono (chiffres) inchangés ;
**Source Sans 3 remplace Inter** pour le texte. **Espacements** : l'échelle
de la toile (4 à 64) est celle de Tailwind — rien à changer.

## 2. Contrastes des jetons de la toile

**Forge** : tout passe. Texte le plus faible (`text-3` sur `surface-2`) 5,05 ;
braise 5,33 à 6,99 ; laiton 5,75 à 7,54 ; texte sur aplat de braise 6,66.

**Atelier** — deux échecs :

| Couleur | `bg` | `surface` | `surface-2` |
|---|---|---|---|
| braise `#FF7A1A` **comme texte** | 2,30 | 2,57 | 2,11 |
| laiton `#8C6D0E` | 4,29 | 4,79 | 3,93 |
| lien de la charte `#B34E08` | 4,61 | 5,15 | 4,23 |

La braise ne tient qu'en **aplat** (texte sombre dessus : 6,66). Or l'app
colore du TEXTE en accent à **32 endroits** (`text-accent`) et en `star` à
**35** : il faut en Atelier une variante de texte (question Q1).

Surfaces : en Atelier, `bar` et `surface` sont **identiques** (1,00) ; en
Forge, `bg` / `bar` / `surface` ne s'écartent que de 1,05 à 1,14 — c'est la
bordure qui sépare, comme aujourd'hui. Bordures sur les fonds : 1,23 à 2,44,
sous le 3:1 d'un contour porteur de sens — comme nos bordures actuelles, qui
séparent des surfaces sans rien signifier.

## 3. Couleurs de l'app SANS équivalent dans la toile

Éléments, raretés, palette des graphiques, fonds doux (`*-soft`), couleurs de
section de l'accueil, accent contextuel (`ctx`). Nos valeurs actuelles,
mesurées sur les fonds de la toile :

| Jeton | Atelier : pire ratio | Forge : pire ratio |
|---|---|---|
| `el-fire` | 4,81 | **4,03** |
| `el-wind` | **3,74** | 8,05 |
| `el-light` | **4,27** | 11,68 |
| `el-dark` | 6,13 | **4,37** |
| `el-unknown` | 5,12 | **4,23** |
| `rarity-5` | **4,21** | 7,59 |
| `pal-1` | **3,67** | 7,59 |
| `pal-3` | **4,31** | 9,85 |
| `pal-5` | 4,71 | **4,46** |
| `pal-6` | **3,90** | **2,90** |

(Les autres passent partout.) Cause : la `surface-2` de la toile est plus
FONCÉE que notre `panel2` en Atelier, plus CLAIRE en Forge.

**Replis calculés** (même teinte, le plus petit pas qui passe 4,5 partout) :

| Jeton | Actuel | Repli |
|---|---|---|
| accent en texte (Atelier) | `#FF7A1A` | `#A64F11` |
| laiton (Atelier) | `#8C6D0E` | `#80640D` |
| `el-wind` (Atelier) | `#946F00` | `#846300` |
| `el-light` (Atelier) | `#866718` | `#816317` |
| `rarity-5` (Atelier) | `#A6580C` | `#9F540B` |
| `pal-1` / `pal-3` / `pal-6` (Atelier) | `#96700A` / `#1C7A4A` / `#6B7280` | `#846309` / `#1B7648` / `#616874` |
| `el-fire` / `el-dark` / `el-unknown` (Forge) | `#E85C50` / `#B076E8` / `#868DA8` | `#EA6B61` / `#B279E9` / `#8B92AC` |
| `pal-5` / `pal-6` (Forge) | `#8890B8` / `#6A7191` | `#8991B9` / `#8D92AB` |

⚠️ **Un arbitrage existe déjà** ([design.md](../../shared/design.md),
« Vent et Lumière : arbitrage assumé », étendu au lot 14 aux paliers `pal-1`
et `pal-6`) : on tient **4,5 sur `panel`**, la surface des cartes, et on
accepte moins ailleurs, parce qu'assombrir un jaune le fait virer au kaki et
que le joueur ne reconnaît plus son élément. Appliqué aux fonds de la toile
(`panel` ← `surface`), il ne laisse que **deux** échecs :

| Jeton | Sur `surface` | Pire ailleurs |
|---|---|---|
| `pal-1` (Atelier) | 4,47 | 3,67 sur `surface-2` |
| `pal-6` (Forge) | 3,35 | 2,90 sur `surface-2` |

Tous les autres jetons du tableau ci-dessus passent 4,5 sur `surface`. D'où
l'alternative de Q5 : les replis partout, ou l'arbitrage existant, qui ne
corrige que ces deux paliers.

**Fonds doux** (`accent-soft`, `good-soft`, `warn-soft`, `bad-soft`,
`el-*-soft`) : la toile n'en a pas ; proposition, les recalculer par la même
construction qu'aujourd'hui (la teinte fondue dans `surface`), sur les
nouvelles surfaces.

## 4. Au-delà des couleurs

- **Échelle typographique** : la toile écrit le corps en **17 px** (légende
  14, titre 19, h2 28, h1 44) ; l'app en 13 à 15 (`sm`, `md`, `base`), réglée
  pour la densité des listes. L'adopter changerait la densité de tous les
  écrans (Q4).
- **Thème par défaut** : la toile fait de Forge (sombre) le défaut ; l'app
  suit le navigateur (« Auto ») et propose Auto / Clair / Sombre (Q3).
- **Icônes** : la toile dessine un jeu d'icônes « objets d'atelier » pour la
  navigation (Accueil, Siège, Recos, RTA, Mon compte, Runes, Bestiaire,
  Mécaniques, Nouveautés) et des notions (vitesse, tick, défense, attaque…),
  trait 2 px, grille 24 ; les actions gardent des formes standard, les icônes
  du jeu restent telles quelles. L'app utilise lucide (Q6). ⚠️ La nav de
  l'app (`App.tsx`) a des entrées que la toile ne dessine pas :
  Arène, Outils, Optimizer, Speed tuning, Monstres, Artéfacts, Ami, et les
  onglets Défense / Offense (la toile n'a que les notions Bouclier / Épée).
  Les adopter veut dire en dessiner sept de plus dans le même trait.
- **Couleurs de section de l'accueil** : la toile n'en a pas — ses tuiles sont
  toutes en braise ou en laiton (seules couleurs vives de `BsAccueil` :
  `#FF7A1A`, `#C9A227`). Dans l'app, `COULEUR_SECTION` colore aussi les
  icônes de la nav du téléphone (`App.tsx`) : c'est le repère de section.
  Proposition : les garder, variantes claires comprises (`TEINTE_CLAIRE`,
  lot 14) ; les remplacer par braise / laiton efface ce repère (Q7).
- **Accent contextuel `ctx`** : alias d'`accent` ou de la couleur d'élément
  (`[data-ctx]`) ; il suit ce que R1 décide pour eux, rien à trancher.

## 5. Questions pour Thomas avant R1

- **Q1** — accent en texte (Atelier) : jeton de texte séparé (`accent-texte`,
  repli `#A64F11`), l'aplat restant braise ?
- **Q2** — un jeton `bar` pour les barres, distinct des cartes ?
- **Q3** — thème par défaut : Forge (toile) ou Auto (actuel) ?
- **Q4** — échelle typographique de la toile (corps 17) ou la nôtre ?
- **Q5** — nos couleurs propres : les replis partout (4,5 sur toutes les
  surfaces), ou l'arbitrage existant (4,5 sur `surface`, seuls `pal-1` et
  `pal-6` corrigés) ?
- **Q6** — icônes de navigation de la toile, ou lucide ?
- **Q7** — couleurs de section de l'accueil gardées, ou braise / laiton ?

## 6. Réponses de Thomas (2026-09-29)

La recommandation, sur les sept questions ; inscrites comme décisions 4 à 10
du cadrage (A.8) :
- Q1 → braise foncée pour le texte (décision 4) ;
- Q2 → jeton `bar` (décision 5) ;
- Q3 → Auto reste le défaut (décision 6) ;
- Q4 → notre échelle (décision 7) ;
- Q5 → règle existante (décision 8) ;
- Q6 → icônes de la toile, plus sept à dessiner (décision 9) ;
- Q7 → couleurs de section gardées (décision 10).
