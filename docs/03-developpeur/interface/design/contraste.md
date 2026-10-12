# Système visuel — contraste

Partie de [Système visuel](README.md).

## Contraste — mesuré, jamais estimé

⚠️ **Toute valeur de couleur se vérifie au ratio WCAG avant d'être posée.** Le
premier jet du thème clair « paraissait » correct : à la mesure, `ink-dimmer`
était à 2,65, le vent à 3,39 et `star` — qui porte les maxima d'efficience — à
3,14. Rien de tout cela ne se voit à l'œil sur un écran calibré.

| Rôle | Seuil | Tenu par |
|------|-------|----------|
| Texte courant | **4,5** | `ink`, `ink-dim`, `ink-dimmer`, `accent-lisible`, `good`, `warn`, `bad`, `star` |
| Couleurs d'élément | **4,5** | les six, sur `panel` (voir l'arbitrage plus bas) |
| Bordure porteuse de sens | **3,0** | `accent-lisible` (champ actif, sélection, focus) |
| Aplat | *son libellé* | `accent` (bouton plein : `accent-ink` dessus, 6,66) |
| Bordure décorative | *aucun* | `border`, `border-soft` |

**Les trois surfaces comptent.** Un token doit passer sur `bg`, `panel` **et**
`panel2` — c'est `bg` la plus exigeante en thème clair, `panel2` en sombre.

### Le ratio ne suffit pas : la saturation aussi

⚠️ **Un ratio conforme ne garantit pas qu'on voie la couleur.** WCAG mesure la
luminance, pas la présence d'une teinte. Le vent est passé à 5,12 sur blanc tout
en restant pâle et indistinct — conforme, invisible.

Les couleurs d'élément visent donc **deux critères** : ratio ≥ 4,5 **et**
saturation ≥ 45 %. Assombrir une couleur vers le gris satisfait le premier et
trahit le second ; il faut saturer, pas seulement foncer.

| Élément | Clair | Sombre | Note |
|---------|-------|--------|------|
| Feu | 85 % | 77 % | — |
| Eau | 100 % | 74 % | — |
| Vent | 100 % | 79 % | Jaune franc, jamais kaki |
| Lumière | 70 % | 17 % | Doré en clair ; en sombre c'est du blanc, la couleur du jeu |
| Ténèbres | 68 % | 71 % | — |
| Inconnu | 17 % | 16 % | Gris par nature — un monstre non identifié |

⚠️ **Vent et Lumière : arbitrage assumé.** Un jaune reste jaune tant qu'il est
clair ; l'assombrir jusqu'à 4,5 sur `bg` le fait virer au kaki, et le joueur ne
reconnaît plus son élément. On tient donc **4,5 sur `panel`** — la surface des
cartes et des listes, où ces libellés apparaissent réellement — et on accepte
moins sur `bg`, qui ne porte quasiment aucun texte d'élément : ~3,6 sur
l'ancien fond, 4,29 au lot 14, **4,08 depuis le rebranding** (fond de papier
chaud ; 3,74 sur `panel2`). Ce sont des libellés courts et gras, pas du texte
courant. Même tolérance pour les paliers du résumé de compte et pour le laiton
(`star`, 4,79 sur `panel`, 3,93 sur `panel2`).
**Règle gardée au rebranding** (décision 8) : 4,5 sur `panel`, rien de plus.
Sur les fonds de la toile, elle n'a fait bouger que deux paliers, d'un
cheveu : `pal-1` en Atelier (4,47 → 4,53) et `pal-6` en Forge (3,35 → 4,52).

### Les trois surfaces se distinguent deux à deux

`panel2` sert **à la fois** de fond enfoncé sur `panel` (détail de rune, piste de
barre) et de surface posée sur `bg`. Il lui faut donc un écart perceptible avec
les deux — ni confondu avec le blanc, ni avec le fond de page.

| Paire | Forge | Atelier |
|-------|-------|---------|
| `panel2` / `panel` | 1,15 | 1,22 |
| `panel2` / `bg` | 1,31 | **1,09** (1,04 au lot 14) |
| `panel` / `bg` | 1,14 | **1,12** |

(Valeurs du rebranding R1.)

C'est ce qui manquait quand le détail d'une rune « semblait n'avoir aucun fond » :
`panel2` était à 1,08 de `panel` — l'écart `panel2` / `panel` est tenu.
⚠️ **Arbitrage du lot 14** : avec les fonds neutres et clairs de la maquette,
`panel2` ne se distingue presque plus de `bg`. Une surface `panel2` posée
directement sur la page est séparée par sa BORDURE, pas par son fond — le
choix de la maquette, retenu par le mainteneur. De même, une carte `panel` ne se
détache du fond qu'à 1,08 au lot 14 (1,28 avant), 1,12 depuis le rebranding :
un papier clair sur un papier chaud, avec son contour.

### Raretés : deux couleurs, deux usages

`RARITY_META` ([effects.ts](../../../../src/lib/effects.ts)) porte **deux** couleurs
par rareté, parce qu'elles servent à deux choses :

- **`color`** — la couleur vive du jeu, posée sur la **bannière** dont le fond
  est un dégradé sombre dans les deux thèmes. Elle ne change jamais.
- **`ink`** — la couleur de **texte** sur un panneau (valeur d'efficience d'une
  tuile, légende du résumé). Elle suit le thème via `--rarity-1..5`.

⚠️ Utiliser `color` comme couleur de texte est le bug qu'il faut éviter : le vert
magique `#7cf0a6` sur fond blanc est illisible.

⚠️ **`border` et `border-soft` sont volontairement sous 3,0** (depuis le
rebranding, les deux bordures de la toile : en clair `border` 1,50 à 1,83,
`border-soft` 1,13 à 1,37 ; en sombre 1,86 à 2,44 et 1,18 à 1,54 —
`border-soft` pour les cadres, `border` un cran plus marquée pour qu'on voie
où taper). Ce
seuil vaut pour un contour qui *porte une information* — un champ de saisie, un
élément sélectionné. Une bordure de carte est décorative : la monter à 3,0
quadrillerait une interface qui affiche 60 tuiles par écran. Ce qui distingue
une carte, c'est sa surface (`panel` sur `bg`), pas son trait.

### Une seule source par thème

Les valeurs de Forge vivent dans des variables `--forge-*` déclarées **une fois**,
que les deux déclencheurs (media query et `[data-theme="dark"]`) se contentent de
référencer.

⚠️ **Ne jamais recopier la liste dans les deux blocs.** Elle l'a été, et les
copies ont divergé en une seule session : le thème forcé gardait des couleurs
sous le seuil pendant que celui du système était corrigé. Un thème qui change
selon la façon dont on l'a activé est un bug indétectable à la lecture.
