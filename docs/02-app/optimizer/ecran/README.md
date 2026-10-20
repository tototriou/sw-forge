# Écran (de haut en bas)

L'écran de l'Optimizer : ce document décrit la mise en page d'ensemble ; chaque carte a le sien.
Le reste de l'outil (listes, import d'équipes, exclusion, interruption) est dans
[../README.md](../README.md).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| la mise en page de `src/components/outils/OptimizerSection.tsx` : grille, panneaux dépliants, largeur, changement d'onglet ; les cartes de réglage de `src/components/outils/optimizer/` | ce README |
| les boîtes de bureau de la mise en page d'ensemble, `src/components/outils/optimizer/bureau/`, `src/lib/optimizerColonnes.ts` ; leur vue de développement | ce README ; [vue-des-gabarits.md](../../../03-developpeur/vue-des-gabarits.md) |
| « Monstre à optimiser », `src/components/outils/MonsterSourcePicker.tsx` | [recherche-du-monstre.md](recherche-du-monstre.md) |
| « Meilleurs artéfacts offensifs pour ce build », `src/components/ArtifactSubLigne.tsx` | [meilleurs-artefacts-offensifs.md](meilleurs-artefacts-offensifs.md) |
| « Équipement actuel » | [equipement-actuel.md](equipement-actuel.md) |
| l'objectif de recherche, `src/components/outils/DamageSetupCard.tsx`, `src/components/outils/DamageSetupModale.tsx`, `src/components/outils/optimizer/ObjectifEtActions.tsx` | [objectif-de-recherche.md](objectif-de-recherche.md) |
| le set recherché et les principales imposées, `src/components/outils/SetComboPicker.tsx` | [set-et-principale.md](set-et-principale.md) |
| la carte « Artéfacts » | [artefacts.md](artefacts.md) |
| la carte « Relique », `src/components/RelicSlot.tsx` | [relique.md](relique.md) |
| « État de mon monstre », `src/components/outils/EtatMonstre.tsx`, `src/lib/aurasExternes.ts`, `src/lib/buffsDePassif.ts` | [etat-de-mon-monstre.md](etat-de-mon-monstre.md) |
| les sous-propriétés verrouillées | [sous-proprietes-verrouillees.md](sous-proprietes-verrouillees.md) |
| les conditions, l'inventaire et les réglages avancés | [conditions-et-reglages.md](conditions-et-reglages.md) |
| « Lancer la recherche », `src/components/outils/optimizer/ObjectifEtActions.tsx`, `src/components/outils/optimizer/ProgressionRecherche.tsx` | [lancer-la-recherche.md](lancer-la-recherche.md) |
| les résultats, `src/components/outils/BuildCandidateCard.tsx`, les blocs de résultats de `src/components/outils/optimizer/` (`EnteteResultats`, `DiagnosticsSansResultat`, `DiagnosticFaisabilite`, `DiagnosticApprofondi`, `QuasiSucces`, `AvisRechercheTronquee`, `GrilleResultats`, `PaginationResultats`) | [resultats.md](resultats.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [recherche-du-monstre.md](recherche-du-monstre.md) | La carte « Recherche du monstre à optimiser ». |
| [meilleurs-artefacts-offensifs.md](meilleurs-artefacts-offensifs.md) | La carte « Meilleurs artéfacts offensifs pour ce build ». |
| [equipement-actuel.md](equipement-actuel.md) | La carte « Équipement actuel ». |
| [objectif-de-recherche.md](objectif-de-recherche.md) | La carte « Objectif de recherche », dont l'objectif « Dégâts réels ». |
| [set-et-principale.md](set-et-principale.md) | Le set de runes recherché et la statistique principale imposée. |
| [artefacts.md](artefacts.md) | La carte « Artéfacts ». |
| [relique.md](relique.md) | La carte « Relique ». |
| [etat-de-mon-monstre.md](etat-de-mon-monstre.md) | La carte « État de mon monstre » : auras, buffs de passif. |
| [sous-proprietes-verrouillees.md](sous-proprietes-verrouillees.md) | Les sous-propriétés verrouillées. |
| [conditions-et-reglages.md](conditions-et-reglages.md) | Les conditions, l'inventaire et les réglages avancés. |
| [lancer-la-recherche.md](lancer-la-recherche.md) | « Lancer la recherche ». |
| [resultats.md](resultats.md) | Les résultats : cartes de build, pagination, vérification. |

## Mise en page d'ensemble

> **Refonte de l'écran de bureau, en cours.** Le code suit cette mise en
> page ([PageBureau.tsx](src/components/outils/optimizer/bureau/PageBureau.tsx)).
> Le format téléphone garde sa propre mise en page
> ([Grille du code actuel](#grille-du-code-actuel)).

Au format bureau, tablette tactile comprise (même mise en page, densité du
doigt), l'écran de l'Optimizer est fait de **quatre colonnes**, de gauche à
droite. Au-dessus d'elles, ni bandeau ni phrase d'introduction.

1. **Les essentiels**, toujours à l'écran, 548 px : la liste de travail
   (« Liste active », « Importer une équipe », puis la carte de la liste,
   dont l'en-tête porte « Rechercher un monstre… » et le monstre actif) ;
   « Critères de recherche » avec le « Set de runes recherché » ; les
   « Conditions », et à leur droite la « Statistique principale imposée
   (slots pairs) » puis « État de mon monstre », réduit aux buffs et au lead.
2. **« Artéfacts et relique »**, repliable, 320 px : la carte « Artéfacts et
   reliques », relique comprise, puis « Meilleurs artéfacts offensifs pour ce
   build » dans sa propre carte.
3. **« Aura, exclusion, avancés »**, repliable, 340 px : « Sets d'aura des
   autres monstres », « Exclusion de runes » et « Réglages avancés », en
   ligne dans la colonne.
4. **La colonne de droite**, jamais repliée, qui prend le reste de la
   largeur : « Exemplaire » (616 px : puces Box / RTA / Défenses siège /
   Offenses siège, fiche, « Valider ce build »), le bloc « Objectif et
   Rechercher », puis les résultats.

Les boîtes sont séparées d'une gouttière de 16 px. Chacune a une **largeur
fixe**, sauf deux, **élastiques** : le bloc « Objectif et Rechercher »
(340 px au moins) et les résultats (386 px au moins, une carte et son cadre,
sans maximum). Une boîte fixe ne s'étire jamais : la place en plus va aux
résultats, ou reste en marge (voir
[Placement et adaptation à la largeur](#placement-et-adaptation-à-la-largeur)).

⚠️ **Un seul contrôle à onglets**, « Artéfacts et relique » · « Aura,
exclusion, avancés », commande les deux colonnes repliables. Cliquer un
onglet ouvre sa colonne et ferme l'autre ; recliquer l'onglet actif la
referme ; là où les deux colonnes tiennent ensemble, la seconde s'ajoute à
la première. Le contrôle ne bouge jamais au clic : la colonne s'ouvre
dessous.

⚠️ **La liste de travail a une place stable**, en tête des essentiels dans
tous les agencements : passer au monstre suivant reste un clic.

Les modales (dont « Dégâts réels ») et les flottants sortent du flux : ils
suivent la fenêtre, pas le conteneur de l'Optimizer.

## Contrôles et largeur

⚠️ **Tous les contrôles viennent de la librairie `src/ui/`**, comme partout
dans l'app (« rien de custom », voir [03-developpeur/interface/design/README.md](../../../03-developpeur/interface/design/README.md)) : les
minimums en `NumberField`, l'objectif et le pré-filtrage en `Segmented`, les
statistiques principales imposées en `Pastille`, les artéfacts et le tri en
`Selecteur`, les bascules en `Interrupteur`, Rechercher/Exporter/Importer/
Arrêter en `Bouton`, les flèches de pagination en `BoutonIcone`, les champs de
recherche des sélecteurs en `Champ` + `Flottant` (même patron combobox que
RtaSearch), et les sets/exclusions choisis en `Jeton` (la pilule supprimable de
la lib). La grille de sets à ajouter est en `BoutonIcone cadre`, ses symboles
colorisés par le **filtre doré partagé** `runeSetIconFilter` (effects.ts) — le
même que les barres de filtre par set (`SetFilter`), pour que l'icône ressorte
sur les deux thèmes au lieu de se fondre, en clair, dans le panneau.

⚠️ **Largeur de l'écran — pleine largeur.** Jamais une colonne bornée
(768 px) : ~2 000 px de réglages s'empileraient à faire défiler sur un écran
large resté à moitié vide. **La barre d'actions, la progression et les
résultats restent pleine largeur** — la grille de cartes de résultat, elle,
profite directement de la largeur (davantage de cartes par ligne).

## Ordre d'usage et grille

> **Refonte de l'écran de bureau, en cours.** Le code suit cette mise en
> page ([PageBureau.tsx](src/components/outils/optimizer/bureau/PageBureau.tsx)).

⚠️ **L'ordre d'usage commande la mise en page :**

1. choisir le monstre : dans la liste de travail, par « Rechercher un
   monstre… » (qui peut l'ajouter à la liste) ou par « Importer une
   équipe » ;
2. choisir l'objectif de recherche, au début ou juste avant de lancer ;
3. poser les conditions : set de runes, conditions minimales (parfois
   maximales), statistiques principales imposées ;
4. selon le cas : le périmètre (artéfacts, relique), l'exclusion de runes ;
   selon l'objectif, « État de mon monstre » et les paramètres de « Dégâts
   réels » ;
5. lancer, puis explorer les builds : les comparer, en valider un ;
6. ajuster, réglages avancés compris, et relancer ;
7. passer au monstre suivant de la liste.

Les étapes 1 et 3 et les buffs et le lead de l'étape 4 sont les
**essentiels**, toujours à l'écran. Le reste de l'étape 4 et les réglages
avancés vont aux **colonnes repliables**. L'objectif,
le lancement et les résultats (étapes 2 et 5) sont dans la **colonne de
droite**, avec « Exemplaire », la référence de « Comparer ». L'objectif
n'est pas un critère parmi d'autres : il vit dans le bloc de
« Rechercher », pas dans « Critères de recherche ».

### Les trois agencements

L'agencement se choisit sur la largeur du conteneur de l'Optimizer, au
format bureau seulement (voir
[Placement et adaptation à la largeur](#placement-et-adaptation-à-la-largeur)).
Chacun vaut sur une plage `[a, b[` :

- **A1, de 728 à 904 px — une colonne.** Les essentiels ; le bloc
  « Objectif et Rechercher » ; le contrôle à onglets ; la colonne repliable
  ouverte, dans la page, ses cartes deux à deux ; « Exemplaire » ; les
  résultats.
- **A2, de 904 à 1 180 px.** Les essentiels à gauche ; à leur droite, de
  haut en bas, le bloc « Objectif et Rechercher », le contrôle à onglets et
  la colonne repliable ouverte, ses cartes empilées. Dessous, sur toute la
  largeur, « Exemplaire » puis les résultats.
- **A3, dès 1 180 px.** Les essentiels à gauche ; le contrôle à onglets en
  haut, à leur droite ; sous lui, la colonne de droite : « Exemplaire », le
  bloc « Objectif et Rechercher » (à côté d'« Exemplaire » quand la
  colonne de droite fait au moins 972 px, dessous sinon), les résultats.
  Une colonne repliable
  ouverte s'insère entre les essentiels et la colonne de droite là où elle
  tient avec « Exemplaire », et se superpose aux résultats sinon.

Chaque seuil se pose là où l'agencement suivant tient : 904 = essentiels
548 + gouttière 16 + 340 (le bloc étroit, ou la plus large des colonnes
repliables) ; 1 180 = 548 + 16 + « Exemplaire » 616.

Aux largeurs repères, la fenêtre se réduit au contenu de l'Optimizer par
les constantes de [volets.ts](src/lib/volets.ts) : barre latérale dépliée
248 px, marges de page 2 × 24 ; en écran partagé, zone des volets 2 × 12,
séparateur 12 au milieu, volet 50 ; puis la barre de défilement de 10 px
que dessinent Chromium et Electron sous Windows.

| Repère | Contenu de l'Optimizer | Agencement |
| --- | --- | --- |
| 1920 scindé | 758 px | A1 |
| 2560 scindé | 1 078 px | A2 |
| Portable plein (fenêtre de 1 536) | 1 230 px | A3, colonne repliable superposée |
| 1920 plein | 1 614 px | A3, une colonne repliable insérée |
| 2560 plein | 2 254 px | A3, les deux insérées |

## Panneaux repliables

> **Avant la refonte du bureau.** Au bureau, « Réglages avancés » et
> « Exclusion de runes » sont désormais en ligne dans la colonne « Aura,
> exclusion, avancés » ([Mise en page d'ensemble](#mise-en-page-densemble)) :
> les cartes repliées et leurs flottants décrits ici ne s'affichent plus à
> aucun format, et restent dans le code jusqu'à leur retrait.

⚠️ **« Réglages avancés » ne pousse jamais rien en se dépliant** : la
partie Critères de recherche ne se déplace pas vers le bas quand on le
déroule, et le bloc reste toujours sous Exclusion de runes (donc sans
déplacer LE BLOC lui-même : l'isoler en dernière rangée pour contourner le
symptôme le déplacerait). Son contenu déplié n'est pas un bloc **inline**
qui grandirait la carte (donc toute la colonne 2, qui partage ses pistes de
rangée avec la colonne 1) — c'est un
**`FlottantAuto`** ancré à la carte, qui flotte PAR-DESSUS la page :
la carte garde TOUJOURS sa hauteur repliée, aucune rangée ne peut
bouger. Un panneau replié par défaut ne peut pas réserver sa place à
l'avance sans perdre l'intérêt d'être replié — il sort donc du flux
(flottant), l'autre option prévue par
[03-developpeur/interface/design/README.md](../../../03-developpeur/interface/design/README.md), « un clic ne déplace jamais ce
qu'on vient de cliquer ». Ferme au clic extérieur, même patron que
`HelpPopover.tsx`.

⚠️ **« Exclusion de runes » est elle aussi REPLIÉE par défaut** et déplie
**le même mécanisme** — ancre `ref`, `ZoneCliquable`
avec chevron, `FlottantAuto`, fermeture au clic extérieur. Le patron est
**réutilisé tel quel**, jamais réécrit : deux mécanismes de dépliement
voisins auraient divergé.

⚠️ **Les deux panneaux prennent EXACTEMENT la largeur de la carte qui les
ancre** (`largeurAncre`), et la **suivent** quand l'écran
change de taille. Jamais une largeur en dur : figée, elle ne peut pas suivre
une carte dont la largeur dépend de la fenêtre.
- ⚠️ **Du CSS, pas une mesure.** La surface est déjà `position: absolute`
  dans l'ancre `relative` : un `width: 100%` la cale dessus et l'y garde au
  redimensionnement, sans effet ni recalcul. Une largeur mesurée à
  l'ouverture, elle, serait périmée au premier redimensionnement.
- Le placement horizontal en devient trivial : une surface aussi large que
  son ancre ne peut pas déborder d'un côté sans déborder de l'ancre — elle
  se pose donc à `gauche: 0`, exactement sur la carte.
- ⚠️ `largeurAncre` est un **axe ajouté à `FlottantAuto`**, pas une variante :
  « la surface suit son ancre » est le cas d'un panneau dépliant ancré à une
  CARTE, par opposition à un menu ancré à une petite tuile — pour celui-là,
  une largeur propre reste la bonne réponse, et `largeur` la sert toujours.
- ⚠️ `hauteur` n'est et reste qu'une **estimation** (560 pour l'exclusion,
  420 pour les avancés) : elle sert à choisir le côté AVANT que le contenu
  existe. La surestimer biaise le placement vers le haut, sans conséquence ;
  la sous-estimer ouvre du mauvais côté.

⚠️ **« Réglages avancés » se pose sur DEUX colonnes dès que la place le
permet** : le **pré-filtrage** avec ses puces et son
avertissement d'un côté, les **trois interrupteurs** de l'autre.
- ⚠️ `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` et **non** un point de
  rupture d'écran (`sm:`/`xl:`) : ce qui décide ici est la largeur du
  **panneau**, pas celle de la fenêtre. Le panneau prend la largeur de sa
  carte, qui dépend de la colonne de grille — une même fenêtre peut donc
  donner un panneau large ou étroit. Sous ~520 px, une colonne ; au-delà,
  deux. Ça vaut aussi pour le panneau « Options » au doigt, **sans une seule
  classe conditionnelle**.
- ⚠️ Les séparateurs des interrupteurs sont en **`divide-y` sur leur
  conteneur**, jamais en `border-t` individuel : un trait ne se pose alors
  qu'ENTRE deux voisins, jamais au-dessus du premier — une bordure par
  interrupteur poserait un trait en tête de colonne, lu comme une ligne
  perdue une fois le groupe posé à côté du pré-filtrage.
- Chacune des deux parties porte son **contour**, aux **mêmes classes** que
  les trois groupes d'« État de mon monstre » : deux façons de cadrer un
  groupe dans le même écran se liraient comme deux natures différentes.

⚠️ Son état d'ouverture est **local à l'écran**, pas remonté dans
`useOptimizerState` : c'est de l'ouverture/fermeture, pas un critère de
recherche — rien à exporter dans une recette, rien à remettre à zéro au
changement de monstre. ⚠️ **Au doigt, rien ne se replie** : le panneau
« Options » reste tel quel, l'ouvrir EST déjà le geste « je veux voir les
options ».

## Placement et adaptation à la largeur

> **Refonte de l'écran de bureau, en cours.** Le code suit cette mise en
> page ([PageBureau.tsx](src/components/outils/optimizer/bureau/PageBureau.tsx)).
> Le format téléphone est décrit dans
> [Au format téléphone](#au-format-téléphone).

### D'abord le format, ensuite l'agencement

- **Le format** reste celui de toute l'app : `useMediaQuery` au seuil `lg`,
  relu dans un volet de l'écran partagé ; sous 728 px de contenu, format
  téléphone ([ecran-partage.md](../../transverse/feat-navigation/ecran-partage.md#les-pages-suivent-la-largeur-de-leur-volet)).
- **Au format bureau seulement**, l'agencement (A1, A2, A3 : voir
  [Ordre d'usage et grille](#ordre-dusage-et-grille)) se choisit sur la
  largeur du **conteneur** de l'Optimizer. ⚠️ Hors volet, une fenêtre de
  900 px donne 852 px de contenu, au format téléphone : une requête de
  conteneur seule y appliquerait un agencement de bureau. Tout agencement
  de bureau se conditionne donc au format bureau.
- **Le conteneur** : la racine de l'Optimizer porte
  `container-type: inline-size`, sans nom. Au bureau, aucune bascule
  d'agencement ne passe par `sm:`/`md:`/`lg:`/`xl:` ni par la fenêtre : la
  page se met en page de même en pleine page et en volet, barre latérale
  dépliée ou repliée. Une classe d'agencement ne se pose que sur un élément
  sans autre conteneur entre lui et la racine ; une boîte qui devient
  elle-même conteneur prend un nom.

### Colonnes repliables selon la largeur

- **A3** : « Artéfacts et relique » s'insère dès 1 516 px (548 + 16 + 320 +
  16 + 616), « Aura, exclusion, avancés » dès 1 536 (même calcul avec 340),
  les deux ensemble dès 1 872. Sous son seuil, une colonne ouverte se pose
  en **panneau superposé** aux résultats, collé aux essentiels : rien ne
  bouge dessous, et les résultats ne descendent jamais sous la largeur d'une
  carte.
- **A2** : la colonne ouverte se place à droite des essentiels, sous le bloc
  « Objectif et Rechercher » et le contrôle à onglets. **A1** : dans la
  page, entre le contrôle et « Exemplaire ».
- **Une à la fois sous 1 872 px** : ouvrir l'une ferme l'autre. Revenue
  sous 1 872 avec les deux ouvertes, la page garde la dernière ouverte.
- **Par défaut**, « Artéfacts et relique » est ouverte en A1, en A2 et dès
  1 516 px ; fermée en A3 sous 1 516 (aucun panneau superposé ouvert
  d'office). « Aura, exclusion, avancés » est fermée.
- ⚠️ **Seul son onglet ferme une colonne repliable** : lancer une recherche
  ne replie rien, et rien ne bouge au clic sur « Rechercher ».

### Défilement

- **A3** : la colonne de droite défile d'un bloc, avec la page :
  « Exemplaire », le bloc « Objectif et Rechercher » et les cartes montent
  ensemble. Les **essentiels restent fixes** ; plus hauts que la partie
  visible de la fenêtre, ils défilent dans leur propre colonne. Le contrôle
  à onglets et la colonne repliable ouverte, insérée ou superposée, restent
  fixes de même, avec le même repli ; en défilant, « Exemplaire » et le bloc
  passent sous le contrôle.
- **A1 et A2** : la page défile, sans colonne fixe.

### Bloc « Objectif et Rechercher »

Le bloc porte, de haut en bas : la ligne d'estimation du pool, visible sans
rien ouvrir ; les quatre objectifs
([objectif-de-recherche.md](objectif-de-recherche.md#les-quatre-objectifs-disponibles))
et la ligne de résumé de « Dégâts réels », à place réservée ;
« Rechercher » ; « Exporter » · « Importer », en libellé court ; la
progression, à place réservée. ⚠️ « Rechercher » est plus grand que la
taille `md` de `Bouton` ; pendant une recherche, « Arrêter » prend sa place
exacte, avec un carré plein, et reste inactif 300 ms.

Deux formes, selon la place :

- **étroite**, 340 × ≈ 356 px, objectifs en 2 × 2 : en A2, à droite des
  essentiels, au-dessus du pli ; en A3, à côté d'« Exemplaire », quand la
  colonne de droite fait au moins 972 px (616 + 16 + 340), soit un
  conteneur d'au moins 1 536 px sans colonne repliable insérée, 1 872 avec
  « Artéfacts et relique » insérée ;
- **large**, ≈ 260 px de haut, à la largeur de sa colonne : objectifs sur
  une ligne, « Rechercher » · « Exporter » · « Importer » sur une rangée,
  estimation sur une ligne, places réservées gardées : partout ailleurs (A1,
  et A3 quand la colonne de droite fait moins de 972 px), sous
  « Exemplaire ».

⚠️ Le bloc ne change de forme qu'au clic d'un onglet, qui ouvre ou ferme
une colonne insérée, jamais au lancement d'une recherche.

En A1, le bloc suit les essentiels ; tant que sa place est sous le pli, il
reste collé au bas de la fenêtre, pour que « Rechercher » soit toujours
atteignable.

### Zone des résultats et place en plus

- **Place réservée** : la zone des résultats est là dès le départ. Avant la
  première recherche, une place d'attente (en-tête et message, ≈ 160 px)
  tient la place où arrivent les cartes : leur arrivée ne déplace jamais ce
  qu'on vient de cliquer. A3 : dans la colonne de droite, sous « Exemplaire »
  et le bloc ; A1 et A2 : sur toute la largeur, sous « Exemplaire ». Une
  recherche lancée (ou arrêtée sur une erreur, un refus) sans carte encore
  garde le cadre et « Les builds trouvés s'afficheront ici. », sans la
  phrase « Aucune recherche lancée pour ce monstre. », dont la ligne reste
  réservée.
- **La place en plus** va aux résultats, en cartes de 360 px au moins
  ([resultats.md](resultats.md)) : en A3, la largeur gagnée ajoute des
  cartes par rangée. En A1 et en A2, la place qui reste à droite des boîtes
  fixes reste une marge.

### Au format téléphone

Le format téléphone garde sa mise en page : une colonne, et le panneau
« Options » pour l'exclusion et les réglages. ⚠️ **Pas de débordement, et
les contrôles du panneau prennent toute la largeur.** Points tenus :

- **Grille Conditions** : « Min »/« Max » collés à chaque champ feraient
  déborder la rangée (libellé + deux `NumberField` + deux mots > largeur utile).
  Au doigt, ces mots sont masqués et remplacés par **deux en-têtes de colonne**
  posés une fois ; au bureau (`sm:`), chaque champ garde son libellé à côté et
  les en-têtes disparaissent.
- **Panneau « Options » — tout prend la largeur.** Les conteneurs empilés du
  panneau sont en **`space-y-*` (blocs), pas `flex flex-col`** : le corps du
  panneau porte `data-tiroir`, où index.css pose
  `[data-tiroir] .flex-col { align-items: flex-start }` (écrit pour les rangées
  d'actions). Sur `flex flex-col`, cette règle raboterait les deux cartes — et
  donc leurs contrôles — à la largeur de leur contenu, laissant une colonne vide
  à droite sur tablette. En blocs, cartes et contrôles reprennent toute la
  largeur. Même piège que MobileNavSheet. Les `Segmented` y sont en outre
  `size="lg"`, dont le **pré-filtrage par emplacement** (serré à son contenu en
  ligne au bureau, plein dans le panneau).
- **Barre d'actions** : Exporter/Importer portent un `libelleCourt`
  (« Exporter »/« Importer ») sous `lg`, pour ne pas étaler deux boutons à
  libellé long au doigt.

### Grille du code actuel

Ce que rendait
[OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx) au
bureau avant la refonte ; la même grille sert encore le format téléphone,
où ses classes `lg:` et `xl:` ne s'appliquent pas, et ses cartes de bureau
(dont les deux flottants de [Panneaux repliables](#panneaux-repliables))
restent dans le code jusqu'à leur retrait : **une seule grille à partir de `xl`** (`grid gap-5 items-start
xl:grid-cols-[1.35fr_1fr]`). Rangée 1, « Monstre & équipement » pleine
largeur (`xl:col-span-2`), recherche à gauche et fiche d'équipement à
droite, sa grille interne au même ratio que la page ; colonne 1,
« Critères de recherche » sur les rangées 2 à 5 (`xl:row-span-4`, nombre qui
suit la colonne d'en face), en deux colonnes internes (Set de runes recherché
puis Statistique principale imposée | Conditions, trait vertical dès `lg`) ;
colonne 2, de haut en bas, « Artéfacts et reliques », « État de mon
monstre », « Exclusion de runes » (rangée 4) et « Réglages avancés »
(rangée 5), ces deux dernières dépliées en flottants
([Panneaux repliables](#panneaux-repliables)) ; rangée 6, pleine largeur, la
ligne d'estimation.

⚠️ **Placement explicite (`col-start`/`row-start`/`row-span`) sur chaque
carte, jamais un réordonnancement de la source** : sous `xl`, une seule
colonne, et l'ordre du DOM redevient l'ordre de lecture. L'objectif n'est
pas dans cette grille : il est rendu après elle, dans la carte du bouton
Rechercher, alors qu'il se choisit avant les critères. La barre d'actions,
la progression et les résultats sont pleine largeur, sous la grille.

## Survie à un changement d'onglet

⚠️ **Survit à un changement d'onglet.** Comme les autres pages de l'app,
`OutilsPage` (et donc `OptimizerSection`) est **démontée** à chaque
navigation — un simple `useState` local y perdrait tout (monstre choisi,
conditions saisies, résultats…) au moindre aller-retour vers RTA ou une autre
page. `useOptimizerState` centralise donc cette saisie et est instancié
**dans `App.tsx`**, qui ne se démonte jamais tant que l'onglet du navigateur
reste ouvert — même principe que `useRtaState`/`useSiegeState` pour la prépa
RTA et les équipes de siège. Le cran « Dégâts supplémentaires » / « Dégâts
réels » de « Meilleurs artéfacts offensifs pour ce build » fait partie de
cet état partagé : il est retrouvé au retour dans l'Optimizer.
La saisie libre et les résultats ne sont pas conservés automatiquement sur
disque : fermer l'onglet ou recharger la page les perd. « Sauvegarder la
session » sérialise une photo à la demande, mais aucun chemin de `App.tsx`
ne la réapplique actuellement. Les critères personnels d'un membre de liste
peuvent en revanche être mémorisés par `useOptimizerLists`, sous
l'interrupteur global de conservation (voir
[../feat-listes-equipes-et-sauvegarde.md](../feat-listes-equipes-et-sauvegarde.md)
§ Mémoires des membres). Le Worker de recherche lui-même
suit ce cycle de vie : une recherche en cours **continue de tourner** en
arrière-plan si on change d'onglet, et son résultat est toujours là au
retour.
