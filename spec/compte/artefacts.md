# Mon compte — Artéfacts (`#/compte/artefacts`)

Explorer **tout l'inventaire d'artéfacts**. Composant :
`ArtifactsSection` ([ArtifactsSection.tsx](src/components/account/ArtifactsSection.tsx)).

## ⚠️ Les deux sortes s'appellent **Attribut** et **Type**

Ce sont les noms du **jeu**, et c'est ce qui s'affiche partout dans l'app :
tuiles, filtres, fiche d'équipement, recommandations de siège.

`element` / `archetype` restent les **clés des données com2us** (`type` 1 / 2) et
ne doivent jamais remonter à l'écran : un joueur qui lit « Archétype » dans
SW Forge et « Type » dans son jeu ne fait pas le rapprochement.

Table de correspondance unique : `ARTIFACT_KINDS` dans [types.ts](src/types.ts) —
les libellés ne sont pas réécrits dans chaque écran.

## Contenu

- **Tuiles** : icône d'artéfact (attribut ou type), niveau (+X), **stat
  principale** (`ArtifactIcon` + `formatArtifactMain`). Bord gauche coloré par
  rareté. Tuiles mémoïsées.
- **Détail au clic** : carte récap façon jeu (`ArtifactDetailBox`) en **popover
  flottant à placement automatique** (même composant que les runes,
  [DetailPopover.tsx](src/components/account/DetailPopover.tsx)) — stat principale,
  substats (↻ orange si modifié), type.
- **Tri** : par **rareté décroissante** puis **niveau décroissant**.
- **Propriété recherchée mise en avant** : sur chaque tuile, la ligne de substat
  qui correspond à un critère posé porte un **liseré d'accent à gauche et un fond
  d'accent à 8 %**.
  - ⚠️ **Léger, juste de quoi attirer l'œil.** On balaie 60 tuiles de 4 lignes :
    ce qu'il faut, c'est savoir *où* regarder, pas rendre la ligne criarde.
  - ⚠️ **Le texte n'est pas recoloré** : il deviendrait moins lisible que les
    trois autres lignes, alors qu'on veut justement le lire.
  - ⚠️ **L'accent, pas `good`/`warn`** : ce n'est pas un état de la donnée mais
    un **écho du filtre**. C'est la couleur du critère posé juste au-dessus, donc
    le lien se fait tout seul. Le vert de la pastille de procs, lui, parle des
    valeurs — les deux signaux ne doivent pas se confondre.
  - ⚠️ **Aucun décalage** : marges négatives + `pl-[2px]` compensent le liseré,
    et la ligne ne prend pas de marge verticale. Sans ça, la ligne visée se
    décale des trois autres — et c'est ce décalage qu'on voit en premier, pas la
    propriété. La pastille de procs reste sur la même colonne, le `space-y-[3px]`
    est préservé.
  - Les codes sont passés à la tuile dans un **`Set` mémoïsé** : `ArtTile` est
    mémoïsée, une référence neuve à chaque rendu casserait le `memo` des 60
    tuiles à chaque frappe dans un seuil.

## Filtres

**Une rangée par axe**, chacune avec son intitulé : `Catégorie` · `Attribut` ·
`Type` · `Rareté` · `Stat principale` · `Propriété`. ⚠️ Tout sur une seule ligne,
le contrôle de catégorie et les neuf pastilles passaient à la ligne au hasard de
la largeur — on ne voyait plus où finissait un filtre et où commençait le suivant.

Les intitulés ont une **largeur fixe** (`w-[86px]`) : les rangées de boutons
démarrent ainsi sur une même colonne. Laissés à leur largeur naturelle,
« TYPE » et « CATÉGORIE » décalaient leurs rangées l'une par rapport à l'autre.

- **Catégorie** : `Tous` · `Attribut` · `Type`.
  - ⚠️ L'intitulé de la rangée est **« Catégorie »**, pas « Type » : une des deux
    valeurs s'appelle déjà « Type », et un en-tête homonyme au-dessus de son
    propre bouton se lit comme un doublon.
  - Si Attribut : sous-filtre **Eau / Feu / Vent / Lumière / Ténèbres**.
  - Si Type : sous-filtre **Attaque / Défense / PV / Support**.
  - ⚠️ **Les neuf pastilles sont TOUJOURS affichées.** Celles hors de la
    catégorie choisie sont **grisées**, jamais retirées : des boutons qui
    disparaissent réorganisent la barre sous le curseur, on perd des yeux ce
    qu'on visait, et rien ne dit pourquoi ils sont partis. Grisées, elles
    montrent ce qui existe et ce qu'il faut changer pour y accéder. Même règle
    que la grille de sets d'une recommandation (voir
    [../siege/recommandations.md](../siege/recommandations.md)).
  - ⚠️ **Choisir une valeur ne bascule PAS la catégorie.** Elle le faisait, pour
    masquer la rangée devenue inutile — mais on se retrouvait sur « Attribut »
    sans l'avoir demandé, et **retirer la valeur laissait ce cran posé** : un
    filtre restait actif alors qu'on venait de tout désélectionner.
  - Les deux axes **s'excluent** (un artéfact est d'attribut *ou* de type) :
    poser une valeur d'un axe efface celle de l'autre, et une valeur hors de la
    catégorie choisie **ne filtre pas** — sur « Attribut », un archétype resté
    sélectionné viderait la liste sans qu'on voie pourquoi.
  - **Chips de valeur : icône du jeu + libellé.** On reconnaît un attribut ou un
    archétype à son symbole ; le texte seul obligeait à lire.
  - ⚠️ Les chips d'**attribut** sont **exactement celles de la box** — mêmes
    classes, même [elementStyles.ts](src/components/elementStyles.ts), même taille
    d'icône. Filtrer par élément doit se présenter pareil d'un écran à l'autre,
    et une seconde copie divergerait (voir [monstres.md](monstres.md)).
  - ⚠️ Les chips de **type** restent **neutres, sans couleur propre** : les quatre
    archétypes n'ont pas de code couleur dans le jeu, en inventer un donnerait à
    croire qu'il veut dire quelque chose. L'icône les distingue, la surbrillance
    dit lequel est posé.
  - ⚠️ **Catégorie est un contrôle à cran** (`Segmented`), pas trois pastilles :
    les trois choix **s'excluent**, alors que des pastilles séparées se lisent
    comme des filtres cumulables — ce que sont justement les chips de valeur
    juste à côté. Le cadre commun dit l'exclusivité sans un mot.
  - Elle reste **sans icône** : c'est un **mode d'affichage**, pas une valeur — et
    le jeu n'a pas de symbole pour « Attribut » ou « Type » pris globalement.
- **Rareté** : chips (Légendaire → Commun), aux couleurs du jeu (`RARITY_META`).
  - ⚠️ **Même typographie que les autres chips de la page** (`font-semibold`,
    casse normale). Le gras majuscule espacé qu'elles portaient venait de la
    bannière du jeu — reproduite à raison dans la fiche d'artéfact, mais isolée
    dans une rangée de filtres elle se lisait comme un composant étranger collé
    là. Les **couleurs** restent : elles portent une information.

- **Stat principale** : `Toutes` · `PV` · `ATQ` · `DEF`. Libellés et ordre pris
  d'`ARTIFACT_MAIN` ([effects.ts](src/lib/effects.ts)) — pas de quatrième table
  de libellés dans l'écran.
  - ⚠️ **Une seule à la fois**, d'où un contrôle **à cran** (`Segmented`) et non
    des pastilles : un artéfact ne porte qu'une stat principale, et ce qu'on
    cherche est « montre-moi mes artéfacts de VIT », pas une union de deux
    stats. Des pastilles séparées se liraient comme cumulables — ce que sont
    justement la rareté au-dessus et les propriétés en dessous. Même
    raisonnement et même composant que la rangée Catégorie.
  - ⚠️ **« Toutes » est une option**, pas l'absence de sélection : le cadre
    montre toujours quel cran est posé, là où trois boutons tous éteints ne
    diraient pas si le filtre est inactif ou simplement vide. C'est aussi ce qui
    distingue cette rangée de Rareté, où l'ensemble vide veut dire « toutes ».
  - ⚠️ L'intitulé se replie sur **deux lignes** au lieu d'être abrégé en « Stat
    princ. » : en 11 px capitales espacées, « STAT PRINCIPALE » dépasse les 86 px
    de la colonne. L'abréger trahirait le nom du jeu, élargir la colonne
    décalerait les cinq autres rangées — le repli tient dans la hauteur déjà
    occupée par le contrôle.

- **Propriété** : la **barre de rappel + modale** du jeu — le **même dispositif
  que les runes**, décrit en détail dans
  [runes.md](runes.md#filtre-par-propriété-secondaire--%EF%B8%8F-la-modale-du-jeu) :
  2 ou 4 cases montrant chacune son critère (« Vol de vie +8 ~ +12 »), la
  bascule 2 ↔ 4 (`Rows2` / `Grid2x2`), et une modale listant toutes les
  propriétés avec **Min** et **Max**.
  - Mêmes composants ([SubSearchBar.tsx](src/components/account/SubSearchBar.tsx),
    [SubSearchDialog.tsx](src/components/account/SubSearchDialog.tsx)) : la
  grille de menus déroulants qui vivait ici a été **remplacée**, pas dupliquée.
  - ⚠️ Seule la **largeur de la modale** diffère — **520 px** contre 380 pour les
    runes : « Dgts supp. en prop. de ATQ » ne tient pas dans la largeur d'un
    « VIT ». C'est le seul paramètre qui sépare les deux usages.
  - ⚠️ Les critères restent **ORDONNÉS** : le premier trie la liste, le deuxième
    départage les ex æquo. Un rappel l'écrit sous la barre dès qu'il y en a deux
    — sans lui, « 1 » et « 2 » passent pour des emplacements d'artéfact.
  - Les propriétés proposées sont celles **réellement portées** par un artéfact
    de l'inventaire, restreintes à la catégorie choisie, dans l'ordre du jeu
    (`artifactSubOrder`).

## Pagination

`Pager` : 60 tuiles/page (DOM borné). En-tête : nombre filtré (« N sur M »).

## Données sous-jacentes

Depuis `parseAccountInventory` (voir [../shared/import-compte.md](../shared/import-compte.md)) :
- `kind` `element` / `archetype` — soit **Attribut** / **Type** à l'écran (via
  `type`, `attribute`, `unit_style`),
- rareté = **`natural_rank`** (le champ `rank` vaut toujours 5),
- substat « modifié » = `sec_effects[i][4] > 0` (`enchant`),
- stat principale : `pri_effect` (100 = PV, 101 = ATQ, 102 = DEF plats).
