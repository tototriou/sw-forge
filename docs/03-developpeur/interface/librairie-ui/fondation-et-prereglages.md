# Librairie UI — fondation et préréglages

Partie de [Librairie UI](README.md).

## Les composants

### Fondation

**`Bouton`** — toute pression qui n'est pas une pastille de filtre. Porte les
cinq axes ci-dessus.

### Préréglages

Ils n'ont **pas de style propre** : ce sont des `Bouton` dont certains axes sont
fixés. Un changement dans `Bouton` les traverse tous sans qu'on y touche.

**`BoutonGroupe`** — **le** bouton des rangées : un libellé, une icône
**optionnelle** à gauche, des actions **optionnelles** accolées à droite. Une
pilule de catégorie (puce + nom + éditer + supprimer), une pilule de lead
(pourcentage + retirer), un filtre (« Sans lead »), un interrupteur d'affichage
(« Vitesses »), un bouton d'ajout en pointillés.

> ⚠️ **Un seul composant pour ces cinq-là**, alors qu'ils étaient cinq écritures
> différentes. Ce qui les distingue n'est pas leur nature — ce sont tous des
> boutons d'une même rangée, à la même hauteur — mais la seule présence ou
> absence de décorations. Cela se dit avec deux props facultatives, pas avec cinq
> composants. Et une rangée qui les mélange ne fait plus de **dents de scie**,
> puisque la hauteur est écrite à un seul endroit.

> ⚠️ **Le cadre porte le style, les boutons sont transparents dedans.** C'est une
> contrainte du HTML avant d'être un choix : un `<button>` dans un `<button>` est
> invalide. Le conteneur n'est donc pas un bouton — il dessine, ses enfants
> agissent. Bénéfice au passage : aucune couture entre le bouton principal et ses
> actions, là où trois boutons côte à côte laissent deux traits.

> ⚠️ **UN SEUL MARQUEUR d'état : le fond.** Fond + bordure teintée + ombre
> feraient trois signaux pour dire une seule chose : le bouton se surlignerait
> deux fois et baverait sur ses voisins. Pas d'ombre non plus : un bouton actif
> ne **décolle** pas de la page, l'élévation est réservée à ce qui flotte.

> ⚠️ Il pose `data-cible-fine` sur son bouton principal, et **c'est son cœur** :
> sans lui, la règle tactile ne gonflerait pas ce bouton mais le **cadre** qui
> l'enveloppe. Rien n'est perdu — le bouton occupe toute la surface du groupe
> sauf les actions.

**`BoutonIcone`** — réduit à son icône. ⚠️ `libelle` est **obligatoire et jamais
dessiné** : il alimente `aria-label` et `title` à la fois. Un bouton d'icône
sans libellé est muet pour un lecteur d'écran ; le rendre obligatoire dans le
type est la seule façon de ne pas avoir à y penser.

- `taille="serre"` n'est **pas « plus petit »**, c'est une **exemption tactile** :
  un bouton posé DANS un contenant plus petit que la cible de 40 px (les deux
  boutons d'une pilule de 28 px). Portés à 40 px ils la débordent ; dotés en plus
  d'une zone étendue de 44 px ils se chevauchent, et **on supprime la catégorie
  en voulant l'éditer**.
- `zoneEtendue` — **le dessin reste petit, la cible fait 44 px.** C'est
  l'INVERSE de `serre`, et les deux ne se confondent pas :

  | | `serre` | `zoneEtendue` |
  |---|---|---|
  | Pour | un bouton **dans** un contenant plus petit que 40 px | un bouton **isolé**, posé sur une surface |
  | Dessin | 20 px | inchangé (28 px) |
  | Zone touchable | celle du dessin | **44 px** |
  | Pourquoi pas l'autre | une zone étendue chevaucherait le voisin | sans zone étendue, on vise 28 px au pouce |

  ⚠️ Il pose `data-cible-fine` **et** `cible-tactile` **ensemble**, et c'est
  tout l'intérêt d'en faire un seul axe : le premier seul laisse la cible sous
  les 44 px réglementaires, le second seul laisse la règle globale étirer le
  bouton en **ovale de 28 × 40**. Les séparer casse soit la visée, soit la
  forme.
  ⚠️ `cible-tactile` suppose un élément `position: relative` : la classe le
  pose elle-même (`index.css`) — voir
  [design/regles-transverses.md](../design/regles-transverses.md), section
  « cible-tactile ».
- `forme` — **transmise** : les axes du bouton restent ouverts, `forme`
  comprise, et un bouton d'icône **rond de taille normale** est possible sans
  réécrire son rayon par-dessus. Défaut : `pilule` quand `serre`, `boite`
  sinon.
- `auSurvol` — n'apparaît qu'au survol du conteneur (qui porte `group`).
  ⚠️ **JAMAIS `hidden group-hover:flex`** : l'élément sortirait du flux, donc ne
  serait ni focusable au clavier ni atteignable au doigt — on ne pourrait pas
  retirer un monstre sur téléphone. On joue sur l'**opacité**, et il est visible
  d'office là où il n'y a pas de survol.
- `libelleALaSouris` — **à la souris, le libellé s'écrit à côté de l'icône** :
  le carré devient un bouton `sm` à libellé (28 px, 10 px de côté). Au doigt,
  l'icône seule (« Éditer ce deck » en pied du détail d'un deck, un crayon au
  téléphone). ⚠️ **Un seul élément, deux dessins** — et non une icône `lg:hidden`
  plus un bouton `hidden lg:inline-flex` : deux éléments pour un geste, c'est
  deux cibles au clavier et deux annonces au lecteur d'écran.
  ⚠️ **À CADRE à la souris** (`.btn-secondary` : fond `panel`, contour
  `border`, survol `panel2` ; `danger` : contour et texte `bad`, survol
  `bad-soft`) — un bouton à libellé posé parmi d'autres boutons à libellé
  doit leur ressembler. Nu, il ne ressortirait pas.
