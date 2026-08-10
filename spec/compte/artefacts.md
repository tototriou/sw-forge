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

## Filtres

**Une rangée par axe**, chacune avec son intitulé : `Catégorie` · `Attribut` ·
`Type` · `Rareté`. ⚠️ Tout sur une seule ligne, le contrôle de catégorie et les
neuf pastilles passaient à la ligne au hasard de la largeur — on ne voyait plus
où finissait un filtre et où commençait le suivant.

Les quatre intitulés ont une **largeur fixe** (`w-[86px]`) : les rangées de
boutons démarrent ainsi sur une même colonne. Laissés à leur largeur naturelle,
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

## Pagination

`Pager` : 60 tuiles/page (DOM borné). En-tête : nombre filtré (« N sur M »).

## Données sous-jacentes

Depuis `parseAccountInventory` (voir [../shared/import-compte.md](../shared/import-compte.md)) :
- `kind` `element` / `archetype` — soit **Attribut** / **Type** à l'écran (via
  `type`, `attribute`, `unit_style`),
- rareté = **`natural_rank`** (le champ `rank` vaut toujours 5),
- substat « modifié » = `sec_effects[i][4] > 0` (`enchant`),
- stat principale : `pri_effect` (100 = PV, 101 = ATQ, 102 = DEF plats).
