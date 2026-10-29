# Mon compte — Artéfacts (`#/compte/artefacts`)

Explorer **tout l'inventaire d'artéfacts**. Composant :
`ArtifactsSection` ([ArtifactsSection.tsx](src/components/account/ArtifactsSection.tsx)).

## ⚠️ Les deux sortes s'appellent **Attribut** et **Type**

Ce sont les noms du **jeu**, et c'est ce qui s'affiche partout dans l'app :
tuiles, filtres, fiche d'équipement, recommandations de siège.

`element` / `archetype` restent les **clés des données com2us** (`type` 1 / 2) et
ne doivent jamais remonter à l'écran : un joueur qui lit « Archétype » dans
SW Blacksmith et « Type » dans son jeu ne fait pas le rapprochement.

Table de correspondance unique : `ARTIFACT_KINDS` dans [types.ts](src/types.ts) —
les libellés ne sont pas réécrits dans chaque écran.

## Contenu

- **Tuiles** : icône d'artéfact (attribut ou type), niveau (+X), **stat
  principale** (`ArtifactIcon` + `formatArtifactMain`). Bord gauche coloré par
  rareté. Tuiles mémoïsées.
- **Détail au clic** : carte récap façon jeu (`ArtifactDetailBox`) en **popover
  flottant à placement automatique** (même composant que les runes,
  [FlottantAuto.tsx](src/ui/FlottantAuto.tsx)) — stat principale,
  substats (↻ orange si modifié), type.
- **Tri** : par **critères posés** (le premier classe, les suivants départagent),
  puis score, rareté et niveau décroissants.
- **Sens du tri** : un bouton
  ([BoutonSensTri](src/components/BoutonSensTri.tsx)) retourne le classement —
  le même que dans les listes de runes, un seul geste à apprendre.
  - ⚠️ **Il vit à côté du compte et de la pagination**, pas dans le panneau de
    filtres : cette liste n'a pas de sélecteur « Trier par » (son classement
    vient de la grille de propriétés). Il rejoint donc les deux autres réglages
    de **présentation** de la liste, et reste visible aux deux formats.
  - ⚠️ Le sens s'applique à **toute la cascade**, critères et départages : voir
    le premier critère s'inverser sans les suivants donnerait un classement
    illisible.
  - Aucun cas d'« absence » à protéger ici, contrairement aux runes : le filtre a
    déjà écarté les artéfacts qui ne portent pas les propriétés cherchées.
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
le contrôle de catégorie et les neuf pastilles passeraient à la ligne au hasard
de la largeur — on ne verrait plus où finit un filtre et où commence le suivant.

Les intitulés ont une **largeur fixe** (`w-[86px]`) : les rangées de boutons
démarrent ainsi sur une même colonne. Laissés à leur largeur naturelle,
« TYPE » et « CATÉGORIE » décaleraient leurs rangées l'une par rapport à l'autre.

**« Effacer les filtres »** (le même bouton que les runes) : au bout des
filtres, à la souris comme dans le
panneau « Filtrer mes artéfacts ». Il remet la catégorie à **Tous**, retire
l'attribut et le type choisis, recoche **toutes les raretés** et remet la stat
principale à **Toutes**. ⚠️ Il ne touche **pas aux propriétés recherchées** :
comme pour les runes, elles servent aussi à TRIER, et les vider changerait
l'ordre de la liste. Ni au sens du tri. **Toujours affiché, désactivé** quand
rien n'est filtré (« Aucun filtre posé »).

⚠️ **À la SOURIS** : les rangées se suivent **sur
la ligne**, chacune avec son intitulé à sa largeur naturelle, collé à ses
choix — ce qui sépare deux filtres est alors l'écart entre les groupes, plus
la colonne. La rangée `Propriété` prend la place restante (au moins 440 px).
Tout reste visible, rien ne passe en menu : même choix que pour les runes. Au
doigt, les rangées restent empilées dans le panneau « Options ».

### Filtre Catégorie

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
    [../siege/](../siege/)).
  - ⚠️ **Choisir une valeur ne bascule PAS la catégorie.** Sinon on se
    retrouverait sur « Attribut » sans l'avoir demandé, et **retirer la valeur
    laisserait ce cran posé** : un filtre resterait actif alors qu'on vient de
    tout désélectionner.
  - Les deux axes **s'excluent** (un artéfact est d'attribut *ou* de type) :
    poser une valeur d'un axe efface celle de l'autre, et une valeur hors de la
    catégorie choisie **ne filtre pas** — sur « Attribut », un archétype resté
    sélectionné viderait la liste sans qu'on voie pourquoi.
  - **Chips de valeur : icône du jeu + libellé.** On reconnaît un attribut ou un
    archétype à son symbole ; le texte seul obligerait à lire.
  - ⚠️ Les chips d'**attribut** sont **exactement celles de la box** — mêmes
    classes, même [elementStyles.ts](src/components/elementStyles.ts), même taille
    d'icône. Filtrer par élément doit se présenter pareil d'un écran à l'autre,
    et une seconde copie divergerait (voir [feat-monstres.md](feat-monstres.md)).
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

### Filtre Rareté

- **Rareté** : chips (Légendaire → Commun), aux couleurs du jeu (`RARITY_META`).
  - ⚠️ **Liste BLANCHE, tout coché par défaut** — même règle que les filtres de
    runes ([feat-runes/filtres-set-et-slot.md](feat-runes/filtres-set-et-slot.md)) : une rareté cochée est **affichée**, n'en
    cocher **aucune** revient à **ne rien vouloir voir**.
  - ⚠️ **Même typographie que les autres chips de la page** (`font-semibold`,
    casse normale). Un gras majuscule espacé, celui de la bannière du jeu —
    reproduite à raison dans la fiche d'artéfact —, se lirait dans une rangée
    de filtres comme un composant étranger collé là. Les **couleurs** restent :
    elles portent une information.

### Filtre Stat principale

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
    distingue cette rangée de Rareté, cumulable et en liste blanche.
  - ⚠️ L'intitulé se replie sur **deux lignes** au lieu d'être abrégé en « Stat
    princ. » : en 11 px capitales espacées, « STAT PRINCIPALE » dépasse les 86 px
    de la colonne. L'abréger trahirait le nom du jeu, élargir la colonne
    décalerait les cinq autres rangées — le repli tient dans la hauteur déjà
    occupée par le contrôle.

### Filtre Propriété

- **Propriété** : la **barre de rappel + modale** du jeu — le **même dispositif
  que les runes**, décrit en détail dans
  [feat-runes/liste.md](feat-runes/liste.md#filtre-par-propriété-secondaire--%EF%B8%8F-la-modale-du-jeu) :
  2 ou 4 cases montrant chacune son critère (« Vol de vie +8 ~ +12 »), la
  bascule 2 ↔ 4 (`Rows2` / `Grid2x2`), et une modale listant toutes les
  propriétés avec **Min** et **Max**.
  - Mêmes composants ([SubSearchBar.tsx](src/components/account/SubSearchBar.tsx),
    [SubSearchDialog.tsx](src/components/account/SubSearchDialog.tsx)), sans copie.
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

⚠️ **À la SOURIS, un en-tête de vue** (même gabarit que la Liste des runes) :
« Liste » et le nombre d'artéfacts de l'INVENTAIRE ; le compte FILTRÉ est
au-dessus des tuiles.

## Onglet Résumé — `ArtifactsSummary`

[ArtifactsSummary.tsx](src/components/account/ArtifactsSummary.tsx), de haut
en bas : six **chiffres clés** (Artéfacts, Eff. moy. · Attribut, Eff. moy. ·
Type, Meilleur score, ≥ 90 % d'eff., Quad rolls), puis **Distribution
d'efficience** et **Raretés**, le **Top 10 par propriété** (section
suivante), et **tout en bas** **Quad rolls · sur quelle propriété** — aux deux
formats.

⚠️ **À la SOURIS** (même gabarit que le Résumé des runes) : un en-tête
« Résumé » et le nombre d'artéfacts, puis les six chiffres clés en **un
bandeau** (`Kpi bandeau`, cases séparées par un filet). Au doigt, les six
chiffres clés forment **une carte** sur deux colonnes (même traitement que le
Résumé des runes, voir [feat-runes/resume.md](feat-runes/resume.md)).

## Top 10 par propriété — `ArtifactsTop`, dans le Résumé

[ArtifactsTop.tsx](src/components/account/ArtifactsTop.tsx), calcul pur
[artifactsTop.ts](src/lib/artifactsTop.ts) : pour un **groupe** d'artéfacts,
les **10 meilleures valeurs de chaque propriété secondaire**. Une **section
du Résumé**, pas une vue à part : elle s'ouvre par son intitulé « Top 10 par
propriété » et l'effectif du groupe, **aux deux formats** — dans le Résumé,
la barre du haut dit « Résumé », pas ce qu'est ce bloc.

- **Le groupe** : des **onglets** (`Onglets`, la librairie UI) côte à côte —
  Eau · Feu · Vent · Lumière · Ténèbres · Attaque · Défense · PV · Support,
  chacun avec l'icône de son attribut ou de son type. Un seul ouvert : il
  coiffe les tableaux du dessous. Retenu entre deux visites
  (`artefacts.top.groupe`, Eau par défaut) ; un groupe retenu devenu vide
  (autre compte) cède la place au premier qui a des artéfacts.
  - ⚠️ **Un intangible compte dans TOUS les groupes de sa sorte** : il se pose
    sur n'importe quel monstre, donc un intangible d'attribut figure dans les
    tableaux des cinq attributs, un intangible de type dans ceux des quatre
    types. Son attribut ou son type lu n'est jamais utilisé (com2us envoie
    98). Dans une cellule, le **glyphe intangible du jeu** le signale, et
    l'infobulle le dit.
  - Un onglet **sans artéfact** reste affiché, **désactivé**, avec la raison
    en infobulle (« Aucun artéfact de ce groupe dans l'inventaire »).
- **La stat principale** : trois pastilles **à bascule**, `PV` · `ATQ` ·
  `DEF`, sous les groupes — « mes réductions de dégâts reçus, sur des
  artéfacts PV ou DEF ». Libellés d'`ARTIFACT_MAIN`, et l'icône en couleur
  de la cellule sur chaque pastille.
  - ⚠️ **Cumulables**, et non un contrôle à cran comme dans la Liste : on veut
    garder PV et DEF ensemble.
  - ⚠️ **Liste BLANCHE, tout coché par défaut** — même règle que la rareté de
    la Liste : une stat cochée est affichée, n'en cocher aucune revient à ne
    rien vouloir voir : les tableaux restent, tout en croix.
  - Retenues entre deux visites (`artefacts.top.principales`). L'effectif de
    l'en-tête suit le filtre.
- **Un tableau par famille** : « Réduction des dégâts reçus », **puis**
  « Augmentation des dégâts infligés », « Augmentation des dégâts
  critiques », « Augmentation des soins », « Augmentation de la précision »,
  « Effet de renforcement », « Dégâts supplémentaires en proportion de »,
  « Dégâts critiques selon la cible », puis « Autres sous-propriétés ».
  Chaque propriété est une **colonne**.
  - ⚠️ **Tous les tableaux, tout le temps** : chaque famille et chaque
    colonne que la sorte du groupe peut porter, même sans artéfact, et
    **toujours 10 rangs** — une **croix** (« Aucun artéfact ») là où il n'y en
    a pas. Les tableaux ne bougent jamais d'un onglet ou d'un filtre à
    l'autre : une colonne vide se lit (« je n'ai rien là »), une colonne qui
    disparaît décale les autres et ne dit pas ce qui manque.
  - Seules les propriétés **impossibles** pour la sorte sont écartées
    (`artifactSubKinds`) : un artéfact d'attribut ne porte jamais
    « Augmentation des soins », ce tableau serait vide à jamais. Un onglet
    d'attribut montre les dégâts reçus et infligés, un onglet de type les
    dégâts critiques, soins et précision par compétence ; les familles
    communes (renforcement, dégâts proportionnels, dégâts critiques selon la
    cible, autres) figurent dans les deux.
  - ⚠️ **Les dégâts REÇUS d'abord**, puis les infligés : l'inverse de la
    recherche du jeu (§ 3 bis de [feat-calcul-artefacts.md](feat-calcul-artefacts.md)),
    à dessein — c'est la ligne qu'on cherche d'abord sur un artéfact
    d'attribut. Le reste suit l'ordre du jeu.
  - ⚠️ **Le nom EN ENTIER dans le titre du tableau, le seul élément qui varie
    dans la colonne** : « Augmentation des dégâts infligés », puis « Feu »,
    « Eau »… ; « [Comp.2] » sous « Augmentation des soins » ; « ATQ » sous
    « Dégâts supplémentaires en proportion de ». Le jeu abrège ses libellés
    (« Aug. des dgts infl. au Feu ») faute de place sur sa fiche ; le titre a
    la place, et répété dans cinq colonnes, le nom noyait ce qui les
    distingue. Une colonne sans élément propre (« Autres sous-propriétés »,
    dégâts critiques selon la cible) porte le nom complet de la propriété
    (`artifactSubName`), sur trois lignes au plus — et tous les en-têtes de
    sa famille prennent alors la même hauteur, pour garder les rangs alignés.
  - « Effet aug. VIT » et « Effet aug. taux CRIT » ne sont **pas** des
    « Effet renforcement » dans le jeu : ils tombent sous les autres.
- **Une colonne classe SA propriété seule**, sur la valeur brute de la ligne.
  ⚠️ Jamais une colonne contre une autre : deux propriétés n'ont pas
  d'échelle commune ([feat-calcul-artefacts.md](feat-calcul-artefacts.md)).
  Ex æquo : le meilleur **score** de l'artéfact devant, puis l'identifiant.
- **Une cellule** : l'icône de la **stat principale** et la valeur **telle
  que le jeu l'écrit** (« +21% », « -26% » pour des dégâts reçus, « 0.3% »).
  Infobulle : le rang, la stat principale, « intangible » s'il l'est. Un clic
  ouvre la **fiche** de l'artéfact (`ArtifactDetailBox`), un second la
  ferme ; une seule ouverte à la fois.
  - ⚠️ **L'icône est EN COULEUR** — ♥ PV rouge (`text-fire`), ⚔ ATQ à l'encre,
    🛡 DEF bleu (`text-water`), comme les outils de référence du jeu : sur dix
    rangs serrés, c'est la teinte qu'on repère d'un coup d'œil.
- ⚠️ **Des tableaux SERRÉS** : chaque carte prend la largeur de son tableau
  (`w-fit`), les colonnes ont une largeur fixe (4,5 rem ; 7 rem pour un nom
  complet), les rangs 20 px. Étirées sur la page, les colonnes écartaient
  l'icône de sa valeur et noyaient dix rangs dans le vide.
- ⚠️ **À la SOURIS** : les cartes se suivent sur la ligne tant qu'elles
  tiennent, et leurs colonnes
  passent à la ligne si la place manque ; la fiche **flotte** à côté de la
  valeur (`FlottantAuto`).
- ⚠️ **Au DOIGT** : chaque tableau **défile de côté dans sa carte** — la page,
  elle, ne défile jamais horizontalement — et la fiche s'ouvre **sous le
  tableau** : ce défilement couperait une surface ancrée à une cellule.

## Données sous-jacentes

Depuis `parseAccountInventory` (voir [../transverse/](../transverse/)) :
- `kind` `element` / `archetype` — soit **Attribut** / **Type** à l'écran (via
  `type`, `attribute`, `unit_style`),
- rareté = **`natural_rank`** (le champ `rank` vaut toujours 5),
- substat « modifié » = `sec_effects[i][4] > 0` (`enchant`),
- stat principale : `pri_effect` (100 = PV, 101 = ATQ, 102 = DEF plats).
