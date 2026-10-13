# Runes — onglet Liste

Partie de [Mon compte — Runes](README.md).

## Onglet Liste — `RunesList`

⚠️ **À la SOURIS, un en-tête** :
« Liste » et le nombre de runes de l'INVENTAIRE ; le compte FILTRÉ est
au-dessus des tuiles. La **pagination** (`Pager`, partagé par toutes les
pages qui paginent) a ses flèches en `BoutonIcone` de la librairie : même
carré de 28 px à cadre, même zone tactile de 44 px.

### ⚠️ La tuile EST la carte du jeu

La tuile n'est pas un aperçu qui mènerait au détail : c'est **`RuneDetailBox`
elle-même**, en rendu resserré (`compact`). Tout ce qu'on vient chercher dans
l'inventaire y est d'emblée — un aperçu qui cacherait les substats obligerait à
ouvrir les runes une par une pour comparer, ce qui est exactement ce qu'on fait
en parcourant 2 000 runes.

- **En-tête sur UNE ligne** : l'**image de la rune** à gauche
  ([RuneSlotIcon.tsx](src/components/RuneSlotIcon.tsx) — cadre orienté selon le
  slot, symbole du set colorisé par rareté, halo si antique), la **stat
  principale** et l'**innée** au centre, la **bannière de rareté** et la **mesure
  choisie** à droite. Dans leur propre bloc, ces deux dernières prendraient
  deux lignes rien que pour elles.
- **Substats** : base en blanc, **part de meule en orange**, ↻ si la ligne a été
  modifiée. ⚠️ **Alignés à gauche, valeur collée à son libellé** — et non la
  valeur poussée au bord droit de la case : « VIT +26 +5 » se lit d'un bloc, là
  où une valeur cadrée à droite oblige l'œil à traverser du vide sur chaque
  ligne. C'est le rendu du jeu.
- ⚠️ **Un clic sur la carte bascule détail ↔ total.** « VIT +26 +5 » devient
  « VIT +31 » : la première lecture sert à **juger** une rune (ce qu'elle valait
  d'origine, ce que la meule a ajouté), la seconde à la **comparer** à un
  minimum, où seul le total compte. Les deux sont utiles, d'où la bascule plutôt
  qu'un choix.
  - ⚠️ **Le total prend la couleur du BONUS** (orange) dès qu'une meule entre
    dedans : le nombre n'est plus la valeur d'origine, et le laisser en blanc
    ferait croire qu'on lit toujours la base. La couleur dit « ce nombre inclut
    la meule ».
  - ⚠️ Une rune **sans aucune meule n'est pas cliquable** : les deux lectures y
    sont identiques, et un clic sans effet se lit comme un défaut.
  - L'état est **propre à chaque carte** et n'est pas mémorisé : c'est un coup
    d'œil, pas un réglage.
  - ⚠️ **La tuile est un VRAI `<button>`** (`RuneDetailBox imbrique={false}`), pas
    le `<div role="button">` qu'emploie la même carte **en popover** (siège, prépa
    RTA, optimiseur), où un `<button>` imbriqué dans le flottant cliquable serait
    du HTML invalide. À plat dans la grille, rien n'impose ce détour — et sur
    téléphone il **coûterait le clic** : un `<div>` rempli de texte laisse le tap
    déclencher une **sélection de texte** (`user-select` par défaut) au lieu de la
    bascule. Voir [interface/](../../../03-developpeur/interface/) (`ZoneCliquable`).
- La ligne **recherchée** prend un **liseré d'accent + un fond à 8 %**, avec les
  compensations qui l'annulent exactement — sinon elle se décale par rapport aux
  autres, et c'est ce décalage qu'on voit en premier.
- **Bonus de set** en pied, comme dans le jeu.
- ⚠️ **Pas de popover au clic** : il ne montrerait rien de plus, tout étant
  déjà sur la tuile. Le clic sert à basculer détail ↔ total.

#### ⚠️ Deux grilles, une par format

| Format | Grille | Tuile |
|---|---|---|
| **Bureau** (`lg` et au-delà) | `auto-fill` à **215 px** | carte entière |
| **Téléphone** (sous `lg`) | **deux colonnes fixes** | rendu **étroit** |

- Le **215 px** du bureau est la largeur en dessous de laquelle la bannière de
  rareté passe **sous** la stat principale — chaque tuile gagne alors une ligne,
  l'inverse du but. En mode compact, la bannière perd son espacement de lettres
  et se resserre **justement pour descendre jusque-là** : c'est elle qui dicte
  la largeur minimale de toute la grille.
- ⚠️ **Sur téléphone, `auto-fill` ne peut pas donner deux colonnes** : à
  390 px d'écran il reste ~358 px utiles, soit moins que deux fois 215 px, et il
  retomberait toujours sur **une seule rune par rangée** — un défilement
  interminable sur 3 000 runes. D'où deux colonnes **fixes**, et non un seuil de
  plus.

#### Le rendu ÉTROIT — le seul endroit où la carte montre moins

À deux colonnes, la tuile tombe à **~175 px** (159 px de contenu). L'en-tête y
tient sur une ligne : icône 36 px + stat principale + bloc rareté/mesure. Trois
retraits, et trois seulement — chacun rendu nécessaire par le précédent :

1. **La bannière prend son abréviation** (`RARITY_META.court` — « Lég », « Hér »,
   « Rare », « Mag », « Com »). ⚠️ **Le seul libellé du jeu abrégé de toute
   l'app** ; le mot entier reste en `title`. « LÉGENDAIRE » seul prendrait la
   moitié de la largeur utile.
2. **La mesure abrège son libellé** — « Effi » / « Score », le début du mot
   entier et non un autre mot. « Score SW » dicterait la largeur du bloc de droite
   (~66 px contre ~47 px pour la bannière abrégée). ⚠️ **Le libellé est gardé,
   pas supprimé** : la mesure est un réglage *global*, elle ne se lit nulle part
   ailleurs sur la page, et une valeur nue ne dirait pas ce qu'on mesure.
3. **Le bonus de set n'est pas rendu.** C'est la ligne la plus longue de la carte
   (« Chance de tour supplémentaire 22% »), et la seule qui se **déduit
   d'ailleurs** : le symbole de set est déjà porté par l'icône.

Et deux ajustements, qui ne sont pas des retraits :

- Le **cadre de rune fait 30 px**. ⚠️ **Pas en dessous de 30** : le
  symbole de set gravé dans le cadre cesse alors de se reconnaître, or c'est lui
  qui dit à quel set appartient la rune — l'abréviation de rareté ne le dit pas,
  et le bonus de set n'est pas rendu.
- **Tout l'en-tête descend au cran `nano`** : stat principale, innée, mesure et
  bannière. C'est ce qui permet de **garder** le libellé de la mesure plutôt que
  de le supprimer. ⚠️ La stat principale y rejoint l'innée en TAILLE, mais leur
  hiérarchie tient toujours par le **poids** et la **couleur** (`font-black` +
  `ink` contre `font-semibold` + `water`) — la taille n'est que le troisième
  marqueur. La bannière resserre aussi son rembourrage (`px-1`) : à cette
  échelle, `px-1.5` autour de « LÉG » se lirait comme une pastille de filtre.

| | Bureau | Étroit |
|---|---|---|
| Cadre de rune | 36 px | **30 px** |
| Stat principale | `sm` (13 px) | **`nano`** (10 px) |
| Innée | `micro` (11 px) | **`nano`** (10 px) |
| Mesure | `micro`, « Score SW » | **`nano`**, « Score » |
| Bannière | `micro`, « LÉGENDAIRE » | **`nano` `px-1`**, « LÉG » |
| Bonus de set | en pied | — |

##### ⚠️ Les libellés longs restent sur deux lignes — c'est assumé

À ~175 px de tuile il reste **~59 px** à gauche de la colonne rareté/mesure
(159 de contenu − 30 de cadre − 16 d'écarts − 54 pour « Score 293 », le plus
long des deux éléments empilés à droite). Or « Taux Crit +58% » occupe ~84 px
même à 10 px : une ligne unique demanderait ~7 px, illisible.

Ce qui la donnerait, c'est de faire **descendre rareté et mesure sous le
texte** — 121 px alors disponibles, « Taux Crit +58% » tiendrait en 12 px.
**Écarté volontairement** : l'en-tête resterait sur deux lignes de toute façon
(bannière et mesure sont déjà empilées), pour un gain qui ne porte que sur les
trois libellés de 14 caractères — « Taux Crit », « Précision », « Dmg Crit ».
Les autres (`PV +2448`, `VIT +42`, `DEF +160`) tiennent déjà sur une ligne.

⚠️ **`etroit` et `resserre` sont deux axes distincts, qui se cumulent.**
`resserre` rogne les corps, les marges et les interlignes — il ne retire jamais
rien. `etroit` retire. Confondre les deux aurait fait disparaître le bonus de set
partout où la carte est déjà compacte (siège, prépa RTA), où la place ne manque
pas.
> La même carte sert **en popover** ailleurs dans l'app (détail d'un monstre,
> candidat de l'Optimizer) : elle y est rendue **sans `compact`** et sans image,
> celle-ci étant déjà sur l'élément qui a ouvert le flottant.

- **Filtres** : **sets** (`SetFilter`) et **slot** (`SlotFilter`) — voir
  ci-dessous — plus **antiques**, et la **propriété secondaire** (ci-dessous).
- La **mesure** (réglage global, voir plus haut) pilote la valeur des tuiles, le
  départage des tris et le repère « meilleur… » de l'en-tête.

### Tri — ⚠️ les entrées DU JEU, dans SON ordre

Un joueur qui trie ses runes cherche l'entrée qu'il connaît, pas une
reformulation : les libellés sont donc **ceux du jeu**, dans l'ordre de sa liste
déroulante (règle de vocabulaire du [conventions](../../../03-developpeur/)). Calcul pur dans
[runeSort.ts](src/lib/runeSort.ts), testé par
[rune-tri.test.ts](tests/rune-tri.test.ts).

⚠️ **Le tri de la Liste est une LISTE DÉROULANTE**, à la hauteur des filtres de
la ligne à la souris (32 px) : en onglets (`Segmented`), ses neuf entrées
feraient ~920 px. Le tri de l'**Optimisation**, cinq entrées (~640 px), est en
onglets à la souris ; au doigt, les deux sont des listes déroulantes.

⚠️ **« Trier par » est AU-DESSUS de la propriété secondaire**, aux deux
formats — trier vient avant filtrer. L'avertissement des deux tris
« propriété » dit donc « Choisis une propriété **ci-dessous** pour trier
dessus ».

⚠️ **Le panneau « Filtrer mes runes » (téléphone) est rangé en deux blocs
intitulés** :
**« Trier »** (le sélecteur et le sens ; l'intitulé « Trier par » y est masqué,
redondant), puis **« Filtrer »** (sets, emplacement, antiques, propriété
secondaire), puis **« Effacer les filtres »** — le même bouton qu'au bout de la
ligne de filtres à la souris (`EffacerFiltres`). Le tri est en tête par
l'ORDRE DU DOM, sans règle CSS `order`.

| Entrée | Clé de tri |
|--------|-----------|
| **Grade** | rareté, puis étoiles |
| **Propriété secondaire** | la valeur de la **1ʳᵉ propriété cherchée**, meule comprise |
| **Sous-propriété avant meule** | la même, **meule déduite** (`grind`) |
| **Nv. d'amélioration** | le `+X` |
| **Obtenu** | les plus récentes d'abord |
| **Total des sous-prop.** | somme des quatre propriétés |
| **Score** *ou* *Efficience* | la mesure choisie dans le menu ⚙ (défaut) |
| *Slot* | du 1 au 6 |

⚠️ **Une seule entrée de mesure, celle du menu ⚙** : « Score » (le score du
jeu) quand le ⚙ est sur Score SW, « Efficience » (notre mesure, %) quand il
est sur Efficience. Deux entrées côte à côte classeraient aussi par la mesure
qu'on ne voit pas sur les tuiles, pour un classement presque identique. Un tri
mémorisé sur l'autre mesure suit le ⚙ (et un tri inconnu retombe sur la mesure
active).

« Efficience » et « Slot » n'existent pas dans le jeu et **ferment** la
liste : l'efficience est notre mesure, le slot sert au repérage.

- ⚠️ **« Avant meule » DÉDUIT la meule**, il ne l'ignore pas : deux runes à
  20 % ne se valent pas si l'une y est arrivée seule et l'autre à coups de
  meules. C'est toute la raison d'être de cette entrée.
- ⚠️ **Une rune qui ne PORTE PAS la propriété passe derrière** toutes celles qui
  la portent, quelle que soit son efficience — et **non « à 0 »**, ce qui la
  mêlerait aux plus faibles. Absent et nul ne sont pas la même chose.
- Les deux tris « propriété » n'ont **rien à classer sans critère posé** : ils
  retombent sur la mesure, et **le disent** sous le sélecteur — sans ça on croit
  le tri cassé.
- ⚠️ **« Obtenu » se lit sur le `rune_id`**, croissant avec le temps : l'export
  ne porte **aucune date d'obtention**. C'est une approximation, mais elle rend
  exactement l'ordre du jeu.
- ⚠️ **« Total des sous-prop. » additionne des unités différentes** (PV plats et
  %), ce qui n'a mathématiquement aucun sens — mais c'est ce que fait le jeu, et
  c'est ce total-là que le joueur reconnaît. On le reproduit tel quel plutôt que
  d'inventer une mesure « correcte » qu'il ne retrouverait nulle part.
- Un tri **mémorisé qui n'existe plus** retombe sur le défaut : sans ce
  garde-fou, le comparateur serait `undefined` et la page blanche.

#### Le SENS du tri — un axe à part, un bouton

Un bouton collé au sélecteur retourne le classement
([BoutonSensTri](src/components/BoutonSensTri.tsx), `SensTri` dans
[tri.ts](src/lib/tri.ts)). Il vaut pour le **critère courant, quel qu'il soit**.

- ⚠️ **Un AXE, pas deux entrées de plus par critère.** Doubler la liste
  déroulante (« Score ↓ », « Score ↑ »…) l'aurait allongée de neuf entrées, sans
  que rien ne dise que ce sont les mêmes classements à l'envers.
- ⚠️ **Décroissant par défaut**, partout : une liste d'inventaire répond d'abord
  à « qu'est-ce que j'ai de mieux ? ». L'ordre inverse sert une question précise
  (« qu'est-ce que je peux nourrir ? »), qu'on pose en la demandant.
- ⚠️ **L'ABSENCE reste en queue dans les DEUX sens.** Une rune qui ne porte pas
  la propriété triée n'est pas une petite valeur : la remonter en tête là où l'on
  cherche justement les plus faibles serait un contresens. C'est pourquoi le sens
  est passé **dans** `comparateurRunes` plutôt qu'appliqué de l'extérieur
  (`-cmp(a, b)`), ce qui aurait retourné cette règle avec le reste. Épinglé par
  [rune-tri.test.ts](tests/rune-tri.test.ts).
- L'icône dit l'**état courant** (flèche vers le bas = du plus grand au plus
  petit), comme un tableur ; le `title` annonce l'action.
- ⚠️ **Dans le panneau mobile, il reste À CÔTÉ du sélecteur** : tout y prend la
  largeur, ce qui l'aurait renvoyé seul à la ligne suivante. Une règle dédiée
  rend la largeur au sélecteur et laisse le bouton à sa taille (voir
  `index.css`, `[data-tri-bloc] select`).
- Le même bouton sert à l'**Optimisation** et à la **liste d'artéfacts** (voir
  [feat-artefacts.md](../feat-artefacts.md)) : un seul geste à apprendre.

### Filtre par propriété secondaire — ⚠️ la MODALE du jeu

Le jeu pose la question dans l'autre sens que quatre menus déroulants : au lieu
de « quelle propriété pour la case 1 ? », il montre **toutes les propriétés** et
on coche celles qu'on veut. On lit d'un coup ce qui est disponible, et on compare
les bornes d'une ligne à l'autre — impossible à travers des menus qui n'en
montrent qu'une à la fois.

Deux pièces, reprises telles quelles :

| Pièce | Fichier | Rôle |
|-------|---------|------|
| **Barre de rappel** | [SubSearchBar.tsx](src/components/account/SubSearchBar.tsx) | 2 ou 4 cases numérotées + la bascule 2 ↔ 4 |
| **Recherche détaillée** | [SubSearchDialog.tsx](src/components/account/SubSearchDialog.tsx) | la modale : toutes les propriétés, **Min** et **Max** |

- ⚠️ **Les cases sont un RAPPEL, pas un formulaire.** Elles affichent le critère
  posé (« VIT +25 ~ +37 ») et ne servent qu'à ça. Toute la saisie vit dans la
  modale : quatre menus déroulants occuperaient toute la largeur pour n'afficher
  que trois lettres, et un seuil unique ne saurait pas dire « entre 25 et 37 ».
- **Bascule 2 ↔ 4 cases**, par les **deux icônes du jeu** : deux barres empilées
  (`Rows2`) pour 2 propriétés, une grille 2×2 (`Grid2x2`) pour 4. Elles disent la
  forme de la grille qu'on obtient, sans un mot.
  - ⚠️ L'icône montre l'état **à venir**, pas l'état courant : c'est un bouton,
    on y lit ce qu'il va faire.
  - ⚠️ Le mode ne fait que **cacher** des cases : les critères 3 et 4 restent
    posés si on repasse à 2 et réapparaissent tels quels. Les effacer ferait
    perdre une recherche en changeant simplement de vue.
  - ⚠️ **Le mode 4 s'impose** dès qu'il y a plus de deux critères, et le bouton
    se désactive : un critère caché filtrerait la liste sans rien montrer à
    l'écran — on chercherait pourquoi il manque des runes.
  - Le maximum de la **modale suit le mode** : en 2 cases, cocher une 3ᵉ
    propriété poserait un critère invisible dans la barre.
- ⚠️ **Min ET Max**, pas un seuil unique. « VIT entre 25 et 37 » est la recherche
  courante quand on trie ses runes.
  - ⚠️ Un `max` **absent** vaut « pas de plafond » — ce n'est **pas** « au plus
    zéro ». C'est ce qui permet de ne borner que d'un côté.
- **Cliquer une case**, vide ou pleine, ouvre la modale. ⚠️ Pas de bouton « … »
  en plus : les cases y mènent déjà, et un second déclencheur pour le même geste
  n'ajouterait qu'un doublon à côté de la bascule 2/4 — deux carrés voisins dont
  un seul change la forme de la grille.
- ⚠️ La modale travaille sur un **brouillon local**, validé par **OK** : écrire
  directement dans l'état ferait filtrer la liste derrière à chaque frappe, et
  « Annuler » ne voudrait plus rien dire.
- **4 au plus** (une rune ne porte que 4 propriétés). Au-delà, les cases non
  cochées sont **grisées et non retirées** : on voit ce qui existe et pourquoi
  c'est refusé, plutôt qu'une liste qui rétrécit sous le curseur.
- ⚠️ Les critères se cumulent **en ET, bornes comprises**, et la **première**
  sert de clé aux deux tris « propriété » : la position porte du sens.
- ⚠️ **Les bornes sont TOUJOURS affichées**, comme dans le jeu — pas seulement
  une fois la ligne cochée. On voit d'emblée que chaque propriété se borne, et on
  compare les intervalles d'une ligne à l'autre. Elles sont **estompées** tant
  que la ligne est décochée, pour que la lecture reste celle des libellés.
- ⚠️ **Saisir une borne COCHE la ligne** : taper « 25 » en face de VIT veut dire
  qu'on cherche de la VIT. Sans ça, on remplit un champ qui ne sert à rien tant
  qu'on n'a pas trouvé la case.
  - **Vider les deux bornes ne décoche pas** pour autant : « cette propriété,
    sans borne » est une recherche valide — c'est même la plus courante. On ne
    retire une ligne que par sa case.
  - Un **min à 0 s'affiche vide** : zéro ne filtre rien, le champ montre donc son
    placeholder comme s'il n'était pas rempli.

> L'inventaire d'**artéfacts** utilise **le même dispositif** (voir
> [feat-artefacts.md](../feat-artefacts.md)) : mêmes composants, même bascule, même modale.
> Seule la **largeur** diffère — 520 px là-bas, 380 ici : « Dgts supp. en prop.
> de ATQ » ne tient pas dans la largeur d'un « VIT ».
- **Pagination** ([Pager.tsx](src/components/account/Pager.tsx)) : 60 tuiles/page
  → DOM borné (fluide même à ~2000 runes). Composant **partagé par toutes les
  listes paginées** de l'app.
  - Trois éléments : flèche précédente, **champ de saisie de la page**, flèche
    suivante. Les flèches sont de simples icônes ; c'est le champ qui compte.
  - ⚠️ **Le champ est indispensable** : à ~2000 runes on dépasse 30 pages, et
    avancer d'une flèche à la fois est intenable. Une liste de numéros ne
    tiendrait pas sur une ligne à ce volume.
  - La saisie est **séparée de la page réelle** : on doit pouvoir vider le champ
    ou taper « 12 » **sans sauter à la page 1** au premier chiffre. Elle est
    validée à **Entrée** ou à la **perte de focus**, bornée à `[1, N]`, annulée
    par **Échap**, et resynchronisée quand la page change ailleurs (filtre, tri).
- **Rotation animée** : les tuiles utilisent une **clé positionnelle** (et non
  l'id de la rune), donc elles sont **réutilisées** d'une page/d'un filtre/d'un
  tri à l'autre → le cadre **pivote** vers l'orientation de son nouveau slot au
  lieu de sauter. Constante `SPIN` dans
  [RuneSlotIcon.tsx](src/components/RuneSlotIcon.tsx) (300 ms, `ease-out`),
  partagée avec la roue de [MonsterGear.tsx](src/components/MonsterGear.tsx).
