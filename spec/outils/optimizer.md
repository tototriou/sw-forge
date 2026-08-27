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
saisie de l'écran, remontée dans App.tsx, JAMAIS écrite sur disque) ·
[useOptimizerLists.ts](src/hooks/useOptimizerLists.ts) (listes de travail,
membres, builds validés — PERSISTÉ, voir « Listes de travail et réservation
de runes ») ·
[OptimizerListPicker.tsx](src/components/outils/OptimizerListPicker.tsx) ·
[MonsterSourcePicker.tsx](src/components/outils/MonsterSourcePicker.tsx)
(mode `bestiary` pour « Monstre à optimiser », mode `account` ailleurs) ·
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
parmi d'autres) ; 3) composer les **Critères de recherche**, en DEUX
colonnes internes à la carte (demande explicite) : à **gauche**, Set de
runes recherché puis Statistique principale imposée (slots 2/4/6) — les
deux contraintes qui portent sur les runes elles-mêmes ; à **droite**,
Artéfacts puis Conditions ; puis, optionnellement et en dernier,
**Exclusion de runes** (Runes imposées y compris, voir plus bas) et
**Réglages avancés**.

Depuis `xl`, **une seule grille** (deux colonnes, cinq rangées) porte tout
l'écran de réglages, en placement EXPLICITE (`col-start`/`row-start`/
`row-span` sur chaque bloc, indépendant de l'ordre du DOM — qui reste
l'ordre d'usage 1-2-3 ci-dessus) :

1. **Rangée 1, pleine largeur (`xl:col-span-2`) : Monstre & équipement.**
   Recherche à **gauche**, fiche d'équipement (stats, artéfacts, roue,
   relique) à **droite**, **côte à côte sur la même ligne** — la carte a
   besoin des DEUX colonnes de la page pour tenir sans repasser à la ligne
   (gabarit ≈ recherche 224 + stats 200 + artéfacts 58 + roue 208 + relique
   ≈ 800 px). Sa grille interne (`lg:grid-cols-[1.35fr_1fr]`) reprend le
   MÊME ratio que la grille principale de la page, pour que la séparation
   entre « Monstre à optimiser » et la fiche d'équipement s'aligne
   visuellement avec celle des deux colonnes principales, une rangée plus
   bas. ⚠️ **Artéfacts, roue et relique forment un groupe INSÉCABLE** : la
   roue se lit collée à la droite des emplacements d'artéfacts, la relique
   juste après — séparés, ils passaient à la ligne dans une colonne
   étroite. Un **sélecteur de source** (Box / RTA / Défenses siège /
   Offenses siège, même contrôle qu'« Exclure les runes d'un monstre » plus
   bas) apparaît entre le libellé « Monstre à optimiser » et son champ de
   recherche — mais **désambiguïse un EXEMPLAIRE, pas un premier choix
   obligatoire** : voir « Écran », étape 1, la recherche résout d'abord une
   ESPÈCE dans tout le bestiaire. ⚠️ **La fiche reste TOUJOURS affichée**,
   vide (stats à zéro, artéfacts grisés, roue vide) tant qu'aucun monstre
   n'est choisi, plutôt que de n'apparaître qu'au clic — l'espace qu'elle
   occupe est réservé d'avance (voir [shared/design.md](shared/design.md),
   « un clic ne déplace jamais ce qu'on vient de cliquer »). Juste en
   dessous des puces de source : **zone C**, « Monstres de la liste » — voir
   « Listes de travail et réservation de runes ».
2. **Rangée 2 : Critères de recherche (colonne 1, `row-span-3` — occupe
   aussi les rangées 3 et 4), à côté d'Objectif de recherche (colonne 2).**
   « Objectif de recherche » à la **droite** de « Critères de recherche »
   (demande explicite : l'objectif se choisit avant même de composer le
   set, ce n'est pas un critère de plus). Le contenu de « Critères de
   recherche », en **DEUX colonnes internes** (demande explicite) : à
   **gauche**, **Set de runes recherché** puis **Statistique principale
   imposée** (les deux contraintes qui portent sur les runes elles-mêmes) ;
   à **droite**, **Artéfacts** puis **Conditions**. `items-start` : la
   colonne la plus courte ne s'étire pas à la hauteur de l'autre ; sous
   `lg`, retour à l'empilement (ordre du DOM inchangé : Set, Statistique
   principale, Artéfacts, Conditions). ⚠️ **Traits de séparation** (demande
   explicite, capture d'écran à l'appui) : un **trait vertical** entre les
   deux colonnes (`lg:border-r`, posé sur la colonne de gauche uniquement —
   jamais deux traits à 1 px l'un de l'autre, voir
   [shared/design.md](shared/design.md)), UNIQUEMENT à partir de `lg` ; un
   **trait horizontal** dans chaque colonne, entre Set de runes recherché
   et Statistique principale imposée, et entre Artéfacts et Conditions —
   quel que soit le format, y compris au doigt.
   ⚠️ **Densité** : le **set de runes recherché** (`max-w-md`) et la
   **grille Conditions** (`w-fit` propre) restent plafonnés en largeur —
   sans quoi Min et Max de la grille Conditions s'étireraient à des
   dizaines de pixels l'un de l'autre (colonnes `auto` qui se partagent
   l'espace libre restant dès qu'aucune piste n'est en `fr`). Le **set
   principal** (4 pièces) s'affiche sur **deux lignes de trois** en
   permanence (comme au doigt), pour laisser plus de largeur au set
   secondaire.
3. **Rangée 3, colonne 2 : Exclusion de runes** (carte à bordure
   accentuée, fonctionnalité vedette — regroupe aussi **Runes imposées**,
   voir plus bas).
4. **Rangée 4, colonne 2 : Réglages avancés** — SOUS Exclusion de runes,
   pas au-dessus (ordre inversé sur demande explicite après une première
   disposition).
5. **Rangée 5, pleine largeur : ligne d'estimation** — ni dans la colonne
   1 ni dans la colonne 2, cette ligne n'a pas sa place dans une cellule
   précise.

⚠️ **« Réglages avancés » ne pousse plus jamais rien en se dépliant** —
demande explicite (« la partie critères de recherche ne doit pas se
déplacer vers le bas lorsqu'on déroule réglages avancés »), et « reste
toujours sous Exclusion de runes » (donc sans déplacer LE BLOC lui-même,
contrairement à une tentative précédente qui l'avait isolé en dernière
rangée pour contourner le même symptôme). Son contenu déplié n'est plus un
bloc **inline** qui grandissait la carte (donc toute la colonne 2, qui
partage ses pistes de rangée avec la colonne 1) — c'est un
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
1. **Recherche bestiaire, puis puces d'exemplaire** — la recherche
   « Monstre à optimiser » résout d'abord une **ESPÈCE** (nom, icône, stats
   de base 6★ niveau max, sorts) dans **TOUT le bestiaire**, possédé ou
   non — pas seulement les monstres du compte (`MonsterSourcePicker
   mode="bestiary"`, même filtre `formesJouables` que les autres pickers de
   l'app). Un **sélecteur de source** (Box, par défaut / RTA / Défenses
   siège / Offenses siège, `Segmented size="lg"` — même contrôle qu'« Exclure
   les runes d'un monstre » plus bas) apparaît entre le libellé et le champ
   de recherche, mais ne filtre plus la recherche elle-même : il choisit
   dans QUELLE source résoudre l'**exemplaire**, une fois l'espèce trouvée.
   ⚠️ **Mode compact déclenché par la largeur RÉELLE de sa colonne, pas par
   celle de la fenêtre** — `Segmented` mesure lui-même la place qu'il reçoit
   et se resserre tout seul (voir
   [shared/librairie-ui.md](../shared/librairie-ui.md)), comportement commun
   à TOUS les sélecteurs de l'app. **Une puce grisée** signale que l'espèce
   choisie n'a aucun exemplaire dans cette source.
   ⚠️ **Choisir une espèce résout automatiquement le PREMIER exemplaire
   Box** dès qu'il y en a au moins un (demande explicite : éviter de rouvrir
   la désambiguïsation pour tout monstre possédé en double) — la fiche
   d'équipement affiche directement ce build, prête à optimiser sans clic
   de plus. Aucun exemplaire Box : repli sur les stats de base 6★ seules
   (monstre non possédé, ou possédé sans jamais avoir été équipé).
   **Cliquer une puce** (`pickSource`) résout l'unique candidat de cette
   source s'il n'y en a qu'un, sinon ouvre la **zone D** — un panneau
   flottant (bureau) / bloc en ligne (mobile) listant chaque candidat
   (`ExclusionCandidateRow` : portrait, nom, icônes des sets actifs, compte
   de runes, et pour le siège le numéro d'équipe + coéquipiers) — jamais de
   résolution automatique dès qu'il y a un choix réel à cet endroit
   (contrairement à la recherche bestiaire, un clic de puce est un geste de
   désambiguïsation volontaire). **Un exemplaire NU (sans aucune rune) reste
   sélectionnable, dans TOUTE source** — Box (construire un build depuis
   rien) comme RTA/siège (un monstre assigné à un favori RTA ou un deck de
   siège mais jamais runé, ex. juste obtenu et pas encore équipé) : seul un
   **slot RÉELLEMENT vide** (aucun monstre assigné) est absent des
   candidats, pas un monstre présent sans rune.
   **Choisir un résultat fixe l'exemplaire RÉELLEMENT optimisé** — pas
   seulement prévisualisé. **Changer d'ESPÈCE** réinitialise « Critères de
   recherche » et les résultats affichés (set, statistique principale
   imposée, objectif, artéfacts, conditions min/max, tri, pagination) — des
   critères posés pour l'ancien monstre n'ont pas de raison de valoir pour
   le nouveau. Re-choisir le même exemplaire, ou un AUTRE exemplaire de la
   MÊME espèce, n'efface rien (seuls les critères propres à l'équipement
   changent, pas ceux propres à l'espèce). Les **réglages avancés**
   (préfiltrage, exclusions, recherche exhaustive…) ne sont jamais
   concernés : préférences générales, pas critères propres à un monstre.
   **Importer un nouveau compte** déclenche la réinitialisation complète,
   pour la même raison (autre box, autre pool de runes possible) — même en
   étant sur un autre onglet au moment de l'import.
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
   plutôt que simplement absent. ⚠️ **Relique : emplacement TOUJOURS affiché
   de la même façon**, même absente — grisé plutôt que simplement absent
   (demande explicite), comportement partagé avec RTA et Siège. ⚠️ **L'encadré de stats bascule base+bonus
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
       motif** — jamais absent sans explication. ⚠️ **Coups variables** (« 2
       à 3 fois », Sia — Great Friends ; « 3 à 5 fois », Okeanos S3) : un
       champ numérique borné apparaît sous le sort choisi (ou sous le passif
       concerné) pour choisir la valeur réellement utilisée par le calcul —
       `Competence.coups` ne porte qu'un seul nombre en donnée, pas fiable
       pour ces sorts-là. Détail : [degats-reels.md](degats-reels.md),
       « Coups variables ». Un champ **Attaques reçues avant ce sort**
       (0 par défaut) n'apparaît que pour l'unique sort connu dont le
       coefficient dépend d'un compteur de combat (Crawler/Frankenstein —
       « Hammer Punch »). Détail : [degats-reels.md](degats-reels.md),
       « formule bespoke selon un compteur ».
     - **Passifs offensifs** — n'apparaît que si le monstre en a un
       (Feng Yan, Sia, Roid, Dominic, Ciri, Sonia, Momo, Chun-Li, Lizardman,
       Jin Kazama…) : des dégâts **en plus** du sort choisi ci-dessus, OU un
       modificateur sur l'ensemble de ses dégâts, via un passif reconnu
       (liste à la main, voir [degats-reels.md](degats-reels.md)). Un passif
       **toujours actif** (le texte du jeu ne pose aucune condition)
       apparaît en jeton simple, sans bouton — y compris un modificateur
       sans formule propre (crit garanti si plus rapide, bonus continu
       selon l'écart de VIT, Taux Crit selon la VIT, bonus flat de Taux
       Crit/Dgts Crit). Un passif **bonus** ou **conditionnel**, ou un
       modificateur sans formule propre soumis à une condition que l'app ne
       peut pas déduire (PV propres, état d'un allié, tour précédent…),
       apparaît en **interrupteur** (glissière, comme « Stats de base
       exclues »), **désactivé par défaut** — signalé par l'utilisateur :
       une pilule cliquable (`Pastille`) ne distinguait pas assez la CIBLE
       du clic (l'icône + le libellé) du paragraphe de condition juste en
       dessous, purement informatif. Un passif dont le bonus S'ACCUMULE en
       combat sans que l'app ne puisse le savoir (Momo) apparaît avec un
       **champ numérique** (0 % par défaut) plutôt qu'un interrupteur.
       ⚠️ **Jamais déduit d'un autre
       réglage de l'écran** (le passif d'un monstre peut dépendre de l'état
       posé par son **propre** sort, avant même que ce sort ne soit lancé :
       aucun réglage existant ne peut trancher ça à sa place) — la condition
       et le texte du jeu (`Competence.description`) sont affichés **en
       clair sous chaque passif**, pas seulement au survol, pour que le
       joueur juge lui-même.
     - **Adversaire** — PV et DEF. ⚠️ Les **PV ne classent rien** : ils ne
       servent qu'à lire le résultat (« 42 % des PV », « tue la cible »).
       Un champ **PV restants** n'apparaît que pour les sorts dont la
       formule lit les PV courants de la cible. Un champ **Effets sur la
       cible** (0 par défaut) n'apparaît que pour les rares sorts dont les
       dégâts augmentent par effet présent sur l'adversaire (Julie, Melissa)
       — l'app ne simule aucun effet réel sur la cible. Détail :
       [degats-reels.md](degats-reels.md), « bonus selon les effets sur la
       CIBLE ». ⚠️ **VIT adversaire** +
       **leader skill VIT** : apparaissent pour un sort/passif qui dépend de
       l'écart de vitesse (`{Relative SPD}`, ignore-DEF proportionnel à
       l'écart, un monstre qui force le critique s'il est plus rapide, ou
       majore tous ses dégâts selon cet écart — même quand le sort CHOISI ne
       lit pas cette variable, ex. n'importe quel sort de Sonia) ; un
       artéfact « Effet aug. VIT » équipé et un éventuel critique/bonus de
       dégâts garanti sont, eux, **déduits et affichés**, jamais redemandés.
       Détail : [degats-reels.md](degats-reels.md), « VIT de l'adversaire ».
     - **Effets actifs** — buffs du monstre (ATQ +50 %, DEF +70 %, VIT
       +30 %) et effets subis par la cible (réduction de défense ×0,3,
       marque +25 %, « ce sort pose le def break » — distingue « attaque une
       cible déjà réduite » de « réduit puis frappe », les deux mitigations
       ne sont pas identiques), chacun son **icône de jeu cliquable**, pas
       une case à cocher séparée. ⚠️ **Grisée au repos, en couleurs + coche
       une fois
       activée** — l'état se lit sur l'icône elle-même, sans avoir à cliquer
       pour comprendre la légende (au repos, tout est grisé : rien n'est
       encore choisi). **Six effets d'ÉQUIPE** (Euldong, Mirinae, Deborah,
       Miriam, Dr. Matteo, Velaska — un AUTRE monstre que celui optimisé),
       même contrôle mais **portrait du monstre** en icône plutôt qu'une
       icône de buff générique. ⚠️ Velaska porte en plus un **champ
       numérique** (% de PV perdus, 0 par défaut) qui n'apparaît que si son
       effet est activé. Détail des mécaniques :
       [degats-reels.md](degats-reels.md), « Effets d'équipe ». **Leader
       skill d'équipe** — type (PV/ATQ/DEF/VIT/Taux Crit/Dégâts Crit, icône
       officielle du jeu réutilisée depuis le Siège) puis valeur (paliers
       réels du jeu ou saisie libre) ; remplace l'ancien champ VIT-only.
       Détail : [degats-reels.md](degats-reels.md), « Leader skill
       d'équipe ».
     - **Compétences d'invocateur** — **Aucune** / **Combat** (défaut) /
       **Combat + Guilde**. Remplacent les anciens totems et drapeaux,
       toujours supposées maxées. ⚠️ **Un choix unique, pas deux cases** :
       l'onglet Guilde ne s'applique qu'en contenu de guilde, où Combat
       compte aussi — « Guilde » implique donc toujours « Combat ». La
       compétence « Puis. d'att. de <élément> » suit l'élément du monstre,
       sans rien demander. Détail des valeurs :
       [degats-reels.md](degats-reels.md).
     - **Coup critique** — Critique (défaut, le plafond d'un coup isolé) /
       Non critique (le plancher) / Moyenne (espérance sur le Taux Crit
       réellement atteint — le seul mode où le Taux Crit pèse sur le
       classement), rangée volontairement tout à droite. ⚠️ Sous
       **Moyenne** uniquement, un avertissement rappelle que la valeur
       affichée est une ESPÉRANCE théorique, pas ce qu'un combat réel (tour
       par tour) produit coup après coup — absent des deux autres modes,
       qui sont déjà des bornes littérales.
     ⚠️ **On n'affiche que ce que le sort CONSOMME** : un sort qui ignore la
     défense ne montre ni la DEF ennemie ni la réduction de défense ; un
     sort qui ne dépend pas de la VIT ne montre pas le buff de vitesse. Un
     champ visible mais sans effet est pire qu'un champ absent — il fait
     croire à une action.
     ⚠️ Contrairement aux trois autres objectifs, ses stats pertinentes
     **dépendent du sort** (`{ATK}`, `{ATK}×({SPD}+70)/30`, `0.2×{MAX HP}`…)
     et ne tiennent donc pas dans une table statique : l'écran les calcule
     (`damageRelevantStats`) et les transmet au moteur via
     `SearchParams.objectiveStats`. Le moteur, lui, reste générique — il
     reçoit « ces stats comptent plus », jamais la notion de sort.
     ⚠️ **Aucun sort calculable** (monstre perso, fiche absente, formules
     hors modèle) : l'option « Dégâts réels » **disparaît purement et
     simplement** du bouton à choix unique (`OBJECTIVE_LABELS` filtré sur
     `realDamage`, résolu) — jamais proposée puis désactivée, ni de repli
     silencieux vers un autre objectif ; il reste Efficience/PV
     effectifs/Vitesse.
   ⚠️ **« Speed nuker » a été retiré** (remplacé par « Dégâts réels »), et
   **« Dégâts » (formule générique `ATQ × (1 + TC × DC)`, sans sort ni
   adversaire) l'a été à son tour** une fois « Dégâts réels » mature —
   approximation devenue strictement inférieure du même besoin, un choix
   supplémentaire qui faisait juste hésiter entre les deux pour un objectif
   offensif. « Dégâts réels » répond mieux à ce besoin quand le sort
   utilisé dépend effectivement de VIT (ex. Lagmaron, `ATQ × (VIT + 70) /
   30`) : la vraie formule, VIT comprise, sert alors au tri — pas seulement
   au pré-filtrage. Une recette exportée pendant la durée de vie de l'un ou
   l'autre objectif porte encore sa valeur retirée — traduite à l'import
   vers « Efficience » (jamais « Dégâts réels », qui exige un sort et un
   adversaire résolus, hors de portée d'un simple import).
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
   on montre OÙ agir. Repasse normale dès qu'un set est ajouté. **Colonne
   GAUCHE** de la carte (demande explicite), avec le point suivant.
5. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), une
   rangée de puces à cocher :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision
   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6. **Colonne
   GAUCHE**, sous Set de runes recherché (demande explicite : les deux
   contraintes qui portent sur les runes elles-mêmes, groupées ensemble). Ce
   filtre s'applique **avant** tout le reste, dans la construction même du
   pool par slot — il réduit donc le nombre de candidats réellement
   considérés dès le départ.
6. **Artéfacts** — interrupteur **« Ignorer les statistiques des
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
   ci-dessous. **Colonne DROITE** de la carte, avec le point suivant.
7. **Conditions** — les 8 stats (PV, ATQ, DEF, VIT, Taux Crit, Dmg Crit, RES,
   Précision). Chaque stat porte **deux champs, minimum et maximum**, tous
   deux facultatifs — champ vide = pas de contrainte. **Colonne DROITE**,
   sous Artéfacts.
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
    d'options — les 8 stats brutes, et les mêmes objectifs qu'à l'étape 3
    (« Dégâts réels » n'y figure que si un sort est réellement calculable
    pour ce monstre).
    ⚠️ **Objectif « Dégâts réels »** : chaque carte affiche en tête le
    **nombre de dégâts** qui a servi à la classer, et la part des PV de la
    cible qu'il emporte (« tue la cible » au-delà de 100 %). Visible dès que
    ce critère ordonne la liste — que ce soit l'objectif de la recherche ou
    un tri choisi après coup.
    ⚠️ **« Valider ce build »**, sur chaque carte — réserve les 6 runes de CE
    résultat (elles n'apparaissent plus dans les recherches suivantes de la
    même liste de travail), jusqu'à libération explicite : voir « Listes de
    travail et réservation de runes ».

⚠️ **Rien n'est appliqué au compte.** L'outil est en lecture seule et
purement indicatif, comme le reste de SW Forge (aucune écriture vers le
jeu) : c'est au joueur de re-runer dans Summoners War.

## Listes de travail et réservation de runes

Un 3ᵉ mécanisme d'exclusion, distinct des deux ci-dessous : ni
l'automatique (« Exclure les runes déjà utilisées ») ni le manuel
(« Exclure les runes d'un monstre ») ne savent exclure les runes d'un build
qui n'existe **pas encore** dans le compte — le résultat d'une recherche.
Résout un vrai problème de rareté : optimiser plusieurs monstres d'affilée
sans que chaque nouvelle recherche re-propose les runes déjà attribuées au
monstre précédent.

⚠️ **Pourquoi des LISTES, et plusieurs à la fois** — le modèle de rareté
réel du jeu ne connaît pas un seul pool global : Box et RTA sont des pools
de runes **totalement séparés** ; chaque **deck d'offense siège** est un
préréglage momentané indépendant des autres (exclusivité seulement ENTRE
les 3 monstres d'un même deck) ; la **défense siège**, elle, est **un seul
pool partagé** entre TOUTES les équipes 1 à 10 (une rune n'y sert qu'à UNE
équipe à la fois, tout runage siège confondu). Un pool de réservation
unique aurait fait fuiter des réservations entre des contextes qui, en
jeu, n'ont RIEN à voir l'un avec l'autre.

- **Aucune liste fixe** — l'utilisateur en crée, renomme et supprime
  librement (`OptimizerListPicker.tsx`, menu déroulant : crayon de
  renommage, corbeille de suppression par ligne, « + Nouvelle liste » en
  bas). Supprimer une liste efface son appartenance et ses runes
  validées — **jamais les runes elles-mêmes**, toujours réelles dans le
  compte. Navigable à tout moment ; changer de liste active change
  instantanément les runes réservées vues par la recherche.
- **« Valider ce build »**, sur chaque carte de résultat — réserve les 6
  runes de CE résultat dans la liste active : elles n'apparaissent plus
  dans les recherches suivantes de la MÊME liste (les autres listes n'en
  savent rien), jusqu'à libération explicite. Valider un NOUVEAU build
  pour un monstre déjà validé **remplace** l'ancien (les runes de l'ancien
  se libèrent automatiquement). ⚠️ **Jamais de perte silencieuse** :
  libérer un build déjà validé demande toujours confirmation (« Ces 6 runes
  redeviendront disponibles pour les recherches des autres monstres de
  cette liste »).
- **Zone C, « Monstres de la liste »** — juste sous les puces de source
  dans « Monstre & équipement » : chaque monstre de la liste active, son
  statut (« Validé » + bouton libérer, ou « pas encore validé »), cliquable
  pour rappeler son exemplaire dans la recherche. **Corbeille** à droite de
  chaque ligne pour retirer un monstre de la liste — sans confirmation s'il
  n'est pas encore validé (rien à perdre), avec confirmation s'il l'est (le
  retrait libère aussi ses runes). Bouton **« Ajouter à la liste »**, dont
  le libellé change selon le contexte (aucun monstre choisi → désactivé ;
  déjà dans la liste active → désactivé ; sinon → « Ajouter <monstre> à
  « <liste> » », suffixé « (non possédé) » pour une espèce sans exemplaire
  réel, voir plus bas). Sans liste active, l'ajout crée une liste (prompt
  du nom) ET y ajoute le monstre dans le même geste. Bouton **« Libérer
  toutes les runes de cette liste »** (visible dès qu'au moins un build y
  est validé), avec sa propre confirmation dédiée.
- ⚠️ **Ajouter un monstre qu'on ne possède PAS** — demande explicite : « le
  joueur a obtenu le monstre et veut essayer des runages de teams sans
  avoir mis à jour son json ». Une ESPÈCE choisie via la recherche
  bestiaire (voir « Écran », étape 1) mais absente des 4 sources du compte
  reste ajoutable à une liste ET « validable » exactement comme un
  exemplaire réel — un sélecteur `unowned` (`ExclusionSelector`, distinct
  des 4 sources réelles) porte cette entrée, sur ses stats de base 6★
  niveau max, sans rune ni artéfact. ⚠️ **Les runes trouvées par la
  recherche restent de VRAIES runes du compte** : « Valider ce build »
  fonctionne à l'identique, réservant réellement ces 6 runes pour les
  autres monstres de la MÊME liste — c'est justement ce qui permet
  d'essayer un runage d'ÉQUIPE (plusieurs monstres, certains possédés,
  certains non) sans qu'un même jeu de runes soit proposé deux fois. Ne
  s'affiche QUE quand l'espèce n'a d'exemplaire dans AUCUNE des 4 sources
  — possédée ne serait-ce que quelque part (même ambiguë), la
  désambiguïsation normale (zone D / puces) garde toujours la main, jamais
  masquée par ce sélecteur. Aucune puce ne s'allume pour ce cas (comme un
  build validé, voir plus haut). ⚠️ Revérification au réimport (comme tout
  le reste de cette section) : un build validé sur un monstre non possédé
  reste valable tant que ses runes existent encore QUELQUE PART dans le
  compte réimporté (pas nécessairement encore équipées sur un exemplaire
  précis, puisqu'il n'y en a pas) — vérification plus faible que pour un
  exemplaire réel, limite assumée.
- **Auto-exemption de la liste ACTIVE** — chercher à nouveau le même
  monstre dans la MÊME liste exempte automatiquement SES PROPRES runes déjà
  validées (sans quoi la recherche se trouverait bloquée par ses propres
  runes réservées) ; les runes validées des AUTRES monstres de cette liste
  restent, elles, indisponibles. Aucune des 4 puces Box/RTA/Défenses siège/
  Offenses siège ne s'allume quand la fiche affiche un build VALIDÉ plutôt
  que le runage réellement équipé d'une source réelle — un build validé
  n'est ni du Box ni du RTA tel qu'actuellement équipé, juste une
  réservation. ⚠️ **Signal explicite en plus des puces grisées** (demande
  explicite) : un bandeau dans la fiche elle-même (« Build validé affiché —
  pas l'équipement réellement porté ») s'affiche dans ce cas, pour ne
  jamais laisser croire que ce qui est montré est réellement équipé en jeu.
- **« Valider ce build » sous la fiche**, sans passer par une recherche
  (demande explicite) — un second bouton, identique à celui d'une carte de
  résultat, juste sous la fiche stats/artéfacts/runes/relique : valide
  directement les runes ACTUELLEMENT affichées sur l'exemplaire (un runage
  déjà composé en jeu, ou déjà planifié). Exige exactement 6 runes
  affichées (comme un build trouvé par la recherche) — désactivé sur un
  exemplaire partiellement runé ou nu. Affiche « Validé » (désactivé,
  coche) si c'est déjà EXACTEMENT le build validé de cet exemplaire. Sans
  liste active, ouvre le même prompt de création que « Ajouter à la
  liste » (crée la liste ET valide dans le même geste). ⚠️ **Bloqué si UNE
  SEULE des 6 runes affichées est déjà réservée pour un AUTRE monstre de la
  MÊME liste** (demande explicite) — contrairement à un résultat de
  recherche (dont le pool exclut déjà les runes réservées ailleurs dans la
  liste), les runes affichées ici viennent de l'équipement RÉEL de
  l'exemplaire : rien n'empêche structurellement qu'elles chevauchent une
  réservation posée depuis pour un autre monstre. Message explicite listant
  quelles runes et pour quel monstre (« Déjà réservées dans cette liste :
  emplacement 2 (Camilla) »), pas juste un bouton désactivé sans
  explication.
- **Persisté**, contrairement au reste de la saisie de l'écran (voir plus
  haut, « Survit à un changement d'onglet ») — un flux de plusieurs
  dizaines de minutes à travers toute une liste ne doit pas perdre le
  travail déjà fait à un simple rechargement de page. Même statut que la
  prépa RTA et les équipes de siège (voir
  [usePersistence](src/hooks/usePersistence.ts)) : soumis au même
  interrupteur global de conservation.
- ⚠️ **Limite connue** : l'ajout à une liste se fait **un monstre à la
  fois** — aucun import en masse depuis un deck de siège ou une prépa RTA
  entière, aucun workflow qui enchaîne automatiquement au monstre suivant
  après validation.

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
texte/rembourrage réduits — à 4 options aussi longues que « Défenses
siège », même resserré, le libellé passe sur DEUX lignes DANS le bouton
plutôt que déborder (le cran resserré ne force pas `whitespace-nowrap`,
contrairement aux autres). `Segmented` (`src/ui/`) mesure lui-même la place
qu'il reçoit et bascule seul entre les deux rendus (voir
[shared/librairie-ui.md](../shared/librairie-ui.md)) — aucun réglage à
poser depuis cet écran.

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

⚠️ **Chaque résultat affiche aussi les icônes des sets ACTIFS** de
l'équipement montré, entre le nom et le compte de runes — pas un simple
comptage des sets présents parmi les runes portées : `activeSets`
(`lib/effects.ts`), la SEULE source de vérité de l'app pour « quels sets
sont actifs » (un set 4 pièces à 3 runes n'est pas actif, une rune
Intangible peut compléter le set incomplet le plus proche — recompter à
côté a déjà fait diverger un affichage sur un cas réel, voir
`swiftActive`). Même fonction que celle qui alimente les icônes de set
affichées sur les cartes de « Mon compte » → RTA.

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
  classement pendant la recherche elle-même — voir « Écran », étape 3.
- **Pré-filtrage heuristique par emplacement** : au-delà du budget de
  recherche, le résultat est « le meilleur trouvé », pas une preuve
  d'optimalité globale absolue sur l'inventaire entier. Sur une recherche à
  beaucoup de conditions simultanées (au-delà de 5-6 à la fois), le moteur
  peut manquer un build qui existe réellement — un cas connu et documenté,
  pas retouché depuis.
- Artéfacts et relique du monstre restent fixes ; l'outil ne travaille que
  sur les runes.
- **L'ajout à une liste de travail se fait UN monstre à la fois** (« Ajouter
  à la liste », voir « Listes de travail et réservation de runes ») —
  l'import en masse depuis un deck de siège/une prépa RTA entière n'est pas
  construit, ni un workflow qui enchaîne automatiquement au monstre suivant
  après validation.
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
- **« Dégâts réels » est une formule communautaire prédictive**, comme
  celles de la page Mécaniques — vraie formule du sort, vrai adversaire,
  mais pas une simulation de combat réel. Restent **hors modèle**, et
  jamais approximés en silence : variance, avantage élémentaire et glancing,
  lignes de dégâts d'artéfact, réductions autres que la marque, mécaniques
  propres à certains monstres. Environ **200 sorts du corpus** (sur ~6 000)
  ont une formule hors modèle et sont refusés explicitement plutôt que
  calculés de travers — détail dans [degats-reels.md](degats-reels.md).
