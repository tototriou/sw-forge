# Recommandations — rendu de la page

Partie de [Siège · Recommandations](README.md).

## En-tête de la page et barre d'outils

⚠️ **En-tête BUREAU** — même règle que la RTA et Défense / Offense : le titre
« Recommandations », le compteur, puis les actions par `BarreActions` —
**toutes en boutons quand elles tiennent sur la ligne**, sinon **Importer** et
**Créer une recommandation** visibles, dans cet ordre, et **Tout exporter**,
**Tout effacer** (séparé, en `bad`) dans le menu « ⋯ » Plus d'actions. Aucune
action mise en avant. Au doigt, les actions sont dans le panneau « Options ».

⚠️ **À la souris, une seule barre d'outils sous l'en-tête** :
Vue (Attaque / Défense) · filet vertical · recherche par monstre et ses trois
cases, sur la même ligne ; « Rôle » passe dessous quand une recherche est
posée.

## En-tête d'une recommandation et actions d'un deck

⚠️ **À la souris, l'en-tête d'une recommandation tient sur UNE ligne** :
chevron · titre · Importée · decks · auteur, un ressort, puis **au bout**
« Analyser mes decks » (bouton **à cadre**, comme les autres boutons à libellé
de la page : fantôme, il ne se lirait pas comme un bouton parmi les icônes
nues), un filet vertical et Exporter / Éditer / Supprimer. Au doigt, l'en-tête
tient sur deux rangées.

⚠️ **À la souris, le crayon d'un deck n'est pas dans la ligne** : la ligne n'a
que ses quatre colonnes (chevron · offense · fort contre · verdict, ce dernier
aligné à droite), et l'édition est **« Éditer ce deck » écrit en toutes
lettres, en PIED du détail déplié**, à droite, sous un filet (en édition :
« Terminer l'édition de ce deck »), avec **« Supprimer ce deck » à l'autre
bout, TOUJOURS présent** — la confirmation est le garde-fou. Au doigt aussi,
la corbeille suit le crayon en permanence. Ces boutons ont un **CADRE** à la
souris, comme les autres boutons à libellé : `BoutonIcone`
`libelleALaSouris`. Replié, un deck ne montre donc pas d'action d'édition : on
le déplie d'abord. C'est le MÊME bouton qu'au doigt, placé sur la 3ᵉ rangée de
la grille du deck. **En édition de la recommandation**, Ajouter un deck vide
et Importer un deck d'offense forment le **pied du tableau des decks**, à
droite, en boutons **pointillés à fond**. **« + Défense »** est un bouton `sm`
pointillé à fond au bout de la rangée des défenses visées : fantômes, ces
trois boutons ne ressortiraient pas. « Déplier tous les decks » est en HAUT du
tableau — en bas, son clic le repousserait de toute la hauteur des decks
dépliés (un clic ne déplace jamais ce qu'on vient de cliquer).

## Boutons d'icône et boutons à libellé

⚠️ **À la souris, UN seul bouton d'icône sur toute la page** : un carré de
28 px aux coins arrondis, sans cadre ni fond, voile au survol — chevron de la
recommandation, chevron de chaque deck, Exporter, Éditer, Supprimer
(`ICONE_LG` dans
[RecoCard.tsx](../../../../src/components/siege/RecoCard.tsx)). Les deux
crayons sont des `BoutonIcone`, le ✓ doré posé sur l'icône. « Analyser mes
decks » et « Déplier tous les decks » (bouton fantôme de la librairie) ont la
même hauteur de 28 px. Cette règle ne vaut qu'à la souris.

En édition : **28 px de haut pour tout bouton à libellé et toute pastille de
filtre**, à la souris (`BOUTON_LG`) — Ajouter un deck vide, Importer un deck
d'offense, + Set, + Possibilité, les pastilles de verdict, « Tout afficher »
(bouton fantôme). Le ✓ « Terminer » d'une défense est un `BoutonIcone`, de la
taille de la corbeille voisine. Restent à part, et c'est
voulu : **« + Défense »** au doigt (la hauteur des vignettes qu'il prolonge ;
à la souris, bouton `sm` pointillé à fond, voir plus haut), les
**croix posées dans une puce** (set, propriété d'artéfact, monstre d'une
défense — `serre`, 20 px, la puce est plus petite qu'un bouton), le **crayon
posé sur le coin d'une vignette**, la **grille des sets** (icônes du jeu) et
les **liens dans une phrase** (« Chercher partout », « Effacer la
recherche »).

## Couleurs et pastilles de statut

⚠️ **Couleurs : pas d'aplats teintés.** Si la carte d'une recommandation,
chaque deck, chaque monstre et l'encart de synthèse se teintaient chacun en
vert / orange / rouge, une page analysée deviendrait un patchwork :

- cartes **neutres** (fond de panneau, contour discret) ; le statut d'un deck
  ou d'un monstre se lit au **contour** (au doigt) et aux **pastilles** —
  même règle que les équipes de siège ;
- ⚠️ **les pastilles de statut sont COLORÉES en entier**
  (`.pill.good/.warn/.bad` : fond doux du ton, texte du ton, sans contour) —
  la pastille Verdict de chaque ligne de deck, les puces de la carte repliée
  (un deck, ou une défense en vue Défense) **et les pastilles de filtre du
  résumé d'analyse**, colorées dès le repos pour que le résumé et les decks en
  dessous parlent la même couleur — enclenchée, une pastille de filtre prend
  en plus le contour de son ton, seul marqueur d'état. Une couleur réduite à
  un point de 6 px ne serait pas assez vive. Non analysé : neutre. Le point
  reste dedans (son creux distingue « monstre manquant » de « à revoir »).
  `PASTILLE_STATUT` dans RecoCard.tsx ; contrastes texte / fond doux mesurés
  dans les deux thèmes, 4,63:1 au plus bas ;
- l'encart de synthèse est neutre, son icône et son titre portent la couleur ;
- jetons de sets et de propriétés d'artéfact, rapport d'import : les **fonds
  doux** (`good-soft`, `warn-soft`, `bad-soft`) avec le texte à l'encre (les
  filtres de verdict ont le texte de leur ton, voir ci-dessus). Contrastes
  mesurés, 4,91:1 au plus bas (`warn` ocre sur `warn-soft`, Atelier ; le rouge
  `bad` fait 5,53 sur `bad-soft` en Forge) ;
- « Importée » : pastille neutre (un contour d'accent la ferait passer pour
  un élément sélectionné).
