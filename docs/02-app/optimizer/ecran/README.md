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
| la page de bureau : `src/components/outils/optimizer/bureau/PageBureau.tsx` (configurations, groupe d'onglets, page à hauteur de fenêtre, défilement des colonnes), `src/components/outils/optimizer/bureau/panneau.ts` (panneaux et sections), `src/lib/optimizerColonnes.ts` ; leur vue de développement | ce README ; [vue-des-gabarits.md](../../../03-developpeur/vue-des-gabarits.md) |
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
| les résultats, `src/components/outils/BuildCandidateCard.tsx`, `src/components/outils/optimizer/bureau/ResultatsBureau.tsx`, les blocs de résultats de `src/components/outils/optimizer/` (`EnteteResultats`, `FiltresResultats`, `TetesDeTri`, `TableauResultats`, `DiagnosticsSansResultat`, `DiagnosticFaisabilite`, `DiagnosticApprofondi`, `QuasiSucces`, `AvisRechercheTronquee`, `GrilleResultats`, `PaginationResultats`), `src/hooks/useFormeResultats.ts` | [resultats.md](resultats.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [recherche-du-monstre.md](recherche-du-monstre.md) | La recherche du monstre à optimiser et le choix de l'exemplaire : liste de travail au bureau, « Monstre & équipement » au téléphone. |
| [meilleurs-artefacts-offensifs.md](meilleurs-artefacts-offensifs.md) | « Meilleurs artéfacts offensifs pour ce build ». |
| [equipement-actuel.md](equipement-actuel.md) | La fiche d'équipement de l'exemplaire (« Exemplaire » au bureau) : vues, aperçu, validation. |
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
([Au format téléphone](#au-format-téléphone)). Au format bureau, tablette
tactile comprise (même mise en page, densité du doigt), l'écran de
l'Optimizer est fait de **cinq colonnes**, de gauche à droite. Les trois
colonnes de réglages se rangent en onglets quand la place manque (voir
[Les quatre configurations](#les-quatre-configurations)). Au-dessus d'elles,
ni bandeau ni phrase d'introduction.

1. **« Monstre »**, toujours à l'écran, place de 384 px (panneau de 376) :
   la liste de travail (« Liste active », « Importer une équipe », puis la
   liste, sans carte (voir « Panneaux et sections »), qu'ouvrent, sans
   titre, « Rechercher un monstre… » et le monstre actif) ; puis « Exemplaire » :
   ses deux vues, ses puces d'aperçu et la fiche
   ([equipement-actuel.md](equipement-actuel.md)). ⚠️ **La fiche y est
   dépliée, à la façon des cartes de résultat** (décision de l'utilisateur) :
   panneau de statistiques resserré, artéfacts et roue à sa droite, relique
   sous la roue, le groupe réduit pour tenir dans les 358 px de contenu du
   panneau.
2. **« Critères »**, place de 320 px (panneau de 312) : « Set de runes
   recherché », « Conditions », « Statistique principale imposée (slots
   pairs) », puis « État de mon monstre », réduit aux buffs et au lead, l'un
   sous l'autre.
3. **« Artéfacts et relique »**, place de 320 px : « Artéfacts et
   relique », relique comprise, puis « Meilleurs artéfacts offensifs pour ce
   build » dans sa propre section, présente dès qu'un monstre est choisi
   avec l'optimisation d'artéfacts active.
4. **« Aura, exclusion, avancés »**, place de 320 px : « Sets d'aura des
   autres monstres », « Exclusion de runes » et « Réglages avancés », en
   ligne dans la colonne.
5. **La colonne des résultats**, jamais rangée, qui prend le reste de la
   largeur : le bloc « Objectif et Rechercher », puis les résultats. ⚠️ **Sa
   largeur minimale est celle d'une carte de résultat** (328 px de contenu,
   [resultats.md](resultats.md)), panneau et barre de défilement compris :
   360 px de place (décision de l'utilisateur). Au-dessus du minimum, tout
   y suit la largeur de son panneau, sans jamais en sortir.

### Panneaux et sections

⚠️ **Chaque colonne est un panneau** (fond `panel`, contour de 1 px) :
« Monstre », chaque colonne de réglages, le groupe d'onglets, la colonne
des résultats. Les boîtes qu'elle porte y sont des **sections sans cadre ni
ombre**, séparées par un trait fin (`border-soft`) : la colonne rassemble
les réglages d'un même parcours, sans cadres concurrents à l'intérieur.
Écarts **serrés dans un panneau** (8 px de rembourrage, 8 px de part et
d'autre d'un trait), **larges entre deux** : 24 px. Classes communes :
`src/components/outils/optimizer/bureau/panneau.ts` (`PANNEAU`, `SECTIONS`).

⚠️ **Aucun cadre de premier niveau dans un panneau de colonne** (décision de
l'utilisateur : des cadres de même poids que le panneau empêchaient de lire
la colonne). La liste de travail n'a plus de carte autour d'elle, mais
chaque monstre y garde la sienne (décision de l'utilisateur : plus lisible
que des lignes sous un trait) ; la grille des sets est dans un « coffre » en
creux (fond `panel2`, sans contour), centré, dépliée comme dans sa liste
ouverte ; la fiche de l'exemplaire, les sets d'aura, le pré-filtrage et les
interrupteurs avancés n'ont plus de boîte ; un diagnostic sans résultat se
pose sous un trait fin, sans contour ni fond. ⚠️ **Exception : chaque
résultat garde sa carte** (contour et fond, décision de l'utilisateur :
sans elle, les résultats se lisaient mal d'une carte à l'autre) ; ses
rangées « Dégâts », « PV effectifs » et ses écarts y gardent leur contour
fin (`border-soft`) et leur fond, comme au téléphone (décision de
l'utilisateur). Restent marqués : les objets du jeu (runes, artéfacts,
reliques), les états (set manquant, rappel des auras, place d'attente des
résultats, « Vérification… », emplacement figé, bandeau d'aperçu), les
contrôles (champs, listes, boutons, segments, onglets, panneau de
statistiques cliquable, résumé du combat). Le rappel des auras teinte un
contour transparent déjà en place : il paraît sans rien déplacer. Chaque
composant partagé avec le téléphone prend un axe de bureau (`enTete` de
`MonstresDeLaListe`, `coffre` de `SetComboPicker`, `sansCadre`
d'`AurasExternesSaisie`, `bureau` de `ReglagesAvancesContenu`,
`GrilleResultats`, `BuildCandidateCard` et des diagnostics) : le téléphone
garde ses cartes et ses boîtes.

⚠️ **Aucune bande de couleur sur les panneaux** (décision de
l'utilisateur) : chaque panneau garde le seul contour de 1 px de la règle
commune ([contours.md](../../../03-developpeur/interface/librairie-ui/contours.md)).
Les colonnes se séparent par leur écart de 24 px, et le groupe d'onglets
se lit par son onglet ouvert, fondu dans son panneau. Quand une colonne
défile, **le haut de son panneau reste en haut de la colonne**, arrondi, et
le contenu qui passe dessous ne se voit pas dans ses coins.

⚠️ **La barre de défilement d'une colonne se lit comme la sienne** : la
boîte qui défile s'arrête à sa barre (le panneau, 4 px, la barre de
10 px), et le reste de l'écart de 24 px jusqu'au panneau suivant est une
marge, hors de la boîte. Une barre au bord de la place se collait au
panneau suivant. La colonne des résultats, la dernière, garde aussi 4 px
entre son panneau et sa barre, au bord de la page : ils sont pris sur les
marges de la page (voir plus bas).

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
seuil ne dépend du retrait ; une section garde 294 px de contenu dans
chaque colonne de réglages. À sa largeur minimale (360 px de place, soit
328 de contenu : 360 moins la barre de défilement réservée et ses 4 px,
moins le contour et le rembourrage du panneau), la colonne des résultats
tient une carte et le bloc « Objectif et Rechercher », sans débordement.

Chaque boîte a une **largeur fixe**, sauf deux, **élastiques** : le bloc
« Objectif et Rechercher » et les résultats, à la largeur de leur colonne.
Une boîte fixe ne s'étire jamais : la place en plus va aux résultats (voir
[Zone des résultats et place en plus](#zone-des-résultats-et-place-en-plus)).

⚠️ **La liste de travail a une place stable**, en tête de « Monstre »
dans toutes les configurations : passer au monstre suivant reste un clic.

Les modales (dont « Dégâts réels ») et les flottants sortent du flux : ils
suivent la fenêtre, pas le conteneur de l'Optimizer.

## Contrôles et largeur

⚠️ **Tous les contrôles viennent de la librairie `src/ui/`**, comme partout
dans l'app (« rien de custom », voir [03-developpeur/interface/design/README.md](../../../03-developpeur/interface/design/README.md)) : les
minimums en `NumberField`, l'objectif, le pré-filtrage, les vues et les
sources d'exemplaire en `Segmented`, les artéfacts et le tri en `Selecteur`,
les bascules en `Interrupteur`, Rechercher/Exporter/Importer/Arrêter en
`Bouton`, le groupe des colonnes rangées en `Onglets`, les flèches de
pagination en `BoutonIcone`, les champs de recherche des sélecteurs en
`Champ` + `Flottant` (même patron combobox que RtaSearch), et les
sets/exclusions choisis en `Jeton` (la pilule supprimable de la lib). Les
statistiques principales imposées sont des `Pastille` au téléphone, un
`SelecteurMultiple` par slot au bureau, qui sert aussi de champ fermé au
set recherché. La grille de sets à ajouter est en `BoutonIcone cadre`, ses
symboles colorisés par le **filtre doré partagé** `runeSetIconFilter`
(effects.ts) — le même que les barres de filtre par set (`SetFilter`), pour
que l'icône ressorte sur les deux thèmes au lieu de se fondre, en clair,
dans le panneau.

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
   monstre… » (qui l'ajoute à la liste) ou par « Importer une équipe » ;
2. choisir l'objectif de recherche, au début ou juste avant de lancer ;
3. poser les conditions : set de runes, conditions minimales (parfois
   maximales), statistiques principales imposées ;
4. selon le cas : le périmètre (artéfacts, relique), l'exclusion de runes ;
   selon l'objectif, « État de mon monstre » et les paramètres de « Dégâts
   réels » ;
5. lancer, puis explorer les builds : les comparer, en valider un ;
6. ajuster, réglages avancés compris, et relancer ;
7. passer au monstre suivant de la liste.

Les étapes 1 et 7 sont dans « Monstre », toujours à l'écran, avec
« Exemplaire », la référence de « Comparer ». L'étape 3, les buffs et le
lead de l'étape 4 sont dans « Critères » ; le reste de l'étape 4 et les
réglages avancés, dans « Artéfacts et relique » et « Aura, exclusion,
avancés ». L'objectif, le lancement et les résultats (étapes 2 et 5) sont
dans la colonne des résultats. L'objectif n'est pas un critère parmi
d'autres : il vit dans le bloc de « Rechercher », pas dans « Critères de
recherche ».

### Les quatre configurations

La configuration se choisit sur la largeur du conteneur de l'Optimizer, au
format bureau seulement (voir
[Placement et adaptation à la largeur](#placement-et-adaptation-à-la-largeur)).
Les colonnes de réglages qui ne tiennent pas à côté de « Monstre » et des
résultats se rangent, de droite à gauche — « Aura, exclusion, avancés »,
puis « Artéfacts et relique », puis « Critères » —, dans **un seul groupe
d'onglets**, qui prend la dernière place des réglages, 320 px. ⚠️ **Jamais
de groupe à un seul onglet** : une colonne rangée seule resterait une
colonne. Chaque configuration vaut sur une plage `[a, b[` :

- **dès 1 768 px — toutes les colonnes**, aucun onglet ;
- **de 1 432 à 1 768 px** — « Critères » en colonne, puis le groupe
  « Artéfacts » · « Options » ;
- **de 1 096 à 1 432 px** — le groupe « Critères » · « Artéfacts » ·
  « Options » ;
- **sous 1 096 px — deux piles** : « Monstre » à gauche ; à droite, dans
  une seule pile qui défile, le groupe d'onglets, le bloc « Objectif et
  Rechercher », puis les résultats. Les deux piles valent jusqu'au plus
  petit conteneur de bureau (752 px) : la pile de droite y prend ce qui
  reste, 352 px au moins, sans débordement. ⚠️ **Dans le panneau du
  groupe, les sections se partagent les rangées**, 294 px au moins
  chacune, **centrées**, et s'élargissent pour remplir leur rangée sans
  dépasser 420 px ; le set de runes y est toujours déplié (décision de
  l'utilisateur). Dans « Critères », la disposition à deux sections par
  rangée tient plus étroit : le set se resserre à côté des Conditions, qui
  gardent leurs 294 px (sa grille perd des colonnes et s'allonge, jusqu'à
  155 px, 1 + 2 colonnes), et les principales (160 px, le texte de leurs
  listes passant à la ligne) et l'état du monstre (176 px, ses trois
  vignettes) restent côte à côte le plus longtemps possible (décision de
  l'utilisateur).

Chaque seuil se pose là où la configuration suivante tient : 1 768 =
« Monstre » 384 + trois fois (gouttière 16 + 320) + gouttière 16 +
résultats 360 ; chaque seuil inférieur retire une colonne de réglages et sa
gouttière (1 432, 1 096) ; sous 1 096, le groupe ne tient plus en colonne à
côté des résultats.

Aux largeurs repères, la fenêtre se réduit au contenu de l'Optimizer par
les constantes de [volets.ts](src/lib/volets.ts) : barre latérale dépliée
248 px, marges de page 2 × 24 ; en écran partagé, zone des volets 2 × 12,
séparateur 12 au milieu, volet 50. La page de bureau reprend 12 px de
chaque côté sur les marges de page (voir
[Panneaux et sections](#panneaux-et-sections)), et, à hauteur de fenêtre,
la fenêtre n'a pas de barre de défilement : son conteneur fait 34 px de
plus que le contenu sous une fenêtre qui défile (24 de marges, 10 de
barre). Au format bureau, le conteneur fait au moins 752 px (728 de
contenu, plus 24).

| Repère | Contenu sous une fenêtre qui défile | Conteneur | Configuration |
| --- | --- | --- | --- |
| 1920 scindé | 758 px | 792 px | deux piles |
| 2560 scindé | 1 078 px | 1 112 px | groupe « Critères » · « Artéfacts » · « Options » |
| Portable plein (fenêtre de 1 536) | 1 230 px | 1 264 px | groupe « Critères » · « Artéfacts » · « Options » |
| 1920 plein | 1 614 px | 1 648 px | « Critères », groupe « Artéfacts » · « Options » |
| 2560 plein | 2 254 px | 2 288 px | toutes les colonnes |

Barre latérale repliée (56 px au lieu de 248), le conteneur gagne 192 px
en pleine page et environ 96 par volet : 1920 plein passe à toutes les
colonnes (1 840), le portable à « Critères » et le groupe de deux (1 456) ;
les volets gardent leur configuration.

## Réglages avancés et exclusion de runes

« Exclusion de runes » et « Réglages avancés » n'ont pas de carte repliée à
eux : au bureau, ils sont en ligne dans « Aura, exclusion, avancés »
(colonne, ou onglet « Options » du groupe : voir
[Mise en page d'ensemble](#mise-en-page-densemble)) ; au téléphone, dans
le panneau « Options ». Un même contenu sert les deux formats
(`ExclusionRunesContenu`, `ReglagesAvancesContenu`), jamais écrit deux
fois. Au bureau, chacun est une section de 294 px du panneau, sans en-tête
(ni titre, ni icône, ni phrase d'accroche : le téléphone garde les siens
dans le panneau « Options »), à la suite de « Sets d'aura des autres
monstres » : empilés dans une colonne ou un groupe de 320 px ; côte à côte,
tant qu'ils tiennent, centrés et élargis jusqu'à 420 px, quand le groupe
prend la largeur de la pile de droite (deux piles).

« Exclusion de runes » garde au bureau l'ordre empilé du panneau : « Exclure
les runes d'un monstre », puis « Exclure les runes déjà utilisées », puis,
après un trait, « Conserver ces slots dans l'optimisation ». Deux réglages
côte à côte ne tiendraient pas dans 294 px de contenu. ⚠️ **Au bureau, les
sources « Défenses siège » et « Offenses siège » d'« Exclure les runes d'un
monstre » passent sur deux lignes** (« Défenses / siège »), au texte normal
des puces (décision de l'utilisateur : c'est ce qui fait tenir la colonne à
la largeur d'« Artéfacts et relique ») ; les quatre puces gardent la même
hauteur, « Box » et « RTA » centrés. Ce passage à la ligne est celui de
`Segmented` quand ses libellés ne tiennent pas sur une ligne : « Exclure les
runes déjà utilisées », à la même largeur, tient sur une ligne. Au bureau, les
monstres exclus s'affichent sur une hauteur bornée (96 px) qui défile, et les
six puces des runes imposées sont de même taille, en deux colonnes égales
(slots 1 · 2, 3 · 4, 5 · 6) ; le téléphone garde sa rangée qui passe à la
ligne.

⚠️ **Au bureau, les interrupteurs de la colonne sont alignés à droite**
(décision de l'utilisateur) : celui d'« Exclure les runes déjà utilisées »
au même bord que ceux des « Réglages avancés » (leur carte les écarte de
9 px du bord : 8 de rembourrage, 1 de contour), et chaque « ? » d'aide
collé à son interrupteur, au même écart de 12 px dans toutes les rangées.
Les puces « Bas, Moyen, Haut, Extrême » du pré-filtrage par emplacement
sont centrées dans leur carte, comme la puce « Dégâts supplémentaires /
Dégâts réels » des meilleurs artéfacts dans « Artéfacts et relique ». Le
téléphone garde ses rangées.

⚠️ **« Réglages avancés » se pose sur DEUX colonnes dès que la place le
permet** : le **pré-filtrage** avec ses puces et son
avertissement d'un côté, les **interrupteurs** de l'autre. Dans une
colonne du bureau (320 px), la place ne le permet jamais : une colonne, le
pré-filtrage au-dessus.

- ⚠️ **Au téléphone**, `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` et **non** un point de
  rupture d'écran (`sm:`/`xl:`) : ce qui décide ici est la largeur de la
  **surface** (colonne du bureau, panneau du téléphone), pas celle de la
  fenêtre. Sous ~520 px, une colonne ; au-delà, deux. Au bureau, les deux
  groupes sont empilés par `SECTIONS` dans leur colonne de largeur fixe.
- ⚠️ Les séparateurs des interrupteurs sont en **`divide-y` sur leur
  conteneur**, jamais en `border-t` individuel : un trait ne se pose alors
  qu'ENTRE deux voisins, jamais au-dessus du premier — une bordure par
  interrupteur poserait un trait en tête de colonne, lu comme une ligne
  perdue une fois le groupe posé à côté du pré-filtrage.
- **Au téléphone**, chacune des deux parties porte son contour, comme les
  groupes d'« État de mon monstre ». **Au bureau**, ce sont des groupes
  sans cadre : les traits du panneau suffisent à les séparer.

⚠️ Ce qui est en colonne et ce qui est en onglet, et l'onglet ouvert, ne
sont **jamais dans `useOptimizerState`** : c'est de l'affichage, pas un
critère de recherche — rien à exporter dans une recette, rien à remettre à
zéro au changement de monstre. ⚠️ **Au doigt, rien ne se replie** dans le
panneau « Options » : l'ouvrir EST déjà le geste « je veux voir les
options ».

## Placement et adaptation à la largeur

Le format téléphone est décrit dans
[Au format téléphone](#au-format-téléphone).

### D'abord le format, ensuite l'agencement

- **Le format** reste celui de toute l'app : `useMediaQuery` au seuil `lg`,
  relu dans un volet de l'écran partagé ; sous 728 px de contenu, format
  téléphone ([ecran-partage.md](../../transverse/feat-navigation/ecran-partage.md#les-pages-suivent-la-largeur-de-leur-volet)).
- **Au format bureau seulement**, la configuration (voir
  [Les quatre configurations](#les-quatre-configurations)) se choisit sur
  la largeur du **conteneur** de l'Optimizer. ⚠️ Hors volet, une fenêtre de
  900 px donne 852 px de contenu, au format téléphone : une requête de
  conteneur seule y appliquerait une configuration de bureau. Toute
  configuration de bureau se conditionne donc au format bureau.
- **Le conteneur** : la racine de l'Optimizer porte
  `container-type: inline-size`, sans nom. Au bureau, aucune bascule
  de configuration ne passe par `sm:`/`md:`/`lg:`/`xl:` ni par la fenêtre :
  la page se met en page de même en pleine page et en volet, barre latérale
  dépliée ou repliée. Une classe de configuration ne se pose que sur un
  élément sans autre conteneur entre lui et la racine ; une boîte qui
  devient elle-même conteneur prend un nom.

### Colonnes et onglets selon la largeur

- ⚠️ **La largeur seule décide** de ce qui est une colonne et de ce qui
  est un onglet (décision de l'utilisateur) : aucun bouton n'ouvre ni ne
  ferme une colonne, aucun panneau ne se superpose à un autre, et lancer
  une recherche ne change rien à la disposition.
- **Le groupe d'onglets** (`Onglets`, [src/ui/Onglets.tsx](src/ui/Onglets.tsx))
  porte des libellés courts : « Critères », « Artéfacts », « Options » ; le
  nom entier de la colonne (« Critères de recherche », « Artéfacts et
  relique », « Aura, exclusion, avancés ») en `title`. Sa rangée est
  au-dessus de son panneau, sans fond, l'onglet ouvert fondu dans le
  panneau ; un clic d'onglet ne déplace jamais l'onglet cliqué : seul le
  contenu dessous change. En deux piles, la hauteur de la pile change d'un
  onglet à l'autre, et ce qui suit le groupe (le bloc, les résultats) se
  déplace d'autant (accepté par l'utilisateur).
- **L'onglet ouvert** : le premier du groupe au départ ; il reste ouvert
  tant qu'il est dans le groupe, redimensionnement compris, sinon le
  premier du groupe s'ouvre. Il est local à l'écran : quitter la page de
  l'Optimizer le perd. Une recherche ne le change jamais.
- **Guidages** : un geste qui mène vers une colonne rangée ouvre son
  onglet, puis fait ce qu'il fait ailleurs. « Rechercher » sans set ouvre
  « Critères » et amène le set à l'écran ; l'ouverture guidée vers les sets
  d'aura (interrupteur des auras RES/PRE) ouvre « Options ».

### Défilement

⚠️ **La page est à hauteur de fenêtre et ne défile pas**, dans toutes les
configurations : elle occupe la partie visible sous la barre du haut
(pleine page) ou le corps de son volet (écran partagé), moins 16 px de
marge en bas, sans pied de page de l'app
([pied-de-page.md](../../transverse/feat-navigation/pied-de-page.md)). Sa
hauteur se mesure (`useHauteurVisible`, `PageBureau.tsx`) : la fenêtre ou
le volet, moins ce qui est au-dessus de la page ; ce qui la suit dans ce
qui défile (rembourrages) est rendu par une marge négative. La fenêtre ne
défile plus (`data-page-fenetre`, [index.css](src/index.css)). Les hauteurs
se jugent sur la fenêtre réelle du navigateur (barre des tâches, onglets et
barre d'adresse retranchés : ≈ 1 920 × 940 sur un écran de 1 920 × 1 080,
≈ 1 536 × 730 sur un portable de 1 536 × 864), jamais sur celle de
l'écran.

- **Chaque colonne est un panneau qui défile seul** : « Monstre », chaque
  colonne de réglages, le panneau du groupe d'onglets (sous sa rangée, qui
  ne défile pas), la colonne des résultats ; en deux piles, « Monstre » et
  la pile de droite (groupe, bloc et résultats ensemble). Une molette
  au-dessus d'un panneau ne fait défiler que lui, et rien d'autre une fois
  au bout (`overscroll-behavior: contain`). « Monstre » défile quand la
  liste de travail et la fiche dépassent la hauteur de la page (portable
  de 1 536 × 730).
- ⚠️ **En deux piles, « Rechercher » (ou « Arrêter », à sa place exacte)
  reste collé au bas de la pile de droite** tant que sa place est plus bas
  (décision de l'utilisateur) : à droite, à 240 px, sans panneau ni
  progression autour ; lancer et arrêter restent ainsi à un clic sans
  faire défiler les réglages. Il reprend sa place une fois le bloc atteint.
  ⚠️ **Sa hauteur ne change jamais** : la progression reste dans le bloc,
  parce que collé par le bas, un élément qui grandirait ferait monter
  « Rechercher » / « Arrêter » sous le pointeur.
- ⚠️ **La colonne des résultats et la pile de droite réservent leur barre
  de défilement** (`scrollbar-gutter: stable`) : les résultats qui
  arrivent ne les rétrécissent pas, et « Rechercher » ne bouge pas sous le
  clic. Ces 10 px et les 4 px entre le panneau et la barre font partie de
  la largeur minimale de la colonne (360).
- ⚠️ **Les autres colonnes ne défilent que si leur contenu dépasse** leur
  hauteur. Les menus, les listes et les aides (`HelpPopover`) posés dedans
  n'en dépendent pas : en couche supérieure (`Flottant`), une bulle ancrée
  près du bord droit d'une colonne qui défile s'affiche en entier.

### Bloc « Objectif et Rechercher »

Le bloc porte, de haut en bas : la ligne d'estimation du pool, visible sans
rien ouvrir ; les quatre objectifs
([objectif-de-recherche.md](objectif-de-recherche.md#les-quatre-objectifs-disponibles))
et, sous « Dégâts réels » seulement, son résumé ; « Exporter » · « Importer »,
en libellé court, et « Rechercher » ; le message d'import d'une recette et la
progression. ⚠️ « Rechercher » est en taille `lg` de
`Bouton`, en braise pleine (`fond="plein"`, le bouton principal de la
librairie) dès qu'un set est choisi : l'action qu'on vient faire pèse plus
qu'un segment choisi, lui aussi en braise pleine. Sans set, il garde le fond
`doux` et son aspect grisé (une braise pleine grisée tournerait au brun), à
la même taille ; pendant une recherche, « Arrêter » prend sa place exacte, avec
un carré plein, et reste inactif 300 ms : le double clic qui lance ne
l'arrête pas.

⚠️ **Une seule place réservée : celle de « Rechercher » / « Arrêter »**
(décision de l'utilisateur). L'estimation, le résumé de
« Dégâts réels » et la progression prennent leur hauteur quand ils
paraissent : toujours sous ce qu'on vient de cliquer (le set, l'objectif,
« Rechercher »), jamais au-dessus. Ce qui suit le bloc (les résultats) peut
descendre : la règle « un clic ne déplace jamais ce qu'on vient de cliquer »
protège la cible du clic, pas ce qui est dessous.

La progression y est **compacte** : sans barre, la ligne « N / M
combinaisons examinées · K trouvée(s) » et la phrase « Attendez la fin de la
recherche pour être sûr de trouver votre build optimal. » ; la préparation
(une ligne par moitié), l'échec et le refus nommé au même endroit. Le
téléphone garde sa barre ([lancer-la-recherche.md](lancer-la-recherche.md)).

**Une seule forme**, à la largeur de sa colonne (≈ 138 px de haut au repos,
estimation sur une ligne) : les objectifs sur une ligne, ou en 2 × 2 quand
ils ne tiennent pas sur une ligne (axe `colonnes`) ; « Exporter » ·
« Importer » à gauche, « Rechercher » à droite, 240 px de large, jamais
réduit : l'écart entre « Importer » et « Rechercher » prend ce qui manque
quand la colonne se resserre, les marges du panneau restent. ⚠️ **Sous
448 px de rangée (« Exporter » 96 + 8 + « Importer » 96 + 8 + « Rechercher »
240, mesurés), « Rechercher » passe sous « Exporter » · « Importer », pleine
largeur** (décision de l'utilisateur) : rien n'est rogné, et le passage ne
dépend que de la largeur de la rangée (requête sur un conteneur nommé,
`rangee`), jamais d'un clic ni du lancement d'une recherche.

### Zone des résultats et place en plus

- **Place réservée** : la zone des résultats est là dès le départ, une
  section « Résultats » élastique de 328 px au moins (une carte, à la
  largeur minimale de la colonne des résultats : elle y tient sans
  déborder), la dernière du panneau des résultats, sous le bloc « Objectif
  et Rechercher ».
  Avant la première recherche, une place d'attente (en-tête et message,
  ≈ 160 px) tient la place où arrivent les cartes : leur arrivée ne déplace
  jamais ce qu'on vient de cliquer. Son en-tête dit « Choisis un monstre
  pour préparer la recherche. » sans monstre, « Aucune recherche lancée
  pour ce monstre. » ensuite ; le cadre en pointillé dit « Les builds
  trouvés s'afficheront ici. ». Une recherche lancée (ou arrêtée sur une
  erreur, un refus) sans carte encore garde le cadre, sans la phrase de
  l'en-tête, dont la ligne reste réservée.
- ⚠️ **Une relance garde la hauteur des résultats d'avant** jusqu'à
  l'arrivée de la première carte : la recherche relancée vide les
  résultats, et la colonne, devenue plus courte que son défilement,
  remonterait d'un coup sous le pointeur, « Rechercher » compris.
- **La place en plus** va aux résultats, en cartes de 328 px au moins (360 au doigt)
  (une seule, à toute la largeur, en dessous ; [resultats.md](resultats.md)) :
  la largeur gagnée ajoute des cartes par rangée.

### Au format téléphone

Le format téléphone garde sa mise en page : une colonne, et le panneau
« Options » pour l'exclusion et les réglages. ⚠️ **Pas de débordement, et
les contrôles du panneau prennent toute la largeur.** Points tenus :

- **Grille Conditions** : « Min »/« Max » collés à chaque champ feraient
  déborder la rangée (libellé + deux `NumberField` + deux mots > largeur utile).
  Au doigt, ces mots sont masqués et remplacés par **deux en-têtes de colonne**
  posés une fois ; la variante de « Critères » au bureau fait de même (voir
  [conditions-et-reglages.md](conditions-et-reglages.md)).
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
