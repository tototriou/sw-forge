# Système visuel — thèmes, tokens, échelles

> **Source de vérité** pour toute décision d'apparence. Une valeur qui n'est pas
> ici n'a pas à être écrite en dur dans un composant.

Ce document est né d'un constat : il n'existait aucune spec de design, et
l'interface le montrait — **248 couleurs en dur** dans le TSX, **21 tailles de
texte** de 9 px à 76 px, **aucune règle de focus**. Chaque composant réarbitrait
au pixel ce qu'aucun document ne fixait.

## Deux thèmes, jamais trois

| Thème | Nom | Quand |
|-------|-----|-------|
| Sombre | **Forge** | `prefers-color-scheme: dark` |
| Clair | **Atelier** | `prefers-color-scheme: light`, et défaut si non exprimé |

Le thème suit le navigateur **par défaut**, et se force depuis le menu ⚙
(`Auto` / `Clair` / `Sombre`, voir [Réglage](#réglage-du-thème)).

⚠️ **Le choix se stocke comme un réglage, pas comme une donnée.** Il s'écrit
toujours dans `localStorage`, même persistance refusée — comme le choix de
conservation lui-même et la mesure de score (voir
[README](../README.md#conventions-communes-toutes-les-pages)). Un thème oublié à
chaque visite serait un bug, pas une protection.

### Pourquoi deux directions nommées et pas une palette inversée

Une inversion mécanique produit un thème clair délavé : les gris qui portaient la
profondeur en sombre deviennent des gris sales sur blanc. Forge et Atelier sont
**deux systèmes cohérents chacun**, qui partagent leur structure de tokens mais
pas leurs valeurs.

- **Forge** — fond presque noir légèrement violacé, cuivre chaud en accent
  unique, données chiffrées en mono. Le métal chauffé, pas le feu de l'élément :
  le cuivre ne doit jamais se confondre avec le rouge de l'élément Feu.
- **Atelier** — fond clair, encre froide, indigo en accent. Lisible sur blanc,
  ce que le bleu nuit historique (`#4a52a0`) n'est pas.

## Tokens

Tous les tokens sont des **variables CSS** déclarées dans
[index.css](../../src/index.css), exposées à Tailwind par
[tailwind.config.js](../../tailwind.config.js). Un composant n'écrit jamais un
hexadécimal.

### Surfaces et encre

| Token | Forge (sombre) | Atelier (clair) | Rôle |
|-------|----------------|-----------------|------|
| `bg` | `#0c0b0f` | `#eceef3` | Fond de page |
| `panel` | `#16141b` | `#ffffff` | Carte, panneau |
| `panel2` | `#1e1b24` | `#f4f6fa` | Surface enfoncée (piste de barre, cadre de `Segmented`) |
| `border` | `#2e2a37` | `#d3d8e4` | Bordure standard |
| `border-soft` | `#241f2b` | `#e4e8f0` | Séparateur intérieur, ligne de table |
| `ink` | `#ede8e4` | `#1a1e2b` | Texte principal |
| `ink-dim` | `#948c9c` | `#636a80` | Texte secondaire, libellés |
| `ink-dimmer` | `#6a6373` | `#8c93a6` | Texte tertiaire (rare) |

### Accent et sémantique

| Token | Forge | Atelier | Rôle |
|-------|-------|---------|------|
| `accent` | `#d2723a` | `#3f4bb8` | Accent unique : état actif, focus, lien |
| `accent-soft` | `#d2723a1f` | `#3f4bb812` | Fond d'un élément actif |
| `good` | `#7fbe7f` | `#2f855a` | Au tick, gain, succès |
| `warn` | `#d9a441` | `#b7791f` | Avertissement |
| `bad` | `#cf5b4e` | `#c53030` | Hors tick, destructif, erreur |

⚠️ **La sémantique n'est pas l'accent.** `good`/`warn`/`bad` disent un état des
données ; `accent` dit « ceci est actif ou sélectionné ». Les confondre rend un
filtre actif indiscernable d'une alerte.

### Éléments — deux valeurs par élément

Les couleurs d'élément sont du **vocabulaire Summoners War**, pas du style : un
joueur les lit sans réfléchir. Elles ne peuvent donc ni disparaître, ni changer
de teinte.

Mais le Vent (`#E7C22E`) et la Lumière (`#EAEBF0`) sont **illisibles sur fond
clair** — contraste sous 2:1. Chaque élément porte donc **deux valeurs, même
teinte, luminosité adaptée** :

| Élément | Forge (sombre) | Atelier (clair) | Note |
|---------|----------------|-----------------|------|
| Feu | `#E4463A` | `#c23528` | — |
| Eau | `#2FA0E0` | `#1d7fb8` | — |
| Vent | `#E7C22E` | `#a8880f` | ⚠️ Ocre profond : le jaune vif est illisible sur blanc |
| Lumière | `#EAEBF0` | `#8a7f5c` | ⚠️ Doré grisé : le blanc n'existe pas sur blanc |
| Ténèbres | `#A15FE0` | `#7c3fbd` | — |
| Inconnu | `#5B6280` | `#767d94` | — |

⚠️ **La teinte est conservée, jamais remplacée.** Le Vent reste jaune-ocre, il ne
devient pas vert. Un joueur qui repère ses monstres Vent à la volée dans une
liste dense doit continuer à le faire.

Les icônes officielles (`public/elements/`) restent **inchangées** dans les deux
thèmes : ce sont des images du jeu, elles portent leur propre fond.

### Trois familles, trois rôles stricts

| Famille | Police | Rôle | Usages |
|---------|--------|------|--------|
| `font-display` | **Cinzel** | Titres et héros | ~26 |
| `font-body` | **Inter** | Tout le texte, **libellés compris** | défaut |
| `font-mono` | **JetBrains Mono** | **Chiffres uniquement** | ~96 |

⚠️ **La mono ne sert qu'à ce qui s'aligne.** Efficiences, vitesses, ticks,
compteurs — des colonnes qu'on compare d'une ligne à l'autre. `tabular-nums` est
posé d'office sur `.font-mono` : sans lui, un « 1 » plus étroit décale toute une
colonne.

⚠️ **JetBrains Mono, pas Space Mono.** Space Mono a des chiffres larges et mous,
illisibles en 11 px — or c'est la taille à laquelle on lit une efficience dans
une liste de 60 tuiles. JetBrains Mono est dessinée pour le petit corps :
hauteur d'x haute, zéro barré, `1` à empattement.

### Le libellé en capitales : une classe, pas un motif

Le motif `font-mono text-[11px] tracking-[0.1em] uppercase text-ink-dim` était
répété **55 fois**, à sept tailles différentes. Il devient la classe `.label`.

⚠️ **En Inter, pas en mono.** Une mono en capitales espacées est large et molle
à 11 px — c'est ce qui donnait cette impression de flou dans les zones denses.
Inter en demi-gras est plus net et plus compact à taille égale.

### Échelle typographique — six paliers, plancher à 11 px

| Token | Taille | Usage |
|-------|--------|-------|
| `micro` | 11 px | Libellés mono en capitales, sous-titres de KPI |
| `xs` | 12 px | Texte secondaire, corps de tuile |
| `sm` | 13 px | Texte courant dense (tables, cartes) |
| `base` | 15 px | Texte courant |
| `lg` | 17 px | Titre de section |
| `xl` | `clamp(22px, 3vw, 30px)` | Titre de page |

⚠️ **Plancher à 11 px, sans exception.** Les `text-[9px]` et `text-[10px]`
existants remontent à 11 px. En dessous, l'écart ne crée pas de hiérarchie : il
crée du flou.

⚠️ **Pas de demi-pixel.** Les paliers 10.5, 11.5, 12.5, 13.5 et 14.5 px
disparaissent. Un écart de 0,5 px entre deux libellés voisins ne se lit pas comme
une intention, il se ressent comme un défaut d'alignement.

Le héros de l'accueil garde son `clamp()` propre : c'est un titre d'affiche, pas
un palier de l'échelle.

### Rayons

| Token | Forge | Atelier |
|-------|-------|---------|
| `radius` | 3 px | 5 px |
| `radius-lg` | 4 px | 7 px |

Forge assume l'angle vif (le métal, la frappe) ; Atelier reste légèrement adouci.

### Mouvement

| Token | Valeur | Usage |
|-------|--------|-------|
| `--ease-out` | `cubic-bezier(.23, 1, .32, 1)` | Entrées, sorties, pression |
| `--ease-in-out` | `cubic-bezier(.77, 0, .175, 1)` | Déplacement à l'écran |

⚠️ **Jamais `ease-in` sur un élément d'interface** : il démarre lentement, à
l'instant précis où l'utilisateur regarde. Une même durée paraît plus lente.

Durées : pression 150 ms · infobulle 125 ms · popover 150 ms · modale 200 ms.
**Rien au-dessus de 300 ms** dans l'interface.

⚠️ **`prefers-reduced-motion: reduce`** coupe les **déplacements** et les boucles
infinies (les cinq icônes d'élément de l'accueil), **garde les fondus** — un
mouvement réduit reste un mouvement, pas une absence de retour.

## Contraste — mesuré, jamais estimé

⚠️ **Toute valeur de couleur se vérifie au ratio WCAG avant d'être posée.** Le
premier jet du thème clair « paraissait » correct : à la mesure, `ink-dimmer`
était à 2,65, le vent à 3,39 et `star` — qui porte les maxima d'efficience — à
3,14. Rien de tout cela ne se voit à l'œil sur un écran calibré.

| Rôle | Seuil | Tenu par |
|------|-------|----------|
| Texte courant | **4,5** | `ink`, `ink-dim`, `ink-dimmer`, `accent`, `good`, `warn`, `bad`, `star` |
| Couleurs d'élément | **4,5** | les six, sur `bg` **et** `panel` |
| Bordure porteuse de sens | **3,0** | `accent` (champ actif, sélection) |
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
~3,6 sur `bg`, qui ne porte quasiment aucun texte d'élément. Ce sont des
libellés courts et gras, pas du texte courant.

### Les trois surfaces se distinguent deux à deux

`panel2` sert **à la fois** de fond enfoncé sur `panel` (détail de rune, piste de
barre) et de surface posée sur `bg`. Il lui faut donc un écart perceptible avec
les deux — ni confondu avec le blanc, ni avec le fond de page.

| Paire | Écart |
|-------|-------|
| `panel2` / `panel` | 1,12 |
| `panel2` / `bg` | 1,15 |

C'est ce qui manquait quand le détail d'une rune « semblait n'avoir aucun fond » :
`panel2` était à 1,08 de `panel`.

### Raretés : deux couleurs, deux usages

`RARITY_META` ([effects.ts](../../src/lib/effects.ts)) porte **deux** couleurs
par rareté, parce qu'elles servent à deux choses :

- **`color`** — la couleur vive du jeu, posée sur la **bannière** dont le fond
  est un dégradé sombre dans les deux thèmes. Elle ne change jamais.
- **`ink`** — la couleur de **texte** sur un panneau (valeur d'efficience d'une
  tuile, légende du résumé). Elle suit le thème via `--rarity-1..5`.

⚠️ Utiliser `color` comme couleur de texte est le bug qu'il faut éviter : le vert
magique `#7cf0a6` sur fond blanc est illisible.

⚠️ **`border` et `border-soft` sont volontairement sous 3,0** (1,3 à 2,2). Ce
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

## Règles transverses

### Focus — une règle globale, pas 24 exceptions

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

⚠️ **`outline-none` est interdit sans remplacement visible.** L'app comptait 24
`outline-none` et zéro `focus-visible` : en tabulant, on ne savait jamais où on
était.

### Survol — toujours derrière une media query

```css
@media (hover: hover) and (pointer: fine) { … }
```

Exposé en variante Tailwind **`hoverable:`**. ⚠️ Un `hover:` nu reste allumé
après un tap au tactile : on croit avoir sélectionné quelque chose.

### Pression

Tout élément cliquable porte `active:scale-[0.97]` avec
`transition-transform duration-150`. Un bouton qui ne bouge pas au clic laisse un
doute d'un dixième de seconde.

### Un élément atteignable ne dépend jamais du survol

⚠️ **`hidden group-hover:*` est interdit** sur un contrôle. L'élément sort du
flux : il n'est ni focusable au clavier, ni atteignable au doigt. Utiliser
`opacity-0 hoverable:group-hover:opacity-100 focus-visible:opacity-100`, et le
laisser visible sous `(hover: none)`.

C'est ce qui rendait le bouton « Retirer » d'une carte RTA **impossible à
actionner sur téléphone**.

## Réglage du thème

Dans le menu ⚙ ([SettingsMenu.tsx](../../src/components/SettingsMenu.tsx)), un
`<Setting>` « Thème » avec un `<Segmented>` à trois options :

| Option | Comportement |
|--------|--------------|
| **Auto** (défaut) | Suit `prefers-color-scheme`, et **change à chaud** si le système bascule |
| **Clair** | Force Atelier |
| **Sombre** | Force Forge |

⚠️ **Trois états, pas un interrupteur.** Un binaire clair/sombre force à choisir
une valeur qui cesse alors de suivre le système : quelqu'un dont le téléphone
bascule le soir perdrait ce comportement sans l'avoir demandé.

Le thème s'applique par un attribut `data-theme` sur `<html>` (`light` / `dark`),
posé **avant la première peinture** par un script inline dans `index.html` —
sinon la page apparaît dans le mauvais thème le temps d'un frame.

## Ce que ce document ne couvre pas

- **Le responsive.** Chantier séparé et assumé (voir
  [README](../README.md#conventions-communes-toutes-les-pages)). Les tokens ci-dessus
  sont indépendants de la largeur.
- **Les icônes du jeu** (`public/elements/`, `public/icons/`,
  `public/leader-skills/`) : ce sont des ressources Com2uS, hors système visuel.
- **Les couleurs de rareté de rune** (`RARITY_META` dans
  [effects.ts](../../src/lib/effects.ts)) : vocabulaire du jeu, comme les
  éléments. Elles suivront la même logique deux-valeurs si un besoin apparaît.
