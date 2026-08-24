# Système visuel — thèmes, tokens, échelles

> ⚠️ **Ce document décrit le système visuel COMMUN aux deux formats** (couleurs,
> échelle typographique, animations). La façon dont chaque écran l'emploie, elle,
> diffère entre mobile et bureau — voir
> [deux-applications.md](deux-applications.md), qui prime en cas de doute.

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
| `good` | `#7fbe7f` | `#2f855a` | Au tick, gain, succès — et **ton camp** |
| `good-soft` | `#1b2a21` | `#e2f4e9` | Fond doux de `good` |
| `warn` | `#d9a441` | `#b7791f` | Avertissement |
| `bad` | `#cf5b4e` | `#c53030` | Hors tick, destructif, erreur |
| `bad-soft` | `#301c20` | `#fae6e6` | Fond doux de `bad` — le pendant d'`accent-soft` |

⚠️ **`good-soft` et `bad-soft` comblent un AXE, pas une variante de plus** :
l'accent et les éléments avaient leur fond doux, la sémantique non. Ils vont par
PAIRE et servent à **opposer deux camps** (speed tuning : `good` = ton équipe,
`bad` = en face) là où une transparence ne convient pas — une colonne collante
passe par-dessus le tableau qui défile dessous, il lui faut un fond SOLIDE.

⚠️ **Deux camps, c'est de la SÉMANTIQUE, pas de l'accent.** L'accent dit « ceci
est actif ou sélectionné » — il ne dit pas à qui appartient une ligne. Et sur le
thème Forge il est cuivre : « ton équipe » y virait à l'orange, à un cheveu du
`warn` d'à côté. `good`/`bad` disent l'état de la donnée, et `bad` portait déjà
« ce qui te coupe » : la paire se referme d'elle-même.

⚠️ **La sémantique n'est pas l'accent.** `good`/`warn`/`bad` disent un état des
données ; `accent` dit « ceci est actif ou sélectionné ». Les confondre rend un
filtre actif indiscernable d'une alerte.

### Rayon intérieur : `rounded-lg-inner`

⚠️ **Un enfant à FOND PLEIN collé au bord d'un panneau arrondi doit rentrer d'un
pixel.** À rayon égal, son fond déborde dans l'arrondi et le coin redevient
carré — c'est visible dès que l'enfant est teinté (bandeau de titre d'une carte,
colonne collante d'un tableau).

`rounded-lg-inner` vaut `calc(var(--radius-lg) - 1px)` : le rayon du panneau
moins son contour. Il suit les deux thèmes tout seul (7 px en Atelier, 6 px en
Forge).

⚠️ **`overflow-hidden` sur le parent n'est PAS la solution** : il règle le coin
mais coupe les menus flottants, qui se placent en `absolute` à l'intérieur du
panneau.

### UN SEUL marqueur de sélection

⚠️ **Un élément sélectionné porte UN marqueur, jamais deux.** L'app cumulait
jusqu'à quatre signaux pour dire une seule chose — `bg-accent-soft` +
`border-accent` + `text-accent` + `shadow`. Le résultat est une zone qui se
surligne elle-même deux fois : on ne lit plus « c'est sélectionné », on voit un
empilement qui bave sur ses voisins, et l'écran devient bruyant dès que trois
filtres sont posés.

**Le marqueur dépend du support** — un seul dans les deux cas :

| Support | Marqueur | Pourquoi pas l'autre |
|---------|----------|----------------------|
| **Champ de saisie** (`select`, `input`, `textarea`) | `border-accent` | Un fond coloré passe derrière du texte qu'on doit lire, et concurrence le curseur |
| **Pastille de filtre** (chip, cran de `Segmented`, onglet) | `border-accent bg-accent-soft` | Le marqueur unique de l'app : le contour porte l'état, le fond l'appuie. Un cran dans un cadre commun (`SlotFilter`, `Segmented`) peut n'en garder que le fond, la bordure étant déjà celle du cadre |

⚠️ **Les pastilles voisines partagent le même marqueur.** Les numéros de
`SlotFilter`, le bouton « Antiques » et les filtres de Ma box (Nat / Doublons /
2A) portent tous le **même fond d'accent** — deux marqueurs différents côte à
côte se liraient comme deux natures de filtre. C'est la brique `Pastille`
([librairie-ui.md](librairie-ui.md)), qui pose ce marqueur une fois pour toutes.

**Corollaires :**

- ⚠️ **`shadow` n'est JAMAIS un marqueur d'état.** L'ombre dit l'élévation — ce
  qui flotte au-dessus du reste. Un filtre actif ne décolle pas de la page. Elle
  reste donc aux popovers, menus et dialogues, et disparaît des états actifs.
- ⚠️ **`text-accent` ne se cumule pas avec un fond.** Sur `accent-soft`, l'encre
  d'accent perd du contraste au lieu d'en gagner : le libellé d'un élément
  sélectionné devient moins lisible que ses voisins non sélectionnés. Le texte
  passe à `ink` sur fond actif.
- ⚠️ **Le marqueur d'état est UNIQUE : `border-accent bg-accent-soft text-ink`**
  — un contour d'accent et un fond très léger. Le contour porte l'état, le fond
  ne fait que l'appuyer : `accent-soft` seul ne se voyait pas, étant un fond de
  panneau trop proche du gris ambiant.
  ⚠️ Il a remplacé un **dégradé doré plein** sur les filtres d'étoiles, les
  pastilles de tick et les filtres de la box. Celui-ci criait plus fort que le
  réglage ne le mérite, et faisait surtout **deux vocabulaires selon l'écran** —
  un filtre actif ne doit pas se lire différemment ici et là.
  **Deux exceptions**, qui n'en sont pas vraiment :
  - La **case à cocher** d'un dialogue (15 px) garde son remplissage plein : un
    contour de 1 px y disparaît, et une case cochée se lit par son remplissage.
  - Les boutons de **lead SPD** (ordre de tour) gardent le doré : ce n'est pas un
    marqueur d'état mais le **code couleur du lead** lui-même, celui de
    `LeadPill`.
- Le **survol** garde `hoverable:border-accent` sur les contrôles à fond : il
  agit au repos, quand aucun marqueur n'occupe la bordure — il n'y a donc pas de
  cumul.

**Focus mis à part.** L'anneau `:focus-visible` (voir plus bas) n'est pas un
marqueur de sélection mais la position du clavier — les deux peuvent coexister
sur un même élément. C'est justement pour qu'ils restent distinguables que
l'état sélectionné n'a droit qu'à un seul signal : quand la bordure d'accent
d'un `select` posé se doublait de l'anneau d'accent à 2 px, on lisait un seul
halo épais au lieu de deux informations.

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

⚠️ **Framer Motion ne lit pas les variables CSS** dans son champ `ease`. Les
courbes s'y écrivent donc en points de Bézier — `[0.23, 1, 0.32, 1]`, la
constante `EASE_OUT` de l'accueil — et **jamais** en `'easeOut'` natif, qui est
plus mou : la page démarrait sur une courbe que rien d'autre dans l'app
n'utilise. Seule exception : `easeInOut` sur une **boucle** de va-et-vient (les
icônes qui flottent), où l'aller-retour doit ralentir aux deux extrémités.

Durées : pression 150 ms · infobulle 125 ms · popover 150 ms · modale 200 ms.
**Rien au-dessus de 300 ms** dans l'interface.

⚠️ **`prefers-reduced-motion: reduce`** coupe les **déplacements** et les boucles
infinies (les cinq icônes d'élément de l'accueil), **garde les fondus** — un
mouvement réduit reste un mouvement, pas une absence de retour.

#### Ce qui s'anime, et ce qui ne s'anime pas

⚠️ **La fréquence décide.** Ce qu'on voit cent fois par jour ne s'anime pas :
l'animation y ajoute une attente à chaque passage, et une interface qu'on
connaît par cœur doit répondre instantanément. Ce qui est occasionnel peut
s'annoncer.

| Fréquence | Décision | Exemples ici |
|-----------|----------|--------------|
| Permanent, à chaque frappe | **Aucune animation** | Liste de résultats du `MonsterPicker`, tuiles de rune et d'artéfact, filtres |
| Fréquent | Retour immédiat seulement | Pression au clic (150 ms), survols |
| Occasionnel | Entrée animée | Menus, popovers, dialogues, retour d'import |

Quatre keyframes, déclarés une fois dans `index.css` :

| Keyframe | Mouvement | Pour |
|----------|-----------|------|
| `popover` | fondu + `scale(.96)` | Menus et popovers **ancrés** |
| `voile` | fondu seul | Le fond d'un dialogue |
| `dialogue` | fondu + 8 px + `scale(.98)` | La boîte d'un dialogue |
| `apparition` | fondu + 4 px | Un message ou un bloc qui se pose **en place** |

- ⚠️ **Un flottant ancré grandit depuis SON ANCRE**, jamais depuis son centre :
  `origin-top-left`, ou `origin-top-right` s'il est calé à droite. Sorti du
  centre, on cherche des yeux une origine qui ne correspond à rien.
- ⚠️ **La boîte de dialogue fait exception** et reste centrée : elle n'a pas
  d'ancre, elle ne sort d'aucun bouton.

### ⚠️ Un clic ne déplace JAMAIS ce qu'on vient de cliquer

**Règle globale, mobile et bureau.** Quand une action ouvre quelque chose — le
détail d'une rune, la grille de monstres d'une catégorie, un panneau dépliant —
l'élément **sur lequel on a cliqué reste exactement où il était**. On doit
pouvoir basculer l'état plusieurs fois d'affilée **sans bouger la souris ni le
regard**.

Ce que cela interdit :

| Motif | Pourquoi il déplace |
|-------|---------------------|
| Insérer le détail **au-dessus** de la ligne cliquée | Tout ce qui est en dessous descend, la ligne cliquée avec |
| Faire pousser un conteneur qui **précède** la cible dans le flux | Même effet, un cran plus haut |
| Ouvrir un panneau qui **change la hauteur de la page** et fait défiler | Le pointeur ne vise plus rien |
| Réserver la place **seulement quand c'est ouvert** | La réservation arrive trop tard : le saut a déjà eu lieu |

Ce que cela impose — trois réponses, dans cet ordre de préférence :

1. **La place est réservée d'avance.** Le détail d'une rune a sa colonne (ou son
   bloc) présente en permanence, vide tant qu'on n'a rien choisi. Ouvrir ne fait
   que la remplir. ⚠️ C'est la seule réponse qui tient quand on **enchaîne** les
   clics d'un élément à l'autre : la place ne change pas d'une rune à la suivante.
2. **Ce qui s'ouvre sort du flux** — un flottant ancré, un dialogue, un panneau
   mobile. Rien de ce qui est en dessous ne bouge, parce que rien n'est poussé.
3. **Ce qui s'ouvre pousse vers le BAS uniquement**, jamais vers le haut, et
   l'ancre reste au-dessus du point d'insertion (un accordéon dont l'en-tête ne
   bouge pas).

⚠️ **Le tactile n'en est pas dispensé.** Le doigt ne « reste » pas sur sa cible,
mais l'écran, lui, saute.

⚠️ **La réponse n° 3 est souvent la bonne au doigt**, et la n° 2 souvent la
mauvaise : un flottant ancré s'ouvre exactement là où le doigt vient de se poser,
et la main masque ce qu'on voulait lire. Le détail d'une rune se pose donc SOUS
la roue au doigt, et dans un flottant ancré à la souris — même composant, deux
placements.

⚠️ **Attention à ce qui CONTIENT la cible.** Un panneau collé au bas de l'écran
ne peut grandir que vers le haut : déplier quoi que ce soit dedans remonte tout
son contenu, alors même que ce qui s'ouvre est bien placé — en dessous de ce
qu'on a touché. C'est ce qui se passait en choisissant les monstres d'une
catégorie RTA depuis « Options ». Le panneau lui-même était bon ; c'est le tiroir
qui bougeait. **`MobileSheet` fige donc sa hauteur à l'ouverture** (mesure en
`useLayoutEffect`) : le bord supérieur ne bouge plus, et un contenu qui grandit
se lit en faisant défiler.

⚠️ **Ne pas confondre avec « le contenu ne change pas ».** Le contenu *doit*
changer, et peut s'animer (voir plus haut) ; c'est la **géométrie autour de la
cible** qui est figée.

### ⚠️ Un bouton d'action ne disparaît jamais — il se désactive

Un bouton dont l'existence dépend des données (« Tout exporter » sans rien à
exporter, « Tout effacer » sans rien à effacer, « Analyser » sans compte
importé) reste **toujours affiché**, et se pose en `disabled` avec un `title`
qui dit pourquoi — il ne sort jamais du rendu conditionnel `{condition &&
<Bouton />}`.

⚠️ **Un bouton qui apparaît une fois qu'on a de quoi l'utiliser surprend** : on
ne l'a jamais vu apparaître d'un geste volontaire, il était juste absent, et
rien n'explique d'où il sort. Désactivé, c'est un repère fixe de l'interface —
on sait que l'action existe, juste pas encore qu'elle s'applique.

Cette règle vaut pour les **boutons d'action**, pas pour tout ce qui se
rend conditionnellement :
- **Les changements de MODE restent conditionnels** — un panneau d'édition qui
  remplace un contrôle par un autre (le titre d'une recommandation devient un
  champ de saisie) n'est pas la même nature de disparition.
- **Un bloc de filtre/recherche entier** peut rester absent d'une page vide,
  si ce choix est documenté et réfléchi (voir « UN SEUL bloc de filtres » dans
  [rta/categories.md](../rta/categories.md) et
  [siege/recommandations.md](../siege/recommandations.md)) : un filtre
  au-dessus d'une liste vide n'a rien à filtrer, et laisse parfois croire
  qu'on n'a rien trouvé alors qu'il n'y a rien.

### Ce qui se confirme, et ce qui ne se confirme pas

⚠️ **Un geste se confirme quand ce qu'il détruit ne se retrouve pas.** Le critère
n'est pas le mot « supprimer » sur le bouton, c'est le coût de l'erreur.

**Se confirme** — la donnée est saisie à la main et perdue sans retour :

| Geste | Ce qui part |
|-------|-------------|
| Retirer un monstre d'une prépa RTA ou d'un slot de siège | Sa vitesse saisie, son tick, son classement |
| Supprimer un monstre créé à la main | Le monstre entier : il n'existe pas dans les données du jeu |
| Supprimer une section RTA | Le classement — les monstres, eux, reviennent en « Non classé » |
| Supprimer / vider une catégorie | L'appartenance, cochée un monstre à la fois |
| Supprimer une équipe, un deck, une recommandation | Leur composition |
| Effacer les données du compte | Tout |

**Ne se confirme PAS** — l'état se repose en un geste :

| Geste | Pourquoi |
|-------|----------|
| Effacer un filtre (sets, slots, éléments) | Un clic pour le reposer |
| Vider une recherche | Idem |
| Retirer un critère de recherche | C'est un critère, pas une donnée |
| Retirer un lead de l'ordre de tour | Il revient en le retapant |
| Retirer un set d'une combinaison en édition | Le geste EST le sujet de l'écran |

⚠️ **Confirmer partout est pire que ne confirmer nulle part.** À force d'en voir,
on valide sans lire — et celle qui compte vraiment passe inaperçue. Deux clics
pour annuler un filtre useraient la patience qu'on veut garder pour l'effacement
d'une prépa.

### Bloquer le défilement derrière un flottant

⚠️ **Par `useScrollBloque`, jamais à la main.** Chaque composant mémorisait la
valeur d'`overflow` à son ouverture pour la restaurer à sa fermeture. Avec un
seul flottant, cela marche ; imbriqués, non :

1. le panneau d'actions s'ouvre, mémorise `''`, pose `hidden` ;
2. une confirmation s'ouvre par-dessus, mémorise `hidden`, repose `hidden` ;
3. on confirme — le panneau se ferme d'abord et restaure `''` ;
4. le dialogue se ferme ensuite et restaure… `hidden`.

La page restait bloquée, **sans qu'aucun flottant ne soit visible pour
l'expliquer**. Le hook tient un compteur : le blocage tombe quand le dernier
verrou est relâché, jamais avant, jamais après — et le résultat ne dépend plus de
l'ordre de démontage.

### L'échelle des plans

⚠️ Deux éléments au **même `z-index`** se départagent par leur ordre dans le
DOM — celui monté en dernier passe devant. C'est ainsi qu'une confirmation
ouverte depuis le panneau d'actions se retrouvait **derrière lui** : tous deux à
`z-50`, et le panneau monté après. On cliquait « Supprimer », rien ne semblait se
produire, et le geste paraissait dépourvu de confirmation.

| Plan | Niveau | Qui |
|------|--------|-----|
| Contenu | — | La page |
| Barre supérieure | `z-20` | Elle passe sous la barre latérale |
| Barre latérale, bouton « Options » | `z-30` | La navigation |
| Barre d'onglets | `z-40` | Sous le panneau qui la recouvre |
| Panneau d'actions | `z-50` | Recouvre la navigation |
| Panneau de second niveau | `z-60` | Recouvre le panneau d'où il sort |
| **Dialogues** | **`z-70`** | **Au-dessus de tout** |

⚠️ **Une confirmation est le dernier mot de l'interface : rien ne se met devant
elle.** Tout dialogue modal — `Modale`, `ConfirmDialog`, et les voiles écrits à
la main comme celui de l'export RTA — porte `z-[70]`.

### Un flottant ne sort jamais de l'écran

⚠️ **`max-width` ne suffit pas.** Il borne la LARGEUR ; un panneau ancré à gauche
d'un déclencheur déjà proche du bord droit sort quand même, parce que c'est sa
POSITION qui dépasse. Le cas se produit dès que la place du déclencheur varie :
une pilule de catégorie au bout d'une rangée, un bouton qui a bougé parce qu'un
libellé s'est allongé, une vignette en fin de ligne. Aucune règle CSS statique ne
peut savoir où ce déclencheur-là se trouve.

Tout flottant **de largeur fixe ancré à gauche** passe donc par
`useRecalageEcran` (`src/hooks/`), qui mesure sa position réelle après rendu et
le ramène dans l'écran :

| Flottant | Ancré sur |
|----------|-----------|
| Création / édition de catégorie | Une pilule, ou « + Catégorie » |
| Création de monstre | Un bouton de barre d'outils ou de panneau |
| Note d'une défense (recommandations) | Une vignette de rangée |

- **`left`, jamais `transform: translateX()`.** Une transformée déplace ce qu'on
  VOIT, mais la boîte de mise en page reste où elle était : le débordement
  subsiste et la page garde son défilement latéral — le bug qu'on prétendait
  corriger. `left` déplace la boîte elle-même.
- Le flottant doit donc porter **`left-0` explicite**. Sans ancrage horizontal
  posé (`left: auto`), une valeur négative ne décale pas : elle repositionne
  depuis un bord que le navigateur choisit seul.
- Le hook pose aussi un **`max-width` mesuré**, car sur un écran plus étroit que
  le flottant le décalage ne suffit pas — il faut le rétrécir.
- **`useLayoutEffect`, pas `useEffect`** : la mesure a lieu avant peinture, le
  flottant ne s'affiche jamais hors cadre, même une image.
- **L'état d'ouverture est passé au hook.** Le flottant n'est monté que lorsqu'il
  est ouvert ; une `ref` ne provoque pas de rendu, donc rien ne redéclencherait
  la mesure à l'ouverture.
- **Remesure au redimensionnement** : une rotation de téléphone change la largeur
  sous un flottant déjà ouvert.
- Les flottants **ancrés à droite** (`right-0`) et ceux **larges comme leur
  ancre** (`w-full`) n'en ont pas besoin — leur position ne peut pas dépasser.

### Jamais de défilement latéral

`html` et `body` portent `overflow-x: hidden` (`index.css`) — **les deux**, car
le navigateur propage le débordement de `body` à `html` quand `body` est seul à
le masquer. Mais ce n'est **qu'un filet de sécurité** : le contenu déborde
toujours, il est simplement coupé, donc inatteignable.

Les quatre causes rencontrées, par ordre de fréquence :

| Cause | Correctif |
|-------|-----------|
| `min-w-[Npx]` rigide | S'écrit `min-w-[min(Npx,100%)]` |
| `minmax(Npx, 1fr)` dans une grille | S'écrit `minmax(min(100%,Npx), 1fr)` |
| Enfant flex qui refuse de se réduire | `min-w-0` — la valeur par défaut est `auto`, qui interdit de passer sous la largeur du contenu |
| Flottant de largeur fixe ancré à gauche | `useRecalageEcran` (voir plus haut) |

⚠️ Le symptôme apparaît **loin de sa cause** : un `min-width` calibré pour une
carte fait défiler la page entière, et on le constate sur un écran qui n'a rien à
voir avec le composant fautif. C'est ce qui rend ces bugs coûteux à chercher — et
pourquoi ils reviennent.

### Le zoom iOS se règle sur le `viewport`, pas sur la taille du texte

⚠️ **`maximum-scale=1` sur la balise `viewport`** ([index.html](../../index.html)).
C'est là qu'est sa place, et deux tentatives précédentes ont montré pourquoi :

| Tentative | Ce qu'elle donnait |
|-----------|--------------------|
| 16 px sur tous les champs, en permanence | Une barre de recherche qui écrit plus gros que le menu déroulant posé à côté — un même écran à deux échelles |
| 16 px en `:focus` seulement | Le champ **change de taille sous le doigt** en s'activant, texte et cadre compris : ça se lit comme un défaut, pas comme une protection |

Le seuil de 16 px contaminait une décision d'interface (la taille du texte) avec
une contrainte de plateforme. Sorti du CSS, les champs de saisie se posent à
**13 px** — la taille des menus déroulants voisins, un champ ne devant écrire ni
plus gros ni plus petit qu'eux.

⚠️ **Le zoom à deux doigts reste possible.** Depuis iOS 10, Safari ignore cette
restriction pour un geste de l'utilisateur et ne l'applique qu'au zoom qu'il
déclenche lui-même. C'est ce qui rend la valeur acceptable, là où un
`user-scalable=no` — qui bloque vraiment — ne le serait pas.

### Les trois pièges d'iOS

⚠️ **`overflow-x: hidden` ne retient PAS un élément `fixed`.** Safari laisse la
page défiler latéralement dès qu'un flottant dépasse la largeur du viewport : la
règle ne borne que le flux normal, pas ce qui en est sorti. `body` porte donc
`position: relative` et `width: 100%`, et un dernier filet plafonne les `.fixed`
et `.sticky`.

⚠️ **`100vh` inclut la barre d'adresse**, qui se replie au défilement : la page
devenait alors plus haute que l'écran, d'où un saut de mise en page à chaque
changement de sens. Toutes les hauteurs de viewport sont en **`dvh`**, avec
`vh` en repli pour les navigateurs qui l'ignorent.

⚠️ **`viewport-fit=cover` est obligatoire** dans le `<meta viewport>`. Sans lui,
`env(safe-area-inset-*)` vaut **zéro** : toutes les gardes posées sur l'encoche
ou sur la barre de geste sont alors inertes, sans que rien ne le signale. La
barre supérieure passait ainsi sous l'encoche, et l'on ne pouvait pas remonter
jusqu'aux premiers éléments de la page.

⚠️ La barre supérieure **descend sous l'encoche** (`height: calc(3rem +
env(safe-area-inset-top))` + `padding-top`), et le dégagement du contenu suit.
Une valeur fixe laissait le haut de la page sous la barre.



⚠️ **Le « tirer pour recharger » est CONSERVÉ** — c'est un geste attendu sur un
téléphone. Il a été bloqué un temps parce qu'il se déclenchait *avant* que le
contenu n'ait atteint le haut, mais c'était traiter le symptôme.

⚠️ Deux causes se cumulaient pour le déclencher trop tôt.

**La hauteur de `body` était en `dvh`** : cette unité suit la hauteur courante du
viewport, donc elle **change** quand la barre d'adresse se replie ou se déplie.
En remontant, la barre se déplie, `dvh` diminue et la page raccourcit sous le
doigt — le défilement se retrouve poussé au-delà du haut.

**La page ne pouvait pas défiler sous la barre supérieure.** Quand son contenu
tient dans l'écran, il n'y a rien à faire défiler : le navigateur est « en haut »
dès le départ, et le moindre geste vers le bas déclenche le rechargement — avant
même qu'on ait vu le premier bloc, qui se trouve pourtant **derrière la barre**.
La hauteur minimale de `body` ajoute donc celle de la barre : il reste toujours
de quoi remonter, et « en haut » signifie bien « je vois le début du contenu ».

`svh` est la hauteur du plus **petit** état (barre dépliée) et ne bouge jamais.
C'est la bonne unité pour une hauteur de page. `dvh` reste correct sur les
**plafonds** d'éléments fixes (`max-h` d'un panneau, d'un dialogue), qui doivent
au contraire suivre la hauteur visible.

⚠️ **`overflow-x: hidden` vit sur `html`, jamais sur `body`.** C'est `html` qui
défile ; sur `body`, la propriété en fait un **second conteneur de défilement**
dont la hauteur se borne au viewport — la molette n'a alors plus rien à faire
défiler sur un écran de bureau.

| Propriété | Sur `html` | Sur `body` |
|-----------|-----------|------------|
| `overflow-x: hidden` | ✅ la garde | ❌ immobilise la page |
| `min-height: 100svh` | — | ✅ hauteur de page |
| `position: relative` + `width: 100%` | — | ✅ largeur de référence des `fixed` |

⚠️ **Safari grossit les polices en paysage** (« text autosizing ») si rien ne
l'en empêche : les tailles calculées ne valent alors plus rien et un bloc dessiné
pour tenir déborde. `html` porte `-webkit-text-size-adjust: 100%`.

⚠️ **Un détecteur nomme le coupable en développement**
(`src/lib/detecteurDebordement.ts`). Il parcourt le DOM après chaque changement,
ne retient que l'élément **le plus profond** qui dépasse — un enfant trop large
déborde tous ses parents, les signaler tous noierait le vrai coupable — et
l'écrit dans la console avec le nombre de pixels en cause. Il est éliminé du
bundle de production (`import.meta.env.DEV`).

⚠️ Il compare à `documentElement.clientWidth`, **jamais** à `window.innerWidth` :
le second inclut la barre de défilement verticale, et tout paraîtrait déborder de
~15 px sur desktop. C'est aussi pourquoi `100vw` est trompeur dans un `calc()`.

⚠️ Le **panneau d'actions mobile** reçoit une garde supplémentaire : ses enfants
flex et grid ont `min-width: 0` d'office. Il accueille des contrôles dessinés
pour une rangée desktop de 900 px, où un `min-width` calibré là-bas déborde
systématiquement.
- ⚠️ **Jamais depuis `scale(0)`** : rien n'apparaît de nulle part. `.96` au
  minimum.
- ⚠️ **Pas de `scale` sur du texte** (`apparition`) : la mise à l'échelle
  déforme les lettres pendant l'animation, et rien ne « grandit » — le message
  se pose, il n'arrive pas de loin.
- La boîte d'un dialogue est **plus lente que son voile** (200 vs 150 ms) : elle
  doit finir après le fond qu'elle recouvre, sinon elle semble le précéder.

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

### ⚠️ Les tokens sont des TRIPLETS, pas des couleurs

Les variables de couleur valent `43 54 165`, **pas** `#2b36a5` : c'est ce qui
permet à Tailwind d'y appliquer une opacité (`bg-accent/10`). Elles ne sont donc
utilisables **que** enveloppées :

```
stroke="rgb(var(--accent))"   ✅
stroke="var(--accent)"        ❌ attribut invalide → RIEN n'est peint
```

⚠️ **L'échec est SILENCIEUX** : pas d'erreur, pas d'avertissement, le trait
n'existe simplement pas. C'est ce qui a rendu invisibles les repères verticaux
des courbes de runes. Le piège guette surtout les **attributs SVG**
(`stroke`, `fill`), où l'on écrit la couleur à la main au lieu de passer par une
classe Tailwind.

### Aucune couleur Tailwind native

⚠️ **`amber-400`, `emerald-500`, `sky-300` sont interdits.** Ce sont des valeurs
figées : elles ne suivent pas le thème, exactement comme un hexadécimal. La
vérification des ticks ATB était illisible en clair pour cette raison — un
`text-amber-300` sur fond blanc.

| Interdit | À utiliser | Sens |
|----------|-----------|------|
| `amber-*` | `warn` | Avertissement |
| `emerald-*` | `good` | Succès, gain, au tick |
| `sky-*` | `water` | Information |
| `rose-*`, `red-*` | `bad` | Erreur, hors tick |

Les nuances 300/400/500 se réduisent à **un seul token** : la variation de
luminosité est déjà portée par le thème (`--warn` vaut `217 164 65` en sombre,
`138 87 12` en clair). Garder trois nuances reproduirait le problème.

⚠️ **Les aplats sémantiques sont à /10, jamais à /5.** Sur fond clair, un aplat à
5 % ne se distingue pas du panneau — l'aura d'une équipe hors tick disparaissait.

⚠️ **Pas de halo en `rgba()` figé.** Un `shadow-[0_0_20px_rgba(245,158,11,.65)]`
est un halo orange vif : correct sur fond sombre, criard sur fond clair. Utiliser
la bordure et l'anneau, qui passent par les tokens.

*Exception* : les `rgba()` noirs ou blancs sur les **icônes du jeu**
(`drop-shadow`) restent — ils fonctionnent dans les deux thèmes.

### ⚠️ `autoFocus` fait DÉFILER la modale

Le navigateur défile jusqu'à l'élément focalisé. Un `autoFocus` posé sur un
bouton situé **sous une longue liste** ouvre donc la boîte **tout en bas**, sur
ses boutons, le contenu invisible — c'est ce qui est arrivé à la recherche
détaillée de sous-propriétés, où le bouton « OK » suit 40 lignes.

La coquille `Modale` ([Dialogs.tsx](../../src/ui/Dialogs.tsx)) pose donc
le focus initial sur **la boîte elle-même** (`tabIndex={-1}` +
`focus({ preventScroll: true })`), et remet son défilement en haut. Elle ne le
fait **que si rien à l'intérieur n'a déjà pris le focus** : un `autoFocus`
délibéré — le champ d'un `PromptDialog`, l'« Annuler » d'une confirmation — reste
prioritaire.

**Règle** : `autoFocus` est réservé à ce qu'on va **utiliser tout de suite** (un
champ de saisie), et seulement dans une boîte **qui tient à l'écran sans
défiler**.

### Croix de fermeture — sur ce qu'on consulte, pas sur ce qu'on décide

Une modale se ferme par **Échap** et par le **clic à côté**. Ni l'un ni l'autre
ne se **voit** : sur une boîte qui ne fait que montrer quelque chose, rien
n'indique par où sortir, et on cherche.

`Modale` porte donc une **croix optionnelle** (`croix`), posée en coin :

- ⚠️ **Sur les modales de CONSULTATION** — la fiche d'un monstre, d'une rune.
  Elles ne demandent rien, donc elles n'ont aucun bouton, donc aucune sortie
  visible.
- ⚠️ **Pas sur les CONFIRMATIONS ni les boîtes de choix** : leur « Annuler »
  **est** la sortie. Une croix à côté ferait deux portes pour une décision qui
  n'en a qu'une, et on hésiterait sur ce qu'elle ferme — abandon, ou simple
  fermeture ?
- ⚠️ **Nue** — ni cadre, ni fond. Encadrée, elle se lisait comme un **bouton
  d'action de plus**, au même rang que ce qu'on est venu consulter. Le symbole
  se reconnaît seul et s'éclaircit au survol. Seule une **ombre portée** reste :
  sans fond, la croix passe devant le contenu qui défile dessous, et un trait
  fin sur du texte devient illisible.
- ⚠️ **`sticky`, jamais `absolute`** : la boîte **défile**, et une croix absolue
  part vers le haut dès les premières lignes d'une fiche longue — c'est-à-dire
  exactement au moment où on la cherche. Hauteur nulle (`h-0`) et décalages
  négatifs : elle se pose dans le padding sans pousser le contenu d'une ligne.
- Elle vit **dans la coquille**, pas dans chaque fiche : posée au cas par cas,
  elle aurait fini à trois endroits différents selon la modale.

### Cibles tactiles — 40 px au doigt

```css
@media (pointer: coarse) {
  button, a[role='button'], [role='tab'], summary,
  input, select { min-height: 40px; }
  button.aspect-square, a.aspect-square { min-width: 40px; }
}
```

L'app est dessinée pour la **souris**, qui vise au pixel : les pastilles de
filtre tombent à 26 px, les boutons d'icône à 32. Au doigt on tape à côté, et
sur une rangée de filtres serrée on active le **voisin**.

- ⚠️ Conditionné à **`(pointer: coarse)`**, jamais à une largeur : ce n'est pas
  l'écran qui est petit, c'est le doigt qui est gros. Une tablette au stylet
  garde les tailles fines ; un téléphone en paysage les agrandit quand même.
  C'est le pendant de la variante `hoverable`, qui règle le même problème pour
  le survol.
- ⚠️ Seuls la **hauteur** et la largeur changent — jamais la taille du texte ni
  les couleurs. Une interface qui se réécrit au doigt devient une autre
  interface, et on ne retrouve plus ce qu'on connaît.
- ⚠️ Les boutons **carrés** (icône seule) portent `aspect-square` et gagnent
  aussi en largeur : agrandis en hauteur seulement, ils devenaient des
  rectangles avec l'icône flottant dans un vide vertical.
- ⚠️ **Un bouton qui perd son libellé sous `sm` perd aussi son CADRE.** Il
  devient une icône nue : ni bordure, ni fond. Le cadre était dimensionné pour un
  mot qui n'est plus là — gardé, il fait un rectangle vertical où l'icône flotte ;
  rendu carré, il déclenche les 40 px de la règle tactile et l'on obtient six
  gros carrés dans une barre qu'on cherchait à compacter.
  Le cadre n'apprend d'ailleurs rien : **l'icône dit l'action, sa présence dit
  qu'on peut la toucher.** Il revient à la souris, où la barre a la place et où
  le survol a besoin d'une surface à colorer.
- ⚠️ Une icône nue reste **exemptée** (`data-cible-fine`) et reçoit
  `.cible-tactile` : 20 px dessinés, 44 touchables.
- ⚠️ **L'écart entre icônes nues double** (`gap-4` contre `gap-2`). Sans cadre
  pour les délimiter, six icônes à 8 px d'intervalle se lisent comme une frise
  continue — c'est l'espace qui remplace le trait.
- ⚠️ …mais dans le **panneau d'actions mobile**, le libellé revient (voir
  navigation.md) : la règle `[data-tiroir] button.aspect-square` relâche alors la
  contrainte de forme, sinon le mot déborderait d'un carré. Le marqueur est
  `aspect-square` et non `.h-8` — un sélecteur sur le nom de classe Tailwind
  aurait cassé au premier ajustement de taille.
#### Le nom du monstre est la RÉFÉRENCE

⚠️ Sur une carte de monstre, **rien ne doit peser plus lourd que son nom** sauf
la valeur principale — et celle-ci reste dans un rapport de **1,3** avec lui, pas
davantage. À 2,2 (26 px contre 12), la vitesse était le seul élément qu'on
voyait ; le reste de la carte devenait un décor.

⚠️ Les **capitales espacées** pèsent plus lourd que leur taille ne le dit :
`.label` à 11 px avec `letter-spacing: 0.08em` occupe autant qu'un mot de 13 px
en bas de casse. Au doigt, la classe descend à 10 px et son espacement de moitié
— le rôle d'un libellé est de nommer, pas de rivaliser.

⚠️ Le cran **`nano` (10 px) n'existe que sous `compact:`** : c'est le secours du
tactile, pas une taille de l'échelle générale. Il sert aux mentions qui
accompagnent une valeur sans être lues pour elles-mêmes (« base 107 »). En
dessous, on ne lit plus.

#### Densité d'un bloc répétitif

⚠️ **Ce qui compte n'est pas la taille du texte mais la HAUTEUR DU BLOC.** Le
panneau de stats en est l'exemple : huit lignes à 12 px plus 8 px d'interligne
font ~190 px de haut — il pesait plus lourd que les trois monstres au-dessus,
alors qu'il ne fait que les détailler. Le texte n'était pourtant pas gros.

Au doigt, un bloc de plus de cinq lignes descend donc d'un cran (`compact:`) :
texte à 11 px, interligne de moitié, rembourrage du cadre réduit. À la souris,
rien ne change — la place ne manque pas.

⚠️ Le repère de référence est le **nom du monstre** juste au-dessus : le panneau
doit rester en dessous de lui dans la hiérarchie, puisqu'il le détaille.

#### Quand la taille EST le dessin

⚠️ **Certains contrôles ne peuvent pas grandir sans cesser d'être eux-mêmes.**
Un interrupteur de 22 px porté à 40 devient un cercle dont la pastille pend en
haut ; une pastille ronde devient un ovale. La règle les cassait au lieu de les
servir.

Trois réponses, selon ce qui gêne :

| Marqueur | Effet | Pour qui |
|----------|-------|----------|
| `.cible-tactile` | Zone touchable de 44 px par pseudo-élément, **dessin inchangé** | `Switch` — la hauteur est sa forme, mais il est isolé |
| `data-cible-fine` | Exempté, **aucune** zone étendue — vaut pour les boutons **comme pour les champs** (`input`, `select`) | Le crayon et la corbeille d'une pilule de catégorie : collés l'un à l'autre, une zone de 44 px les ferait se chevaucher et on supprimerait en voulant éditer |
| `data-carte-dense` | 32 px au lieu de 40 | Un contrôle seul sur la largeur de sa carte — rater y est improbable |

⚠️ **`.cible-tactile` est la réponse par défaut** dès qu'un contrôle a une forme
qui porte du sens : elle rend la cible utilisable sans rien déformer. Les deux
autres sont des exceptions qu'il faut justifier — la première parce qu'un
voisinage serré rend la grande cible dangereuse, la seconde parce que le contexte
protège déjà du ratage.

⚠️ **`.cible-tactile` pose `position: relative` sur ELLE-MÊME** (`index.css`)
— pas seulement sur son `::after`. Incident vécu : deux porteurs
(`Pager.tsx`, et `BoutonIcone.tsx` via `zoneEtendue` — utilisé par
`HelpPopover.tsx`, donc quasiment partout dans l'app) posaient la classe sur
un élément resté `position: static`, en comptant sur la convention « tous
les porteurs sont déjà `relative` » sans l'appliquer. Le `::after` (`position:
absolute`) remontait alors jusqu'au premier ancêtre RÉELLEMENT positionné —
souvent `<body>` — et calculait `width/height: 100%` de LUI, pas du petit
bouton : un pseudo-élément invisible de la taille de la page entière
(mesuré : 390×4670 px sur un cas réel), centré dessus, interceptant les
clics/survols d'éléments sans aucun rapport ailleurs sur l'écran — un
utilisateur l'a décrit comme « impossible de cliquer sur une rune », et
« l'infobulle du bouton Page suivante apparaît en survolant une carte de
rune ». Poser `relative` sur la classe elle-même ferme la catégorie entière
plutôt qu'un seul appelant — ne plus compter sur chaque appelant pour s'en
souvenir.

- Les **champs de saisie** aussi : viser un `<input>` de 28 px au doigt demande
  autant de précision qu'un bouton, et rater ouvre le clavier au mauvais
  endroit.

⚠️ **Incident vécu** : les cadres de rune (`RuneWheel.tsx`) et d'artéfact
(`ArtifactSlots.tsx`), à échelle réduite dans les cartes de résultat de
l'Optimizer (`BuildCandidateCard.tsx`), n'avaient PAS `data-cible-fine` —
hérités de `main` sans cet attribut lors de la fusion de `forge/refonte-ui`.
`min-height: 40px` gagnait contre la hauteur fixée en ligne : le cadre
s'étirait (une roue de 6 runes ne tient que 94 px, une cible de 44 px par
rune aurait de toute façon chevauché ses voisines — même cas que la pilule
de catégorie ci-dessus, à vérifier en premier sur tout futur cadre de jeu
réduit sous `compact:`).

### Focus — une règle globale, pas 24 exceptions

```css
:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
```

⚠️ **`outline-none` est interdit sans remplacement visible.** L'app comptait 24
`outline-none` et zéro `focus-visible` : en tabulant, on ne savait jamais où on
était.

⚠️ **1 px, comme tout contour de l'app.** L'anneau en faisait 2, détachés de 2 px
de plus : un halo de quatre pixels autour de chaque contrôle atteint au clavier,
qui bavait sur ses voisins dans une rangée serrée. C'est le **contraste** qui
fait un marqueur de focus, pas l'épaisseur.

⚠️ **Un contrôle qui marque déjà le focus par sa BORDURE n'a pas d'anneau du
tout.** Un `<select>` ou un champ en `focus:border-accent` teinte sa propre
bordure à la mise au point ; l'anneau par-dessus faisait un second trait d'accent
collé au premier, soit 3 px autour d'un contrôle qui n'en demandait qu'un. Le
focus reste porté par la bordure, qui change de couleur au moment précis où le
clavier arrive.

⚠️ En revanche, une bordure d'accent **permanente** (un critère posé, un filtre
actif) ne dit rien du clavier — elle est là avant et après. L'anneau reste donc,
mais collé à elle.

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
