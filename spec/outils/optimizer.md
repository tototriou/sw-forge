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
2. **Rangée 2 : Critères de recherche (colonne 1, `row-span-4` — occupe
   aussi les rangées 3, 4 et 5).** ⚠️ Ce nombre suit la colonne d'EN FACE
   (Artéfacts, État de mon monstre, Exclusion de runes, Réglages avancés),
   il ne décrit pas le contenu de cette carte-ci : toute carte ajoutée ou
   retirée à droite se répercute ici **et** sur la rangée de la ligne
   d'estimation, qui reste toujours la dernière.
   ⚠️ « Objectif de recherche » occupait la
   colonne 2 de cette rangée ; **il a rejoint la carte du bouton
   Rechercher**, en bas. Il était une carte à part parce qu'il portait
   AUSSI la description du combat de « Dégâts réels », qui réclamait de la
   place ; celle-ci sortie en fenêtre, il ne reste qu'un bouton à choix
   unique — et *quoi* chercher se lit mieux juste au-dessus de *chercher*
   qu'au milieu des critères. Le contenu de « Critères de
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
2 ter. **Rangée 2, colonne 2 : Artéfacts** (voir §6) — sous « Exemplaire »,
   le bloc se lisant « ces artéfacts, sur CE build ». **Rangée 3, colonne 2 :
   État de mon monstre** (voir §6 bis).
3. **Rangée 4, colonne 2 : Exclusion de runes** (carte à bordure
   accentuée, fonctionnalité vedette — regroupe aussi **Runes imposées**,
   voir plus bas).
4. **Rangée 5, colonne 2 : Réglages avancés** — SOUS Exclusion de runes,
   pas au-dessus (ordre inversé sur demande explicite après une première
   disposition).
5. **Rangée 6, pleine largeur : ligne d'estimation** — ni dans la colonne
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

⚠️ **« Exclusion de runes » est elle aussi REPLIÉE par défaut** (demande
explicite) et déplie **le même mécanisme** — ancre `ref`, `ZoneCliquable`
avec chevron, `FlottantAuto`, fermeture au clic extérieur. Le patron est
**réutilisé tel quel**, jamais réécrit : deux mécanismes de dépliement
voisins auraient divergé, et celui-là avait déjà dû être corrigé une fois
pour exactement la raison qu'il traite.

⚠️ **Les deux panneaux prennent EXACTEMENT la largeur de la carte qui les
ancre** (`largeurAncre`, demande explicite), et la **suivent** quand l'écran
change de taille. Ils en faisaient à peu près la moitié (340 et 420 px en
dur) : une largeur figée ne peut pas suivre une carte dont la largeur dépend
de la fenêtre.
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
permet** (demande explicite) : le **pré-filtrage** avec ses puces et son
avertissement d'un côté, les **trois interrupteurs** de l'autre.
- ⚠️ `grid-cols-[repeat(auto-fit,minmax(260px,1fr))]` et **non** un point de
  rupture d'écran (`sm:`/`xl:`) : ce qui décide ici est la largeur du
  **panneau**, pas celle de la fenêtre. Le panneau prend la largeur de sa
  carte, qui dépend de la colonne de grille — une même fenêtre peut donc
  donner un panneau large ou étroit. Sous ~520 px, une colonne ; au-delà,
  deux. Ça vaut aussi pour le panneau « Options » au doigt, **sans une seule
  classe conditionnelle**.
- ⚠️ Les séparateurs des interrupteurs passent en **`divide-y` sur leur
  conteneur**, plus en `border-t` individuel : un trait ne se pose alors
  qu'ENTRE deux voisins, jamais au-dessus du premier. Avec des bordures
  individuelles, le premier interrupteur portait un trait en tête de colonne —
  anodin quand tout était empilé sous le pré-filtrage, lu comme une ligne
  perdue une fois le groupe posé à côté.
- Chacune des deux parties porte son **contour**, aux **mêmes classes** que
  les trois groupes d'« État de mon monstre » : deux façons de cadrer un
  groupe dans le même écran se liraient comme deux natures différentes.

⚠️ Son état d'ouverture est **local à l'écran**, pas remonté dans
`useOptimizerState` : c'est de l'ouverture/fermeture, pas un critère de
recherche — rien à exporter dans une recette, rien à remettre à zéro au
changement de monstre. ⚠️ **Au doigt, rien ne se replie** : le panneau
« Options » reste tel quel, l'ouvrir EST déjà le geste « je veux voir les
options ».

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

   ⚠️ **Changer d'espèce ramène l'objectif à « Efficience » et le cran des
   artéfacts à « Dégâts supplémentaires »**, et vide le sort choisi. Un sort
   appartient à un monstre : après un changement, le calcul retomberait
   silencieusement sur le sort par défaut du nouveau. Tant que le réglage de
   combat se dépliait sous l'objectif on voyait le sort revenir au défaut ;
   derrière une fenêtre fermée, ce repli devient invisible et l'on croirait
   calculer sur un sort qu'on a choisi. Remettre les deux sélecteurs au défaut
   rend ce repli **impossible** plutôt que visible — réoptimiser en dégâts
   demande de recliquer « Dégâts réels » et de rechoisir le sort.

   ⚠️ **La description du combat, elle, SURVIT** : défense, PV et élément de
   l'adversaire, buffs, lead ne sont pas propres au monstre, et ce sont les
   plus longs à ressaisir. Recliquer « Dégâts réels » rouvre la fenêtre avec
   le combat déjà décrit. Seuls les deux **sélecteurs** retombent au défaut.
2 bis. **« Meilleurs artéfacts offensifs pour ce build »** — dans la carte
   **Artéfacts**, juste sous les **sous-propriétés verrouillées** : le
   résultat suit immédiatement les réglages qui le produisent, sans qu'un
   autre sujet ne s'intercale. La meilleure paire pour l'équipement
   **affiché**, avec ce
   qu'elle apporte face à celle qui est portée. Optimise les artéfacts
   **seuls**, sans lancer de recherche de runes : le cas visé est un monstre
   runé pour un autre objectif (un tank fait pour survivre) à qui les artéfacts
   ajoutent des dégâts par-dessus.

   ⚠️ **Ce bloc RESPECTE les réglages de la carte, et le DIT** — il ne cherche
   pas dans son coin. La question « quels sont mes meilleurs artéfacts » et la
   question « quelle paire supposer pendant la recherche de runes » partagent
   donc une seule réponse : deux blocs qui se contrediraient à l'écran
   coûteraient plus cher qu'un bloc parfois muet. Concrètement :
   - **un** emplacement sur « Garder l'artéfact équipé » → la proposition
     reste faite, et **deux signaux** disent qu’une moitié est imposée :
     un **bandeau au-dessus de la paire** (« Emplacement attribut figé — il
     est gardé tel que porté, pas optimisé ») et un **marqueur « figé » sur
     la pièce concernée**. Les deux répondent à des questions différentes —
     le bandeau dit *ce qui se passe*, le marqueur dit *laquelle* — et sans
     le second il fallait retraduire « attribut » en « celle de gauche ».
     La pièce figée est en outre **légèrement atténuée** (80 %), pour que
     l’œil tombe d’abord sur la moitié réellement cherchée.
     La question garde tout son sens : « à artéfact d'attribut donné, quel
     type ? » ;

     ⚠️ **80 %, et surtout pas moins.** Le vocabulaire « désactivé » de
     l’application vit à 30-40 % : descendre là ferait lire
     « indisponible » une pièce qui est justement celle qu’on portera.
     L’atténuation établit une hiérarchie, elle ne retire rien.

     ⚠️ **Le bandeau est NEUTRE APPUYÉ, pas ambre** (décision explicite).
     Un réglage que l’utilisateur a lui-même posé n’est pas un
     avertissement : l’ambre reste réservé à ce qui réclame une action
     (« Valider les artéfacts »), et deux ambres de sens différents dans la
     même carte auraient dévalué les deux. Le contraste vient du contour
     (plein, là où le bloc porte un contour atténué) et de l’encre pleine.
     La mention vivait auparavant en petit texte grisé sous le titre, loin
     du regard : on lisait la paire en croyant à deux propositions.
   - **les deux** figés → le bloc explique qu'il n'y a rien à chercher, au
     lieu d'annoncer « tu portes déjà la meilleure paire » — ce qui serait
     vrai, mais uniquement parce qu'on lui a interdit de chercher.

   ⚠️ **Le bloc ne DISPARAÎT plus en silence.** Il s'effaçait entièrement
   quand la paire retenue n'apportait aucun dégât brut : avec un emplacement
   figé il n'y a qu'une paire candidate, donc le bloc allait et venait selon
   qu'elle porte ou non ces lignes. Signalé à l'usage — « il est affiché,
   sinon il disparaît ». Il affiche désormais la raison, et aucun chiffre :
   un « 0 / coup » se lirait comme un résultat alors que rien n'a été cherché.

   **Deux crans**, à choisir — un `Segmented`, jamais un bouton qui déclenche :
   - **Dégâts supplémentaires** (défaut) — les dégâts bruts par coup des
     sous-propriétés 218-221. **Calculé en permanence** : la qualité première
     de ce bloc est d'apparaître sans qu'on l'ait demandé, et ce calcul est
     bon marché (ni sort, ni cible, ni critique).

   ⚠️ **Deux nombres, pas un** (demande explicite) : ce que la paire retenue
   apporte **en absolu** (`2 145 / coup`), puis l'**écart** avec la paire
   portée (`+737`). Ils répondent à des questions différentes — « combien
   cette paire me rapporte-t-elle ? » contre « combien j'y gagne par rapport à
   maintenant ? » — et l'écart seul laissait la première sans réponse : un gros
   gain sur une base nulle et un petit gain sur une grosse base affichaient le
   même nombre.
   - L'**absolu s'affiche toujours**, y compris quand on porte déjà la
     meilleure paire — c'est justement là qu'il est seul à dire quelque chose,
     l'écart valant zéro.
   - L'**écart** ne s'affiche que s'il y a quelque chose à gagner.
   - La phrase qui NOMME le chiffre suit la même règle : présente dès qu'un
     nombre l'est. Un nombre sans sa légende serait exactement le défaut du
     « +X % grâce aux artéfacts » qu'on a retiré faute de pouvoir le nommer.
   - **Dégâts réels** — les dégâts **totaux** du sort visé contre l'adversaire
     décrit. ⚠️ **Le moteur choisit une AUTRE paire**, il ne réaffiche pas la
     même autrement : une paire chargée en Dgts CRIT bat une paire chargée en
     218-221 sur le total, et perd sur le brut. Mesuré sur Lushen :
     +737 / coup en brut, **+1 831 dégâts** en réel, avec **deux paires
     différentes**. Affiché `+X dégâts`.

   ⚠️ **Choisir « Dégâts réels » ouvre la fenêtre du combat**, comme le cran
   homonyme de l'objectif de recherche. C'est ce qui rend ce cran légitime :
   cette optimisation avait été **retirée** parce qu'elle reposait sur un sort,
   une cible et un mode de critique jamais choisis. La fenêtre les rend vus et
   posés.

   ⚠️ Si **aucun sort du monstre n'est calculable**, le cran retombe sur les
   dégâts supplémentaires **en le disant** — jamais un bloc vide ni un chiffre
   brut sous un libellé « Dégâts réels ».

   **Chaque artéfact proposé s'affiche comme dans le jeu** : sa statistique
   principale en tête, puis **une ligne par sous-propriété** avec le nombre de
   procs à gauche, la valeur en gras et le marqueur des propriétés modifiées.
   ⚠️ Le rendu est **partagé avec la tuile d'inventaire**
   ([ArtifactSubLigne.tsx](src/components/ArtifactSubLigne.tsx)) : ce bloc
   avait le sien, qui aplatissait les quatre propriétés sur une seule ligne
   séparée par des « · » et se repliait n'importe où. Deux rendus de la même
   donnée, dont un seul ressemblait au jeu.

   ⚠️ **Jamais à la place des artéfacts de la fiche** : celle-ci montre
   l'équipement RÉEL, et y substituer une proposition ferait croire à un
   équipement qu'on ne porte pas. Cette règle était d'abord satisfaite en
   affichant le bloc **sous** la fiche ; elle l'est désormais en le mettant
   dans la carte **voisine**, sous « Exemplaire » — la fiche dit ce qu'on
   PORTE, la carte Artéfacts ce qu'on DEVRAIT porter, et elles se touchent.
   Le bloc rejoint ainsi les réglages qui le pilotent, au lieu d'en être
   séparé par une carte entière.

   Quand la paire portée est déjà la meilleure, l'écran le **dit** au lieu
   d'afficher « +0,0 % » — un zéro ressemble à une panne, la phrase est une
   réponse. Et si des lignes sont verrouillées, ce qu'elles coûtent est chiffré
   là aussi (« vos lignes verrouillées coûtent −3,6 % **sur ce build** »).
   ⚠️ « sur ce build » n'est pas une précaution de langage : la recherche de
   runes tourne elle aussi sous le modèle contraint, donc sans les verrous
   d'AUTRES builds auraient pu émerger. Le chiffrer exigerait de relancer toute
   la recherche.

   ⚠️ **Il vaut pour TOUS les objectifs de recherche, et c'est son cas
   principal.** Un monstre optimisé en efficience, en PV effectifs ou en
   vitesse porte de gros PV/DEF/VIT — que les lignes « Dégâts supp. en
   proportion de… » convertissent en dégâts. Son build de runes est déjà figé
   par un autre objectif, et les artéfacts se posent par-dessus sans y toucher.
   C'est exactement la situation que cette fonctionnalité vise.

   Le libellé le dit alors : « Artéfacts les plus **offensifs** pour ce build »
   — sur une recherche d'efficience, « meilleurs artéfacts » tout court
   laisserait croire qu'ils servent cet objectif-là.

   ⚠️ La paire proposée n'est donc PAS celle que la recherche de runes suppose :
   celle-là maximise l'objectif de recherche, celle-ci maximise les dégâts. Les
   deux coïncident en « Dégâts réels » et divergent partout ailleurs.

   La statistique principale exigée et les lignes verrouillées sont respectées
   dans les deux cas — une contrainte posée reste une contrainte.

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
3. **Objectif de recherche** — en tête de la **carte du bouton
   Rechercher**, au-dessus de la rangée Rechercher / Exporter / Importer.
   ⚠️ Il a longtemps été une carte à part, à droite de « Critères de
   recherche » : c'était nécessaire tant qu'il portait la description du
   combat de « Dégâts réels », qui a besoin de place. Celle-ci ouverte en
   fenêtre, il ne reste qu'un bouton à choix unique, et il rejoint le geste
   qu'il qualifie. Ce qui n'a pas changé : ce n'est **pas** un champ de
   « Critères de recherche » — l'objectif se choisit avant même de composer
   le set, ce n'est pas un critère de plus parmi d'autres. **Un bouton à
   choix unique** (`<Segmented
   size="lg">`), choisi **avant** de lancer la recherche, pas seulement un tri
   après coup :
   ⚠️⚠️ **ON NE REVALIDE JAMAIS LES LISTES CONTRE UN COMPTE VIDE**
   (`comptePeutJuger`, [optimizerExclusion.ts](src/lib/optimizerExclusion.ts)).
   La revérification répond à « mon compte a-t-il changé depuis » ; face à un
   compte sans monstre ni rune, elle ne peut répondre qu'une chose — plus rien
   ne résout, donc **tout est jeté** — et cette réponse-là n'est jamais la
   bonne : un compte vide veut dire « pas encore chargé », pas « tes monstres
   ont disparu ». Le résultat étant **écrit sur disque**, la perte est
   définitive.
   - Symptôme observé : à **chaque rechargement de page**, les listes
     survivaient mais leur CONTENU disparaissait — `replaceMembersAndValidated`
     vide les membres et les builds sans toucher aux listes elles-mêmes.
   - Cause : `React.StrictMode` monte le composant **deux fois** en
     développement. Le garde-fou d'`App.tsx` (`boxMountedRef`) ne protège que
     le PREMIER passage de l'effet ; le second revalidait avec `box` et `runes`
     encore vides.
   - ⚠️ **La garde vit sur la DONNÉE, pas sur un compteur de rendus.** Un
     garde-fou qui compte les passages d'un effet est battu par StrictMode, par
     un remontage, ou par le prochain qui réorganise les effets. Celui-ci tient
     quoi qu'il arrive en amont — et il est **testable**, donc testé (dont le
     contrôle qui montre que sans lui, tout part).
   - ⚠️⚠️ **« Le compte » = LA BOX ET LES RUNES, jamais RTA ni le siège.** Une
     première version acceptait « n'importe quelle source non vide » — elle
     passait donc toujours : RTA et le siège sont des états persistés **à part**,
     rendus dès le premier rendu, tandis que le compte se relit en **asynchrone**
     (`loadAccount()`). Mesuré sur le cas réel, au second passage d'effet de
     StrictMode :

     ```
     revalidation lancée — box=0 runes=0 rta=40 siegeDef=3 siegeOff=49 membres=1
     ```

     Le garde-fou laissait passer, la revérification jetait le membre, et
     l'écriture suivante le perdait pour de bon. C'est bien contre la **box**
     que les sélecteurs se résolvent, et contre les **runes** que les builds se
     vérifient : une source annexe chargée ne dit rien de la disponibilité de
     celles-là.

   ⚠️⚠️ **UN OBJECTIF RETIRÉ SURVIT DANS LES SCRIPTS.** `'degats'` a été sorti
   d'`Objective`, mais il restait le DÉFAUT de dix scripts CLI/diag, en cast
   `as Objective`. Or `objectiveKeysOf` retombe sur `[]` pour une valeur absente
   de la table : ces scripts mesuraient donc **sans aucun biais de
   pré-filtrage**, alors qu'ils sont précisément là pour le mesurer — le
   validateur différentiel comparait deux moteurs dans des conditions qui
   n'étaient plus celles de l'app, et **rien ne le disait**.
   - Le repli vit en **un seul endroit** (`scripts/lib/objectifCli.ts`) et
     **reproduit l'ancien comportement** : `'degats'` → `efficience` +
     `objectiveStats: ['atk', 'cd']`, l'équivalence déjà retenue par
     `perfShared.ts`. Mesurer « sans biais » aurait changé la question posée,
     silencieusement.
   - La valeur reste acceptée **en ligne de commande** : c'est une compatibilité
     d'argument, pas un objectif de l'app.
   - ⚠️⚠️ **`tsconfig.json` n'inclut que `src`** : `tsc --noEmit` ne voit RIEN de
     `scripts/`. C'est ce qui a laissé passer les dix casts — et le code le
     savait déjà (`filterSlot` porte l'avertissement « incident déjà vécu deux
     fois »). Ça vient de se reproduire une troisième. Tant que le périmètre
     n'est pas élargi, **tout changement de type partagé avec `scripts/` se
     vérifie à la main** (`grep` du nom, puis un bundle esbuild de contrôle).

   - **Efficience** (par défaut) — pas de biais particulier, la mesure
     choisie globalement (Efficience ou Score SW, voir
     [compte/runes.md](../compte/runes.md)).
   - **PV effectifs** — considère PV et DEF ensemble.
   - **Vitesse** — VIT seule.
   - **Dégâts réels** — la **vraie formule d'un sort précis** contre un
     adversaire configuré, pas une espérance générique. Modèle de calcul
     détaillé : [degats-reels.md](degats-reels.md). Choisir cet objectif
     **ouvre** son réglage, dans une fenêtre par-dessus l'écran
     ([DamageSetupModale.tsx](src/components/outils/DamageSetupModale.tsx),
     qui porte la même carte qu'avant) — et rien ailleurs à l'écran ne
     change. Une fois la fenêtre fermée, une **ligne de résumé** prend sa
     place sous l'objectif : `S1 Flying Cards · élément ignoré · PV 30 000 ·
     DEF 1 000 · Critique`. On la clique pour rouvrir.
     - ⚠️ **Le résumé dit le sort RÉELLEMENT utilisé**, pas celui qu'on
       avait choisi. Un sort appartient à un monstre : après un changement
       de monstre, le calcul retombe sur le sort par défaut du nouveau. Tant
       que le réglage était déplié on le voyait ; derrière une fenêtre
       fermée, afficher l'ancien choix ferait croire à un calcul qui n'a pas
       lieu.
     - ⚠️ **Le résumé ne montre QUE ce que le sort consomme**, exactement
       comme la fenêtre. Sur un sort qui **ignore la défense**, le champ DEF
       n'existe pas dans la fenêtre — et il disparaît donc du résumé : `S3
       Amputation Magic · élément ignoré · PV 30 000 · Critique`. Une
       première version l'affichait en dur, donnant « DEF 1 000 » sur un sort
       qui n'en tient aucun compte, signalé à l'usage. Les deux lectures
       viennent désormais d'un seul prédicat (`champsDuCombat`,
       [damage.ts](src/lib/damage.ts)) : deux copies avaient déjà divergé.
     - **Pas de buffs dans ce résumé** : ils ne sont plus dans la fenêtre
       qu'il rouvre, et ont leurs propres contrôles toujours visibles dans
       « État de mon monstre ».
     - ⚠️ **Choisir l'objectif ouvre la fenêtre, il ne fait pas que la
       révéler.** Auparavant le réglage se dépliait sous l'objectif et rien
       n'obligeait à le regarder : on pouvait classer des milliers de builds
       sur un sort, une cible et un mode de critique jamais choisis. Le
       geste est désormais explicite.

     Ce que contient ce réglage :
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
     - **Effets actifs** — effets subis par la cible (réduction de défense
       ×0,3, marque +25 %, « ce sort pose le def break » — distingue
       « attaque une cible déjà réduite » de « réduit puis frappe », les
       deux mitigations ne sont pas identiques), chacun son **icône de jeu
       cliquable**, pas
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
       [degats-reels.md](degats-reels.md), « Effets d'équipe ».

       ⚠️ **Les buffs ATQ/DEF/VIT et le leader skill n'y sont plus** — voir
       « État de mon monstre » ci-dessous.
     - ⚠️ **Compétences d'invocateur : parties ailleurs**, voir « État de mon
       monstre ». Rappel de ce qu'elles font : **Aucune** / **Combat**
       (défaut) / **Combat + Guilde**, remplaçant les anciens totems et
       drapeaux, toujours supposées maxées. **Un choix unique, pas deux
       cases** : l'onglet Guilde ne s'applique qu'en contenu de guilde, où
       Combat compte aussi — « Guilde » implique donc toujours « Combat ».
       La compétence « Puis. d'att. de <élément> » suit l'élément du
       monstre, sans rien demander. Détail des valeurs :
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
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés.

   ⚠️ **L'Intangible ne figure PAS dans la grille.** C'est un **joker à une
   pièce** qui complète n'importe quel set : on ne le vise jamais pour
   lui-même, et le demander revenait à réclamer un set de 2 pièces qui
   n'existe pas. Il apparaissait sous « Set secondaire » parce que ce groupe
   se définissait par la négation — « tout ce qui n'est pas un set de 4 » —
   or l'Intangible n'est ni l'un ni l'autre. Signalé à l'usage. Il reste
   évidemment **utilisable par la recherche**, qui s'en sert pour compléter
   les sets demandés ; c'est seulement le CHOISIR comme objectif qui n'avait
   pas de sens. Un combo ancien qui en contiendrait un reste affiché et
   retirable.

   ⚠️ **Obligatoire** :
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
   ⚠️ **Un maximum saisi SOUS le minimum retombe au défaut de la case**
   (demande explicite) : la condition serait insatisfaisable par construction,
   et la recherche renverrait « 0 build » sans que rien ne dise pourquoi.
   - À la **sortie du champ**, jamais à la frappe : on ne saurait pas
     distinguer un « 5 » définitif d'un « 50 » en cours d'écriture. C'est le
     même piège que celui que `NumberField` documente déjà pour le bornage par
     `min` — d'où un axe `onBlur` ajouté au composant, réservé aux règles qui
     lient DEUX champs (borner celui-ci reste le travail de `min`/`max`).
   - Le champ est **effacé**, pas remonté à la valeur du minimum : il retrouve
     ainsi son placeholder, donc son défaut (le plafond pour une stat bornée à
     100, « aucun maximum » sinon). Le corriger en « max = min » poserait une
     contrainte que personne n'a demandée, et qui ne laisse passer qu'une
     seule valeur.

   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6. **Colonne
   GAUCHE**, sous Set de runes recherché (demande explicite : les deux
   contraintes qui portent sur les runes elles-mêmes, groupées ensemble). Ce
   filtre s'applique **avant** tout le reste, dans la construction même du
   pool par slot — il réduit donc le nombre de candidats réellement
   considérés dès le départ.
6. **Artéfacts** — interrupteur **« Activer l'optimisation d'artéfacts »**,
   **ACTIVÉ par défaut**.

   ⚠️ **Désactivé ne veut PAS dire « sans artéfact ».** Le monstre garde les
   pièces qu'il porte réellement, statistiques comprises : on cesse simplement
   d'en chercher d'autres. Sert à composer un runage autour des artéfacts déjà
   en place. Le réglage retirait auparavant TOUTE contribution d'artéfact, ce
   que son libellé ne disait pas et qui rendait les conditions minimales plus
   dures à franchir sans raison.

   Activé, deux listes déroulantes (Attribut, Type) proposent :
   **« Libre »** (**défaut** — cherche le meilleur artéfact parmi TOUS les
   artéfacts équipables), **« Garder l'artéfact équipé »**, **Principale
   ATQ +100**, **Principale DEF +100**, **Principale PV +1500** (les trois
   statistiques principales d'artéfact du jeu).

   ⚠️ **Le défaut affiché était FAUX** : la liste montrait « Garder l'artéfact
   équipé » tant qu'aucun choix n'avait été fait, pendant que la recherche
   cherchait librement — le moteur traite une absence de choix comme
   « Libre ». L'écran annonçait donc le contraire de ce qui se passait, et
   tout ce qui se fiait à cet affichage (les emplacements considérés comme
   figés, donc l'éditeur de sous-propriétés verrouillées) raisonnait sur un
   état faux. Le comportement n'a pas changé — seul l'affichage a été mis
   d'accord avec lui.

   ⚠️ **Il n'y a PAS de cran « Aucun »** — il a existé, il a été retiré.
   Imposer l'emplacement vide pour UNE sorte pendant que l'autre cherche ne
   correspond à rien en jeu : un monstre porte deux artéfacts, ou n'en porte
   pas. Ne pas les compter est une décision **globale**, et l'interrupteur la
   prend d'un seul geste pour les deux emplacements. L'emplacement peut
   toujours rester **vide** si la recherche n'a rien de mieux à y mettre —
   c'est l'imposer par sorte qui n'avait pas de sens. Une recette exportée
   avant ce retrait voit son « Aucun » ramené sur **« Libre »** à l'import.

   ⚠️ **« Garder l'artéfact équipé » conserve la PIÈCE ENTIÈRE**, ses quatre
   sous-propriétés comprises : le pool de cet emplacement tombe à **un seul
   candidat**, l'exemplaire réellement porté (ou rien, s'il n'est pas
   éligible pour ce monstre). Rien n'est cherché.

   ⚠️ **Ce choix ne se PARTAGE pas.** Importer une recette exportée par
   **quelqu'un d'autre** bascule automatiquement « Garder l'artéfact équipé »
   sur **« Libre »**, et le dit dans le message d'import. Raison : ce réglage
   garde l'artéfact porté par **celui qui lit**, pas par l'auteur — chez un
   autre joueur il ne transporte aucune intention, il impose une pièce
   arbitraire, parfois sans rapport avec la recherche décrite. Tout le reste
   d'une recette se re-résout contre le compte du lecteur (le monstre par son
   `com2usId`, les runes par la recherche elle-même) ; celui-ci était le seul
   à transporter en douce une hypothèse locale. « Libre » est l'intention la
   plus proche : cherche le meilleur artéfact **parmi les tiens**.
   - La comparaison se fait sur le **nom du joueur** (`wizard_name`), écrit
     dans la recette à l'export.
   - ⚠️ **Provenance inconnue = on ne touche à rien** : une recette exportée
     avant ce champ, ou un compte local sans nom, ne permettent aucune
     comparaison. Agir sur une provenance devinée serait pire que de
     transporter la donnée telle quelle.
   - ⚠️ **Le script CLI (`optimizer-search.ts`) ne bascule PAS**, exprès :
     l'appelant y désigne le compte explicitement, presque toujours pour
     rejouer un cas signalé avec l'export de celui qui l'a signalé. Basculer
     rendrait la reproduction moins fidèle.

   ⚠️ Ce choix s'appelait **« Comme équipé »**, et le mot « principale »
   n'apparaissait nulle part. Posé au milieu de trois statistiques
   principales, il se lisait « la principale, comme équipé » — une liste se
   lit comme homogène. Signalé à l'usage. Le qualificatif a donc été ajouté
   aux entrées qui filtrent **réellement** par stat principale, et le choix
   qui garde la pièce dit maintenant qu'il la garde.

   ⚠️ **Carte à part**, colonne 2 rangée 2 — sous « Exemplaire », plus dans
   la colonne droite de « Critères de recherche ». L'interrupteur
   « Activer l'optimisation d'artéfacts » masque d'un coup les deux listes ET les
   lignes verrouillées : tant que le bloc vivait en tête de cette colonne,
   ce clic faisait REMONTER « Conditions », soit un clic qui déplace ce qui
   le suit ([shared/design.md](shared/design.md)). Le trait qui séparait
   Artéfacts de Conditions a disparu avec lui — un trait en tête de colonne
   ne sépare plus rien.

   ⚠️ **Pas en pleine largeur** : essayé et rejeté sur capture. La pleine
   largeur projette la puce de sorte, le champ de minimum et la croix à
   ~1 400 px de leur libellé — une saccade d'un bout à l'autre de l'écran
   pour lire UNE ligne verrouillée, pire que le repli de texte qu'elle
   corrigeait.

6 bis. **État de mon monstre** — ⚠️ **une carte à part**, colonne 2 rangée 3,
   juste sous « Artéfacts ». Elle a d'abord vécu en bas de cette carte, séparée
   par un simple trait : ça laissait croire que ces réglages servaient les
   artéfacts, alors qu'ils décrivent le **monstre** et valent pour tout calcul.
   Le trait ne suffisait pas à dire « autre métier » — une carte, si.
   Contenu : **buff ATQ**, **buff DEF**, **buff
   VIT**, **leader skill** d'équipe (type puis valeur, icône officielle du
   jeu) et **compétences d'invocateur**. Ce qui rend le monstre plus fort,
   quel que soit l'adversaire.

   Les trois groupes tiennent sur **une seule rangée** (demande explicite) :
   empilés, ils donnaient à la carte une hauteur sans rapport avec le peu
   qu'elle contient. ⚠️ En `flex-wrap`, pas en rangée rigide — au doigt ou
   dans une colonne étroite, ils repassent à la ligne plutôt que de comprimer
   les contrôles sous leur taille de cible.

   Dans le groupe **Invocateur**, le libellé et son aide sont **au-dessus**
   des trois crans, pas à leur gauche (demande explicite) : côte à côte, ils
   formaient le groupe le plus large des trois et faisaient replier la rangée
   plus tôt. ⚠️ **Sans changer la hauteur de la carte** — le groupe passe à
   deux rangées, mais « Lead » en fait déjà deux et `items-stretch` aligne les
   trois boîtes sur la plus haute : l'invocateur ne fait que remplir une place
   qui existait déjà.

   Chacun porte son **contour** (demande explicite : « barres verticales ou
   contours »). ⚠️ **Des boîtes et non des barres**, alors qu'une barre aurait
   été plus légère et que c'est le patron des deux colonnes de « Critères de
   recherche » : ces groupes-ci peuvent passer à la ligne, et une barre
   verticale se retrouverait alors à pendre dans le vide au bout d'une rangée.
   Un contour ferme le groupe où qu'il aille. Un **seul** contour, jamais deux
   superposés ([shared/design.md](shared/design.md)) — ces boîtes vivent à
   l'intérieur de la carte, elles ne longent pas son bord. `items-stretch` les
   met à la hauteur de la plus haute, sinon une boîte d'une rangée flotterait
   au milieu d'une boîte de deux et l'œil lirait un décalage.

   Dans le groupe **Lead**, les deux menus (type et valeur) ont la **même
   largeur** : ils occupent la même colonne de grille, en `w-full`. La largeur
   se déduit donc du plus large des deux — aucune valeur en dur à tenir à jour
   quand un libellé change.

   ⚠️ **Ces cinq réglages vivaient dans la fenêtre « Dégâts réels »**, donc
   atteignables sous ce seul objectif — alors qu'ils changent les
   statistiques du monstre, donc les **dégâts supplémentaires** que lui
   apportent les artéfacts proportionnels aux PV/ATQ/DEF/VIT, affichés quel
   que soit l'objectif. Qui optimisait l'efficience les subissait sans
   pouvoir ni les voir ni les régler. Aucun réglage n'est dupliqué : c'est
   le même état, montré à un endroit toujours visible.

   ⚠️ **La coupe se vérifie, elle ne s'interprète pas.** Sortent de la
   fenêtre EXACTEMENT les réglages qui modifient les statistiques propres du
   monstre ; ce qui reste (cible, sort, critique, réduction de DEF, marque,
   effets d'alliés) n'y touche pas. Test : changer un réglage d'« État de
   mon monstre » DOIT faire bouger le « +X / coup ». Mesuré sur Lushen —
   buff ATQ activé : **+737 → +1 068 / coup**.

   ⚠️ **Rendus sans condition**, contrairement à leur ancienne place où ils
   n'apparaissaient que si la formule du sort lisait la statistique. C'était
   la bonne question tant qu'ils décrivaient un coup ; un buff change les
   stats du monstre même sans sort du tout.

   ⚠️ **La fenêtre « Dégâts réels » en garde un écho en lecture seule**,
   dans son sous-titre — jamais les contrôles eux-mêmes, qui feraient deux
   exemplaires vivants du même interrupteur visibles en même temps. Qui
   ouvre la fenêtre voit sous quelles hypothèses il travaille ; pour les
   changer, il ferme.

   ⚠️ **Le sélecteur FILTRE l'inventaire, il n'hypothèque pas.** Choisir
   « ATQ +100 » restreint la recherche aux artéfacts qu'on POSSÈDE portant
   cette principale, avec leurs sous-propriétés. Sans aucun, l'emplacement
   reste vide — on ne peut pas équiper ce qu'on n'a pas.

   Ce réglage servait à l'origine de « et si j'avais un artéfact PV+1500 ? »
   et fabriquait pour cela une pièce sans aucune sous-propriété. En
   « Dégâts réels », cette pièce faisait calculer les dégâts SANS aucune ligne
   d'effet — ni renforcement d'ATQ, ni dégâts additionnels, ni points de
   Dgts Crit conditionnels — quand « Comme équipé » les comptait : deux
   réglages voisins, deux modèles de dégâts, sans que rien ne le signale. Le
   « et si… » est donc perdu, en connaissance de cause.

   **Sous-propriétés verrouillées** — sous les deux listes, jusqu'à **8**
   sous-propriétés exigées avec un minimum chacune (« Précision Compétence 3
   ≥ 15 % »). Sert à obtenir un build qui maximise les dégâts *tout en*
   garantissant une propriété qui n'y contribue pas.

   ⚠️ **Un verrou n'a de sens que sur un emplacement CHERCHÉ.** Sur une sorte
   laissée sur « Garder l'artéfact équipé », la pièce est déjà décidée :
   exiger une sous-propriété n'en fait pas apparaître une meilleure — soit
   celle qui est portée la porte déjà, soit plus aucune paire ne passe et la
   recherche refuse de partir. Donc :
   - les sous-propriétés **exclusives** à une sorte figée disparaissent du
     menu (une ligne portable par les deux reste proposée tant qu'un
     emplacement cherche) ;
   - les **deux** emplacements figés — ce qui est le **défaut** — rendent la
     section entièrement inerte, et elle **dit pourquoi** plutôt que de
     présenter un menu vide ;
   - une ligne déjà posée qui devient sans effet est **barrée et grisée**,
     avec la raison et la conduite à tenir ; sa **croix reste active**, parce
     que la retirer est le seul geste qui serve encore.

   ⚠️ **Le minimum vaut 1 % à la pose, et ne peut pas descendre à 0**
   (demande explicite). Un verrou à 0 est **inerte** — `paireRespecteLignes`
   passe les lignes à `min <= 0` : la ligne s'affichait donc comme une
   contrainte tout en n'en étant pas une, et occupait pour rien l'un des 8
   emplacements de l'écran. Pour retirer une exigence, on retire la ligne —
   la croix est là pour ça.

   Vocabulaire de cette section, **aligné sur celui du jeu** (demande
   explicite) : on parle d'**artéfact**, jamais de « pièce », et de
   **sous-propriété**, jamais de « ligne » ni d'« emplacement » — d'où
   « + Sous-propriété… » pour ajouter (**au singulier** : le menu en ajoute
   une à la fois), un compteur préfixé `sous-propriétés :`, et le même mot
   dans les deux diagnostics d'échec. Les commentaires de code et les
   libellés de test gardent « pièce »/« ligne », qui n'atteignent aucun
   joueur.

   - ⚠️ **Un verrou somme STRICTEMENT par code — d'où un avertissement.** Le
     jeu a **deux familles** où une forme GROUPÉE recouvre des formes simples :

     | Forme groupée | Recouvre |
     |---|---|
     | Dgts CRIT [compétence 3/4] | [Comp.3] Aug. Dgts CRIT · [Comp.4] Aug. Dgts CRIT |
     | Effet renforcement ATQ/DEF | Effet renforcement ATQ · Effet renforcement DEF |

     Au **calcul des dégâts**, elles font la même chose (sur un S3 pour la
     première, sur le buff concerné pour la seconde). Au **verrouillage**,
     non : exiger l'une ignore l'autre. Sur un inventaire mixte, le verrou
     écarterait donc une partie des pièces sans rien dire. Une ligne
     d'avertissement le signale sous la sous-propriété concernée, en nommant
     la ou les formes équivalentes.
     - La relation est **symétrique** : verrouiller la forme groupée avertit
       aussi qu'elle ignore les formes simples.
     - ⚠️ **Comp.1, Comp.2 et le renforcement de VIT n'ont aucun voisin**, et
       n'affichent donc rien : aucune forme groupée ne les recouvre. La
       relation est **déduite** de ce que chaque code couvre — les sorts pour
       les Dgts CRIT, les buffs pour les renforcements
       (`codesEquivalentsAuVerrou`, [damage.ts](src/lib/damage.ts)) — jamais
       d'une liste écrite à la main qui divergerait.
     - ⚠️ Choix **assumé de ne PAS cumuler** les formes : un verrou groupé
       serait la première ligne dont la valeur ne se lit plus sur un seul
       code, avec un plafond et une arithmétique d'emplacements à repenser.
       Dire vaut mieux que compliquer.
   - ⚠️ **Le minimum porte sur la PAIRE, pas sur un artéfact** : une même ligne
     peut tomber sur les deux artéfacts et ses valeurs s'additionnent. Le
     plafond affiché double donc pour une ligne que les deux sortes peuvent
     porter (200-299), et reste simple pour une ligne réservée à l'attribut
     (300-309) ou au type (400-411). Le champ est **borné** à ce plafond :
     au-delà, aucun inventaire ne pourrait satisfaire l'exigence.
   - ⚠️ **8 = 4 + 4, en deux moitiés qui ne se prêtent rien.** Un artéfact
     porte 4 sous-propriétés. Verrouiller 5 lignes réservées au type est donc
     impossible d'avance : un compteur `sous-propriétés : attribut x/4 ·
     type x/4` le montre
     pendant la saisie. Et au-delà du plafond d'UNE pièce, une ligne
     cumulable exige les DEUX, donc un emplacement de chaque côté.
   - Quand aucune paire ne satisfait les verrous, l'écran rapporte le
     **meilleur cumul réellement atteignable** ligne par ligne (« 35 % exigé ·
     28 % au mieux »). ⚠️ **Observé, jamais déduit** : un pré-contrôle
     théorique pourrait annoncer « impossible » sur une combinaison en fait
     réalisable, ce qui serait pire que de se taire. Chaque maximum étant pris
     ligne par ligne, deux lignes atteignables séparément peuvent ne l'être
     par aucune paire à la fois — l'écran le dit.
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
    ⚠️ **Objectif « PV effectifs »** : même traitement, et pour la même
    raison — chaque carte affiche la valeur de PV effectifs qui l'a classée.
    Elle manquait : on triait par PV effectifs sans jamais voir la valeur
    triée. Le chiffre vient de `pvEffectifs` (runeBuildOptim.ts), **la même
    fonction que celle qui classe** — extraite d'`objectiveScore` pour ça,
    plutôt que recopiée côté écran où elle aurait divergé au premier
    ajustement du facteur de défense.
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

  ⚠️ **Les ARTÉFACTS du build sont réservés eux aussi**, et mémorisés avec
  lui. Un artéfact physique ne se porte que sur UN monstre à la fois,
  exactement comme une rune : la paire retenue disparaît donc de l'inventaire
  proposé aux autres monstres de la MÊME liste, avec la même auto-exemption
  (relancer une recherche sur un monstre déjà validé ne le prive pas de ses
  propres pièces) et la même indépendance entre listes.

  ⚠️ **« Valider les artéfacts » — mêmes runes, autre paire.** Un build peut
  s'afficher avec les runes déjà réservées mais une AUTRE paire d'artéfacts :
  ses statistiques ne sont alors pas celles qui sont réservées. Le bouton
  passe dans un troisième état, actif, qui met à jour la seule paire sans
  toucher aux runes. Sans lui, la carte disait « Validé » et n'offrait plus
  rien alors que ce qu'elle montrait n'était pas ce qui était réservé.
  Le cas est courant : la meilleure paire dépend du critère de tri affiché,
  donc changer de tri change la paire à runes identiques.

  Sans cette mémorisation, la fiche d'un build validé rejouait la paire portée
  AUJOURD'HUI plutôt que celle retenue par la recherche. ⚠️ Les builds validés
  avant que les artéfacts aient un identifiant n'en portent pas : ils retombent
  sur les artéfacts réels, et il faut les revalider. Les jeter aurait été une
  perte de données pour un simple affichage.

  ⚠️⚠️ **LA GARDE ANTI-DOUBLE-RÉSERVATION EST SUR LES DEUX CHEMINS.** Elle
  n'existait que sous la **fiche** (`displayedRuneConflicts`) ; la carte de
  résultat, elle, ne vérifiait rien — au motif que le pool de recherche exclut
  déjà les runes réservées. C'est vrai **au moment de la recherche seulement** :
  des résultats affichés avant un changement de liste active, ou avant qu'un
  autre monstre ne réserve, permettaient de réserver **deux fois la même rune**
  dans une même liste. **La garde va là où l'on valide, pas là où l'on
  cherche** — un seul calcul (`conflitsDeRunes`), utilisé par les deux.

  ⚠️ Le bouton reste **affiché et désactivé**, libellé « Rune déjà réservée » et
  infobulle nommant le monstre qui la retient : le retirer laisserait croire que
  ce build n'est pas validable du tout, alors qu'il le redevient dès qu'on
  libère la rune.
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
  ⚠️ **Bascule vers l'équipement réel, sans quitter la liste** (demande
  explicite : « on ne peut plus voir à quoi ressemblait le runage précédent
  tant qu'on est dans la liste ») — une icône dans ce même bandeau («
  Voir le runage réellement porté ») affiche l'équipement RÉEL de
  l'exemplaire à la place du build validé, sans changer d'exemplaire ni
  quitter la liste ; le bandeau change alors de message (« Équipement
  réellement porté affiché ») et une puce s'allume normalement si ce
  runage correspond bien à l'une des 4 sources. Réinitialisée à chaque
  changement d'exemplaire — revenir sur ce monstre plus tard réaffiche le
  build validé par défaut.
- **« Comparer », à côté de « Valider ce build »** sur chaque carte de
  résultat (demande explicite) : les deux boutons **se partagent la largeur**
  de la carte, plutôt que d'être empilés — une rangée de plus par carte se
  paierait sur toute la grille de résultats. Au clic, l'**écart statistique
  par statistique** entre ce build et la référence apparaît **sous** les
  boutons, donc sans rien déplacer de ce qui précède.
  - ⚠️ **La référence est la fiche affichée**, ce qui couvre les deux cas
    demandés *sans les distinguer* : « le build validé s'il y en a un, sinon
    le build actuel ». `selected.gear` **est** déjà le build validé quand il
    en existe un — runes ET artéfacts substitués — et l'équipement réel
    sinon. Refaire cette résolution côté comparaison l'aurait dupliquée, et
    aurait raté « Voir le runage réellement porté », qui la désactive exprès.
  - Un seul build comparé à la fois : ils partagent la même référence, deux
    comparaisons ouvertes ne diraient rien de plus.
  - ⚠️ **L'écart porte aussi sur la valeur de TÊTE**, pas seulement sur les
    huit statistiques (demande explicite) : dégâts, PV effectifs et
    efficience/score selon ce qui est affiché. Il se pose **sous** la valeur
    qu'il qualifie, jamais à côté, où il se lirait comme une seconde mesure.
    Un seul composant les rend tous les trois — trois rendus séparés auraient
    divergé de couleur ou de format, alors que c'est précisément leur
    comparaison qui compte.
  - ⚠️ L'écart de **dégâts** est recalculé contre les stats ET la paire
    d'artéfacts de la référence, jamais contre le total d'un autre candidat.
  - ⚠️ Les écarts **nuls sont affichés**, en gris. Ne montrer que les stats
    qui changent ferait une liste de longueur variable d'une carte à l'autre,
    et laisserait croire qu'une stat absente n'a pas été comparée.
  - L'écart est calculé **par le parent**, comme les dégâts réels de la carte
    et pour la même raison : la carte n'a aucune raison de savoir comment la
    référence se résout. Il n'est calculé que pour la carte comparée — le
    faire pour les 20 de la page coûterait vingt fois plus pour dix-neuf
    valeurs jamais affichées.

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
  quelles runes et pour quel monstre (« Rune déjà réservée dans cette
  liste : emplacement 2 (Camilla) », accordé en nombre — « Runes déjà
  réservées » dès qu'il y en a plusieurs), pas juste un bouton désactivé
  sans explication.
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
    ⚠️ **L'apport des artéfacts y compte pour ce que l'INVENTAIRE peut
    donner, jamais pour ce qu'une paire choisie d'avance apporte.** Deux
    bornes distinctes : le meilleur apport atteignable pour juger d'un
    minimum, l'apport incompressible (zéro dès qu'un emplacement peut rester
    vide) pour juger d'un maximum. Sans cette distinction, laisser la stat
    principale sur **Libre** pouvait rendre MOINS de résultats que la forcer
    sur une stat précise — alors que « Libre » autorise strictement plus
    d'artéfacts : la paire supposée était choisie pour son score, et pouvait
    donc n'apporter aucune DEF alors que l'inventaire en contenait.
  - ⚠️ **Cette borne est calculée stat par stat**, donc plus optimiste que ce
    qu'une paire réelle peut fournir : deux emplacements ne portent que deux
    statistiques principales. Elle sert au pré-filtrage, où être large ne
    coûte que du travail en trop. **La décision finale, elle, se prend sur de
    VRAIES paires** : un build n'est retenu que si l'une des combinaisons
    réellement équipables lui fait tenir *toutes* ses conditions à la fois.
    Un résultat affiché respecte donc toujours les conditions demandées.
  - **La meilleure paire d'artéfacts d'un build suit le critère de tri
    affiché.** Trier par PV effectifs choisit les artéfacts qui maximisent les
    PV effectifs, trier par Dégâts réels ceux qui maximisent les dégâts — deux
    réponses différentes pour le même build, et c'est normal : un artéfact
    change les statistiques du monstre, donc le meilleur dépend de ce qu'on
    cherche. Sur Efficience et Vitesse, aucun artéfact n'entre dans le score :
    il n'y a rien à y maximiser, seule compte la faisabilité.
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

### Le choix des artéfacts — un second problème, séparé

⚠️ **Rien à voir avec la recherche de runes, et c'est voulu.** Toute la
machinerie ci-dessus existe parce que les runes forment un espace de 6
emplacements sous contraintes de sets. Les artéfacts, eux, sont **deux**
emplacements, et la règle d'éligibilité (l'attribut suit l'élément du monstre,
le type suit son archétype) ramène chacun à ~200 candidats sur un inventaire
réel : une **double boucle exhaustive** suffit, elle est exacte, et il n'y a
donc aucune heuristique à valider — voir
[artifactOptim.ts](src/lib/artifactOptim.ts).

- **Le build de runes est FIXE** pendant ce choix. Un artéfact amplifie un
  build, il n'en déplace pas la cible : chercher les deux ensemble multiplierait
  l'espace pour un gain que la mesure ne montre pas.
- ⚠️ **La contrainte de PAIRE n'est pas un détail** : on ne peut pas porter
  deux artéfacts **intangibles** à la fois, alors que chacun est éligible seul.
  Choisir le meilleur de chaque côté indépendamment produirait une paire
  inéquipable.
- **Élagage exact, jamais heuristique** — vérifié par différentiel contre le
  balayage complet, optimum identique :
  - **Pertinence** : une ligne qui ne fait pas bouger les dégâts POUR CE
    RÉGLAGE n'entre pas en compte. ⚠️ Elle est **sondée contre le vrai calcul**,
    jamais lue dans une table de codes : « Dgts CRIT Compétence 2 » ne sert à
    rien quand on optimise le S3, « D.CRIT+ cible unique » ne sert à rien sur
    une attaque de zone, et les lignes élémentaires ne servent à rien quand
    l'élément visé est ignoré — ou quand il ne correspond pas.
  - **Dominance** : un artéfact au moins aussi bon qu'un autre sur toutes les
    dimensions qui comptent est le seul retenu. ⚠️ Un **intangible** ne peut
    jamais en éliminer un ordinaire : il traîne la contrainte de paire, et le
    substituer rendrait infaisable toute paire dont l'autre emplacement est
    déjà intangible.
  - **Obligation** : quand une ligne verrouillée ne peut être servie que par
    une sorte, tout candidat sous son seuil est écarté. ⚠️ Le seuil n'est pas
    le minimum demandé : il en retranche ce que l'AUTRE pièce peut apporter.

**Quand ce choix a lieu.** La recherche de runes a besoin d'une paire pour
noter les candidats, avant qu'aucun build n'existe : elle en **suppose** une
(la meilleure pour l'équipement affiché, sous les mêmes contraintes). Puis,
**pendant que la recherche tourne**, les meilleurs builds reçoivent chacun
leur vraie paire, sur le temps d'inactivité — l'ordre d'appariement étant
piloté par l'objectif, les bons builds sortent en quelques secondes là où la
recherche s'écoule sur plusieurs minutes.

⚠️ **Ce travail concurrent ne ralentit pas la recherche** — mesuré, pas
supposé : +0,3 % sur une recherche de 25 secondes et −1,6 % sur une de 8, les
deux sous le plancher de bruit de la mesure. Seule une recherche d'environ une
seconde montre ~3 %, dont une charge de calcul *pure* explique la
quasi-totalité : c'est du partage de cœurs, pas un coût propre à ce calcul.

**La page que vous consultez passe en premier.** Les cent meilleurs builds sont
traités en avance de fond, mais c'est la page affichée qui est servie d'abord —
sans quoi aucune page au-delà de la centième position n'aurait jamais sa paire.
Changer de page ou de tri repriorise immédiatement, sans rien recalculer de ce
qui est déjà connu.

Une carte dont la paire n'est pas encore calculée le **dit** (« artéfacts pas
encore optimisés ») plutôt que de laisser croire à un résultat définitif. ⚠️ La
place de cette mention est réservée d'avance : sans ça, chaque paire trouvée
changeait la hauteur d'une carte et réorganisait toute la grille.

⚠️ **Un build optimisé peut alors passer devant dans le classement**, et la
boucle « trier → optimiser → retrier » ne s'emballe pas : optimiser un build ne
peut que faire MONTER son score (la paire supposée fait partie des paires
candidates, le maximum lui est toujours ≥). Un build non optimisé ne peut donc
qu'être repoussé vers le bas, jamais entrer dans les premiers de ce fait —
l'ensemble à traiter rétrécit.

⚠️ **Les stats de la carte sont recalculées avec sa vraie paire**, pas seulement
son total : la stat principale d'un artéfact entre dans les stats du monstre.
Sans ce recalcul, la carte afficherait des stats qui ne correspondent pas aux
artéfacts montrés juste à côté, et un tri par ATQ porterait sur une valeur
périmée.

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
