# Outils · Optimizer (`#/outils/optimizer`)

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets**, de **statistiques principales imposées** (slots 2/4/6) et de
**minimums/maximums de stats**, orientée par un **objectif de recherche**
choisi d'avance. Anticipé dans
[compte/calcul-runes.md §6](../compte/calcul-runes.md) (« Futur optimiseur
de builds »).

Fichiers : [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx) ·
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts) (moteur pur) ·
[runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts) (Worker) ·
[useBuildOptimSearch.ts](src/hooks/useBuildOptimSearch.ts) (cycle de vie du
Worker) · [useOptimizerState.ts](src/hooks/useOptimizerState.ts) (toute la
saisie de l'écran, remontée dans App.tsx) ·
[MonsterSourcePicker.tsx](src/components/outils/MonsterSourcePicker.tsx) ·
[ExclusionCandidateRow.tsx](src/components/outils/ExclusionCandidateRow.tsx)
(partagé avec [RuneExclusionPicker.tsx](src/components/outils/RuneExclusionPicker.tsx)) ·
[SetComboPicker.tsx](src/components/outils/SetComboPicker.tsx) ·
[BuildCandidateCard.tsx](src/components/outils/BuildCandidateCard.tsx) ·
[DamageSetupCard.tsx](src/components/outils/DamageSetupCard.tsx) +
[damage.ts](src/lib/damage.ts) (objectif « Dégâts réels », voir
[degats-reels.md](degats-reels.md)) ·
[StatPanel.tsx](src/components/StatPanel.tsx) ·
[ArtifactSlots.tsx](src/components/ArtifactSlots.tsx) ·
[RuneWheel.tsx](src/components/RuneWheel.tsx) — ces trois derniers
partagés avec `MonsterGear.tsx` (RTA/Siège/« Équipement actuel »), voir
[README.md](../README.md).

⚠️ **Tous les contrôles viennent de la librairie `src/ui/`**, comme partout
dans l'app (« rien de custom », voir [design.md](../shared/design.md)) : les
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

⚠️ **Largeur de l'écran — pleine largeur, en deux temps.** L'Optimizer était
le seul écran de l'app à s'imposer une colonne bornée (768 px), et empilait
~2 000 px de réglages à faire défiler sur un écran large resté à moitié
vide. **La barre d'actions, la progression et les résultats restent pleine
largeur** — la grille de cartes de résultat, elle, profite directement de
la largeur (davantage de cartes par ligne).

⚠️ **L'ordre d'usage voulu, explicite dans la mise en page, pas seulement
dans le DOM** — demande directe de l'utilisateur : 1) choisir un monstre
(**Monstre & équipement**) ; 2) choisir l'**Objectif de recherche**, une
carte à part entière (PAS un champ dans « Critères de recherche » : il se
choisit avant même de composer le set, ce n'est pas un critère de plus
parmi d'autres) ; 3) composer les **Critères de recherche**, dans cet
ordre : Set de runes recherché → Artéfacts → Conditions → Statistique
principale imposée (slots 2/4/6) ; puis, optionnellement et en dernier,
**Exclusion de runes** (Runes imposées y compris, voir plus bas) et
**Réglages avancés**.

Depuis `xl`, **une seule grille** (deux colonnes, quatre rangées) porte tout
l'écran de réglages, organisée en **paires** plutôt qu'en un seul bloc
continu — demande explicite de l'utilisateur :

1. **Rangées 1-2 : Monstre & équipement, à côté d'Exclusion de runes +
   Réglages avancés.**
   « Monstre & équipement » : recherche à **gauche** (`lg:flex-1`, GRANDIT
   pour occuper l'espace libéré par la fiche d'équipement, désormais serrée
   sur son propre contenu — demande explicite d'utiliser l'espace libre
   autour de la roue/fiche de stats pour élargir la recherche, dont le
   résultat suit la largeur de son parent : une équipe complète de siège
   s'y lit sans se tasser), fiche d'équipement à **droite** (`lg:flex-none`,
   à taille pleine, ne s'étire plus) — la fiche se déploie à côté de la
   recherche, plus en dessous. ⚠️ **Artéfacts, roue et relique forment un
   groupe INSÉCABLE** : la roue se lit collée à la droite des emplacements
   d'artéfacts, la relique juste après. Ils se déplacent ensemble ou pas du
   tout — séparés, la roue puis la relique passaient à la ligne dans une
   colonne étroite, cette dernière pouvant finir hors du cadre. Un
   **sélecteur de source** (Box / RTA / Défenses siège / Offenses siège,
   même contrôle qu'« Exclure les runes d'un monstre » plus bas) apparaît
   entre le libellé « Monstre à optimiser » et son champ de recherche —
   c'est le premier choix à faire, avant même de taper un nom. ⚠️ **Le champ
   de recherche lui-même se comporte EXACTEMENT comme celui d'« Exclure les
   runes d'un monstre »** : il cherche par nom PARMI les entrées de la
   source active (toute la source, pas un monstre déjà choisi ailleurs),
   équipe complète affichée pour le siège (un même monstre peut apparaître
   dans plusieurs équipes, indiscernables par le seul nom) — et choisir un
   résultat fixe **directement** l'exemplaire optimisé, en un seul geste
   plutôt qu'en deux (espèce, puis exemplaire). **Choisit RÉELLEMENT ce que
   la recherche optimise**, pas seulement ce qui est prévisualisé. ⚠️
   Changer de source ne touche PAS au monstre affiché — le sélecteur filtre
   uniquement la liste de recherche, l'exemplaire reste actif jusqu'à être
   explicitement remplacé par un nouveau clic. ⚠️ **La
   fiche reste TOUJOURS affichée**, vide (stats à zéro, artéfacts grisés,
   roue vide) tant qu'aucun monstre n'est choisi, plutôt que de n'apparaître
   qu'au clic — l'espace qu'elle occupe est réservé d'avance (voir
   [shared/design.md](shared/design.md), « un clic ne déplace jamais ce
   qu'on vient de cliquer »). À sa droite : **Exclusion de runes**
   (rangée 1) puis **Réglages avancés** (rangée 2), empilés — Exclusion
   regroupe désormais aussi **Runes imposées** (verrouiller un emplacement
   sur une rune précise — déplacé depuis « Critères de recherche », même
   thème : agir sur le pool de runes à partir de l'exemplaire recherché).
2. **Rangée 3 : Critères de recherche, à côté d'Objectif de recherche.**
   « Critères de recherche » est **compactée au maximum** (`w-fit` — la
   carte hugs son contenu plutôt que de s'étirer sur toute la largeur de sa
   colonne) pour laisser de la place, visuellement, à « Objectif de
   recherche » à sa droite. Son contenu, dans cet ordre : **Set de runes
   recherché**, puis **Artéfacts**, puis **Conditions**, puis
   **Statistique principale imposée** en dernier — demande explicite
   d'intervertir cette dernière avec le duo Artéfacts+Conditions (elle
   vivait auparavant CÔTE À CÔTE avec Set de runes recherché, en tête).
   ⚠️ **Densité — deux plafonds de largeur en plus du `w-fit` de la
   carte** : le **set de runes recherché** (`max-w-md`, ceinture et
   bretelles — `fit-content` peut encore grandir jusqu'à la largeur
   disponible de la piste si le contenu peut la remplir sans repasser à la
   ligne) et la **grille Conditions** (`w-fit` propre, en plus de celui de
   la carte). ⚠️ Pour Conditions précisément : un conteneur `grid` en bloc
   prend toute la largeur de son parent, et des colonnes `auto` (Min/Max)
   SE PARTAGENT l'espace libre restant dès qu'aucune piste n'est en `fr` —
   sans `w-fit`, Min et Max s'étiraient à des dizaines de pixels l'un de
   l'autre. Le **set principal** (4 pièces) s'affiche sur **deux lignes de
   trois** en permanence (comme au doigt), pour laisser plus de largeur au
   set secondaire.
3. **Rangée 4 : ligne d'estimation**, pleine largeur (`col-span-2`) — ni
   dans l'une ni l'autre paire.

⚠️ **« Réglages avancés » ne pousse plus jamais rien en se dépliant** —
demande explicite (« la partie critères de recherche ne doit pas se
déplacer vers le bas lorsqu'on déroule réglages avancés »), et « reste
toujours sous Exclusion de runes » (donc sans déplacer LE BLOC lui-même,
contrairement à une tentative précédente qui l'avait isolé en dernière
rangée pour contourner le même symptôme). Son contenu déplié n'est plus un
bloc **inline** qui grandissait la carte (donc la rangée 2 partagée avec
« Monstre & équipement », donc le départ de la rangée 3) — c'est un
**`FlottantAuto`** ancré à la carte, qui flotte PAR-DESSUS la page :
la carte garde TOUJOURS sa hauteur repliée, aucune rangée ne peut plus
bouger. Un panneau replié par défaut ne peut pas réserver sa place à
l'avance sans perdre l'intérêt d'être replié — il sort donc du flux
(flottant), l'autre option prévue par
[shared/design.md](shared/design.md), « un clic ne déplace jamais ce
qu'on vient de cliquer ». Ferme au clic extérieur, même patron que
`HelpPopover.tsx`.

⚠️ **Placement explicite (`col-start`/`row-start`) sur CHAQUE bloc, jamais
un réordonnancement de la source** : l'ordre du DOM reste celui de l'ordre
d'USAGE (1. monstre, 2. objectif, 3. critères, puis optionnellement
exclusion/réglages avancés) — c'est le placement CSS, pas le DOM, qui
organise l'écran en paires. Sous `xl`, une seule colonne : aucune de ces
classes ne s'applique, et l'ordre du DOM (= l'ordre d'usage) redevient
l'ordre de lecture.

⚠️ **Responsive — pas de débordement, et les contrôles du panneau prennent
toute la largeur.** Points tenus au format étroit (l'écran n'avait jamais été
audité en mobile) :
- **Grille Conditions** : « Min »/« Max » collés à chaque champ faisaient
  déborder la rangée (libellé + deux `NumberField` + deux mots > largeur utile).
  Au doigt, ces mots sont masqués et remplacés par **deux en-têtes de colonne**
  posés une fois ; au bureau (`sm:`), chaque champ garde son libellé à côté et
  les en-têtes disparaissent — rendu inchangé.
- **Objectif de recherche** : le `Segmented` pleine largeur passe en **`dense`**
  sous `sm` (`useMediaQuery(SOUS_SM)`), sinon « PV effectifs » débordait son
  quart de rangée que `whitespace-nowrap` interdit de couper.
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

⚠️ **Survit à un changement d'onglet.** Comme les autres pages de l'app,
`OutilsPage` (et donc `OptimizerSection`) est **démontée** à chaque
navigation — un simple `useState` local y perdrait tout (monstre choisi,
conditions saisies, résultats…) au moindre aller-retour vers RTA ou une autre
page. `useOptimizerState` centralise donc cette saisie et est instancié
**dans `App.tsx`**, qui ne se démonte jamais tant que l'onglet du navigateur
reste ouvert — même principe que `useRtaState`/`useSiegeState` pour la prépa
RTA et les équipes de siège. ⚠️ **Sans écriture disque**, à la différence de
ces deux-là : cette saisie n'a rien à voir avec le compte importé ni le
système de conservation (voir [usePersistence](src/hooks/usePersistence.ts))
— fermer l'onglet ou recharger la page la perd, seule la navigation ENTRE
onglets de la session en cours la préserve. Le Worker de recherche lui-même
suit ce cycle de vie : une recherche en cours **continue de tourner** en
arrière-plan si on change d'onglet, et son résultat est toujours là au
retour.

## Écran (de haut en bas)

0. **Bandeau bêta** — permanent, pas refermable (contrairement à
   `MobileNotice` : ce n'est pas un avertissement ponctuel mais un statut qui
   reste vrai tant que l'outil est en rodage). Rappelle que le moteur de
   recherche peut être lent sur des critères serrés ou manquer un build sur
   un cas inhabituel, et qu'il faut vérifier le résultat avant de re-runer.
1. **Source, puis sélecteur de monstre** — un **sélecteur de source** (Box,
   par défaut / RTA / Défenses siège / Offenses siège) entre le libellé
   « Monstre à optimiser » et son champ de recherche — c'est le premier
   choix à faire, avant même de taper un nom. ⚠️ **Même hauteur et même
   répartition que le sélecteur de source d'« Exclure les runes d'un
   monstre »** (`Segmented size="lg"` : pleine largeur, les 4 options
   réparties à égalité, un **séparateur vertical** entre chacune) —
   auparavant un sélecteur compact (`dense` seul), disproportionné avec
   celui d'« Exclure les runes d'un monstre ». ⚠️ **Le champ de recherche cherche PARMI
   les entrées de la source active** — EXACTEMENT le même mécanisme que
   « Exclure les runes d'un monstre » plus bas (même composant de rangée de
   résultat, `ExclusionCandidateRow` : portrait, nom, compte de runes, et
   pour le siège le numéro d'équipe + ses coéquipiers, un même monstre
   pouvant apparaître dans plusieurs équipes indiscernables par le seul
   nom) — pas un sélecteur d'espèce suivi d'un second choix d'exemplaire :
   **choisir un résultat fixe directement l'exemplaire optimisé**, en un
   seul geste. Pour Box, un monstre nu (sans aucune rune) reste
   recherchable : construire un build depuis rien est un cas d'usage normal
   de l'outil. Pour RTA/siège, seules les entrées **avec au moins une rune
   équipée** apparaissent (rien à optimiser sur un slot vide de ces sources).
   ⚠️ **Changer de SOURCE ne touche PAS au monstre affiché** — le sélecteur
   filtre uniquement la LISTE DE RECHERCHE ci-dessous (« dans quelle source
   chercher »), l'exemplaire réellement optimisé reste celui du dernier
   choix explicite, quel que soit l'onglet affiché depuis. Bug corrigé
   (signalement direct) : une version antérieure vidait ce choix à chaque
   clic d'onglet, faisant disparaître le monstre affiché — et ses
   « Runes imposées » — sans qu'aucun nouveau monstre n'ait été choisi. Le
   monstre **reste présent et actif jusqu'à être explicitement remplacé**
   par un clic sur un autre résultat. **Changer d'ESPÈCE** (un monstre différent, dans n'importe
   quelle source) réinitialise en plus « Critères de recherche » et les
   résultats affichés (set, statistique principale imposée, objectif,
   artéfacts, conditions min/max, tri, pagination) — des critères posés pour
   l'ancien monstre n'ont pas de raison de valoir pour le nouveau. Re-choisir
   le même exemplaire déjà sélectionné n'efface rien ; choisir un AUTRE
   exemplaire de la MÊME espèce non plus (seuls les critères propres à
   l'équipement changent, pas ceux propres à l'espèce). Les **réglages
   avancés** (préfiltrage, exclusions, recherche exhaustive…) ne sont PAS
   concernés : ce sont des préférences générales, pas des critères propres à
   un monstre. **Importer un nouveau compte** (bouton global « Importer un
   JSON ») déclenche la réinitialisation complète, pour la même raison
   (autre box, autre pool de runes possible) — même en étant sur un autre
   onglet au moment de l'import.
2. **Équipement actuel** — **le composant `MonsterGear`, réutilisé tel quel**
   (pas réimplémenté), le même qu'en RTA/Siège quand on clique un monstre :
   stats base/bonus, artéfacts, roue de runes et relique **tels
   qu'ACTUELLEMENT équipés** sur l'exemplaire choisi ci-dessus — **c'est
   CET exemplaire que la recherche optimise**, pas systématiquement la box.
   Tant qu'aucun exemplaire n'a encore été choisi DANS LA SOURCE ACTIVE
   depuis le dernier montage de la page : repli sur le meilleur exemplaire
   box de l'espèce affichée la dernière fois (continuité au retour sur
   l'onglet) si la source active est Box, fiche vide sinon (RTA/siège
   n'ont pas d'équivalent « toujours un choix par défaut sensé », l'espèce
   peut apparaître dans plusieurs équipes). ⚠️ **Limite connue** : ce choix
   d'exemplaire ne fait PAS partie de la recette exportée (`OptimizerRecipe`
   ne porte que l'espèce, `monsterCom2usId`) — réimporter une recette lancée
   sur un exemplaire RTA/siège retombe sur la box par défaut. Chacun de ses éléments reste **cliquable**
   pour ouvrir son détail complet (`RuneDetailBox`/`ArtifactDetailBox`/
   `RelicDetailBox`, tous dans [MonsterGear.tsx](src/components/MonsterGear.tsx)),
   affiché en **popover flottant** ancré sur l'élément cliqué — même
   dispositif que les cartes de résultat (`BuildCandidateCard`, voir plus
   bas), pas un bloc qui pousserait le reste de la fiche vers le bas. Ce que
   l'outil part optimiser, visible d'un coup d'œil avant de lancer quoi que
   ce soit — y compris les artéfacts et la relique, qui ne sont eux jamais
   modifiés par la recherche (voir « Algorithme »). ⚠️ **Artéfacts : toujours
   2 emplacements affichés** (Attribut puis Type), même si le monstre choisi
   n'en porte qu'un seul ou aucun — un emplacement vide est montré grisé
   plutôt que simplement absent. ⚠️ **L'encadré de stats bascule base+bonus
   ↔ total au clic**, comportement propre à `MonsterGear`, partagé avec RTA
   et Siège (voir [rta/sections-runes.md](../rta/sections-runes.md)).
   ⚠️ **Affiché à DROITE de la recherche, TOUJOURS** — vide (stats à zéro,
   emplacements grisés, roue sans rune) tant qu'aucun monstre n'est choisi,
   plutôt que de n'apparaître qu'au clic. C'est un `GearSet` NUL construit
   en local (`EMPTY_GEAR`, [OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx)),
   pas une variante de `MonsterGear` : le composant partagé n'a besoin
   d'aucune adaptation, `computeStats` sur une base à zéro renvoie déjà des
   lignes à zéro, et `ArtifactSlots`/`RuneWheel` gèrent nativement un
   tableau vide.
3. **Objectif de recherche** — une **carte à part**, entre « Monstre &amp;
   équipement » et « Critères de recherche » (pas un champ dans cette
   dernière) : demande explicite de l'utilisateur pour que l'ordre d'usage
   soit clair — l'objectif se choisit avant même de composer le set
   recherché, ce n'est pas un critère de plus parmi d'autres. **Un bouton à
   choix unique** (`<Segmented
   size="lg">`), choisi **avant** de lancer la recherche, pas seulement un tri
   après coup :
   - **Efficience** (par défaut) — pas de biais particulier, la mesure
     choisie globalement (Efficience ou Score SW, voir
     [compte/runes.md](../compte/runes.md)).
   - **Dégâts** — considère ATQ, Taux Crit et Dmg Crit **ensemble** (une
     seule formule d'espérance) : `ATQ × (1 + (Taux Crit/100) × (Dgts
     Crit/100))`. Taux Crit plafonné à 100 % **dans la formule**, même si le
     total brut d'un build le dépasse — au-delà, le surplus ne rapporte plus
     rien en jeu, donc pas plus de dégâts espérés dans ce calcul non plus.
   - **PV effectifs** — considère PV et DEF ensemble.
   - **Vitesse** — VIT seule.
   - **Dégâts réels** — la **vraie formule d'un sort précis** contre un
     adversaire configuré, pas une espérance générique. Modèle de calcul
     détaillé : [degats-reels.md](degats-reels.md). Choisir cet objectif
     déplie, **juste en dessous**, son propre réglage
     ([DamageSetupCard.tsx](src/components/outils/DamageSetupCard.tsx)) —
     et rien ailleurs à l'écran ne change :
     - **Compétence utilisée** — les sorts offensifs du monstre, chacun
       accompagné de ce que ses données disent déjà (« 3 coups · Zone ·
       Ignore la DEF · +30 % (compétence maxée) »). ⚠️ **Rien de tout cela
       ne se saisit** : coefficient, coups, portée, ignore défense, dégâts
       fixes et bonus des améliorations sont lus dans la fiche du sort. Par
       défaut, le dernier slot calculable (S3 avant S2 avant S1). Un sort
       dont la formule sort du modèle reste **affiché, grisé, avec son
       motif** — jamais absent sans explication.
     - **Adversaire** — PV et DEF. ⚠️ Les **PV ne classent rien** : ils ne
       servent qu'à lire le résultat (« 42 % des PV », « tue la cible »).
       Un champ **PV restants** n'apparaît que pour les sorts dont la
       formule lit les PV courants de la cible.
     - **Effets actifs** — buffs du monstre (ATQ +50 %, DEF +70 %, VIT
       +30 %) et effets subis par la cible (réduction de défense ×0,3,
       marque +25 %), chacun son **icône de jeu cliquable**, pas une case à
       cocher séparée. ⚠️ **Grisée au repos, en couleurs + coche une fois
       activée** — l'état se lit sur l'icône elle-même, sans avoir à cliquer
       pour comprendre la légende (au repos, tout est grisé : rien n'est
       encore choisi).
     - **Compétences d'invocateur** — **Aucune** / **Combat** (défaut) /
       **Combat + Guilde**. Remplacent les anciens totems et drapeaux,
       toujours supposées maxées. ⚠️ **Un choix unique, pas deux cases** :
       l'onglet Guilde ne s'applique qu'en contenu de guilde, où Combat
       compte aussi — « Guilde » implique donc toujours « Combat ». La
       compétence « Puis. d'att. de <élément> » suit l'élément du monstre,
       sans rien demander. Détail des valeurs :
       [degats-reels.md](degats-reels.md).
     - **Coup critique** — Moyenne (défaut, espérance sur le Taux Crit
       réellement atteint — le seul mode où le Taux Crit pèse sur le
       classement) / Critique / Non critique.
     ⚠️ **On n'affiche que ce que le sort CONSOMME** : un sort qui ignore la
     défense ne montre ni la DEF ennemie ni la réduction de défense ; un
     sort qui ne dépend pas de la VIT ne montre pas le buff de vitesse. Un
     champ visible mais sans effet est pire qu'un champ absent — il fait
     croire à une action.
     ⚠️ Contrairement aux cinq autres objectifs, ses stats pertinentes
     **dépendent du sort** (`{ATK}`, `{ATK}×({SPD}+70)/30`, `0.2×{MAX HP}`…)
     et ne tiennent donc pas dans une table statique : l'écran les calcule
     (`damageRelevantStats`) et les transmet au moteur via
     `SearchParams.objectiveStats`. Le moteur, lui, reste générique — il
     reçoit « ces stats comptent plus », jamais la notion de sort.
     ⚠️ **Aucun sort calculable** (monstre perso, fiche absente, formules
     hors modèle) : la recherche reste possible et se rabat sur le biais de
     **Dégâts** ; le tri « Dégâts réels » n'est alors pas proposé.
   ⚠️ **« Speed nuker » a été retiré** (remplacé par « Dégâts réels ») :
   c'était un archétype générique (ATQ+Dmg Crit+VIT élargis au pré-filtrage,
   mais VIT absente du tri final — placeholder jamais résolu). « Dégâts
   réels » répond mieux à ce besoin quand le sort utilisé dépend
   effectivement de VIT (ex. Lagmaron, `ATQ × (VIT + 70) / 30`) : la vraie
   formule, VIT comprise, sert alors au tri — pas seulement au pré-filtrage.
   ⚠️ L'objectif choisi oriente le **pré-filtrage** (quelles runes ont une
   vraie chance d'être considérées) et le **tri par défaut** des résultats
   (modifiable ensuite) — il **n'influence pas** le classement des candidats
   pendant la recherche elle-même : seuls les minimums/maximums posés
   ci-dessous en décident, quel que soit l'objectif choisi.
4. **Set de runes recherché** — **un seul combo** (contrairement aux
   recommandations de siège, qui proposent plusieurs possibilités au choix) :
   grille d'icônes de sets, jamais un menu déroulant (`SetComboPicker.tsx`,
   même comportement que le picker de `RecoCard.tsx` réécrit en plus simple).
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés. ⚠️ **Obligatoire** :
   tenter de lancer une recherche sans set sélectionné met cette zone en
   **surbrillance rouge marquée** au lieu de silencieusement ne rien faire —
   on montre OÙ agir. Repasse normale dès qu'un set est ajouté.
5. **Artéfacts** — interrupteur **« Ignorer les statistiques des
   artéfacts »**, **décoché par défaut** (les artéfacts réellement équipés
   comptent). Décoché, deux listes déroulantes (Attribut, Type) proposent :
   **« Comme équipé »** (défaut, reprend l'artéfact du build de BASE),
   **ATQ +100**, **DEF +100**, **PV +1500** (les trois valeurs de
   statistique principale d'artéfact possibles en jeu), ou **« Aucun »**.
   ⚠️ Un même monstre peut porter des artéfacts DIFFÉRENTS selon le contexte
   (build de base, RTA, un deck de siège) — le sélecteur de monstre de
   l'Optimizer n'expose que le build de base ; choisir une statistique
   explicite permet d'hypothéquer l'artéfact d'un autre contexte sans changer
   de monstre affiché. Ces stats deviennent le PLANCHER des conditions
   ci-dessous.
6. **Conditions** — les 8 stats (PV, ATQ, DEF, VIT, Taux Crit, Dmg Crit, RES,
   Précision). Chaque stat porte **deux champs, minimum et maximum**, tous
   deux facultatifs — champ vide = pas de contrainte.
   - **Interrupteur « Stats de base exclues »**, activé par défaut : n'affecte
     que PV, ATQ, DEF et VIT — ces 4 stats ont une base qui grandit avec le
     niveau/l'éveil ; activé, le champ porte sur ce que l'**équipement**
     (runes et artéfacts) doit apporter au-dessus de la base nue. Désactivé,
     il porte sur le total. Taux Crit/Dmg Crit/RES/Précision restent
     TOUJOURS en total, quel que soit ce réglage.
   - Taux Crit, RES et Précision sont plafonnés à 100 % **sur la saisie**
     seulement — la recherche elle-même ne doit surtout pas exclure un build
     dont la somme brute dépasse 100 % (une marge de sécurité contre la
     précision/résistance adverse reste un résultat légitime).
   - **« Réinitialiser les conditions »** vide les 16 champs sans toucher aux
     autres réglages de l'écran.
7. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), une
   rangée de puces à cocher :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision
   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6. ⚠️ **Placée en
   DERNIER** dans la carte (intervertie avec Artéfacts+Conditions, demande
   explicite) — elle vivait auparavant en tête, CÔTE À CÔTE avec Set de
   runes recherché. Ce filtre s'applique **avant** tout le reste, dans la
   construction même du pool par slot — il réduit donc le nombre de
   candidats réellement considérés dès le départ, quelle que soit sa
   position dans l'écran.
8. **« Utiliser tout l'inventaire »** — case à cocher, **cochée par défaut**
   (voir « Exclusion des runes » ci-dessous).
9. **« Réglages avancés »** (repliés par défaut). ⚠️ **Au bureau, un
   `FlottantAuto`** (`shared/librairie-ui.md`), PAS un bloc qui grandit la
   carte — dépliée, la carte reste sous « Exclusion de runes » (rangée 1-2
   du duo Monstre & équipement, voir plus haut) à sa hauteur repliée, le
   contenu flotte par-dessus le reste de la page ; ferme au clic extérieur.
   Un panneau replié par défaut ne peut pas réserver sa place à l'avance
   sans perdre l'intérêt d'être replié — voir
   [shared/design.md](shared/design.md), « un clic ne déplace jamais ce
   qu'on vient de cliquer ». **Pré-filtrage par emplacement**, en
   **presets** plutôt qu'un curseur libre — Bas / Moyen
   (défaut) / Haut / Extrême, du plus rapide au plus large (et donc plus
   lent, mais capable de retrouver un build sur un très gros compte),
   **séparés par un liseré vertical** (même patron que `Segmented.tsx`,
   PC et mobile).
   ⚠️ **Au doigt, dans le panneau « Options »** (bouton de la barre de nav,
   voir App.tsx/`pageAPanneau` — même patron que la Liste et l'Optimisation
   de runes de « Mon compte », voir RunesOptim.tsx), **sous** « Exclusion de
   runes » — **jamais replié** dans ce panneau : ouvrir le panneau EST déjà
   le geste « je veux voir les options ». Chaque groupe dans son propre
   cadre, deux unités visuelles distinctes plutôt qu'un simple trait entre
   deux blocs de texte. ⚠️ **« Pool de runes = X » s'affiche à droite des
   presets**, dans le panneau SEULEMENT (pas la carte du bureau, où
   l'estimation détaillée du point 10 est déjà visible juste en dessous,
   sans qu'un panneau ne la masque) — sans ce rappel local, aucun moyen de
   voir l'effet du preset qu'on vient de toucher sans d'abord fermer le
   panneau. **Passe sous les presets si la largeur manque** (le message
   est assez long pour ne pas toujours tenir à côté sur un téléphone
   étroit) — adaptatif, jamais coupé ni superposé. ⚠️ **Choisir Haut ou
   Extrême active automatiquement** « Rechercher jusqu'à épuisement
   complet » et « Prioriser les stats les plus difficiles » ci-dessous — un
   pré-filtrage large n'a de sens que combiné à ces deux réglages, qu'un
   utilisateur novice n'a aucune raison de connaître. Un COUP DE POUCE, pas
   un verrouillage : chaque interrupteur reste cliquable normalement
   ensuite pour revenir à décoché. Choisir Bas ou Moyen ne les décoche PAS
   automatiquement dans l'autre sens. Sous ce réglage :
   - **« Rechercher jusqu'à épuisement complet »**, décoché par défaut :
     retire le filet de temps de 10 minutes (voir « Interruption ») — la
     recherche continue tant qu'il reste des combinaisons à examiner, plutôt
     que de s'arrêter au bout d'un temps fixe. ⚠️ Peut prendre très longtemps
     sur une recherche avec peu de conditions (beaucoup de combinaisons
     restent à examiner) : le bouton « Arrêter » reste le seul filet et garde
     le meilleur trouvé jusque-là. ⚠️ Ne retire que la limite de TEMPS — le
     plafond interne de candidats collectés (non réglable) reste actif ; une
     recherche assez large pour l'atteindre s'arrête quand même avant d'avoir
     tout exploré, ce qui n'a en pratique aucune conséquence sur la qualité
     du résultat (voir « Limites connues »). Fait partie des réglages
     exportés/importés dans une recette (voir plus bas).
   - **« Diagnostic approfondi sur 0 résultat »**, décoché par défaut (plus
     coûteux qu'un diagnostic simple, voir « Résultats »).
   - **« Prioriser les stats les plus difficiles »**, décoché par défaut :
     réalloue le budget de rétention vers les stats demandées les plus
     rares/difficiles à combiner plutôt qu'un partage égal entre toutes —
     peut retrouver un build qu'une recherche normale rate, au prix d'une
     recherche plus longue. Fait partie des réglages exportés/importés dans
     une recette (voir plus bas).
10. **Estimation du pool retenu** — dès qu'un monstre et un set sont choisis,
    une ligne affiche le nombre **exact** de runes gardées après
    pré-filtrage, détaillé par emplacement (une **somme**, pas un produit),
    recalculée en direct à chaque changement de critère. ⚠️ **Le pool, pas
    l'espace de recherche** : le nombre de combinaisons brutes (produit des
    tailles de pool par emplacement) est un ordre de grandeur bien trop
    éloigné du nombre réel de demi-builds construits ou de paires visitées
    par le meet-in-the-middle pour servir de repère — seul le pool retenu,
    lui, est un nombre exact et directement lisible.
11. **« Rechercher »** — lance le calcul. Changer un des critères ci-dessus
    ne relance rien automatiquement : il faut recliquer. Un bouton
    **« Arrêter »** apparaît pendant le calcul — il interrompt la recherche
    et garde le **meilleur trouvé jusque-là**, plutôt que de tout perdre
    (voir « Interruption »). ⚠️ **« Exporter les paramètres » / « Importer
    les paramètres »**, juste à côté : télécharge/relit un fichier `.json`
    contenant la RECETTE de cette recherche (set, minimums, objectif,
    préréglage, exploration de tout l'inventaire, choix d'artéfacts) —
    **jamais le pool de runes ni le compte**, ce qui la rend partageable
    entre joueurs. L'import remplit tous les réglages et sélectionne
    automatiquement le monstre de la box courante si son `com2usId` s'y
    trouve.
12. **Barre de progression** — se remplit progressivement (pas une roue qui
    tourne), avec le nombre de combinaisons déjà examinées et déjà trouvées,
    suivi d'un message **en gras, couleur dorée** (même que le rang `#X`
    d'un résultat) : « Attendez la fin de la recherche pour être sûr de
    trouver votre build optimal ».
13. **Résultats** — jusqu'à 20 combinaisons affichées, chacune : rang, les
    sets obtenus, le **panneau de stats** (`StatPanel.tsx`, le même composant
    que dans « Équipement actuel ») et les artéfacts + les 6 runes sur une
    roue à échelle réduite (`BuildCandidateCard.tsx`), tous deux cliquables
    pour ouvrir le détail complet de la pièce. Puis la valeur **moyenne par
    rune** dans la mesure choisie — « Efficience moyenne : X » ou « Score
    moyen : X » selon le réglage global (Efficience/Score SW).
    ⚠️ **Détail à la souris vs au doigt — même bascule que « Équipement
    actuel »/RTA/Siège** (voir `MonsterGear.tsx`) : à la souris, un flottant
    ancré à la pièce ; au doigt, le détail s'affiche **en ligne sous la
    carte**, sur sa propre ligne. Un flottant à taille fixe débordait de
    l'écran sur une carte de résultat déjà compacte en mobile.
    ⚠️ **Sur 0 résultat**, un encadré diagnostic apparaît : soit une liste de
    conditions mathématiquement hors de portée (avec leur borne exacte), soit
    un message neutre orientant vers la conjonction des contraintes ou un
    pré-filtrage plus large. Un sélecteur **« Trier par »** re-trie **côté
    client, instantanément**, sans relancer la recherche : le moteur a déjà
    calculé les stats complètes de chaque combinaison retenue. Deux groupes
    d'options — les 8 stats brutes, et les mêmes objectifs qu'à l'étape 5
    (« Dégâts réels » n'y figure que si un sort est réellement calculable
    pour ce monstre).
    ⚠️ **Objectif « Dégâts réels »** : chaque carte affiche en tête le
    **nombre de dégâts** qui a servi à la classer, et la part des PV de la
    cible qu'il emporte (« tue la cible » au-delà de 100 %). Visible dès que
    ce critère ordonne la liste — que ce soit l'objectif de la recherche ou
    un tri choisi après coup.

⚠️ **Rien n'est appliqué au compte.** L'outil est en lecture seule et
purement indicatif, comme le reste de SW Forge (aucune écriture vers le
jeu) : c'est au joueur de re-runer dans Summoners War.

## Exclusion des runes déjà portées ailleurs

⚠️ **Au doigt, dans le panneau « Options »** (bouton de la barre de nav),
EN TÊTE — avant « Réglages avancés » (voir item 9 ci-dessus) : fonctionnalité
vedette, mise en avant côté bureau par sa carte à bordure accentuée.

**« Exclure les runes déjà utilisées »**, DÉCOCHÉE par défaut, porte la
recherche sur l'**inventaire entier** — y compris des runes qu'il faudrait
retirer d'un autre monstre pour composer le build proposé. ⚠️ **Icône** : la
roue de runes (le fond derrière les runes des cartes de résultat, voir
`RuneWheel.tsx`), barrée du symbole « interdit » — même traitement que les
deux autres icônes de cette section.

Cochée, la recherche **exclut** les runes déjà portées ailleurs, dans **un
seul périmètre au choix** (jamais plusieurs à la fois) : **RTA** (défaut),
**Défenses siège** ou **Box**. Elle ne propose alors que des combinaisons
réellement montables sans déruner quelqu'un dans ce périmètre. Les runes
déjà portées par le monstre **choisi** lui-même (même espèce, n'importe
lequel de ses exemplaires) restent TOUJOURS disponibles quel que soit ce
réglage — jamais exclu de ses propres runes. Le sélecteur de périmètre est
grisé et non cliquable tant que la case n'est pas cochée.

⚠️ **Le moteur est générique**, pas couplé à un périmètre précis :
`searchBuilds` ne connaît qu'un `pool` de runes déjà filtré.
`autoExcludedRuneIds` (dans
[optimizerExclusion.ts](src/lib/optimizerExclusion.ts)) est la fonction qui
construit cet ensemble d'exclusion pour le périmètre choisi — sa branche
« Box » réutilise `excludedRuneIds`
([runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), seule fonction restée
spécifique à la box (comportement historique de l'outil, avant l'ajout des
deux autres périmètres).

### Exclusion manuelle — un monstre précis, dans n'importe quelle source

**« Exclure les runes d'un monstre »** : recherche par nom un monstre déjà
connu du compte, dans l'une de quatre sources (Box / RTA / Défenses siège /
Offenses siège), et retire SES runes **actuellement équipées** du pool
considéré — utile pour un build qu'on ne veut pas défaire, sans dépendre du
périmètre choisi pour « Exclure les runes déjà utilisées ». Se **superpose**
à ce dernier, ne le remplace pas : les deux exclusions s'additionnent.
⚠️ **Icône** : même pictogramme que « Monstre & équipement » (le monstre),
barré du symbole « interdit » — même traitement que l'icône « Exclusion de
runes » elle-même, cette action-ci RETIRE un monstre précis du pool.

Ordre relatif à « Exclure les runes déjà utilisées » : **au-dessus** dans le
panneau « Options » au doigt (c'est le réglage le plus utilisé sur cet
écran) ; à **droite**, côte à côte, au bureau (voir la carte ci-dessus).

⚠️ **Les quatre onglets de source restent sur UNE seule ligne au doigt**,
texte/rembourrage réduits (`Segmented.tsx`, prop `dense`) — à 4 options
aussi longues que « Défenses siège », même resserré, le libellé passe sur
DEUX lignes DANS le bouton plutôt que déborder (`dense` ne force pas
`whitespace-nowrap`, contrairement aux autres tailles). Au bureau, rendu
normal, une ligne, texte sur une ligne.

⚠️ **L'équipe complète d'un résultat de siège reste visible sans défiler**
(`c.teamContext`, résultats de recherche par nom) : les coéquipiers passent
à la ligne (`flex-wrap`) plutôt que de glisser horizontalement — un
glissement horizontal DANS un panneau déjà scrollable verticalement
concurrence le geste de défilement de la page, quasi inutilisable au
doigt.

⚠️ Chaque sélection porte sur une **entrée précise**, pas un monstre en
général — un même monstre peut avoir un runage différent en box, en RTA et
dans un deck de siège ; exclure « Camilla (RTA) » n'exclut QUE son runage
RTA. Plusieurs sélections restent possibles à la fois (une liste, pas un
choix unique).

En Siège défense/offense, un même monstre peut apparaître dans plusieurs
équipes — indiscernables par le seul nom/portrait (même espèce = même
portrait). Chaque résultat de recherche affiche donc le **numéro d'équipe et
les portraits des 3 coéquipiers** (slot vide = tiret), à la même échelle que
l'écran Siège, pour lever l'ambiguïté sans avoir à cliquer.

Fait partie des réglages exportés/importés dans une recette : ce qui est
exporté, ce sont des **identifiants** (quel monstre, quelle source), jamais
les runes elles-mêmes — re-résolus contre le compte de qui importe la
recette au moment de la recherche. Un identifiant introuvable (monstre
absent chez l'importeur, deck remanié depuis…) est silencieusement ignoré,
jamais une erreur — même tolérance que pour le monstre recherché lui-même.

⚠️ **Réinitialisée sur un compte réellement DIFFÉRENT, pas sur une simple
nouvelle version réimportée du même compte.** Les sélections référencent des
monstres/runes par identifiant — valides pour un réexport du même joueur
(mêmes identifiants), mais sans plus aucun sens pour un compte différent.
Distingué par l'identité STABLE du compte (`wizard_id`), pas la date
d'export (qui change à chaque réexport) : réimporter son propre compte,
même après des heures de jeu, garde les sélections ; importer le fichier
d'un autre joueur les efface.

### Runes imposées — verrouiller un emplacement sur une rune précise

**Regroupée dans la même carte** que les deux exclusions ci-dessus — même
thème (agir sur le pool de runes à partir de l'exemplaire recherché),
mécanisme distinct : ce n'est pas une exclusion mais un **verrou**. Une
pastille par emplacement (1 à 6) portant une rune sur l'exemplaire de
« Monstre & équipement » ; cliquer verrouille ce slot sur **exactement
cette rune** — son pool tombe à 1, les cinq autres emplacements restent
optimisés normalement. Cas d'usage : « je garde cette rune, cherche les
cinq autres autour » — d'où un choix limité aux runes que l'exemplaire
**porte déjà**, plutôt qu'un second sélecteur parmi des milliers de runes.
Un emplacement sans rune est montré grisé plutôt qu'absent.

⚠️ **Techniquement une RÉDUCTION DE POOL, pas une contrainte de plus** : le
verrou s'applique tout en amont (avant dominance/faisabilité/pré-filtrage).
Le moteur ne connaît pas la notion de verrou — il travaille sur un pool où
ce slot ne contient plus qu'une rune, ce qui rend la fonctionnalité **sûre
par construction** (elle ne peut pas provoquer de faux rejet, elle ne
retire que des candidats explicitement écartés par l'utilisateur).

⚠️ **Un `runeId` est propre à un compte.** Une recette importée d'un autre
joueur porte des runes imposées inconnues ici : elles sont **ignorées à
l'import**, avec le nombre signalé dans le message — les garder viderait le
pool du slot (zéro résultat) sans rien expliquer. En ligne de commande, le
script **avertit** au lieu de purger : il est censé rejouer la recette
telle quelle.

## Interruption — filet de temps, pré-filtrage et arrêt manuel

Trois façons dont une recherche s'arrête **avant** d'avoir tout exploré, en
plus du plafond de candidats collectés :

- **Filet de temps** — 10 minutes par défaut, pas un réglage direct : une
  garde-fou en cas de recherche anormalement longue. Le vrai moyen de
  reprendre la main **avant** reste le bouton « Arrêter ». Peut être retiré
  via « Rechercher jusqu'à épuisement complet » (Réglages avancés, décoché
  par défaut) — la recherche continue alors jusqu'à épuisement des
  combinaisons à examiner (ou du plafond de candidats collectés, voir
  ci-dessous), sans limite de temps automatique.
- **Pré-filtrage par emplacement** — les presets « Réglages avancés »
  ci-dessus, calibrés par mesure sur des comptes réels : plus le preset est
  large, plus le pool considéré par emplacement grandit, et plus la
  recherche peut prendre de temps (jusqu'à plusieurs dizaines de secondes au
  preset le plus large sur un très gros compte).
- **Bouton « Arrêter »** — l'utilisateur reprend la main quand il l'estime
  suffisant. L'arrêt est **coopératif** : le moteur rend la main
  régulièrement pendant la recherche et renvoie le **meilleur trouvé
  jusque-là** plutôt que de tout jeter.

Les cas de troncature se distinguent dans le message affiché : un arrêt
manuel dit « voici le meilleur trouvé jusque-là » (un choix assumé), un
plafond atteint dit « resserre tes critères » (une limite subie).

### Barre de progression

Poste des messages de progression **entre** les points de passage internes,
avec le nombre de combinaisons déjà examinées et déjà trouvées. ⚠️
**Approximatif par construction** : le moteur ne consomme pas ses budgets
internes à un rythme constant d'une recherche à l'autre, donc la barre peut
accélérer ou ralentir en cours de route plutôt que progresser régulièrement.

## Algorithme (résumé fonctionnel)

Calcul pur dans [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), exécuté dans
un **Web Worker** (premier de l'app) pour ne jamais geler l'interface.
Lancer une **nouvelle** recherche termine sèchement celle en cours ; arrêter
la recherche **en cours** pour en garder le résultat passe par un canal
différent, coopératif (voir « Interruption »).

- **Jamais de brute-force.** *Meet-in-the-middle* : les 6 emplacements sont
  scindés en **deux moitiés de 3**, chacune énumérée depuis le pool déjà
  pré-filtré, puis regroupées par le **compte exact** de pièces de chaque
  set demandé qu'elles apportent (+ jokers Intangible) : deux moitiés dont
  les comptes s'additionnent pour satisfaire le combo peuvent être appariées
  **sans jamais énumérer le produit complet** des runes individuelles. Un
  choix mesuré et confirmé sur des comptes réels — voir « Vérification ».
- **Statistique principale imposée (slots 2/4/6)** : appliquée avant tout le
  reste, dans la construction même du pool par slot.
- **Élagages SÛRS, ensuite — jamais un faux rejet**, avant même le
  pré-filtrage heuristique qui suit :
  - **Dominance** : une rune strictement moins bonne qu'une autre du MÊME
    slot (sur toutes les stats suivies, avantage strict quelque part) ne
    sert jamais à rien. Comparaison limitée aux runes de même set (ou toutes
    deux hors du combo demandé). ⚠️ Sur une stat PLAFONNÉE (un maximum est
    demandé dessus), le sens s'inverse — seule l'égalité stricte y est sûre
    à comparer.
  - **Faisabilité** : une rune ne peut jamais entrer dans un build valide si,
    même avec le meilleur trouvé dans le pool réellement possédé de chacun
    des 5 autres emplacements, un minimum demandé reste hors de portée — ou
    si elle dépasse déjà, à elle seule, un maximum demandé.
  - **Faisabilité de SET, précoce** (pendant la génération d'une moitié, pas
    seulement à l'appariement) : pour chaque set demandé, si même le
    meilleur cas ne peut plus atteindre le compte requis, la branche est
    coupée avant même de choisir le 3ᵉ slot.
- **Pré-filtrage heuristique par emplacement**, ensuite : chaque slot ne
  garde qu'un nombre borné de runes candidates, en fonction du preset choisi
  — celles du (ou des) set(s) recherché(s), les meilleures toutes
  provenances vis-à-vis des minimums demandés, une tranche garantie de runes
  hors du set demandé, et le meilleur du slot sur chacune des 8 stats
  individuellement (pour que le tri après coup reste honnête sur un critère
  non contraint). Les stats propres à l'objectif choisi reçoivent un budget
  de rétention plus large. ⚠️ **Heuristique** malgré tout : au-delà de ce
  pré-filtrage, le résultat est « le meilleur trouvé parmi le pool retenu »,
  pas une preuve d'optimalité globale sur l'inventaire entier.
- **Compartiments construits EN FLUX, bornés en mémoire** : chaque
  combinaison d'une moitié est évaluée puis, selon son mérite, retenue ou
  immédiatement jetée — jamais de tableau intermédiaire qui grandirait au
  cube du pré-filtrage. La rétention se fait sur **plusieurs critères en
  parallèle** (pas un seul score agrégé), pour qu'un build spécialisé sur une
  stat donnée ne perde pas sa place face à des builds plus généralistes.
- **Compartiments triés par potentiel décroissant** avant l'appariement : les
  paires les plus prometteuses sont explorées EN PREMIER, ce qui compte dès
  que le budget de recherche interrompt la recherche avant d'avoir tout
  exploré.
- **Groupage par compte de pièces sûr, jamais approximatif dans le sens
  dangereux** : le regroupement ne connaît que des comptes agrégés, ce qui
  reste volontairement plus optimiste que la réalité mais seulement dans le
  sens qui ne casse rien — chaque candidat qu'il laisse passer est ensuite
  **revérifié sur les runes réelles** avant d'être retenu.
- **Au plus 1 rune Intangible par proposition** : le jeu n'autorise à en
  sertir qu'une seule par monstre (voir
  [compte/calcul-runes.md §5.2](../compte/calcul-runes.md)).
- **Élagage de faisabilité MIN et MAX, pas d'optimisation vers un seul
  critère** : la recherche collecte un ensemble large mais borné de
  combinaisons valides, pour permettre le tri après coup sur n'importe quel
  critère sans recalcul.
- **Budget de recherche adaptatif** : le moteur ajuste automatiquement le
  travail qu'il s'autorise en fonction du nombre de contraintes posées à la
  fois, plutôt qu'un plafond fixe deviné à l'avance — évite à la fois de
  gaspiller du temps sur une recherche lâche et de sous-budgétiser une
  recherche à beaucoup de conditions simultanées.
- **Artéfacts et relique restent fixes** (ceux actuellement équipés ou
  hypothéqués à l'étape 6) : l'outil optimise **uniquement les 6 runes**.
- Toutes les valeurs sont recalculées avec [stats.ts](src/lib/stats.ts)
  (`computeStats`), la même fonction que partout ailleurs dans l'app.
- **Écrit comme un générateur**, pas une seule boucle qui tourne jusqu'au
  bout : il rend la main régulièrement pour rester interruptible et pour
  poster sa progression sans jamais geler l'interface. La construction des
  deux moitiés tourne en **vrai parallèle** (deux Web Workers dédiés).
- **L'appariement peut lui aussi se paralléliser sur plusieurs Web Workers**,
  au-delà d'une taille de recherche donnée — en recherche normale (le filet
  de temps par défaut) comme en mode « Rechercher jusqu'à épuisement
  complet ». Invisible à l'écran : mêmes garanties (aucun résultat valide
  perdu, vérifié par différentiel), potentiellement plus rapide sur une
  grosse recherche.

### Vérification

Discipline imposée par
[.claude/skills/algo-verify/SKILL.md](../../.claude/skills/algo-verify/SKILL.md) :
[tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts)
compare le moteur à une référence **naïve et exhaustive** sur des jeux de
runes aléatoires mais déterministes — même verdict de faisabilité, aucun
faux positif, même optimum exact sur les scénarios non tronqués.
[tests/rune-optim.test.ts](tests/rune-optim.test.ts) couvre en plus, à la
main, la statistique principale imposée, les conditions maximum, et les cas
limites de chaque élagage. Un test de régression à échelle réelle
([tests/rune-optim-scale-monotonicity.test.ts](tests/rune-optim-scale-monotonicity.test.ts))
couvre en plus des pools de taille proche des comptes réels, pas seulement
les petits jeux du test différentiel.
[tests/rune-optim-parallel-pairing.test.ts](tests/rune-optim-parallel-pairing.test.ts)
vérifie spécifiquement que découper l'appariement sur plusieurs Workers
retrouve EXACTEMENT le même ensemble de candidats que l'appariement
séquentiel, sur des jeux aléatoires balayés à 1/2/3/4 tranches. Le moteur a
par ailleurs été validé
« grandeur nature » : retrouver exactement le runage d'un monstre réel
existant, à partir de ses propres stats comme critères, sur un compte de
plusieurs milliers de runes.

## Limites connues

- **L'objectif de recherche n'affecte QUE le pré-filtrage**, jamais le
  classement pendant la recherche elle-même — voir « Écran », étape 5.
- **Pré-filtrage heuristique par emplacement** : au-delà du budget de
  recherche, le résultat est « le meilleur trouvé », pas une preuve
  d'optimalité globale absolue sur l'inventaire entier. Sur une recherche à
  beaucoup de conditions simultanées (au-delà de 5-6 à la fois), le moteur
  peut manquer un build qui existe réellement — un cas connu et documenté,
  pas retouché depuis.
- Artéfacts et relique du monstre restent fixes ; l'outil ne travaille que
  sur les runes.
- L'exclusion v1 ne connaît que la **box** (6★ équipés) ; RTA, Siège et
  l'exclusion ciblée par monstre/rune sont prévus mais pas construits.
- Le preset de pré-filtrage par emplacement et le filet de temps (« Réglages
  avancés ») sont réglables ; le plafond de candidats collectés et le
  budget de paires restent des paramètres internes du moteur, non exposés
  dans l'UI — **« Rechercher jusqu'à épuisement complet » ne les retire
  pas**. Sur une recherche assez large pour atteindre le plafond de
  candidats collectés avant d'avoir tout exploré, la recherche s'arrête
  quand même — en pratique sans conséquence sur la qualité du résultat, ce
  plafond étant largement au-delà de ce qu'affiche l'écran.
- **L'estimation du nombre de builds** est un ordre de grandeur, pas le
  nombre réellement exploré par le meet-in-the-middle — et la barre de
  progression est elle-même approximative (voir « Interruption »).
- **Le joker (rune Intangible) n'est pas toujours crédité, dans le
  classement de rétention, de la valeur qu'il débloque en complétant un
  set** — un demi-build à joker médiocre en sous-stats brutes mais qui
  complète un set précieux peut ne pas recevoir l'avantage de classement
  qu'il mériterait. Piste connue, pas encore corrigée dans tous les cas.
- L'objectif « Dégâts » est une **formule communautaire prédictive**, comme
  celles de la page Mécaniques — pas une simulation de combat réel.
- **« Dégâts réels » l'est aussi** — plus fidèle (vraie formule du sort,
  vrai adversaire), mais toujours prédictif. Restent **hors modèle**, et
  jamais approximés en silence : variance, avantage élémentaire et glancing,
  lignes de dégâts d'artéfact, réductions autres que la marque, mécaniques
  propres à certains monstres. Environ **200 sorts du corpus** (sur ~6 000)
  ont une formule hors modèle et sont refusés explicitement plutôt que
  calculés de travers — détail dans [degats-reels.md](degats-reels.md).
