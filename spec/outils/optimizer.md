# Outils · Optimizer (`#/outils/optimizer`)

**Statut :** ÉTAT ACTUEL — décrit l'écran et le comportement ACTUELS de l'Optimizer, ainsi que son algorithme
**Lire si :** on modifie l'écran, ses réglages, ou l'algorithme de recherche de runes
**Ne pas lire si :** on cherche le modèle de calcul des dégâts (degats-reels.md) seul
**Voir aussi :** degats-reels.md, README.md

Cherche, parmi les runes **réellement possédées**, la (les) meilleure(s)
combinaison(s) de 6 pour un monstre donné, sous contrainte d'un **combo de
sets**, de **statistiques principales imposées** (slots 2/4/6) et de
**minimums/maximums de stats**, orientée par un **objectif de recherche**
choisi d'avance. Anticipé dans
[compte/calcul-runes.md § 6. Perf (contrainte forte, à respecter)](../compte/calcul-runes.md)
(« Futur optimiseur de builds »).

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

## Ordre d'usage et grille

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

## Panneaux repliables

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

## Placement et adaptation à la largeur

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

## Survie à un changement d'onglet

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

## Où vit le reste de la spec

Les anciennes sections de cette page vivent chacune dans leur fichier, dans le dossier optimizer à côté de cette page :

- **Écran** — [ecran/README.md](optimizer/ecran/README.md) (grille), puis une page par carte :
  - [Recherche du monstre à optimiser](optimizer/ecran/recherche-du-monstre.md)
  - [Meilleurs artéfacts offensifs pour ce build](optimizer/ecran/meilleurs-artefacts-offensifs.md)
  - [Équipement actuel](optimizer/ecran/equipement-actuel.md)
  - [Objectif de recherche](optimizer/ecran/objectif-de-recherche.md)
  - [Set de runes recherché et statistique principale imposée](optimizer/ecran/set-et-principale.md)
  - [Artéfacts](optimizer/ecran/artefacts.md)
  - [Relique](optimizer/ecran/relique.md)
  - [État de mon monstre](optimizer/ecran/etat-de-mon-monstre.md)
  - [Sous-propriétés verrouillées](optimizer/ecran/sous-proprietes-verrouillees.md)
  - [Conditions, inventaire et réglages avancés](optimizer/ecran/conditions-et-reglages.md)
  - [Lancer la recherche](optimizer/ecran/lancer-la-recherche.md)
  - [Résultats](optimizer/ecran/resultats.md)
- [Listes de travail et réservation de runes](optimizer/listes-et-reservation.md)
- [Exclusion des runes déjà portées ailleurs](optimizer/exclusion.md)
- [Interruption — filet de temps, pré-filtrage et arrêt manuel](optimizer/interruption.md)
- **Algorithme** — [Algorithme (résumé fonctionnel)](optimizer/moteur/elagages.md) · [Le choix des artéfacts](optimizer/moteur/artefacts.md) · [Vérification](optimizer/verification.md)
- [Limites connues](optimizer/limites-connues.md)
