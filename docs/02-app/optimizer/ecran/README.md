# Écran (de haut en bas)

L'écran de l'Optimizer : ce document décrit la mise en page d'ensemble ; chaque boîte a le sien.
Au format bureau, la page est
[PageBureau.tsx](src/components/outils/optimizer/bureau/PageBureau.tsx), ses boîtes dans
`src/components/outils/optimizer/bureau/` et ses seuils dans
[optimizerColonnes.ts](src/lib/optimizerColonnes.ts) ; au format téléphone, la grille
d'[OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx). Le reste de l'outil
(listes, import d'équipes, exclusion, interruption) est dans [../README.md](../README.md).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| la mise en page de `src/components/outils/OptimizerSection.tsx` : format, grille du téléphone, panneau « Options », changement d'onglet ; les cartes de réglage de `src/components/outils/optimizer/` | ce README |
| la page de bureau : `src/components/outils/optimizer/bureau/PageBureau.tsx` (agencements, page à hauteur de fenêtre, défilement des colonnes), `src/components/outils/optimizer/bureau/panneau.ts` (panneaux et sections), `src/components/outils/optimizer/bureau/OngletsColonnes.tsx`, `src/lib/optimizerColonnes.ts` ; leur vue de développement | ce README ; [vue-des-gabarits.md](../../../03-developpeur/vue-des-gabarits.md) |
| la recherche du monstre et la liste de travail du bureau : `src/components/outils/MonsterSourcePicker.tsx`, `src/components/outils/optimizer/bureau/ListeDeTravailBureau.tsx`, `src/components/outils/optimizer/MonstreEquipementTelephone.tsx` | [recherche-du-monstre.md](recherche-du-monstre.md) |
| « Meilleurs artéfacts offensifs pour ce build », `src/components/ArtifactSubLigne.tsx`, `src/components/outils/optimizer/MeilleursArtefacts.tsx`, `src/components/outils/optimizer/bureau/MeilleursArtefactsBureau.tsx` | [meilleurs-artefacts-offensifs.md](meilleurs-artefacts-offensifs.md) |
| « Exemplaire » et sa fiche, `src/components/outils/optimizer/ExemplaireEtFiche.tsx`, `src/components/outils/optimizer/bureau/ExemplaireBureau.tsx` | [equipement-actuel.md](equipement-actuel.md) |
| l'objectif de recherche, `src/components/outils/DamageSetupCard.tsx`, `src/components/outils/DamageSetupModale.tsx`, `src/components/outils/optimizer/ObjectifEtActions.tsx`, `src/components/outils/optimizer/bureau/ObjectifEtRechercherBureau.tsx` | [objectif-de-recherche.md](objectif-de-recherche.md) |
| le set recherché et les principales imposées, `src/components/outils/SetComboPicker.tsx`, `src/components/outils/optimizer/bureau/SetDeRunesCompact.tsx`, `src/components/outils/optimizer/bureau/PrincipalesImposeesBureau.tsx` | [set-et-principale.md](set-et-principale.md) |
| la carte « Artéfacts et relique », `src/components/outils/optimizer/ArtefactsEtReliques.tsx`, `src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau.tsx` | [artefacts.md](artefacts.md) |
| le bloc « Relique », `src/components/outils/optimizer/Relique.tsx`, `src/components/RelicSlot.tsx` | [relique.md](relique.md) |
| « État de mon monstre » et les sets d'aura des autres monstres, `src/components/outils/EtatMonstre.tsx`, `src/components/outils/optimizer/bureau/EtatMonstreEssentiels.tsx`, `src/components/outils/optimizer/bureau/SetsAuraBureau.tsx`, `src/lib/aurasExternes.ts`, `src/lib/buffsDePassif.ts` | [etat-de-mon-monstre.md](etat-de-mon-monstre.md) |
| les sous-propriétés verrouillées | [sous-proprietes-verrouillees.md](sous-proprietes-verrouillees.md) |
| les conditions, l'inventaire et les réglages avancés, `src/components/outils/optimizer/Conditions.tsx`, `src/components/outils/optimizer/bureau/ConditionsBureau.tsx`, `src/components/outils/optimizer/ReglagesAvancesContenu.tsx`, `src/components/outils/optimizer/bureau/ReglagesAvancesBureau.tsx` | [conditions-et-reglages.md](conditions-et-reglages.md) |
| l'exclusion de runes au bureau, `src/components/outils/optimizer/bureau/ExclusionRunesBureau.tsx` | [Réglages avancés et exclusion de runes](#réglages-avancés-et-exclusion-de-runes) ; [../feat-exclusion.md](../feat-exclusion.md) |
| « Lancer la recherche », `src/components/outils/optimizer/ObjectifEtActions.tsx`, `src/components/outils/optimizer/bureau/ObjectifEtRechercherBureau.tsx`, `src/components/outils/optimizer/EstimationPool.tsx`, `src/components/outils/optimizer/ProgressionRecherche.tsx` | [lancer-la-recherche.md](lancer-la-recherche.md) |
| les résultats, `src/components/outils/BuildCandidateCard.tsx`, `src/components/outils/optimizer/bureau/ResultatsBureau.tsx`, les blocs de résultats de `src/components/outils/optimizer/` (`EnteteResultats`, `DiagnosticsSansResultat`, `DiagnosticFaisabilite`, `DiagnosticApprofondi`, `QuasiSucces`, `AvisRechercheTronquee`, `GrilleResultats`, `PaginationResultats`) | [resultats.md](resultats.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [recherche-du-monstre.md](recherche-du-monstre.md) | La recherche du monstre à optimiser et le choix de l'exemplaire : liste de travail au bureau, « Monstre & équipement » au téléphone. |
| [meilleurs-artefacts-offensifs.md](meilleurs-artefacts-offensifs.md) | « Meilleurs artéfacts offensifs pour ce build ». |
| [equipement-actuel.md](equipement-actuel.md) | La fiche d'équipement de l'exemplaire (« Exemplaire » au bureau). |
| [objectif-de-recherche.md](objectif-de-recherche.md) | L'objectif de recherche, dont l'objectif « Dégâts réels ». |
| [set-et-principale.md](set-et-principale.md) | Le set de runes recherché et la statistique principale imposée. |
| [artefacts.md](artefacts.md) | La carte « Artéfacts et relique ». |
| [relique.md](relique.md) | Le bloc « Relique ». |
| [etat-de-mon-monstre.md](etat-de-mon-monstre.md) | « État de mon monstre » et les sets d'aura des autres monstres ; buffs de passif. |
| [sous-proprietes-verrouillees.md](sous-proprietes-verrouillees.md) | Les sous-propriétés verrouillées. |
| [conditions-et-reglages.md](conditions-et-reglages.md) | Les conditions, l'inventaire et les réglages avancés. |
| [lancer-la-recherche.md](lancer-la-recherche.md) | « Lancer la recherche ». |
| [resultats.md](resultats.md) | Les résultats : cartes de build, pagination, vérification. |

## Mise en page d'ensemble

Le format téléphone a sa propre mise en page
([Au format téléphone](#au-format-téléphone)). Au format bureau, tablette tactile comprise (même mise en page, densité du
doigt), l'écran de l'Optimizer est fait de **quatre colonnes**, de gauche à
droite. Au-dessus d'elles, ni bandeau ni phrase d'introduction.

1. **Les essentiels**, toujours à l'écran, place de 548 px (panneau de
   540) : la liste de travail (« Liste active », « Importer une équipe »,
   puis la carte de la liste, dont l'en-tête porte « Ajouter un monstre / à
   la liste » sur deux lignes, sans nom de liste, « Rechercher un monstre… »
   et le monstre actif) ; « Critères de
   recherche » avec le « Set de runes recherché » ; les « Conditions », et à
   leur droite la « Statistique principale imposée (slots pairs) » puis
   « État de mon monstre », réduit aux buffs et au lead.
2. **« Artéfacts et relique »**, repliable, place de 320 px (panneau de
   312) : « Artéfacts et relique », relique comprise, puis « Meilleurs
   artéfacts offensifs pour ce build » dans sa propre section, présente dès
   qu'un monstre est choisi avec l'optimisation d'artéfacts active.
3. **« Aura, exclusion, avancés »**, repliable, place de 340 px (panneau de
   332) : « Sets d'aura des autres monstres », « Exclusion de runes » et
   « Réglages avancés », en ligne dans la colonne.
4. **La colonne de droite**, jamais repliée, qui prend le reste de la
   largeur : « Exemplaire » (616 px de place : puces Box / RTA / Défenses
   siège / Offenses siège, fiche, « Valider ce build »), le bloc « Objectif
   et Rechercher », puis les résultats.

### Panneaux et sections

⚠️ **Chaque colonne est un panneau** (fond `panel`, contour de 1 px) : les
essentiels, chaque colonne repliable, la colonne de droite. Les boîtes
qu'elle porte y sont des **sections sans cadre ni ombre**, séparées par un
trait fin (`border-soft`) — décision de l'utilisateur à l'arrêt 4 de la
refonte : des cartes côte à côte se lisaient comme une mosaïque aérée.
Écarts **serrés dans un panneau** (8 px de rembourrage, 8 px de part et
d'autre d'un trait), **larges entre deux** : 24 px. Classes communes :
`src/components/outils/optimizer/bureau/panneau.ts` (`PANNEAU`, `SECTIONS`,
`BANDE`, `BANDE_FIXE`).

⚠️ **Le contour du haut d'un panneau de colonne est une bande braise de
3 px**, à la place du trait de 1 px (braise vive, `--accent`), aux coins
arrondis du panneau, pour distinguer les colonnes, que le seul panneau ne
séparait pas assez (décision de l'utilisateur). C'est la seule exception à
la règle du contour de 1 px
([contours.md](../../../03-developpeur/interface/librairie-ui/contours.md)) :
une section, un bloc posé dans une colonne ou une carte n'en porte pas. Le
rembourrage du haut du panneau perd les 2 px que le contour gagne : rien ne
bouge dedans. En A1 et A2, où la page défile, la bande est le contour du
panneau (`BANDE`). En A3, où chaque colonne défile seule, elle **reste en
haut de sa colonne, arrondie**, quand son contenu défile : c'est le
pseudo-élément `::before` du panneau, collé (`sticky`) au pixel 0 de la
boîte qui défile (`BANDE_FIXE`), le même dessin que le haut du panneau
(bande, contours de côté, coins), au-dessus du contenu, sans prendre de
place ni recevoir de clic. Le panneau, lui, ne la dessine plus en A3
(contour du haut transparent). Une colonne qui défile est rognée aux coins
du haut de son panneau (`coinsDuPanneau`, un `clip-path` fixe au
défilement) : le contenu qui passe sous la bande ne se voit pas dans les
coins, où l'on voit ce qui est derrière la colonne, comme au repos. Une
colonne superposée garde son ombre de flottant.

⚠️ **La barre de défilement d'une colonne se lit comme la sienne** : en A3,
la boîte qui défile s'arrête à sa barre (le panneau, 4 px, la barre de
10 px), et le reste de l'écart de 24 px jusqu'au panneau suivant est une
marge, hors de la boîte. Une barre au bord de la place se collait au
panneau suivant. La colonne de droite, la dernière, garde aussi 4 px entre
son panneau et sa barre, au bord de la page : ils sont pris sur les marges
de la page (voir plus bas), et son panneau est, à fenêtre égale, 12 px plus
large qu'avec des marges de 24.

⚠️ **Marges de la page : 12 px à gauche et à droite**, au lieu des 24 de
l'app, en pleine page comme dans un volet de l'écran partagé : la page de
bureau empiète de 12 px de chaque côté sur le rembourrage de la page ou du
volet (`-mx-3` à sa racine, `PageBureau.tsx`), sans toucher aux autres
pages ni au téléphone. Décision de l'utilisateur : la place va aux colonnes.
Le conteneur gagne ces 24 px : à fenêtre égale, il fait 24 px de plus, et
chaque seuil (exprimé en largeur de conteneur, inchangé) est atteint pour
une fenêtre ou un volet 24 px plus étroit. L'empiètement se mesure : jamais
plus que le rembourrage réellement laissé jusqu'au bord de ce qui défile ou
de la fenêtre — la page montée sans rembourrage autour ne déborde pas en
largeur.

Les largeurs ci-dessus sont des **places** (`LARGEURS_BUREAU`,
src/lib/optimizerColonnes.ts), d'où se calculent les seuils : un panneau
prend sa place moins 8 px (`RETRAIT_PANNEAU`) quand une autre colonne le
suit, et l'écart visible vaut la gouttière de 16 px plus ce retrait. Aucun
seuil n'a bougé ; une section garde la largeur de contenu de la carte qu'elle
remplace (294 px dans « Artéfacts et relique », 314 dans « Aura, exclusion,
avancés », 598 pour « Exemplaire »). La colonne de droite n'est une boîte
qu'en A3 (`data-zone="droite"`) : un panneau qui défile seul, où « Exemplaire »
tient la première piste (607 px, la place de 616 moins le bord du panneau) et
le bloc étroit la seconde. En A1 et A2, cette boîte s'efface
(`display: contents`) : « Exemplaire » et les résultats sont des cases de la
grille de la page, et dessinent le haut et le bas du panneau. En A3, les
panneaux des essentiels, des colonnes insérées et de la colonne de droite
descendent jusqu'au bas de la page ; une colonne superposée garde la hauteur
de son contenu.

Chaque boîte a une **largeur fixe**, sauf deux, **élastiques** : le bloc
« Objectif et Rechercher » (340 px au moins) et les résultats (360 px au
moins, une carte, sans maximum). Une boîte fixe ne s'étire jamais : la place
en plus va aux résultats, ou reste en marge (voir
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
minimums en `NumberField`, l'objectif, le pré-filtrage et les sources
d'exemplaire en `Segmented`, les artéfacts et le tri en `Selecteur`, les
bascules en `Interrupteur`, Rechercher/Exporter/Importer/Arrêter et les deux
onglets des colonnes repliables en `Bouton`, les flèches de pagination en
`BoutonIcone`, les champs de recherche des sélecteurs en `Champ` + `Flottant`
(même patron combobox que RtaSearch), et les sets/exclusions choisis en
`Jeton` (la pilule supprimable de la lib). Les statistiques principales
imposées sont des `Pastille` au téléphone, une `SelecteurMultiple` par slot
au bureau, qui sert aussi de champ fermé au set recherché. La grille de sets
à ajouter est en `BoutonIcone cadre`, ses symboles
colorisés par le **filtre doré partagé** `runeSetIconFilter` (effects.ts) — le
même que les barres de filtre par set (`SetFilter`), pour que l'icône ressorte
sur les deux thèmes au lieu de se fondre, en clair, dans le panneau.

⚠️ **Largeur de l'écran — pleine largeur.** Jamais une colonne bornée
(768 px) : ~2 000 px de réglages s'empileraient à faire défiler sur un écran
large resté à moitié vide. Au bureau, les boîtes ont leur largeur fixe et la
place en plus va aux résultats, en cartes de plus par rangée (voir
[Zone des résultats et place en plus](#zone-des-résultats-et-place-en-plus)).
Au téléphone, la barre d'actions, la progression et les résultats prennent
toute la largeur de la colonne.

## Ordre d'usage et grille

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
  « Objectif et Rechercher », suivi de sa barre fine (« Rechercher » et la
  progression, la seule partie collée au bas de la fenêtre) ; le contrôle à
  onglets ; la colonne repliable ouverte, dans la page, ses sections deux à
  deux ; « Exemplaire » ; les résultats.
- **A2, de 904 à 1 180 px.** Les essentiels à gauche ; à leur droite, de
  haut en bas, le bloc « Objectif et Rechercher », le contrôle à onglets et
  la colonne repliable ouverte, ses sections empilées. Dessous, sur toute la
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
que dessinent Chromium et Electron sous Windows. La page de bureau reprend
8 px de chaque côté sur les marges de page (marges de 16, voir
[Panneaux et sections](#panneaux-et-sections)) : son conteneur fait 16 px
de plus que la valeur du tableau (774, 1 094, 1 246, 1 630, 2 270), sans
changer l'agencement d'aucun repère. Au format bureau, le conteneur fait
donc au moins 744 px (728 de contenu, plus 16).

| Repère | Contenu de l'Optimizer | Agencement |
| --- | --- | --- |
| 1920 scindé | 758 px | A1 |
| 2560 scindé | 1 078 px | A2 |
| Portable plein (fenêtre de 1 536) | 1 230 px | A3, colonne repliable superposée |
| 1920 plein | 1 614 px | A3, une colonne repliable insérée |
| 2560 plein | 2 254 px | A3, les deux insérées |

## Réglages avancés et exclusion de runes

« Exclusion de runes » et « Réglages avancés » n'ont pas de carte repliée à
eux : au bureau, ils sont en ligne dans la colonne repliable « Aura,
exclusion, avancés » ([Mise en page d'ensemble](#mise-en-page-densemble)) ;
au téléphone, dans le panneau « Options ». Un même contenu sert les deux
formats (`ExclusionRunesContenu`, `ReglagesAvancesContenu`), jamais écrit
deux fois. Au bureau, chacun est une section de 314 px du panneau de la colonne, sans
en-tête qui se replie, à la suite de « Sets d'aura des autres monstres » :
empilés en A2 et A3 ; en A1, deux à deux, « Exclusion de runes » à droite
des deux autres.

« Exclusion de runes » garde au bureau l'ordre empilé du panneau : « Exclure
les runes d'un monstre », puis « Exclure les runes déjà utilisées », puis,
après un trait, « Conserver ces slots dans l'optimisation ». Deux réglages
côte à côte ne tiendraient pas dans 314 px de contenu. Au bureau, les
monstres exclus s'affichent sur une hauteur bornée (96 px) qui défile, et les
six puces des runes imposées sont de même taille, en deux colonnes égales
(slots 1 · 2, 3 · 4, 5 · 6) ; le téléphone garde sa rangée qui passe à la
ligne.

⚠️ **« Réglages avancés » se pose sur DEUX colonnes dès que la place le
permet** : le **pré-filtrage** avec ses puces et son
avertissement d'un côté, les **interrupteurs** de l'autre. Dans la colonne
du bureau (340 px), la place ne le permet jamais : une colonne, le
pré-filtrage au-dessus.

- ⚠️ `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` et **non** un point de
  rupture d'écran (`sm:`/`xl:`) : ce qui décide ici est la largeur de la
  **surface** (colonne du bureau, panneau du téléphone), pas celle de la
  fenêtre. Sous ~520 px, une colonne ; au-delà, deux — **sans une seule
  classe conditionnelle**.
- ⚠️ Les séparateurs des interrupteurs sont en **`divide-y` sur leur
  conteneur**, jamais en `border-t` individuel : un trait ne se pose alors
  qu'ENTRE deux voisins, jamais au-dessus du premier — une bordure par
  interrupteur poserait un trait en tête de colonne, lu comme une ligne
  perdue une fois le groupe posé à côté du pré-filtrage.
- Chacune des deux parties porte son **contour**, aux **mêmes classes** que
  les trois groupes d'« État de mon monstre » : deux façons de cadrer un
  groupe dans le même écran se liraient comme deux natures différentes.

⚠️ L'ouverture de leur surface (colonne, panneau) n'est **jamais dans
`useOptimizerState`** : c'est de l'ouverture/fermeture, pas un critère de
recherche — rien à exporter dans une recette, rien à remettre à zéro au
changement de monstre. ⚠️ **Au doigt, rien ne se replie** dans le panneau
« Options » : l'ouvrir EST déjà le geste « je veux voir les options ».

## Placement et adaptation à la largeur

Le format téléphone est décrit dans
[Au format téléphone](#au-format-téléphone).

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
  en **panneau superposé** à la colonne de droite, à 24 px des essentiels,
  avec une ombre : elle ne prend aucune place dans la grille, rien ne bouge
  dessous, et les résultats ne descendent jamais sous la largeur d'une carte.
  Elle couvre le bord gauche de la colonne de droite (312 ou 332 px), jamais
  « Rechercher », posé à droite dans la forme large du bloc (voir
  [Bloc « Objectif et Rechercher »](#bloc--objectif-et-rechercher-)).
- **A2** : la colonne ouverte se place à droite des essentiels, sous le bloc
  « Objectif et Rechercher » et le contrôle à onglets. **A1** : dans la
  page, entre le contrôle et « Exemplaire ».
- **Une à la fois sous 1 872 px** : ouvrir l'une ferme l'autre. Revenue
  sous 1 872 avec les deux ouvertes, la page garde la dernière ouverte.
- **Par défaut**, « Artéfacts et relique » est ouverte en A1, en A2 et dès
  1 516 px ; fermée en A3 sous 1 516 (aucun panneau superposé ouvert
  d'office). « Aura, exclusion, avancés » est fermée. Tant que l'utilisateur
  n'a touché à aucun onglet, cet état de départ suit la largeur : une
  fenêtre ou un volet redimensionné le recalcule. Le premier clic d'onglet,
  ou une ouverture guidée vers « Aura, exclusion, avancés », le fixe. Cet
  état est local à l'écran : quitter la page de l'Optimizer le perd, et le
  retour repart de l'état de départ.
- ⚠️ **Seul son onglet ferme une colonne repliable** : lancer une recherche
  ne replie rien, et rien ne bouge au clic sur « Rechercher ».

### Défilement

⚠️ **En A2 et A3, la page est à hauteur de fenêtre et ne défile pas** :
elle occupe la partie visible sous la barre du haut (pleine page) ou le corps
de son volet (écran partagé), moins 16 px de marge en bas, sans pied de page
de l'app ([pied-de-page.md](../../transverse/feat-navigation/pied-de-page.md)).
Sa hauteur se mesure (`useHauteurVisible`, `PageBureau.tsx`) : la fenêtre ou
le volet, moins ce qui est au-dessus de la page ; ce qui la suit dans ce qui
défile (rembourrages) est rendu par une marge négative. La fenêtre ne défile
plus (`data-page-fenetre`, [index.css](src/index.css)). Les hauteurs se jugent
sur la fenêtre réelle du navigateur (barre des tâches, onglets et barre
d'adresse retranchés : ≈ 1 920 × 940 sur un écran de 1 920 × 1 080,
≈ 1 536 × 730 sur un portable de 1 536 × 864), jamais sur celle de l'écran.

- **A3 : chaque colonne est un panneau qui défile seul** — essentiels,
  colonne repliable (insérée ou superposée), colonne de droite (« Exemplaire »,
  le bloc « Objectif et Rechercher » et les cartes, qui montent ensemble).
  Une molette au-dessus d'un panneau ne fait défiler que lui, et rien d'autre
  une fois au bout (`overscroll-behavior: contain`). Le contrôle à onglets
  reste en tête de la zone à droite des essentiels, dans sa rangée, sans
  fond : les colonnes défilent sous sa rangée, jamais dessous. Les essentiels
  font environ 721 px de haut (mesuré, liste vide, monstre choisi ; la liste
  de travail les allonge jusqu'à 308 px de membres) : ils tiennent entiers à
  1 920 × 940 (856 px de page), défilent de 60 px à 1 536 × 730 (646 px).
- **A2 : la page défile en elle-même, d'un bloc**, la fenêtre (ou le volet)
  immobile. « Exemplaire » (616 px) et les résultats passent sous les
  essentiels : aucune colonne n'y va de haut en bas, et la colonne à droite
  des essentiels (340 à 615 px) ne les tiendrait pas. Sa barre de défilement
  est réservée hors du conteneur, comme celle de la fenêtre avant elle :
  aucune largeur de boîte ne change.
- ⚠️ **La colonne de droite réserve sa barre de défilement**
  (`scrollbar-gutter: stable`), comme la page en A2 : les résultats qui
  arrivent ne la rétrécissent pas, et « Rechercher » ne bouge pas sous le
  clic. Le bloc étroit y perd ces 10 px et les 4 px entre le panneau et
  la barre : 333 px à son seuil (colonne de droite de 972 px), pour 340
  déclarés, sans débordement mesuré. En contrepartie, la fenêtre n'a plus
  de barre en A2 et A3 : le conteneur gagne 10 px à fenêtre égale, plus les
  16 px des marges (1 640 px à 1 920 de large au lieu des 1 614 du tableau
  des repères).
- ⚠️ **Les autres colonnes ne défilent que si leur contenu dépasse** leur
  hauteur : une boîte qui défile rogne les menus posés dedans, qu'il vaut
  mieux laisser déborder tant que rien n'oblige à défiler. Les aides
  (`HelpPopover`) en sortent toujours, en portail : une bulle ancrée près du
  bord droit d'une colonne s'affiche en entier.
- **A1** : la page défile dans la fenêtre (ou le volet), avec le pied de page ;
  seule la barre fine du bloc est collée au bas de la partie visible.

### Bloc « Objectif et Rechercher »

Le bloc porte, de haut en bas : la ligne d'estimation du pool, visible sans
rien ouvrir ; les quatre objectifs
([objectif-de-recherche.md](objectif-de-recherche.md#les-quatre-objectifs-disponibles))
et, sous « Dégâts réels » seulement, son résumé ; « Rechercher » ;
« Exporter » · « Importer », en libellé court ; le message d'import d'une
recette et la progression. ⚠️ « Rechercher » est en taille `lg` de
`Bouton`, en braise pleine (`fond="plein"`, le bouton principal de la
librairie) dès qu'un set est choisi : l'action qu'on vient faire pèse plus
qu'un segment choisi, lui aussi en braise pleine. Sans set, il garde le fond
`doux` et son aspect grisé (une braise pleine grisée tournerait au brun), à
la même taille ; pendant une recherche, « Arrêter » prend sa place exacte, avec
un carré plein, et reste inactif 300 ms : le double clic qui lance ne
l'arrête pas.

⚠️ **Une seule place réservée : celle de « Rechercher » / « Arrêter »**
(décision de l'utilisateur à l'arrêt 4). L'estimation, le résumé de
« Dégâts réels » et la progression prennent leur hauteur quand ils
paraissent : toujours sous ce qu'on vient de cliquer (le set, l'objectif,
« Rechercher »), jamais au-dessus. Ce qui suit le bloc (les onglets en A2,
les résultats en A3) peut descendre : la règle « un clic ne déplace jamais ce
qu'on vient de cliquer » protège la cible du clic, pas ce qui est dessous.

La progression y est **compacte** : sans barre, la ligne « N / M
combinaisons examinées · K trouvée(s) » et la phrase « Attendez la fin de la
recherche pour être sûr de trouver votre build optimal. » ; la préparation
(une ligne par moitié), l'échec et le refus nommé au même endroit. Le
téléphone garde sa barre ([lancer-la-recherche.md](lancer-la-recherche.md)).

Deux formes, selon la place :

- **étroite**, 340 px (≈ 239 px de haut au repos, estimation sur deux
  lignes, mesuré en A2), objectifs en 2 × 2, « Exporter » · « Importer »
  sous « Rechercher », à parts égales : en A2, à droite des essentiels,
  dans son propre panneau ; en A3, section du panneau de droite, à côté
  d'« Exemplaire », quand la colonne de droite fait au moins 972 px
  (616 + 16 + 340), soit un conteneur d'au moins 1 536 px sans colonne
  repliable insérée, 1 872 avec « Artéfacts et relique » insérée, 1 892 avec
  « Aura, exclusion, avancés » insérée ;
- **large**, ≈ 138 px de haut au repos (estimation sur une ligne, mesuré en
  A3), à la largeur de sa colonne : objectifs sur une ligne, « Exporter » ·
  « Importer » à gauche, « Rechercher » à droite, 240 px de large : partout
  ailleurs (A1, et A3 quand la colonne de droite fait moins de 972 px), sous
  « Exemplaire ». ⚠️ **À droite, parce qu'en A3 une colonne repliable
  superposée couvre le bord gauche de la colonne de droite** (332 px au
  plus) : « Rechercher », qui commence au plus près à 367 px de ce bord,
  reste toujours atteignable.

⚠️ Le bloc ne change de forme qu'au clic d'un onglet, qui ouvre ou ferme
une colonne insérée, jamais au lancement d'une recherche.

En A1, le bloc suit les essentiels, à sa place, dans son panneau : estimation,
objectifs, « Exporter » · « Importer ». ⚠️ **Seule sa barre fine reste collée
au bas de la fenêtre** tant que sa place est sous le pli : « Rechercher » (ou
« Arrêter », à sa place exacte) et, à sa droite, la progression, 69 px
mesurés (décision de l'utilisateur, arrêt 4 : le bloc entier collé couvrait
264 px). Elle suit le bloc dans la page (`data-zone="barre"`), et y reprend
sa place une fois le bloc atteint. ⚠️ **Sa hauteur ne change jamais** : la
progression y tient dans la place de la plus haute (copie invisible) ;
collée par le bas, une barre qui grandirait ferait monter « Rechercher » /
« Arrêter » sous le pointeur.

### Zone des résultats et place en plus

- **Place réservée** : la zone des résultats est là dès le départ, une
  section « Résultats » élastique de 360 px au moins (une carte), la
  dernière du panneau de droite.
  Avant la première recherche, une place d'attente (en-tête et message,
  ≈ 160 px) tient la place où arrivent les cartes : leur arrivée ne déplace
  jamais ce qu'on vient de cliquer. Son en-tête dit « Choisis un monstre
  pour préparer la recherche. » sans monstre, « Aucune recherche lancée
  pour ce monstre. » ensuite ; le cadre en pointillé dit « Les builds
  trouvés s'afficheront ici. ». A3 : dans la colonne de droite, sous
  « Exemplaire » et le bloc ; A1 et A2 : sur toute la largeur, sous
  « Exemplaire ». Une recherche lancée (ou arrêtée sur une erreur, un refus)
  sans carte encore garde le cadre, sans la phrase de l'en-tête, dont la
  ligne reste réservée.
- ⚠️ **Une relance garde la hauteur des résultats d'avant** jusqu'à
  l'arrivée de la première carte : la recherche relancée vide les
  résultats, et la page, devenue plus courte que son défilement, remonterait
  d'un coup sous le pointeur, « Rechercher » compris.
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

### Grille du téléphone

[OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx) rend, sous
`SOUS_LG`, la phrase d'introduction (« Recherche parmi tes runes possédées ;
rien n'est appliqué à ton compte, l'outil est purement indicatif — c'est à toi
de re-runer dans le jeu. »), que le bureau n'a pas, puis une seule grille d'une
colonne (`grid-cols-[minmax(0,1fr)] gap-5 items-start`) : « Monstre & équipement », « Critères de recherche » (Set de
runes recherché et Statistique principale imposée, puis Conditions),
« Artéfacts et relique », « État de mon monstre », puis la ligne
d'estimation ; « Exclusion de runes » et « Réglages avancés » sont dans le
panneau « Options » ([Réglages avancés et exclusion de
runes](#réglages-avancés-et-exclusion-de-runes)). ⚠️ La colonne est en
`minmax(0,1fr)` : une colonne implicite grandirait jusqu'au contenu le plus
large (la roue de la fiche, `w-max`) et décentrerait la page.

⚠️ **L'ordre du DOM est l'ordre de lecture**, jamais réordonné par des
classes de placement. L'objectif n'est pas dans cette grille : il est rendu
après elle, dans la carte du bouton Rechercher, alors qu'il se choisit avant
les critères. La progression et les résultats suivent.

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
