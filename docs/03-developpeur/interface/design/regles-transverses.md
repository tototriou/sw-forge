# Système visuel — règles transverses

Partie de [Système visuel](README.md).

## Règles transverses

### ⚠️ Les tokens sont des TRIPLETS, pas des couleurs

Les variables de couleur valent `255 122 26`, **pas** `#ff7a1a` : c'est ce qui
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
5 % ne se distingue pas du panneau — l'aura d'une équipe hors tick disparaîtrait.

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

La coquille `Modale` ([Dialogs.tsx](../../../../src/ui/Dialogs.tsx)) pose donc
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

- ⚠️ **Sur les modales de CONSULTATION** — la fiche d'un monstre, d'une rune,
  un outil ouvert par-dessus une page. Elles ne demandent rien, donc elles n'ont
  aucun bouton, donc aucune sortie visible.
- ⚠️ **Et alors elles n'ont PAS de pied non plus.** Un « Fermer » en bas à droite
  ferait doublon avec la croix — deux portes pour la même sortie — et coûterait
  une **bande entière**, soit ~50 px. Sur une modale qui prend 90 % de la hauteur
  d'écran pour montrer un tableau, ce sont deux lignes de données en moins au
  profit d'un bouton qui ne dit rien de plus que la croix. La croix reste à sa
  place habituelle, en haut à droite : on ne la déplace pas en bas sous prétexte
  qu'on a retiré le pied.
- ⚠️ **Pas sur les CONFIRMATIONS ni les boîtes de choix** : leur « Annuler »
  **est** la sortie. Une croix à côté ferait deux portes pour une décision qui
  n'en a qu'une, et on hésiterait sur ce qu'elle ferme — abandon, ou simple
  fermeture ?
- ⚠️ **Nue** — ni cadre, ni fond. Encadrée, elle se lirait comme un **bouton
  d'action de plus**, au même rang que ce qu'on est venu consulter. Le symbole
  se reconnaît seul et s'éclaircit au survol. Seule une **ombre portée** reste :
  sans fond, la croix passe devant le contenu qui défile dessous, et un trait
  fin sur du texte devient illisible.
- ⚠️ **`sticky`, jamais `absolute`** : la boîte **défile**, et une croix absolue
  part vers le haut dès les premières lignes d'une fiche longue — c'est-à-dire
  exactement au moment où on la cherche. Hauteur nulle (`h-0`) et décalages
  négatifs : elle se pose dans le padding sans pousser le contenu d'une ligne.
- Elle vit **dans la coquille**, pas dans chaque fiche : posée au cas par cas,
  elle finirait à trois endroits différents selon la modale.

### Les deux bandes d'une modale : un trait, et seulement s'il dit quelque chose

L'en-tête et le pied ne défilent pas ; le corps, si. Sans rien entre les deux, le
contenu se glisse **sous** les bandes : une card coupée en deux au bord de la
bande, et on ne sait plus si elle est tronquée ou si c'est la fin de la liste.

- ⚠️ **Le trait est une INFORMATION, pas une décoration** : « il y a autre chose
  au-dessus / en dessous ». Il n'apparaît donc que lorsque du contenu passe
  réellement derrière la bande — mesuré au défilement **et** au redimensionnement
  du corps (un panneau qui s'ouvre change la donne sans qu'on ait défilé). Posé
  en permanence, il mentirait sur une modale dont tout tient à l'écran, et
  alourdirait les confirmations.
- **1 px, `border-border`, un seul** — comme partout. Quand il apparaît, le corps
  reprend son rembourrage haut (ou bas) : sinon une card viendrait toucher le
  trait, ce qui ferait **deux contours superposés**.
- ⚠️ **Densité (`bandes`) : c'est un AXE, pas une variante.** `compactes` retire
  de la hauteur aux deux bandes **sans toucher au corps**. C'est ce qu'il faut à
  une modale qui contient un **outil entier** (le speed tuning prend 90 % de la
  hauteur d'écran) : chaque pixel de bande y est une ligne de tableau en moins.
  Une confirmation garde l'air par défaut. `compactes` **remplace** le
  rembourrage des bandes au lieu de s'y ajouter, et suppose donc le `padding` par
  défaut pour l'axe horizontal.
  - ⚠️ **Le rythme d'une bande n'est pas celui du corps.** Une bande ne porte
    qu'une ligne de texte ou un bouton : lui donner les 16 px du corps lui fait
    manger la hauteur d'une ligne de tableau pour rien. `compactes` la met à
    **8 px** — et le sous-titre y passe en `leading-snug`, une interligne de
    lecture longue n'ayant pas de sens sur une phrase unique.

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
  aussi en largeur : agrandis en hauteur seulement, ils deviendraient des
  rectangles avec l'icône flottant dans un vide vertical.
- ⚠️ **Un bouton qui perd son libellé sous `sm` perd aussi son CADRE.** Il
  devient une icône nue : ni bordure, ni fond. Le cadre est dimensionné pour un
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
  02-app/transverse/feat-navigation/panneau-actions-mobile.md) : la règle `[data-tiroir] button.aspect-square` relâche alors la
  contrainte de forme, sinon le mot déborderait d'un carré. Le marqueur est
  `aspect-square` et non `.h-8` — un sélecteur sur le nom de classe Tailwind
  casserait au premier ajustement de taille.
#### Le nom du monstre est la RÉFÉRENCE

⚠️ Sur une carte de monstre, **rien ne doit peser plus lourd que son nom** sauf
la valeur principale — et celle-ci reste dans un rapport de **1,3** avec lui, pas
davantage. À 2,2 (26 px contre 12), la vitesse serait le seul élément qu'on
verrait ; le reste de la carte deviendrait un décor.

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
font ~190 px de haut — il pèserait plus lourd que les trois monstres au-dessus,
alors qu'il ne fait que les détailler, sans que le texte soit gros.

Au doigt, un bloc de plus de cinq lignes descend donc d'un cran (`compact:`) :
texte à 11 px, interligne de moitié, rembourrage du cadre réduit. À la souris,
rien ne change — la place ne manque pas.

⚠️ Le repère de référence est le **nom du monstre** juste au-dessus : le panneau
doit rester en dessous de lui dans la hiérarchie, puisqu'il le détaille.

#### Quand la taille EST le dessin

⚠️ **Certains contrôles ne peuvent pas grandir sans cesser d'être eux-mêmes.**
Un interrupteur de 22 px porté à 40 devient un cercle dont la pastille pend en
haut ; une pastille ronde devient un ovale. La règle les casserait au lieu de les
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
— pas seulement sur son `::after`. Posée sur un élément resté `position:
static`, la classe laisserait son `::after` (`position: absolute`) remonter
jusqu'au premier ancêtre RÉELLEMENT positionné — souvent `<body>` — et
calculer `width/height: 100%` de LUI, pas du petit bouton : un pseudo-élément
invisible de la taille de la page entière, centré dessus, qui intercepte les
clics et les survols d'éléments sans aucun rapport ailleurs sur l'écran (une
rune impossible à cliquer, l'infobulle d'un bouton qui apparaît en survolant
une carte). Poser `relative` sur la classe elle-même ferme la catégorie
entière plutôt qu'un seul appelant : aucun porteur n'a à s'en souvenir.

- Les **champs de saisie** aussi : viser un `<input>` de 28 px au doigt demande
  autant de précision qu'un bouton, et rater ouvre le clavier au mauvais
  endroit.

⚠️ **Un cadre de jeu réduit porte `data-cible-fine`** : les cadres de rune
(`RuneWheel.tsx`) et d'artéfact (`ArtifactSlots.tsx`), à échelle réduite dans
les cartes de résultat de l'Optimizer (`BuildCandidateCard.tsx`). Sans
l'attribut, `min-height: 40px` gagne contre la hauteur fixée en ligne et le
cadre s'étire (une roue de 6 runes ne tient que 94 px, une cible de 44 px par
rune chevaucherait de toute façon ses voisines — même cas que la pilule de
catégorie ci-dessus). À vérifier en premier sur tout cadre de jeu réduit sous
`compact:`.

### Focus — une règle globale, pas 24 exceptions

```css
:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
```

⚠️ **`outline-none` est interdit sans remplacement visible** : sans
`focus-visible`, en tabulant, on ne sait jamais où on est.

⚠️ **1 px, comme tout contour de l'app.** Un anneau de 2 px détaché de 2 px de
plus ferait un halo de quatre pixels autour de chaque contrôle atteint au
clavier, qui baverait sur ses voisins dans une rangée serrée. C'est le
**contraste** qui fait un marqueur de focus, pas l'épaisseur.

⚠️ **Un contrôle qui marque déjà le focus par sa BORDURE n'a pas d'anneau du
tout.** Un `<select>` ou un champ en `focus:border-accent` teinte sa propre
bordure à la mise au point ; l'anneau par-dessus ferait un second trait d'accent
collé au premier, soit 3 px autour d'un contrôle qui n'en demande qu'un. Le
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

⚠️ **Sauf les boutons de la librairie** : un `Bouton` (donc aussi
`BoutonIcone`) **descend d'1 px**, et le principal fonce (`accent-appui`). La
règle vit dans `index.css` (`button[data-bouton]`, et `a[data-bouton]` pour un
`Bouton` lien — axe `href` ; attribut posé par `Bouton`), plus spécifique que
celle du rétrécissement ; les cartes, poignées et autres surfaces cliquables
gardent `scale(0.97)`.

### Un élément atteignable ne dépend jamais du survol

⚠️ **`hidden group-hover:*` est interdit** sur un contrôle. L'élément sort du
flux : il n'est ni focusable au clavier, ni atteignable au doigt. Utiliser
`opacity-0 hoverable:group-hover:opacity-100 focus-visible:opacity-100`, et le
laisser visible sous `(hover: none)`.

Sans cela, le bouton « Retirer » d'une carte RTA serait **impossible à
actionner sur téléphone**.

### Exporter ↑, importer ↓

⚠️ **Exporter = `Upload` (flèche vers le haut), importer = `Download`
(flèche vers le bas)**, partout : boutons, actions de la palette, zone de
dépôt, étapes de l'accueil. Le fichier qui **sort** de l'app monte, celui
qui **entre** descend — même « Exporte ton compte » de l'accueil, où le
fichier sort du jeu. Ne pas raisonner « on télécharge un fichier, donc
`Download` » : c'est l'inversion à éviter.
