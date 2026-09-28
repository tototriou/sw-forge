# Preuve — lot R1 du rebranding : les jetons

**Statut :** CHANTIER en cours — branche forge/refonte-graphique

Cadrage : [rebranding-blacksmith.md](../rebranding-blacksmith.md), R1 ;
relevé : [lot-R0.md](lot-R0.md). Décisions appliquées : 4 à 12 (A.8). Mesures :
scripts du scratchpad `r1-mesures.mjs`, `r1-warn.mjs`, `r1-valeurs.mjs`,
`r1-surfaces.mjs`, `r1-css-construit.mjs` (ratio WCAG 2, ΔE OKLab ×100),
2026-09-29.

## 1. Avant / après

| Jeton | Forge avant | Forge après | Atelier avant | Atelier après |
|---|---|---|---|---|
| `bg` | `#12131C` | `#161514` | `#F6F6F8` | `#F6F0E4` |
| `bar` *(nouveau)* | — | `#1B1A19` | — | `#FFFDF8` |
| `panel` | `#191A26` | `#232120` | `#FFFFFF` | `#FFFDF8` |
| `panel2` | `#212332` | `#2E2C2A` | `#F1F1F4` | `#EFE6D5` |
| `border` | `#3A3E56` | `#5A544D` | `#C4C6D0` | `#CDBC9E` |
| `border-soft` | `#2D3044` | `#3A3734` | `#E3E3E9` | `#E4D9C6` |
| `ink` | `#E9E7F0` | `#EDE3D1` | `#16171F` | `#1B1A19` |
| `ink-dim` | `#9494AA` | `#CFC3AE` | `#565869` | `#3F3A34` |
| `ink-dimmer` | `#828398` | `#A89A86` | `#6B6D80` | `#6B6259` |
| `accent` | `#D27A42` | `#FF7A1A` | `#2B36A5` | `#FF7A1A` |
| `accent-lisible` *(nouveau)* | — | `#FF7A1A` | — | `#A64F11` |
| `accent-soft` | `#302622` | `#3D2C1F` | `#E2E5F7` | `#FFEDDD` |
| `accent-ink` | `#12131C` | `#1B1A19` | `#FFFFFF` | `#1B1A19` |
| `good` / `-soft` | `#7FBE7F` / `#1B2A21` | `#9FD39A` / `#253024` | `#146A41` / `#E2F4E9` | `#2F6B36` / `#E3F1E3` |
| `warn` / `-soft` | `#D9A441` / `#322A14` | `#FF9A4D` / `#402D1F` | `#8A570C` / `#FDF0D2` | `#9A4307` / `#FFE7D8` |
| `bad` / `-soft` | `#E27468` / `#301C20` | `#E5848A` / `#372324` | `#B01C1C` / `#FAE6E6` | `#A3303A` / `#F8E4E3` |
| `star` | `#F2C24C` | `#C9A227` | `#8A570C` | `#8C6D0E` |
| `pal-1` | — | — | `#96700A` | `#956F0A` |
| `pal-6` | `#6A7191` | `#8187A2` | — | — |
| `el-*-soft` | — | la plus vive des deux constructions (§ 9) | — | idem |

Inchangés : couleurs d'élément, raretés, `pal-2` à `pal-5`, couleurs de
section (décision 10). **Arrondis** 6 / 8 / 12 / 14 → **6 / 10 / 14 / 20**.
**Police du texte** Inter → **Source Sans 3** (`index.html`,
`tailwind.config.js`, `.label` qui lit désormais `theme('fontFamily.body')`),
tailles inchangées (décision 7). **Halo de page** : supprimé dans les deux
thèmes (la toile n'en a pas ; celui de Forge était violet). **Chevron des
`<select>`** : gris chaud `#827C72` (3,34 sur le `panel2` d'Atelier, 3,36 sur
celui de Forge), à la place d'un gris bleuté.

**Barres** (décision 5) : `Sidebar.tsx` passe de `bg-bg` à `bg-bar`,
`TopBar.tsx` de `bg-panel` à `bg-bar`. La barre d'onglets du téléphone ne
bouge pas : la décision nomme la barre latérale et la barre du haut, et R4
refait la coquille.

## 2. Deux braises, un seul nom de classe

Décisions 4 et 11 : en Atelier, la braise vive fait 2,11 à 2,57 sur les fonds.
Tout ce qui se lit ou se trace prend donc la braise lisible `#A64F11`.

**Écart au contrat du R1** : le cadrage prévoyait de renommer les 32
`text-accent` à la main. Le partage est fait à la place dans
`tailwind.config.js` — `textColor`, `borderColor`, `ringColor` et
`outlineColor` lisent `--accent-lisible` (et `--ctx-lisible`), `colors` garde
la vive pour les aplats. Même résultat, zéro composant touché pour ça, et un
`text-accent` écrit plus tard sera lisible d'office — le renommage aurait
laissé le piège ouvert. Ce que Tailwind ne voit pas est écrit à la main :
anneau `:focus-visible` et `.title-gradient` (`index.css`), deux traits SVG
de `CurveChart.tsx`.

Preuve dans le CSS **construit** (`r1-css-construit.mjs` sur `dist/`) :

```text
✓ .text-accent{… color:rgb(var(--accent-lisible) / …)}
✓ .border-accent{… border-color:rgb(var(--accent-lisible) / …)}
✓ .border-accent\/50{border-color:rgb(var(--accent-lisible) / .5)}
✓ .ring-accent{… --tw-ring-color: rgb(var(--accent-lisible) / …)}
✓ .text-ctx{… color:rgb(var(--ctx-lisible) / …)}
✓ .hoverable\:border-ctx:hover{… border-color:rgb(var(--ctx-lisible) / …)}
✓ .bg-accent{… background-color:rgb(var(--accent) / …)}
✓ .bg-accent\/25{background-color:rgb(var(--accent) / .25)}
✓ .bg-bar{… background-color:rgb(var(--bar) / …)}
✓ contient « outline:1px solid rgb(var(--accent-lisible)) »
✓ ne contient plus « 'Inter' », « Inter, », « #241d2e »
tout est émis comme prévu
```

## 3. Contrastes mesurés

Texte, pire des trois surfaces (`bg`, `panel`, `panel2`) :

| Encre | Forge | Atelier |
|---|---|---|
| `ink` / `ink-dim` / `ink-dimmer` | 10,93 / 7,99 / 5,05 | 14,03 / 9,08 / 4,82 |
| `accent-lisible` | 5,33 | 4,52 |
| `good` / `warn` / `bad` | 8,12 / 6,61 / 5,30 | 5,17 / 5,33 / 5,57 |
| `star` | 5,75 | **3,93** (4,79 sur `panel` : décision 8) |

- **Contours d'état** (`accent-lisible`, 3:1 visé) : 5,33 à 6,99 en Forge,
  4,52 à 5,51 en Atelier ; sur le fond d'un filtre actif (`bg-accent/25`),
  4,02 et 4,34. L'encre sur ce fond : 8,25 et 13,46.
- **Aplat** : `accent-ink` sur la braise 6,66 dans les deux thèmes. En
  Atelier, l'aplat ne se détache du fond qu'à 2,30 ; le bouton plein porte
  son libellé.
- **Bordures** (décoratives, sous 3:1 comme avant) : `border` 1,86–2,44
  (Forge), 1,50–1,83 (Atelier) ; `border-soft` 1,18–1,54 et 1,13–1,37.
- **Fonds doux** (après le § 9) : encre 9,71 au pire (Forge), 13,99
  (Atelier) ; accent et sémantique sur leur propre fond doux, 4,91 au pire.
- **Nos couleurs** (règle : 4,5 sur `panel`) : toutes au-dessus ; les plus
  justes, `pal-6` Forge 4,52, `pal-1` Atelier 4,53, vent Atelier 4,56.
- **Surfaces** : Forge `panel2`/`panel` 1,15, `panel`/`bg` 1,14, `bar`/`bg`
  1,05 ; Atelier 1,22, 1,12, et `bar` = `panel`.

## 4. Voisinages de teintes (ΔE, sous 8 on confond)

- Avertissement ↔ accent : **6,7** (Forge), **3,8** (Atelier, braise lisible)
  — gardé (décision 12), le libellé porte l'état. Avant : 10,7 et 29,4.
- Légendaire ↔ braise lisible, en Atelier : **2,2**. Le légendaire est orange
  dans le jeu et la braise aussi : on ne touche pas une couleur du jeu. Une
  rareté se lit avec son nom ou sa bannière, jamais à la seule couleur.
- Braise ↔ Feu : 9,7 (Forge), 8,8 (Atelier) — distincts.

## 5. Autres changements

- `src/hooks/useTheme.ts` (permis, nommé dans la section R1 avant le code) :
  sous-titres « encre froide » → « encre chaude », « accent cuivre » →
  « accent braise ». Le test des Paramètres (`ressources.test.tsx`) les fige :
  attente mise à jour, commentée.
- `scripts/chemins-interdits.mjs` : `useTheme.ts` ajouté à `PERMIS`.
- `design.md` : tables des surfaces, de l'accent et des rayons ; « Deux
  braises » ; avertissement assumé ; fonds doux ; tableau des éléments
  **réaligné sur le code**, dont il avait décroché avant le R1 (aucune couleur
  d'élément ne change).
- Défaut trouvé en route, commit à part (f119015d) : le test
  `refonte-chemins-interdits` échouait depuis le lot 13 de la refonte.
- **Non fait, pour R3** : `--bs-accent-hover` n'a pas de jeton ; il n'a de sens
  qu'avec le survol des boutons de la librairie.

## 6. Vérifications

```text
npx tsc --noEmit                                → 0
node tests/run.mjs rendu refonte                → 827 vérifications passées
node scripts/inventaire-ui.mjs --verifier       → aucune perte
node scripts/chemins-interdits.mjs 6110609      → aucun modifié
npm run build                                   → built
node <scratchpad>/r1-css-construit.mjs          → tout est émis comme prévu
node scripts/spec-lint.mjs                      → aucune erreur
```

## 7. À regarder sur le serveur de dev (les deux thèmes)

Menu ⚙ → Thème → Clair puis Sombre, et sur chaque écran :

- barre latérale et barre du haut (fond `bar`) ;
- un filtre actif (Pastille) et un champ au focus : contour lisible en clair ;
- tabulation au clavier : anneau visible ;
- une pastille « à corriger » à côté d'un filtre actif (décision 12) ;
- les listes denses (runes, box, speed tuning) : Source Sans 3 a un œil plus
  petit qu'Inter à taille égale, à juger ;
- les courbes de runes : trait de visée.

## 8. Ce que je n'ai pas pu prouver

- **Le rendu à l'œil** : pas de navigateur piloté ici. Mesures et CSS construit
  prouvent les valeurs, pas l'impression d'ensemble.
- **L'effet de Source Sans 3 sur les mises en page serrées** : une police plus
  étroite ne devrait rien faire déborder, mais une troncature ou un retour à la
  ligne décalé ne se voit qu'à l'écran.
- **Les 70 contours d'accent** passent tous à la braise lisible, sans tri un à
  un : elle tient 3:1 partout, donc un contour purement décoratif n'y perd rien.

## 9. Retour de Thomas — « ça me paraît pâle » (2026-09-29)

Capture : les camps du speed tuning, en Forge. Cause : les fonds doux fondus à
12 % dans `panel`. La sémantique de la toile est pastel ; fondue dans un fond
brun, elle donnait des gris à peine teintés. Chroma OKLCH, avant → 12 % :
`good-soft` 0,026 → 0,013, `bad-soft` 0,032 → 0,019.

Correction : chaque fond doux prend la plus vive de deux constructions — le
12 %, ou la chroma et l'écart de clarté de l'ancien fond doux reportés sur le
nouveau `panel`, dans la teinte de la toile (`r1-doux-chroma.mjs`).

| Fond doux | Forge | Atelier |
|---|---|---|
| `accent-soft` | 12 % gardé, `#3D2C1F` | 12 % gardé, `#FFEDDD` |
| `good-soft` | `#32362F` → `#253024` | `#E6EBE1` → `#E3F1E3` |
| `warn-soft` | `#3D3025` → `#402D1F` | `#F3E7DB` → `#FFE7D8` |
| `bad-soft` | `#3A2D2D` → `#372324` | `#F4E4E1` → `#F8E4E3` |
| `el-*-soft` | 12 % gardé pour le vent, chroma d'avant pour les autres | 12 % gardé pour le feu et le vent |

Mesures (`r1-doux-mesure.mjs`) : encre 9,71 au pire (Forge), 13,99 (Atelier) ;
`good` sur `good-soft` 8,03 / 5,48, `bad` sur `bad-soft` 5,60 / 5,65.
⚠️ **Ce correctif répondait à une lecture fausse du retour** : Thomas parlait
du vert et du rouge eux-mêmes (§ 10), pas de leurs fonds. Il est gardé : il
va dans le même sens, et les fonds recalculés suivent la teinte, qui ne
change pas au § 10.

## 10. Le vert et le rouge de Forge — décision 13

« Je parlais du vert et du rouge. » Mesures (`r1-vert-rouge.mjs`) : le vert de
la toile est surtout très CLAIR (L 0,816, C 0,095 ; l'ancien L 0,743, C 0,110).
À clarté égale, le gamut permet 0,276. Retenu : même clarté, même teinte,
chroma à mi-chemin du maximum.

| Jeton Forge | Toile | Retenu | Pire contraste | ΔE braise | ΔE Feu |
|---|---|---|---|---|---|
| `good` | `#9FD39A` (C 0,095) | `#73E06B` (C 0,186) | 8,12 → 8,35 | 28,6 | 34,5 |
| `bad` | `#E5848A` (C 0,119) | `#F27A84` (C 0,147) | 5,30 → 5,23 | 10,1 | 7,8 |

Écartée : ramener le rouge vers le corail de l'ancien (`#EF7F73`) — ΔE 7,7
avec la braise. L'ancien rouge n'était qu'à 4,7 du Feu.

Sur leurs fonds doux : `good` 8,25, `bad` 5,53. **Défaut trouvé en route** :
le bouton danger plein écrivait en blanc, et le blanc sur le rouge de Forge
tombait déjà à 2,63 avec la toile (3,03 avec l'ancien) — la croix « Retirer »
d'une carte RTA, sous le 3:1 d'une icône. Nouveau jeton `bad-ink`, le pendant
d'`accent-ink` : sombre en Forge (6,53), blanc en Atelier (6,91) ;
`Bouton.tsx` l'utilise pour `danger` / `plein`. Atelier : vert et rouge
inchangés.

Vérifié : tsc ; `node tests/run.mjs rendu refonte ui` → 848 ; inventaire sans
perte ; chemins interdits ; build (`.text-bad-ink` émis, `--forge-good: 115
224 107`, `--forge-bad: 242 122 132`).
