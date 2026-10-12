# Système visuel — mouvement et gestes

Partie de [Système visuel](README.md).

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
  [02-app/rta/](../../../02-app/rta/) et
  [02-app/siege/](../../../02-app/siege/)) : un filtre
  au-dessus d'une liste vide n'a rien à filtrer, et laisse parfois croire
  qu'on n'a rien trouvé alors qu'il n'y a rien.

### Ce qui se confirme, et ce qui ne se confirme pas

⚠️ **Un geste se confirme quand ce qu'il détruit ne se retrouve pas.** Le critère
n'est pas le mot « supprimer » sur le bouton, c'est le coût de l'erreur.

**Se confirme** — la donnée est saisie à la main et perdue sans retour :

| Geste | Ce qui part |
|-------|-------------|
| Retirer un monstre d'un slot de siège | Sa vitesse saisie, son tick |
| Supprimer un monstre créé à la main | Le monstre entier : il n'existe pas dans les données du jeu |
| Supprimer une section RTA | Le classement — les monstres, eux, reviennent en « Non classé » |
| Supprimer / vider une catégorie | L'appartenance, cochée un monstre à la fois |
| « Tout effacer » (prépa, équipes, recommandations) | Tout le côté |
| Effacer les données du compte | Tout |

**Se DÉFAIT au lieu de se confirmer** (refonte graphique, lot 13, décision
29 du mainteneur) — le geste se fait tout de suite, puis une **notification
« … · Annuler »** le laisse revenir en arrière quelques secondes :

| Geste | Notification |
|-------|--------------|
| Retirer un monstre de la prépa RTA | « {Monstre} retiré de ta prépa » |
| Supprimer une équipe de siège | « Équipe retirée de la défense / de l'offense » |
| Supprimer un deck | « Deck supprimé » |
| Supprimer une recommandation | « Recommandation supprimée » |

⚠️ **« Annuler » remet l'élément À SA PLACE, tel quel** — même position dans
la liste, mêmes vitesses, mêmes sets, même section —, pas une copie ajoutée
au bout. Voir « Notification « Annuler » » plus bas.

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
