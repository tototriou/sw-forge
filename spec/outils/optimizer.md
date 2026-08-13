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
[MonsterGearPicker.tsx](src/components/outils/MonsterGearPicker.tsx) ·
[SetComboPicker.tsx](src/components/outils/SetComboPicker.tsx) ·
[BuildCandidateCard.tsx](src/components/outils/BuildCandidateCard.tsx) ·
[StatPanel.tsx](src/components/StatPanel.tsx) ·
[ArtifactSlots.tsx](src/components/ArtifactSlots.tsx) ·
[RuneWheel.tsx](src/components/RuneWheel.tsx) — ces trois derniers
partagés avec `MonsterGear.tsx` (RTA/Siège/« Équipement actuel »), voir
[README.md](../README.md).

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
1. **Sélecteur de monstre** — recherche parmi **tous** les monstres 6★ de la
   box importée (même liste que « Mon compte » → Monstres), **avec ou sans
   runes actuellement équipées** : un monstre nu se recherche tout aussi bien
   (même grammaire que [MonsterPicker](../shared/recherche-clavier.md)).
   Plusieurs exemplaires du même monstre → **une seule entrée** ; on retient
   l'exemplaire au meilleur équipement (somme d'efficience la plus haute,
   0 pour un monstre nu) pour les stats/artéfacts affichés. **Tous** les
   exemplaires comptent comme « à soi » pour l'exclusion (voir plus bas).
2. **Équipement actuel** — **le composant `MonsterGear`, réutilisé tel quel**
   (pas réimplémenté), le même qu'en RTA/Siège quand on clique un monstre :
   stats base/bonus, artéfacts, roue de runes et relique **tels
   qu'ACTUELLEMENT équipés** sur le monstre choisi, chacun **cliquable**
   pour ouvrir son détail complet (`RuneDetailBox`/`ArtifactDetailBox`/
   `RelicDetailBox`, tous dans [MonsterGear.tsx](src/components/MonsterGear.tsx)),
   affiché **en ligne sous la roue** (pas un popover flottant — c'est le
   comportement propre à `MonsterGear`, pas celui de `DetailPopover` utilisé
   ailleurs dans l'outil pour les résultats). Ce que l'outil part optimiser,
   visible d'un coup d'œil avant de lancer quoi que ce soit — y compris les
   artéfacts et la relique, qui ne sont eux jamais modifiés par la recherche
   (voir « Algorithme »). ⚠️ **Artéfacts : toujours 2 emplacements affichés**
   (Attribut puis Type), même si le monstre choisi n'en porte qu'un seul ou
   aucun — un emplacement vide est montré grisé (icône `Ban`) plutôt que
   simplement absent. ⚠️ **L'encadré de stats bascule base+bonus ↔ total au
   clic** (bonus et total dans le même vert ; Taux Crit/RES/Précision en
   rouge dès que leur TOTAL atteint 100 %). Les deux sont des comportements
   de `MonsterGear` lui-même, donc partagés avec RTA et Siège (voir
   [rta/sections-runes.md](../rta/sections-runes.md) pour le détail).
3. **Set de runes recherché** — **un seul combo** (contrairement aux
   recommandations de siège, qui proposent plusieurs possibilités au choix) :
   grille d'icônes de sets, jamais un menu déroulant (`SetComboPicker.tsx`,
   même comportement que le picker de `RecoCard.tsx` réécrit en plus simple).
   Compteur `N/6 runes`, sets qui ne rentrent plus grisés.
   ⚠️ **Obligatoire** : tenter de lancer une recherche sans set sélectionné
   met cette zone en **surbrillance rouge marquée** (bordure épaisse + fond
   teinté + halo large) au lieu de silencieusement ne rien faire — on montre
   OÙ agir, pas seulement qu'il faut agir. ⚠️ **Rouge Tailwind `red-500`
   littéral, pas le jeton sémantique `bad`** du thème : `bad` (voir
   [shared/design.md](../shared/design.md)) est volontairement une teinte corail douce
   en thème sombre, pensée pour un état des DONNÉES — trop proche du fond du
   contrôle pour se voir comme un vrai signal d'alerte. Ce cas précis en avait
   besoin, demandé explicitement après deux essais d'intensification du jeton
   `bad` jugés encore insuffisants. Elle repasse normale dès
   qu'un set est ajouté.
4. **Statistique principale imposée (slots pairs)** — pour chacun des slots
   **2, 4 et 6** (les seuls dont la statistique principale n'est **pas**
   fixée par les règles du jeu — 1/3/5 sont toujours ATQ/DEF/PV plats), une
   rangée de puces à cocher (`SLOT_MAIN_OPTIONS` dans
   [runeBuildOptim.ts](src/lib/runeBuildOptim.ts)) :
   - slot 2 : PV% · ATQ% · DEF% · VIT
   - slot 4 : PV% · ATQ% · DEF% · Taux Crit · Dmg Crit
   - slot 6 : PV% · ATQ% · DEF% · RES · Précision
   Multi-sélection ; **aucune coche = pas de contrainte** sur ce slot. Exemple
   donné pour un Lushen : ATQ% en 2, Dmg Crit en 4, ATQ% en 6.
   ⚠️ Ce filtre s'applique **avant** le pré-filtrage par pertinence, dans la
   construction même du pool par slot — il réduit donc le nombre de candidats
   réellement considérés **dès le départ**, ce qui aide aussi, en pratique, à
   éviter la troncature sur un gros compte (voir « Validation grandeur
   nature »).
5. **Objectif de recherche** — **un bouton à choix unique** sur une seule
   ligne (`<Segmented size="lg">`, [Segmented.tsx](src/components/Segmented.tsx)),
   chaque option se partageant la largeur à égalité, séparées par un **liseré
   vertical constant** entre chaque paire d'options adjacentes, y compris
   quand l'une des deux est sélectionnée.
   ⚠️ Le liseré est un **élément à part** (un `<span>` dédié, sans rayon de
   bordure), pas une bordure posée sur le bouton arrondi lui-même : une
   bordure `border-l` sur un bouton `rounded` se courbe aux coins au lieu de
   rester parfaitement droite sur toute la hauteur.
   L'option choisie est **surlignée sur toute sa case** — fond, ombre **et
   bordure de la couleur d'accent**, pas juste un fond légèrement teinté (le
   ton « accent-soft » du thème sombre est trop proche du fond du contrôle
   pour se voir tout seul). Choisi **avant** de lancer la recherche, pas
   seulement un tri après coup :
   - **Efficience** (par défaut) — pas de biais particulier, la mesure
     choisie globalement (Efficience ou Score SW, voir
     [compte/runes.md](../compte/runes.md)).
   - **Dégâts** — considère ATQ, Taux Crit et Dmg Crit **ensemble** (une
     seule formule d'espérance, pas un choix entre plusieurs hypothèses de
     critique) : `ATQ × (1 + (Taux Crit/100) × (Dgts Crit/100))`. ⚠️ **Taux
     Crit plafonné à 100 % DANS la formule** (`Math.min(cr, 100)`), même si le
     total brut d'un build le dépasse (voir Conditions — `computeStats`
     n'écrête jamais le total lui-même) : au-delà de 100 %, le surplus ne
     rapporte plus rien en jeu, donc pas plus de dégâts espérés dans ce
     calcul non plus. Sans ce plafond, un build à 110 % de Taux Crit brut
     ressortirait avec PLUS de dégâts espérés qu'un build à 100 % pile,
     alors que les deux critiquent en réalité aussi souvent l'un que
     l'autre — couvert par un test dédié
     ([tests/rune-optim.test.ts](tests/rune-optim.test.ts)).
   - **PV effectifs** — considère PV et DEF ensemble.
   - **Vitesse** — VIT seule.
   ⚠️ Le choix influence **deux choses**, pas une seule : il élargit le
   budget de rétention du pré-filtrage sur les stats propres à l'objectif
   (voir « Algorithme »), pour qu'elles aient une vraie chance de survivre
   avant même que la recherche ne démarre — **et** il fixe le tri par défaut
   des résultats (peut être changé après coup, voir section Résultats).
6. **Conditions** — les 8 stats (`RECO_STATS`) : PV, ATQ, DEF, VIT, Taux
   Crit, Dmg Crit, RES, Précision. Chaque stat porte **deux champs, minimum
   et maximum**, tous deux facultatifs — **champ vide = pas de contrainte**
   sur ce côté (pas de case à cocher séparée : la présence d'une valeur EST
   la décision).
   - **Interrupteur « Stats de base exclues »** (`<Switch>`, même composant
     que « Garder mes données » du menu ⚙ — remonté dans
     [Switch.tsx](src/components/Switch.tsx), voir [README.md](../README.md))
     au-dessus de la grille, **activé par défaut** : n'affecte **que** PV,
     ATQ, DEF et VIT — ces 4 stats ont une base qui grandit avec le
     niveau/l'éveil et que les runes viennent gonfler en % ou en plat, donc
     raisonner « bonus apporté par l'équipement » a un sens. Activé, le champ
     porte sur ce que l'équipement doit apporter **au-dessus de la base
     nue** du monstre choisi ; désactivé, il porte sur le **total**.
     ⚠️ **Taux Crit, Dmg Crit, RES et Précision restent TOUJOURS en total**,
     quel que soit ce réglage — elles partent d'une petite valeur d'éveil
     fixe plutôt que d'une base qui grandit, donc « bonus vs total » n'a pas
     le même sens pour elles ; leur champ **évolue selon la valeur d'éveil
     du monstre** (repère affiché en `placeholder`), pas selon ce réglage.
   - ⚠️ **La valeur stockée ne change jamais de nature** : c'est une lecture
     dérivée (`total − base`) qui est recalculée à l'affichage, pas une
     conversion appliquée une fois puis oubliée. Désactiver l'interrupteur
     change donc immédiatement les 4 champs concernés (sans perte), et
     **saisir** une valeur pendant qu'il est activé l'enregistre convertie en
     total (`base + valeur saisie`).
   - Sans monstre sélectionné, la base vaut 0 : les deux lectures coïncident.
   - ⚠️ **En lecture Total, aucun champ ne descend sous la base nue du
     monstre choisi** : même sans la moindre rune, le total vaut déjà au
     moins ça. En lecture « bonus », aucun ne descend sous 0.
   - ⚠️ **Taux Crit, RES et Précision sont plafonnés à 100 %** sur les deux
     champs — leur effet en jeu ne va jamais au-delà, même si la somme brute
     des runes dépasse. **Dmg Crit n'a pas ce plafond** (200 %+ courant), les
     autres stats non plus. Ce plafond ne concerne **que la saisie** : la
     **recherche**, elle, ne doit surtout pas exclure un build dont la somme
     brute dépasse 100 % — c'est un résultat légitime (une marge de sécurité
     contre la précision/résistance adverse, par exemple). `computeStats`
     n'écrête jamais rien ; seuls les champs de saisie sont bornés.
   - **Largeur des champs alignée pixel pour pixel** entre les 8 stats, via
     `NumberField`, prop `boxWidth` (`w-24` sur les 16 champs de la grille) :
     la largeur **totale** du contrôle (boutons + champ + suffixe compris)
     est fixée d'avance, et c'est le champ texte lui-même qui devient
     flexible (`flex-1`) pour absorber la différence quand un suffixe `%`
     est présent. ⚠️ Une simple réduction de la largeur du champ texte
     (essayée d'abord) ne suffisait **pas** : le suffixe prend de la place
     EN PLUS dans le contrôle, donc à largeur de texte égale un champ avec
     `%` reste toujours plus large qu'un champ sans — seule une largeur
     totale fixée en amont garantit l'alignement.
   - **« Réinitialiser les conditions »** en bas à droite de la grille : vide
     en un clic les 16 champs (les 8 minimums et les 8 maximums), sans
     toucher à « Stats de base exclues » ni aux autres réglages de l'écran
     (set, statistique principale, objectif…) — seules les VALEURS saisies
     sont concernées.
7. **« Explorer tout l'inventaire »** — case à cocher, **décochée par
   défaut** (voir « Exclusion des runes » ci-dessous).
8. **« Options avancées »** (repliées par défaut) : **pré-filtrage par
   emplacement**, en **presets** (`<Segmented>`) plutôt qu'un curseur libre —
   défaut **Moyen**. Voir « Interruption » pour ce que chaque niveau change
   concrètement. Pas de réglage de temps limite : voir « Interruption ».
9. **Estimation du nombre de builds** — dès qu'un monstre et un set sont
   choisis, une ligne affiche le produit des pools filtrés par emplacement
   (`estimateSearchSpace` dans
   [runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), recalculée en direct à
   chaque changement de critère. ⚠️ **Un ordre de grandeur, pas le nombre
   réellement exploré** : le meet-in-the-middle n'énumère jamais ce produit
   en entier (voir « Algorithme ») — c'est un repère pour juger si les
   critères actuels sont trop larges ou trop stricts, pas une promesse de
   temps de calcul.
10. **« Rechercher »** — lance le calcul. Changer un des critères ci-dessus
    ne relance **rien automatiquement** : il faut recliquer, comme
    « (Ré)analyser mes decks » dans les recommandations de siège (« rien
    n'est confronté par défaut »). Un bouton **« Arrêter »** apparaît à côté
    pendant le calcul — il interrompt la recherche et garde le **meilleur
    trouvé jusque-là**, plutôt que de tout perdre (voir « Interruption »).
11. **Barre de progression** — pendant le calcul, une barre qui se **remplit
    progressivement** (pas une roue qui tourne), avec le nombre de
    combinaisons déjà examinées et déjà trouvées. Voir « Interruption » pour
    comment le pourcentage est estimé.
12. **Résultats** — jusqu'à 20 combinaisons affichées, chacune : rang, les
    sets obtenus, puis une **ligne** : le **panneau de stats** à **gauche** —
    **`StatPanel.tsx`, le même composant** que dans « Équipement actuel »
    (extrait de `MonsterGear.tsx` à son deuxième usage, voir
    [README.md](../README.md)) : mêmes couleurs, même bascule **base+bonus ↔
    total au clic**, sa colonne TOTAL suivant elle aussi le réglage global
    « Overcap Taux Crit/RES/Précision » du menu ⚙ (désactivé, elle s'arrête à
    100 % pour ces trois stats même si le total brut du build le dépasse) —
    et à **droite**, les **artéfacts** (fixes, voir « Algorithme ») et les 6
    runes sur une **roue** (`ArtifactSlots.tsx`/`RuneWheel.tsx`) — la **même
    forme** que l'affichage de l'équipement actuellement équipé (RTA/Siège/
    « Équipement actuel » ci-dessus), mais à une **échelle réduite**
    (`scale=0,45`, contre `1` en pleine taille) et **côte à côte avec les
    stats plutôt qu'empilés au-dessus**, pour tenir dans une carte de résultat
    compacte sans l'alourdir ; **cliquables** (voir plus bas). Puis la valeur
    **moyenne par rune** dans la mesure choisie — comparer des builds dans la
    même unité que la carte d'une rune individuelle, plutôt qu'un total qui
    ne se lit pas d'un coup d'œil.
    ⚠️ **Deux cartes par ligne**, calibré exprès (`scale=0,45`, largeur de
    grille `minmax(360px, …)`) : à cette taille, deux cartes de 360px + le
    creux entre elles (12px) tiennent tout juste sous les 768px du conteneur
    (`max-w-3xl` de `OptimizerSection.tsx`) — un résultat plus compact et plus
    rapide à comparer d'un coup d'œil qu'une seule carte pleine largeur par
    ligne.
    ⚠️ **La bascule base+bonus ↔ total ne déplace jamais les artéfacts, la
    roue ou la relique voisins** : `StatPanel` a une **largeur fixe**
    (`w-[200px]`), pas `w-fit` — en mode Total, une seule colonne remplace les
    deux colonnes base+bonus, et sans largeur fixe l'encadré changeait de
    taille au clic et poussait ses voisins d'un côté à l'autre.
    ⚠️ **Recalculée à l'affichage** (`candidateMetricTotal` dans
    [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), à partir des VRAIES
    runes) plutôt que lue depuis `BuildCandidate.effTotal` : ce champ est
    figé dans la mesure Efficience/Score active AU MOMENT DE LA RECHERCHE
    (voir `SearchParams.metric`) — si l'utilisateur bascule le réglage (menu
    ⚙) APRÈS avoir cherché, sans relancer, `effTotal` reste dans l'ancienne
    mesure alors que le popover d'une rune individuelle, lui, se recalcule
    toujours en direct. Un affichage qui aurait continué à lire `effTotal`
    tel quel se serait retrouvé incohérent avec les runes qu'il prétend
    résumer — bug signalé, corrigé, et couvert par un test dédié
    ([tests/rune-optim.test.ts](tests/rune-optim.test.ts) : la fonction ne
    doit JAMAIS lire `effTotal`, vérifié avec un `effTotal` délibérément
    faux dans le candidat de test). Même correctif appliqué au tri « Trier
    par efficience » (voir plus bas). Un sélecteur
    **« Trier par »** re-trie **côté client, instantanément**, sans relancer
    la recherche : le moteur a déjà calculé les stats complètes de chaque
    combinaison retenue. Initialisé sur l'objectif choisi avant la
    recherche, il reste ensuite libre. Deux groupes d'options :
    - **Stats** : les 8 stats brutes.
    - **Objectifs** : les 4 mêmes choix qu'à l'étape 5 (Efficience, Dégâts,
      PV effectifs, Vitesse) — calculés à l'affichage depuis le candidat déjà
      connu (`objectiveScore` dans
      [runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), pas recalculés par le
      moteur.
    - **Cliquer sur une rune** d'un résultat ouvre le **même popover** que
      dans Mon compte → Runes (`DetailPopover` + `RuneDetailBox`, ancré sur
      la rune cliquée) — les runes d'un candidat sont de vraies runes du
      compte, autant pouvoir les inspecter sans aller les rechercher
      ailleurs. La rune dont le popover est ouvert porte le **même halo
      orange** que la sélection dans MonsterGear (`brightness` + `drop-shadow`
      sur son cadre, voir `RuneWheel.tsx`) — pas un style à part, la roue de
      résultat se comporte comme n'importe quelle roue de l'app. Une seule
      rune ouverte à la fois, **parmi TOUS les résultats affichés** (pas
      seulement dans la même carte) : cliquer une autre rune ferme celle déjà
      ouverte, exactement comme dans Mon compte → Runes → Optimisation.
      ⚠️ L'identité d'une rune ouverte (et donc du halo) combine le candidat ET
      le slot (`BuildCandidateCard.tsx`), pas seulement l'id de la rune : la
      même rune peut apparaître dans plusieurs candidats affichés à la fois,
      et ne doit ouvrir qu'UNE instance à la fois.
      ⚠️ **`RuneWheel`/`ArtifactSlots` gèrent le détail de deux façons
      différentes selon l'appelant** : MonsterGear l'affiche EN LIGNE sous la
      roue (pas de `renderOverlay`, juste `onSelectRune`/`isSelected`) ;
      `BuildCandidateCard` passe un `renderOverlay` qui ancre un
      `DetailPopover` flottant sur CHAQUE rune/artéfact — une carte de
      résultat, dans une grille compacte, n'a pas la place de pousser son
      contenu vers le bas comme le fait la fiche pleine page.
      ⚠️ **Le popover passe toujours au premier plan, quel que soit son
      voisinage** : sans z-index, deux éléments `position:absolute` frères
      s'empilent par simple **ordre du DOM**, pas par position à l'écran — le
      popover d'une rune pouvait donc se retrouver visuellement recouvert par
      le cadre d'une autre rune de la même roue rendue plus tard, ou par une
      carte de résultat voisine plus loin dans la grille, même sans
      chevauchement apparent. Corrigé en promouvant, UNIQUEMENT tant qu'un
      popover y est ouvert : le wrapper de la rune/l'artéfact concerné
      (`z-10`, dans `RuneWheel.tsx`/`ArtifactSlots.tsx`) **et** la carte de
      résultat entière qui le contient (`relative z-10`, dans
      `BuildCandidateCard.tsx`) — deux niveaux, parce qu'un popover doit
      gagner à la fois contre ses voisins immédiats (autres runes/artéfacts de
      la même carte) et contre les autres cartes de la grille.

⚠️ **Rien n'est appliqué au compte.** L'outil est en lecture seule et
purement indicatif, comme le reste de SW Forge (aucune écriture vers le
jeu) : c'est au joueur de re-runer dans Summoners War.

## Exclusion des runes déjà portées ailleurs

Par défaut, la recherche **exclut** les runes déjà portées par un **autre**
monstre de la box : elle ne propose que des combinaisons réellement
montables sans dérunir quelqu'un. Les runes déjà portées par le monstre
**choisi** (n'importe lequel de ses exemplaires) restent disponibles, elles
sont « à soi ».

**« Explorer tout l'inventaire »** lève cette contrainte : la recherche
porte alors sur l'**inventaire entier**, y compris des runes qu'il faudrait
retirer d'un autre monstre pour composer le build proposé — un outil
exploratoire (« si je pouvais réassigner librement mes runes »).

⚠️ **Le moteur est générique**, pas couplé à la box : `searchBuilds` ne
connaît qu'un `pool` de runes déjà filtré. `excludedRuneIds` (dans
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts)) est la fonction **spécifique
à la box** qui construit cet ensemble d'exclusion aujourd'hui — pensée pour
qu'un autre appelant construise le sien.

> **Prévu, pas construit** : brancher l'outil dans RTA (pool RTA, dont le
> runage est **séparé** du reste — voir
> [shared/import-compte.md](../shared/import-compte.md)) et dans le Siège
> (pool des decks de défense), avec la possibilité d'exclure des
> runes/monstres **ciblés** en plus de « tout » ou « rien ». L'architecture
> (pool + exclusion calculée par l'appelant) ne s'y oppose pas, mais rien de
> tout ça n'est implémenté pour l'instant.

## Interruption — filet de temps, pré-filtrage et arrêt manuel

Trois façons dont une recherche s'arrête **avant** d'avoir tout exploré, en
plus du plafond de candidats collectés :

- **Filet de temps** (`maxMs`) — **fixe, non réglable** : 10 minutes
  (`HARD_TIMEOUT_MS` dans `OptimizerSection.tsx`). ⚠️ Ce n'est pas pensé
  comme un réglage à ajuster : c'est une garde-fou en cas de recherche
  anormalement longue, assez large pour ne jamais couper une recherche
  légitime au preset Extrême sur un gros compte (voir « Validation grandeur
  nature »). Le vrai moyen de reprendre la main **avant** ces 10 minutes
  reste le bouton « Arrêter », pas un réglage de durée.
- **Pré-filtrage par emplacement** (`slotFilterCap`) — **presets**, pas un
  nombre libre, calibrés par mesure sur un vrai compte (voir « Validation
  grandeur nature ») :

  | Preset | `slotFilterCap` | Coût |
  |---|---|---|
  | Bas | 40 | Rapide — suffit la plupart du temps |
  | Moyen (défaut) | 80 | Un peu plus large, coût encore modéré |
  | Haut | 150 | Nettement plus de runes considérées, recherche plus lente |
  | Extrême | 300 | La valeur mesurée nécessaire pour retrouver un build réel sur un très gros compte — peut prendre plusieurs dizaines de secondes |

  ⚠️ Défaut passé de Bas à **Moyen** : Bas (40) s'est montré trop juste sur
  un vrai gros compte (voir « Validation grandeur nature », premier tour).

- **Bouton « Arrêter »** — l'utilisateur reprend la main quand il l'estime
  suffisant, sans attendre un plafond. Contrairement à un simple
  `worker.terminate()` (qui perdrait tout le travail déjà fait),
  l'arrêt est **coopératif** : le moteur tourne comme un **générateur**
  (`searchBuildsSteps`) qui rend la main tous les 500 paires évaluées ; le
  Worker vérifie à chaque point de passage si un message d'arrêt est arrivé,
  et si oui, renvoie le **meilleur trouvé jusque-là** au lieu de tout jeter.
  ⚠️ Un `terminate()` pur et simple aurait été plus simple à écrire, mais
  aurait vidé le bouton de son intérêt : on l'appuie précisément pour
  **garder** ce qui a déjà été trouvé, pas pour tout perdre.

Les cas de troncature se distinguent dans le message affiché : un arrêt
manuel dit « voici le meilleur trouvé jusque-là » (un choix assumé), un
plafond atteint dit « resserre tes critères » (une limite subie) — voir la
section Résultats plus haut.

### Barre de progression

Le Worker ([runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts))
poste des messages de progression **entre** les points de passage du
générateur, **throttlés au temps écoulé** (au plus un tous les 150 ms) pour
ne jamais flooder le fil principal même quand l'élagage va très vite. Chaque
message porte `explored`, `found` et un `pct` **approximatif** : le plus
avancé des trois budgets qui peuvent chacun déclencher la fin de la
recherche —

```
pct = max(explored / maxNodes, found / maxCollected, tempsÉcoulé / maxMs)
```

⚠️ **Approximatif par construction**, pas une mesure exacte d'avancement :
le meet-in-the-middle ne consomme pas ces trois budgets à un rythme
constant d'une recherche à l'autre (ça dépend de combien de paires de
compartiments passent le pré-filtre de faisabilité), donc la barre peut
accélérer ou ralentir en cours de route plutôt que progresser
régulièrement. C'est délibérément le budget de **candidats collectés**
(`maxCollected`) qui domine le plus souvent en pratique — voir
« Vérification ».

## Validation grandeur nature — ce qu'un vrai compte a révélé

Un contributeur a signalé être bridé par le message de troncature sur son
compte réel (~4 400 runes, 600 à 1000 par emplacement). Plutôt que de
deviner, la même discipline que pour le calibrage précédent : retrouver un
monstre réel dans son export (Lushen, deck d'offense n°15), reconstruire ses
runes exactes via le moteur (`computeStats` retombe pile sur ses 8 stats
annoncées — **écart nul**, ce qui valide au passage tout le pipeline de
calcul sur des données réelles), puis chercher à RETROUVER ce runage avec
plusieurs stratégies, ses stats réelles servant de critères. Deux tours
successifs de mesure, chacun ayant trouvé une cause réelle avant de la
corriger — voir `.claude/skills/algo-verify/SKILL.md`.

### Premier tour — le choix d'algorithme

| Stratégie | Pool | Temps | Paires explorées | Runage exact retrouvé |
|---|---|---|---|---|
| Brute-force restreinte (top 12/emplacement) | 12⁶ ≈ 3 M | 2,4 s | 2 985 984 | ✅ oui |
| **Meet-in-the-middle**, même pool restreint (contrôle) | 12⁶ ≈ 3 M | **0,13 s** | **49 668** | ✅ oui |
| Backtracking séquentiel (sans MITM), pool réel complet | ~700/emplacement | 2,6 s (plafond atteint) | 5 000 000 | ❌ non |
| Meet-in-the-middle (production), pool réel complet | ~700/emplacement | 14,7 s (non tronqué) | 2 490 384 | ❌ non |
| Brute-force sur le pool réel complet | ~700⁶ ≈ 1,5 × 10¹⁷ | — | — | hors de portée (pour mémoire) |

**Meet-in-the-middle confirmé juste et nettement meilleur** : sur un pool
identique, il retrouve le même runage que la brute-force en **60× moins de
paires examinées** et **~18× plus vite**. Mais sur le pool réel complet,
MITM et le backtracking séquentiel échouent tous les deux à retrouver le
runage, pour la **même raison** : **3 des 6 runes réelles de Lushen étaient
écartées par le pré-filtrage** (`slotFilterCap=40`) avant même que la
recherche ne commence. Ce n'était donc **pas** un problème de stratégie de
recherche.

### Deuxième tour — la mémoire, puis le regroupement

Relever `slotFilterCap` pour que les 6 runes réelles survivent au
pré-filtrage (il fallait ≈100) a révélé un second problème, plus grave que
la lenteur : le moteur d'alors matérialisait **tous** les combos d'une
moitié en mémoire d'un coup (tableau de `cap³` objets, pas les « tableaux
typés » que [calcul-runes.md §6](../compte/calcul-runes.md) anticipait) — à
`cap=80`, le processus **plantait par épuisement mémoire** (~4 Go,
`Ineffective mark-compacts near heap limit`).

**Correctif** : les compartiments sont désormais construits **en flux** —
chaque combinaison d'une moitié est évaluée une fois, puis retenue ou
**immédiatement jetée** selon son mérite (`insertBounded`,
[runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), sans jamais passer par un
tableau intermédiaire de `cap³` éléments. La mémoire dépend maintenant du
nombre de compartiments × leur taille max (`BUCKET_CAP`), plus jamais du
cube du pré-filtrage. À `slotFilterCap=80` avec ce correctif : **plus de
plantage**, la recherche se termine (42 s, non tronquée) — mais toujours
« exact=non ».

⚠️ **Une combinaison dont les 6 runes individuelles survivent au
pré-filtrage n'est pas automatiquement retrouvée pour autant.** Le
regroupement par compte de pièces (voir « Algorithme ») rassemble parfois
des **dizaines de milliers** de combinaisons de 3 runes dans le **même
compartiment** (le combo de sets « évident » d'un vrai build en fait
partie) — la moitié réelle de Lushen doit alors se classer dans le
`BUCKET_CAP` premières par pertinence pour ne pas être jetée à son tour,
même si chacune de ses 3 runes, prise isolément, avait survécu à son propre
pré-filtrage de slot.

Mesuré à `slotFilterCap=80` (avec la contrainte de statistique principale de
Lushen posée — ATQ% en 2, Dmg Crit en 4, ATQ% en 6) :

| `BUCKET_CAP` | Temps | Paires explorées | Runage exact retrouvé |
|---|---|---|---|
| 300 (valeur initiale du correctif mémoire) | 14,3 s (non tronqué) | 330 600 | ❌ non |
| 600 | 16,5 s | 1 095 000 | ✅ oui |
| 1000 | 20,0 s | 2 631 000 | ✅ oui |
| 3000 | 49,8 s | 15 934 704 | ✅ oui |

**Retenu : `BUCKET_CAP = 600`** — le plus bas des trois qui retrouve le
runage exact, pour un temps de recherche qui reste raisonnable.

### Suite — bucketCap paramétrable et tas binaire (mesure de suivi)

`SearchParams.bucketCap` (surcharge optionnelle de `BUCKET_CAP`, défaut
inchangé) a été ajouté **uniquement pour la mesure** — jamais exposé dans
l'UI — afin de rejouer le moteur réel, déjà vérifié, à différents plafonds
sans reconstruire une seconde implémentation qui risquerait de diverger.
[scripts/benchmark-bucket-retention.ts](scripts/benchmark-bucket-retention.ts)
(`npm run benchmark:bucket-retention`) fait varier `bucketCap` sur des pools
synthétiques de 80 runes/slot (la taille réelle après le preset « Moyen »,
défaut de l'app), à budget de recherche identique par ailleurs.

⚠️ **Résultat inattendu** : sous les plafonds de production D'ALORS
(`maxCollected` = 5000, `maxNodes` = 400 000 — depuis relevés à 100 000 /
4 000 000, voir plus bas « Suite — augmenter le budget de recherche »), le
meilleur candidat trouvé est **rigoureusement identique**
quel que soit `bucketCap` testé (100 à 6000), sur les 4 profils mesurés —
`maxCollected` (5000 candidats valides) est systématiquement atteint **avant**
qu'un compartiment n'approche même le plus petit plafond testé (100). Le seul
effet observé de relever `bucketCap` est un ralentissement (jusqu'à ~5-6× plus
lent à 6000 qu'à 100, pour un résultat identique). À budget de recherche
volontairement DESSERRÉ (pour isoler `bucketCap` seul), relever le plafond
au-delà de 100-300 fait même parfois légèrement **reculer** le meilleur
trouvé — parce que des compartiments plus gros consomment le budget de PAIRES
explorées plus vite, au prix d'explorer MOINS de compartiments différents
pour le même budget, alors que **l'ordre d'exploration des compartiments
reste arbitraire** (limite déjà connue, voir plus bas).
⚠️ **Ne pas sur-interpréter** : mesuré à `slotFilterCap = 80` (preset
« Moyen »), pas dans les conditions exactes de la « Validation grandeur
nature » ci-dessus (un vrai gros compte, où c'était `slotFilterCap` qui posait
initialement problème, pas `BUCKET_CAP`) — cette mesure ne remet donc pas en
cause `BUCKET_CAP = 600` en l'état, elle indique seulement qu'à cette échelle,
la rétention par compartiment n'est plus le facteur limitant observé — ce
n'est pas une preuve que ça resterait vrai sur un compte exceptionnellement
gros ou un profil de recherche non testé ici.

Cette même mesure a aussi révélé un vrai goulot de PERFORMANCE (indépendant de
la question de rétention) : la construction des compartiments à `bucketCap`
élevé (l'ancienne insertion triée, `splice`, en O(taille) par insertion) a
pris **~80 s** à `bucketCap = 50 000`, bien avant même que la recherche ne
commence — `maxMs` n'étant vérifié que dans la boucle d'appariement, jamais
pendant la construction des compartiments. **Corrigé** : les compartiments
sont maintenant construits via un **tas binaire à capacité fixe** (`heapPush`
dans [runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), en O(log `bucketCap`)
par insertion/éviction au lieu de O(taille) — un seul tri final par
compartiment restitue le même contrat qu'avant (`combos` trié décroissant).
Même scénario, après correctif : **~4 s** à `bucketCap = 50 000`, contre
~80 s avant. `BUCKET_CAP = 600` (le défaut réel) n'était pas dans la zone
pathologique, donc ce correctif n'a **aucun** effet observable en usage
normal aujourd'hui — mais il retire un vrai risque si `bucketCap` devait un
jour être relevé.

### Conclusion générale

- Le choix de l'algorithme (meet-in-the-middle) était déjà le bon —
  confirmé et non remis en cause par ce qui suit.
- Le vrai obstacle avait **deux couches**, découvertes l'une après l'autre en
  mesurant plutôt qu'en devinant : d'abord le pré-filtrage **par slot**, puis
  — une fois celui-ci desserré — le regroupement **par compartiment**. Les
  deux sont maintenant réglables (`slotFilterCap`, en presets) ou recalibrés
  (`BUCKET_CAP`), et le moteur ne risque plus de plantage mémoire en
  poussant l'un des deux.
- La **contrainte de statistique principale** (slots 2/4/6) aide aussi
  concrètement : en réduisant le pool brut avant tout le reste, elle rend
  chacune des deux couches ci-dessus moins sujette à l'écrasement par des
  runes hors sujet.

## Algorithme (résumé fonctionnel)

Calcul pur dans [runeBuildOptim.ts](src/lib/runeBuildOptim.ts), exécuté dans
un **Web Worker** (premier de l'app) pour ne jamais geler l'interface.
Lancer une **nouvelle** recherche (paramètres changés) termine sèchement
celle en cours (`cancel`, `worker.terminate()`) — sa réponse ne doit pas
écraser la nouvelle demande. Arrêter la recherche **en cours** pour en garder
le résultat passe par un canal différent, coopératif : voir « Interruption »
plus haut.

- **Jamais de brute-force.** *Meet-in-the-middle* : les 6 emplacements sont
  scindés en **deux moitiés de 3**, chacune énumérée depuis le pool déjà
  pré-filtré. Les moitiés sont regroupées par le **compte exact** de pièces
  de chaque set demandé qu'elles apportent (+ jokers Intangible) : deux
  moitiés dont les comptes s'additionnent pour satisfaire le combo peuvent
  être appariées **sans jamais énumérer le produit complet** des runes
  individuelles.
  ⚠️ Un *branch-and-bound* linéaire sur les 6 emplacements (la première
  version) ne détecte un combo de sets impossible qu'une fois les 6 runes
  choisies — il gaspille donc des branches entières. Le regroupement par
  compte élimine ce gaspillage, et c'est mesuré (voir « Validation grandeur
  nature »).
- **Statistique principale imposée (slots 2/4/6)** : appliquée **avant**
  tout le reste, dans la construction même du pool par slot — un candidat
  dont la mainstat n'est pas dans la liste autorisée n'entre jamais en jeu.
- **Deux élagages SÛRS, ensuite — jamais un faux rejet, contrairement au
  pré-filtrage heuristique qui suit** (`pruneDominated` puis
  `eliminateInfeasible`, avant même `filterSlot`) :
  - **Dominance** : une rune strictement moins bonne qu'une autre du MÊME
    slot ne sert jamais à rien — si B égale ou dépasse A sur pct **et** flat
    de chaque stat (avantage strict quelque part), tout build valide utilisant
    A resterait valide, et au moins aussi bon, en remplaçant A par B.
    Comparaison limitée aux runes de **même set** (ou toutes deux hors du
    combo demandé) : comparer des sets différents pertinents pour le combo
    ferait perdre une pièce essentielle au profit d'une rune aux stats
    brutes meilleures mais inutile pour le combo. ⚠️ **Sur une stat
    PLAFONNÉE** (un maximum est demandé dessus), le sens s'inverse : plus
    n'est PAS toujours sans risque (ça peut faire dépasser le plafond), donc
    seule l'égalité stricte y est sûre à comparer — un piège identifié et
    corrigé en cours de route (voir `isDominated` dans
    [runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), non couvert par le test
    différentiel existant (qui n'exerce pas `maxStats`) mais couvert par un
    cas écrit à la main depuis. Comparaison bornée à `DOMINANCE_MAX_POOL`
    (2000) par slot : O(n²), négligeable aux tailles réelles, mais sans
    borne un `exploreAll` sur un très gros compte pourrait coûter cher pour
    un gain marginal — au-delà, on renonce à cet élagage plutôt que de
    ralentir.
  - **Faisabilité** : une rune ne peut jamais entrer dans un build valide si,
    même avec le **meilleur trouvé dans le pool RÉELLEMENT possédé** (pas une
    borne théorique du jeu) de chacun des 5 autres emplacements, un minimum
    demandé reste hors de portée — ou si elle dépasse déjà, À ELLE SEULE, un
    maximum demandé (les autres emplacements ne peuvent qu'AJOUTER, jamais
    retirer). C'est la réponse directe à un exemple concret remonté :
    « le maximum de VIT sur une rune est ~37-42, ça devrait déjà éliminer des
    runes mathématiquement incapables d'atteindre le minimum demandé ». Plutôt
    que coder cette borne théorique du jeu en dur, `eliminateInfeasible`
    calcule le MEILLEUR RÉELLEMENT POSSÉDÉ par slot (`computeSlotMaxBounds`) —
    plus étroit que la borne théorique, donc plus efficace, et tout aussi sûr
    puisque c'est un maximum OBSERVÉ, pas estimé.
- **Pré-filtrage heuristique par emplacement**, ensuite (`filterSlot`) :
  chaque slot ne garde qu'un nombre borné de runes candidates
  (`slotFilterCap`) — celles du (ou des) set(s) recherché(s) (`matches`), les
  meilleures toutes provenances par pertinence vis-à-vis des minimums
  demandés (`scored.slice(fillCap)`), **une tranche garantie de runes HORS du
  set demandé** (`offSet`, même taille que la précédente — voir « Limites
  connues » pour l'incident qui l'a motivée), **et** le meilleur du slot sur
  **chacune des 8 stats individuellement** (`PER_STAT_KEEP`), même sans
  minimum demandé dessus (pour que le tri après coup reste honnête sur un
  critère non contraint).
  ⚠️ **Budget élargi pour l'objectif choisi** (`PER_STAT_KEEP_OBJECTIVE`,
  24 au lieu de 6) : les stats propres à l'objectif de recherche (ATQ/Taux
  Crit/Dmg Crit pour Dégâts, PV/DEF pour PV effectifs, VIT pour Vitesse — «
  Efficience » n'en a aucune, c'est déjà la lentille par défaut) reçoivent un
  budget de rétention nettement plus large que les autres, pour qu'elles
  aient une vraie chance de survivre au pré-filtrage. C'est ce choix, fait
  **avant** de lancer la recherche, qui « oriente le type de rune étudié ».
  ⚠️ **Heuristique** malgré tout : au-delà de ce pré-filtrage, le résultat
  est « le meilleur trouvé parmi le pool retenu ».
- **`estimateSearchSpace`** (exporté) réutilise EXACTEMENT le même
  pré-filtrage (`buildFilteredBySlot`, factorisé pour être partagé) pour
  calculer, avant de lancer la recherche, le produit des tailles de pool par
  slot — l'estimation affichée dans l'UI (voir « Écran »). Les deux voient
  donc toujours le même pool ; l'estimation ne peut pas mentir par
  divergence avec ce que la recherche fera réellement.
- **Compartiments construits EN FLUX, bornés en mémoire** (`BUCKET_CAP`,
  600, surchargeable via `SearchParams.bucketCap` — mesure uniquement, jamais
  exposé dans l'UI) : chaque combinaison d'une moitié est évaluée puis, selon
  son mérite, retenue ou **immédiatement jetée** — jamais de tableau
  intermédiaire de `cap³` éléments. C'est ce qui a remplacé un risque de
  plantage mémoire par un coût borné et prévisible (voir « Validation
  grandeur nature »). Les bornes d'élagage (`maxPct`/`maxFlat` par
  compartiment) s'étendent à partir de **toute** combinaison rencontrée, même
  celles finalement jetées — rester large ici ne coûte rien et ne peut jamais
  écarter une paire à tort. ⚠️ **Rétention via des tas binaires** (`heapPush`,
  généralisé pour accepter un score explicite par tas), pas une liste triée
  par insertion (`splice`, O(taille) par insertion — un vrai coût mesuré à
  `bucketCap` élevé, voir « Suite — bucketCap paramétrable et tas binaire ») :
  O(log cap) par insertion/éviction. ⚠️ **Plusieurs tas EN PARALLÈLE par
  compartiment, pas un seul** — un générique (`relevanceScore`), une tranche
  combinée si des minimums sont posés, et une par stat à protéger
  (`retentionKeys`) — fusionnés (dédupliqués) et triés UNE SEULE fois par
  compartiment à la fin. Voir « Suite — rétention par tranches » : un score
  scalaire unique écartait des builds spécialisés valides, confirmé sur un
  vrai compte.
- **Compartiments (pas seulement leurs demi-builds) triés par potentiel
  décroissant** avant l'appariement — le meilleur `relevanceScore` que
  chacun contient. Remplace l'ordre d'arrivée (arbitraire, celui de la
  première combinaison de sets rencontrée en balayant les triples) : les
  paires les plus prometteuses sont désormais explorées EN PREMIER, ce qui
  compte dès que `maxCollected`/`maxNodes` interrompt la recherche avant
  d'avoir tout exploré — le cas courant en pratique (voir « Suite — ordre
  d'exploration des paires… »).
- **Élagage de FAISABILITÉ DE SET, précoce** (pendant la génération d'une
  moitié, pas seulement à l'appariement des compartiments) : pour chaque set
  demandé, si le meilleur cas — reste de cette moitié + meilleur de l'autre
  moitié + un crédit de joker volontairement généreux — ne peut plus
  atteindre le compte requis, la branche est coupée avant même de choisir le
  3ᵉ slot. Complémentaire du « Groupage par compte de pièces » ci-dessous
  (qui, lui, agit à l'appariement, une fois les demi-builds déjà tous
  générés) — voir « Suite — ordre d'exploration des paires… ».
- **Groupage par compte de pièces sûr, jamais approximatif dans le sens
  dangereux** : le regroupement ne connaît que des comptes agrégés (pas les
  runes réelles), ce qui l'empêche de voir qu'un joker pourrait, dans la
  vraie combinaison, être disputé par une rune d'un set **hors combo
  demandé** (ex. un « Shield » isolé). C'est volontairement **plus
  optimiste** que la réalité, mais seulement dans le sens qui ne casse rien :
  s'il écarte une paire, la vraie combinaison échouerait forcément aussi.
  Chaque candidat qu'il laisse passer est ensuite **revérifié sur les runes
  réelles** (`activeSets`/`missingSets`) avant d'être retenu.
- **Au plus 1 rune Intangible par proposition** : le jeu n'autorise à en
  sertir qu'une seule par monstre (voir
  [compte/calcul-runes.md §5.2](../compte/calcul-runes.md)) — une paire de
  compartiments dont les jokers additionnés dépassent 1 (1+1 réparti sur les
  deux moitiés, ou plusieurs dans une seule) est écartée **avant** d'ouvrir la
  boucle des combinaisons, via `bA.jokers + bB.jokers`, un compte EXACT
  attaché à chaque compartiment (voir `bucketKeyOf`) — jamais un faux rejet.
  Sans ce garde-fou, une combinaison utilisant deux runes Intangible aurait pu
  être proposée : ses stats calculées seraient correctes (`activeSets`
  plafonne lui-même l'effet à 1 joker), mais elle resterait inéquipable en
  jeu.
- **Élagage de faisabilité MIN et MAX, pas d'optimisation vers un seul
  critère** : la recherche collecte un ensemble large mais borné de
  combinaisons valides (jusqu'à `MAX_COLLECTED`, 100 000 — relevé depuis 2000
  puis 5000 après mesure, voir « Vérification »), pour permettre le tri après coup sur
  n'importe quel critère sans recalcul. Le maximum se prête à un
  élagage plus simple que le minimum : une combinaison ne peut qu'AJOUTER en
  complétant les 6 runes (jamais retirer), donc dès qu'un maximum est déjà
  dépassé par la première moitié seule (plus le contexte fixe), aucune
  seconde moitié ne peut plus repasser sous la barre — branche coupée sans
  même ouvrir la boucle de la moitié B.
- **Artéfacts et relique restent fixes** (ceux actuellement équipés) :
  l'outil optimise **uniquement les 6 runes**.
- Toutes les valeurs sont recalculées avec [stats.ts](src/lib/stats.ts)
  (`computeStats`), la même fonction que partout ailleurs dans l'app.
- **Écrit comme un générateur** (`searchBuildsSteps`), pas une seule boucle
  qui tourne jusqu'au bout : il rend un point de passage tous les 500 paires
  évaluées. `searchBuilds` (l'API historique, utilisée par les tests et le
  benchmark) ne fait que le drainer d'un bloc. Le Worker, lui, pilote le
  générateur pas à pas et poste des messages de progression **throttlés au
  temps** entre deux points de passage — voir « Interruption ».

### Vérification

Discipline imposée par
[.claude/skills/algo-verify/SKILL.md](../../.claude/skills/algo-verify/SKILL.md) :
[tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts)
compare le moteur à une référence **naïve et exhaustive** sur des jeux de
runes aléatoires mais déterministes (seed fixe) — même verdict de
faisabilité, aucun faux positif, même optimum exact sur les scénarios non
tronqués. ⚠️ Cette référence a servi de garde-fou lors de l'ajout de la
dominance et de la faisabilité par rune : les 15 scénarios (dont certains
avec `minStats`) sont restés verts après coup, preuve qu'aucun des deux
élagages ne rejette à tort une combinaison réellement valide — un scénario
a même vu le moteur renvoyer MOINS de candidats que la référence brute-force
(285 contre 307) tout en retrouvant EXACTEMENT le même optimum : la
dominance élimine légitimement des combinaisons redondantes (une rune
strictement moins bonne qu'une autre), sans jamais perdre la meilleure.

[tests/rune-optim.test.ts](tests/rune-optim.test.ts) couvre en plus, à la
main, la statistique principale imposée (une rune écartée quand sa mainstat
ne correspond pas, une autre retenue), les conditions maximum (rejet
au-delà, acceptation en-deçà, encadrement exact), et — ajoutés avec les deux
nouveaux élagages — quatre scénarios ciblés : une rune dominée jamais
retenue quand une alternative strictement meilleure existe ; une rune tout
juste hors de portée d'un minimum (frontière exacte : le meilleur cas
possible passe, un cran au-dessus échoue) ; le symétrique côté maximum (une
rune dont la seule contribution dépasse déjà le plafond, écartée même si le
reste du build resterait dessous) ; et un test qui mesure — pas seulement
vérifie l'absence de faux rejet — que l'élagage réduit RÉELLEMENT le travail
exploré (`explored` vaut exactement le nombre de candidats mathématiquement
capables d'atteindre le minimum, pas la taille brute du pool). Ce dernier a
d'ailleurs révélé en cours d'écriture que la dominance et la faisabilité
peuvent se chevaucher sur un même jeu de données mal choisi (deux runes qui
ne diffèrent QUE sur la stat contrainte se dominent l'une l'autre avant même
d'atteindre l'élagage de faisabilité) — les fixtures ont été corrigées pour
isoler chaque mécanisme (une stat annexe, non contrainte, qui varie en sens
opposé empêche la dominance de s'appliquer).

[scripts/benchmark-optim.ts](scripts/benchmark-optim.ts) (`npm run
benchmark:optim`, hors `npm test`) calibre les constantes sur des pools
synthétiques de 500 à 5000 runes — la troncature au plafond de collecte est
SYSTÉMATIQUE (le budget de paires n'est jamais le facteur limitant) sur les
4 scénarios testés, ce qui a d'abord fixé `MAX_COLLECTED = 2000`, puis motivé
son relevé à 5000 après une plainte directe (le message de troncature
revenait trop souvent en usage réel).

⚠️ **Relevé une seconde fois, à 100 000** (`DEFAULT_MAX_NODES` à
4 000 000, ×10) — demande explicite : trouver le meilleur build importe plus
que la vitesse, une recherche allant jusqu'à ~1 minute est acceptable.
Mesuré avant de relever, pas deviné —
[scripts/benchmark-search-budget.ts](scripts/benchmark-search-budget.ts)
(`npm run benchmark:search-budget`), `bucketCap`/`slotFilterCap` fixés aux
valeurs de production (600 / preset testé) et seul `maxCollected` variant :
- Au preset **« Moyen »** (`slotFilterCap = 80`, le défaut réel de l'app) :
  relever `maxCollected` de 5000 à 100 000 a fait passer un scénario à
  contrainte maximum de 95,2 % à 100 % du meilleur trouvé, pour un coût de
  temps négligeable (< 1 s de plus, sur un total < 2 s sur les 4 scénarios
  testés).
- Au preset **« Extrême »** (`slotFilterCap = 300`) : aucun effet mesuré, ni
  sur la qualité ni sur le temps (~22 à 55 s, quel que soit `maxCollected`) —
  à cette échelle, c'est la **construction des compartiments**
  (O(slotFilterCap³), un coût FIXE indépendant de `maxCollected`) qui domine
  largement le temps total, pas le budget de collecte. `maxCollected`
  n'y était déjà pas le facteur limitant, donc le relever n'y coûte
  quasiment rien de plus (le temps total reste dans l'ordre de grandeur déjà
  documenté pour ce preset — « peut prendre plusieurs dizaines de
  secondes »).
Le pire cas mesuré (pool 5000 synthétique, scénario le plus serré, AVEC ce
nouveau plafond) reste largement dans le filet de 10 minutes du Worker (voir
« Interruption ») — `maxMs`/`HARD_TIMEOUT_MS` (déjà 10 min côté UI) n'a pas
eu besoin de changer : c'était `maxCollected`, pas le temps, qui coupait la
recherche court.

[scripts/monster-search-cap-sweep.ts](scripts/monster-search-cap-sweep.ts) et
les autres `scripts/monster-*.ts` (généralisés — prennent monstre/deck en
argument, plus de nom de monstre en dur) rejouent la « Validation grandeur
nature » ci-dessus sur n'importe quel compte réel, pour des ordres de
grandeur qu'un pool synthétique ne reproduit pas forcément.

### Suite — ordre d'exploration des paires, et élagage précoce sur les sets

Deux correctifs supplémentaires, motivés directement par la mesure du budget
de recherche ci-dessus : sur le scénario qui s'améliorait avec un
`maxCollected` plus large, le meilleur build n'apparaissait qu'après avoir
collecté plus de 100 000 candidats — signe que l'ORDRE d'exploration, pas
seulement le budget, avait un vrai defaut.

- **Compartiments triés par potentiel avant l'appariement** (`buildBuckets`
  trie désormais son résultat par le meilleur `relevanceScore` qu'il contient,
  décroissant) : auparavant, `bucketsA`/`bucketsB` restaient dans l'ordre
  d'arrivée (celui de la première combinaison de sets rencontrée en balayant
  les triples), qui ne voulait rien dire. Effet mesuré, avant/après, au
  budget de production (`slotFilterCap=80`) : les 4 scénarios trouvent
  désormais leur meilleur résultat **dès `maxCollected=5000`** (le plus petit
  niveau testé), contre certains qui ne l'atteignaient qu'à 100 000+ ou
  jamais avant ce correctif — un gain plus important que le simple relevé du
  budget de collecte.
- **Élagage précoce sur les sets, pendant la génération d'une moitié**
  (`buildBuckets`, avant même d'ouvrir la boucle du 3ᵉ slot) : pour chaque set
  demandé, si même le meilleur cas — le reste de CETTE moitié au mieux + le
  meilleur de L'AUTRE moitié + un crédit de joker VOLONTAIREMENT généreux
  (0 ou 1, jamais plus précis) — ne peut plus atteindre le compte requis, la
  branche est coupée immédiatement, avant de payer le coût d'énumérer le
  3ᵉ slot pour rien. ⚠️ **Le crédit de joker est délibérément trop généreux**
  (accordé indépendamment à chaque set testé, alors qu'un seul joker ne peut
  jamais en aider deux à la fois) — c'est précisément ce qui le rend SÛR :
  plus généreux que la réalité ne peut jamais écarter à tort une combinaison
  valide, seulement échouer à couper une branche qui s'avérera de toute façon
  infaisable à la vérification finale sur les runes réelles
  (`activeSets`/`missingSets`, inchangée). Couvert par deux scénarios dédiés
  dans [tests/rune-optim.test.ts](tests/rune-optim.test.ts) : un où le crédit
  de joker est nécessaire pour ne PAS couper une branche réellement valide,
  et un où deux sets incomplets simultanés (le joker n'aide alors personne,
  voir compte/calcul-runes.md §5.2) confirment que l'élagage précoce reste
  sûr sans devenir permissif à tort.

⚠️ **Nouvelle mesure de `bucketCap` après ces deux correctifs** — rejouée
avec [scripts/benchmark-bucket-retention.ts](scripts/benchmark-bucket-retention.ts) :
au budget de production, `bucketCap=100` (le plus petit testé) donne
désormais le meilleur résultat sur 3 des 4 scénarios, `bucketCap` plus élevé
n'aidant plus et pouvant même très légèrement reculer — cohérent avec le
tri par potentiel : un compartiment plus petit laisse la recherche visiter
DAVANTAGE de paires différentes pour le même budget, plutôt que d'épuiser
ce budget dans un seul compartiment déjà bon. **Non appliqué à l'époque** :
abaisser `BUCKET_CAP` en dur referait le même genre de changement de
comportement de production que celui qui avait motivé la « Validation
grandeur nature » initiale (retrouver un runage réel) — à revalider sur ce
même scénario réel avant d'y toucher, pas seulement sur des pools
synthétiques.
⚠️ **Mesure dépassée depuis** (voir plus bas, « BUCKET_CAP relevé ») : cette
observation date d'AVANT que `maxNodes` ne soit relevé dans la même
proportion que `bucketCap` — une fois les deux montés ensemble, le
désavantage d'un `bucketCap` plus élevé sur ces mêmes 4 scénarios disparaît
entièrement (100 % du plafond atteint à chaque palier, aucune perte).

⚠️ **Confirmé sur un vrai compte, en conditions réelles** (Lushen, decks
d'offense 10 et 11, recherche restreinte à ATQ/Taux Crit/Dmg Crit
uniquement) : le compartiment `combos` limitait bel et bien ce qui pouvait
être retrouvé quand le build cible est fortement spécialisé sur peu de
stats — le demi-build réel du deck 10 se classait #11 854 sur 342 654 dans
son compartiment (par `relevanceScore`, l'efficience agrégée), largement hors
de portée de `BUCKET_CAP=600` **et** d'un budget de recherche généreux
(20 000/compartiment, 50 millions de paires explorées, toujours tronqué sans
le retrouver). Confirme concrètement, sur des données réelles et pas
seulement des scénarios synthétiques, le risque déjà identifié en
discussion : un score de rétention aveugle à l'objectif recherché peut
écarter un build par ailleurs valide.

### Correctif — rétention par tranches

`relevanceScore` (efficience agrégée) reste le repère PAR DÉFAUT, mais
n'est plus le SEUL critère qui décide ce qui survit à `bucketCap`. Chaque
compartiment (`buildBuckets`, `runeBuildOptim.ts`) maintient désormais
PLUSIEURS tas bornés en parallèle, fusionnés (dédupliqués) à la fin — même
principe que `PER_STAT_KEEP`/`PER_STAT_KEEP_OBJECTIVE` dans `filterSlot`
(réserver une tranche par critère plutôt qu'un tri global unique), appliqué
ici aux demi-builds plutôt qu'aux runes individuelles :

- **Tranche générique** (`relevanceScore`) — la moitié du budget, comportement
  historique inchangé quand rien de plus n'est demandé.
- **Tranche combinée**, si des minimums sont posés — triée par la somme des
  contributions rapportées à leur propre seuil (`Σ (pct+flat)/min`, même
  heuristique que `relevance()` dans `filterSlot`). Protège un demi-build qui
  satisfait PLUSIEURS minimums À LA FOIS sans être le meilleur sur AUCUN pris
  isolément — exactement le cas du deck 10 (ATQ+Taux Crit+Dmg Crit demandés
  ensemble) : rang #227/314 730 par ce score combiné, contre #9 521 par la
  seule efficience générique.
- **Une tranche par stat de `retentionKeys`** (les minimums demandés, PLUS
  les stats propres à l'objectif choisi — JAMAIS les maximums : sur une stat
  plafonnée, « plus » n'est pas sûrement « meilleur » pour un tri après coup,
  même piège que la dominance directionnelle abandonnée plus haut dans ce
  document) — triée par sa propre contribution seule.

Le reste du budget (après la tranche générique) est réparti à parts égales
entre tranche combinée et tranches par stat, au moins 1 place chacune.
`heapPush` a été généralisé pour accepter un score EXPLICITE par tas (pas
seulement `relevanceScore`), sans dupliquer ni muter les demi-builds — un
même objet peut survivre dans plusieurs tranches à la fois, dédupliqué par
identité à la fusion finale.

**Vérifié sur les deux mêmes decks réels** : deck 11 (combo 4+2) retrouvé
EXACTEMENT au budget de **production par défaut** (`bucketCap=600`, aucune
surcharge), là où l'ancienne rétention avait besoin de `bucketCap=2 000`.
Deck 10 (un seul set 4 pièces, le cas le plus dur mesuré) retrouvé
EXACTEMENT avec un budget relevé (`bucketCap=8 000`, `maxNodes=50 000 000`,
~83 s) — un budget qui, avec l'ANCIENNE rétention à score unique, ne
suffisait déjà plus même à `bucketCap=20 000`. Aucune régression sur le
harnais différentiel ni les scénarios écrits à la main. Reproductible via
[scripts/monster-search-validate.ts](scripts/monster-search-validate.ts)
(recherche restreinte à un sous-ensemble de stats, budget ajustable) et
[scripts/monster-search-rank-diag.ts](scripts/monster-search-rank-diag.ts)
(rang exact d'un demi-build réel dans chaque tranche de rétention, sans
payer une recherche complète) — deux outils dans la famille
`scripts/monster-*.ts`, génériques comme les autres.

### Suite — ordonnancement conscient des tranches, et Taux Crit hors de l'objectif Dégâts

Trois correctifs supplémentaires, dans le prolongement direct du précédent :

- **`OBJECTIVE_RELEVANT_STATS['degats']` ne contient plus `cr`** (reste
  `['atk', 'cd']`) : ATQ et Dmg Crit se maximisent (jamais de plafond utile),
  mais le Taux Crit est plafonné à 100 % en jeu — le pousser plus haut
  n'apporte rien (`objectiveScore` l'écrête déjà). Pour l'objectif Dégâts, TC
  se comporte comme une CONDITION à satisfaire (l'utilisateur pose
  typiquement un minimum, souvent 100 % ou une valeur pensée pour se
  compléter avec un buff en jeu), pas comme une cible à maximiser plus loin —
  sa protection passe entièrement par `minEntries` (la tranche combinée),
  jamais par la liste des stats de l'objectif.
- **Ordonnancement des compartiments conscient des tranches** : `buildBuckets`
  triait encore les compartiments par leur seul `relevanceScore` (efficience
  générique) avant l'appariement, même après l'ajout des tranches
  combinée/par-stat. Il compare désormais, pour chaque compartiment, un score
  de potentiel NORMALISÉ — le meilleur score de CHAQUE tranche, rapporté au
  maximum atteint par N'IMPORTE QUEL compartiment sur cette même tranche (les
  tranches ne sont pas sur la même échelle : `relevanceScore` ~0-1, score
  combiné en unités de seuil, score par stat en valeur brute — les comparer
  directement mélangerait des grandeurs incomparables).
- **Budget réparti à PARTS ÉGALES entre toutes les tranches**, générique
  comprise — plus la moitié réservée d'office à la générique. Mesuré sur le
  deck 10 : elle n'était la tranche la plus prédictive pour AUCUNE des deux
  moitiés (la combinée l'était pour la première — #227/314 730 — la tranche
  ATQ seule pour la seconde — #583/61 216) ; lui garder la moitié du budget
  sous-dotait systématiquement celles qui comptaient réellement.

**Résultat, honnête** : ces trois correctifs ramènent le budget nécessaire
pour retrouver le deck 10 de `bucketCap=8 000` à **`bucketCap=3 000`**
(`maxNodes` toujours élargi, ~24 s) — une réduction réelle et mesurée,
cohérente avec le calcul à la main (au moins 583×5 ≈ 2 915 nécessaires à
répartition égale sur 5 tranches, pour que la tranche ATQ seule de la
seconde moitié atteigne son rang). **Mais ça ne suffit toujours pas au
`bucketCap=600` de production, sans aucune surcharge** — testé et confirmé
négatif, recherche exhaustive (1,4 million de paires, aucune troncature),
donc ce n'est plus une question d'ordre d'exploration : à ce budget, la
CAPACITÉ de rétention elle-même reste trop courte pour ce cas précis (un
seul set 4 pièces sur un compte de plus de 3 000 runes, avec un build cible
très spécialisé). Le seul levier qui reste, non actionné ici faute de
validation séparée : relever `BUCKET_CAP` lui-même — un changement de
comportement de production qui affecterait TOUTES les recherches, pas
seulement ce cas, à décider et mesurer indépendamment (même prudence que
pour le `slotFilterCap`/`BUCKET_CAP` initiaux). Le deck 11, structurellement
moins exigeant, reste trouvé au budget par défaut sans changement.

### Suite — BUCKET_CAP relevé : ce type de recherche est un cas à résoudre, pas une exception

⚠️ **Position produit explicite** : un build très spécialisé sur un gros
compte réel (le cas du deck 10) n'est **pas** un cas à part qu'on laisse de
côté — l'Optimizer doit pouvoir le résoudre, quitte à prendre 1 à 2 minutes.
Ça change le calcul du paragraphe précédent : la question n'est plus
« combien de temps est-ce acceptable ? » (déjà répondu : jusqu'à 1-2 min) —
c'est « ce budget de temps suffit-il, et à quel prix sur les recherches
courantes ? ».

**`BUCKET_CAP` relevé de 600 à 5000**, avec `DEFAULT_MAX_NODES` relevé DANS
LA MÊME FOULÉE (4 000 000 → 20 000 000, ×5) — **les deux doivent grandir
ensemble**. Mesuré, pas supposé : relever `BUCKET_CAP` seul (à
`bucketCap=5000` avec `maxNodes` resté à 4M) fait au contraire RECULER un
résultat déjà trouvé (retrouvé à `bucketCap=3000`/4M, plus retrouvé à
`bucketCap=5000`/4M) — chaque paire de compartiments coûte plus cher à
parcourir à `bucketCap` élevé, donc sans plus de budget de paires, la
recherche épuise son budget sur MOINS de paires de compartiments explorées,
pas plus. Les deux plafonds relevés ensemble : deck 10 retrouvé EXACTEMENT
en **48 s**, deck 11 en **59 s**, tous deux au budget de production **strict,
sans aucune surcharge** — le critère de validation posé au tour précédent
est maintenant atteint.

**Vérifié sans régression** sur les 4 scénarios synthétiques
(`scripts/benchmark-search-budget.ts`, `bucketCap`/`maxNodes` de production
fixés à leurs nouvelles valeurs) : les 4 scénarios trouvent 100 % de leur
plafond testé à CHAQUE palier de `maxCollected`, temps toujours sous ~3,2 s —
aucune perte de qualité ni de vitesse sur l'usage courant, contrairement à
la première tentative (relever `bucketCap` seul) qui aurait coûté sans rien
apporter.

**Accélération GPU — évaluée, pas retenue pour l'instant.** La question a
été posée directement (d'autres outils similaires explorent au GPU, plusieurs
milliards de combinaisons). Le CPU, une fois `BUCKET_CAP`/`maxNodes` réglés
ensemble plutôt que l'un sans l'autre, suffit à résoudre le cas le plus dur
mesuré dans le budget de temps jugé acceptable (moins d'une minute, pas
besoin des « 1 à 2 minutes » approuvées) — le goulot n'était pas un manque de
débit de calcul brut, c'était une capacité de rétention mal calibrée. Une
implémentation GPU (WebGPU dans un navigateur, support encore inégal, aucun
repli possible sur les navigateurs non supportés) est un chantier
nettement plus lourd et plus risqué que régler deux constantes déjà
paramétrées — pas justifié tant que le CPU suffit. Reste une piste pour un
compte encore plus gros que celui mesuré ici (~4400 runes), si un jour ce
budget CPU ne suffit plus non plus — à re-mesurer avant, pas à anticiper.

### Suite — ordre D'EXPLORATION à l'intérieur d'un compartiment

⚠️ **Signalé en usage réel** (recherche « Dégâts » sur un vrai compte, set
Rage, conditions ATQ/Taux Crit/Dmg Crit) : sur plusieurs millions de paires
explorées, les bons résultats n'apparaissaient qu'à la toute fin. Trois
niveaux d'ordre avaient été corrigés cette session — quels demi-builds
survivent à `bucketCap` (les tranches), quel COMPARTIMENT est exploré en
premier (`out.sort`) — mais pas un troisième, plus profond : `Bucket.combos`
(la liste que parcourt la boucle d'appariement `for comboA of bA.combos`
dans `searchBuildsSteps`) restait triée par le seul `relevanceScore`
(efficience générique), même pour un demi-build qui n'avait survécu à
`bucketCap` que grâce à la tranche combinée ou une tranche par stat — donc
correctement RETENU, mais exploré en DERNIER dans son propre compartiment,
après des milliers de demi-builds génériquement bons mais hors sujet. Un
vrai risque, pas seulement une perte de temps : si la recherche s'était
interrompue un peu plus tôt (budget de paires ou de temps atteint avant la
fin), ces bons résultats auraient pu être MANQUÉS, pas seulement trouvés en
retard.

**Corrigé** : une seconde passe, une fois le meilleur score global de chaque
tranche connu (`globalBestBySlice`, déjà calculé pour l'ordre des
compartiments), retrie maintenant CHAQUE demi-build DANS son compartiment
par le même principe — son propre meilleur score normalisé, toutes tranches
confondues, pas seulement `relevanceScore`. Nécessite de recalculer, pour
chaque demi-build retenu, son score dans chaque tranche à partir de ses
`pct`/`flat` déjà stockés (`combinedRetentionScore`/`retentionScore`,
réutilisées telles quelles) — peu coûteux, borné par `bucketCap` demi-builds
par compartiment. Vérifié sans régression sur le harnais différentiel, les
scénarios écrits à la main, et les deux decks réels (deck 10 et deck 11,
toujours retrouvés exactement aux défauts de production).

### Suite — pourquoi ce correctif d'ordre n'a rien changé en usage réel

⚠️ **Signalé en usage réel, après le correctif ci-dessus** : toujours ~18
millions de paires explorées avant d'obtenir le Lushen du deck 10, en
conditions réelles (Pré-filtrage « Moyen », `slotFilterCap=80`). Deux failles
de méthodologie ont d'abord été trouvées dans les scripts de mesure de cette
session : `monster-search-validate.ts`/`monster-search-pipeline-diag.ts`
codaient en dur `slotFilterCap=300` (« Extrême »), jamais 80 (« Moyen », le
vrai défaut de l'écran) ; et aucun des scripts diagnostiques ne passait
`objective` aux fonctions du moteur, alors que la recherche réelle avait
« Dégâts » sélectionné — les mesures « deck 10 retrouvé en 48 s » de la
section précédente ne reflétaient donc pas fidèlement les réglages réels de
l'utilisateur. Les deux scripts ont été corrigés pour prendre `slotFilterCap`
et `objective` en paramètres, défauts alignés sur l'écran (80, « Dégâts »).

**Mesure directe, une fois ces deux failles corrigées** (`monster-search-
validate.ts`, deck 10, aux défauts de production `bucketCap=5000`,
`maxNodes=20 000 000`) : le Lushen réel est retrouvé dans les QUATRE
combinaisons testées (`slotFilterCap` 80 et 300, `objective` posé ou non) —
mais **`explored` vaut exactement `20 000 001` (= `maxNodes`+1) dans les
quatre cas**, jamais moins. La recherche ne s'arrête JAMAIS avant d'avoir
épuisé tout le budget de paires, quel que soit l'ordre d'exploration : avec
un set exact + 3 minimums serrés + statistique principale imposée sur 3
emplacements à la fois, un seul candidat au total satisfait toutes les
contraintes en même temps (`candidates.length === 1`) — bien loin de
`maxCollected=100 000`, la seule autre condition d'arrêt anticipé. La
recherche tourne donc TOUJOURS jusqu'à `maxNodes`, qu'elle trouve le bon
candidat tôt ou tard dans son parcours.

**Conséquence directe** : l'ordre d'exploration (tranches, compartiments,
demi-builds DANS un compartiment) ne peut changer ni le temps total de la
recherche, ni le nombre final de paires explorées, dans ce régime précis — il
ne peut avancer QUE le moment où le candidat apparaît dans le flux de
progression pendant que la recherche tourne. Instrumentation directe de
`buildBuckets` (nouveau script `monster-search-buildbuckets-diag.ts`,
reproduit exactement les paramètres de `searchBuildsSteps`, y compris
`objective`) : le compartiment réel du deck 10 se classe 4ᵉ/10 (moitié A) et
5ᵉ/9 (moitié B) dans l'ordre d'exploration des compartiments — pas en tête —
et, À L'INTÉRIEUR de ce compartiment, le demi-build réel se classe
~2278ᵉ/4290 et ~2026ᵉ/4147 après le tri par potentiel normalisé — loin d'être
le meilleur sur les tranches mesurées (générique, combinée, ATQ/TC/DCC
isolés). Ce n'est pas une régression du correctif précédent : d'AUTRES
demi-builds sont légitimement jugés plus prometteurs sur chacune de ces
tranches, alors que le build réel n'est exceptionnel sur AUCUNE d'elles prise
isolément — il ne fait que satisfaire les trois conditions À LA FOIS, ce
qu'aucune tranche à un seul axe ne peut anticiper sans déjà connaître la
réponse.

**Ce n'est donc pas un bug à corriger, mais le coût réel d'une aiguille dans
une botte de foin** : avec `atk`+`tc`+`dcc` demandés ensemble près de leurs
seuils, sur 3163 runes réelles, très peu de builds satisfont tout à la fois —
la recherche DOIT explorer une grande partie de l'espace atteignable pour
être sûre de le trouver, quel que soit l'ordre. Les ~30-47 s mesurées à
chaque essai (toujours dans la fourchette « 1-2 minutes » jugée acceptable)
SONT la réponse du système à ce cas, pas un signe qu'il reste à optimiser par
un meilleur tri. Le levier qui compte reste celui déjà actionné :
`bucketCap`/`maxNodes` assez grands pour que le budget total de paires
couvre bien la paire de compartiments cible — vérifié ici (le build réel est
systématiquement retrouvé, dans les quatre configurations testées).

⚠️ Le vrai coupable de la lenteur perçue en usage réel (3-4 minutes dans le
navigateur pour ce même deck 10, contre 30-47 s hors Worker) n'était
finalement PAS ici : c'est le Worker qui rendait la main à la boucle
d'événements à CHAQUE point de passage (`await setTimeout(resolve, 0)` tous
les 500 nœuds, soit 40 000 fois à `maxNodes=20 000 000`) — les navigateurs
plafonnent `setTimeout(fn, 0)` appelé en boucle à ~4 ms, ajoutant jusqu'à
~160 s de pur overhead de planification. Corrigé en throttlant ce rendu de
main au temps écoulé (50 ms), voir [runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts).

### Suite — BUCKET_CAP relevé une troisième fois : plus de conditions à la fois dilue chaque tranche

⚠️ **Signalé sur un autre vrai compte** (Sonia, deck 14 : set Swift + 4
minimums À LA FOIS — ATQ/Taux Crit/Dmg Crit/Vitesse — sur les trois
objectifs de recherche essayés par l'utilisateur, Dégâts/Efficience/Vitesse).
Le build réel n'était retrouvé dans AUCUN des trois. Diagnostic direct
(`monster-search-buildbuckets-diag.ts`) : le demi-build réel d'une des deux
moitiés était **ABSENT de tout compartiment retenu**, quel que soit
l'objectif — pas un problème d'ordre cette fois, un problème de RÉTENTION.
Cause : le budget de rétention par compartiment (`bucketCap`) est **partagé
à parts égales entre TOUTES les tranches** (voir `buildBuckets`,
`sliceCountForCap`) — avec 4 minimums simultanés, ça fait 6 tranches
(générique + combinée + 4 stats), donc `bucketCap=5000` ÷ 6 ≈ 833 places par
tranche. Le demi-build réel se classait #1212 sur sa MEILLEURE tranche (la
combinée) — juste hors de portée, alors que le deck 10 (3 minimums, 5
tranches, 1000 places chacune) passait grâce à une combinaison différente de
facteurs (une tranche différente le protégeait, à un rang différent). Plus
une recherche pose de conditions à la fois, plus ce partage égal dilue
chaque tranche — un piège qui n'était pas visible avec seulement 3 minimums
en test.

**`BUCKET_CAP` relevé de 5000 à 8000** (1333 places/tranche à 6 tranches,
marge d'environ 10 % sur le rang #1212 mesuré), **`DEFAULT_MAX_NODES`
relevé DANS LA MÊME FOULÉE** (20 000 000 → 32 000 000, ×1,6) — même risque de
régression que les deux fois précédentes, reconfirmé PAR LA MESURE : relever
`bucketCap` seul (8000, `maxNodes` resté à 20M) retrouve bien Sonia deck 14
(63,7 s) mais fait RECULER un résultat déjà acquis (deck 10 Lushen, retrouvé
à 5000/20M, plus retrouvé à 8000/20M — 0 candidat). Les deux plafonds relevés
ensemble : Sonia deck 14, deck 10 Lushen et deck 11 Lushen tous les trois
retrouvés EXACTEMENT aux défauts de production stricts (71,8 s / 57,0 s /
34,2 s). Aucune régression sur les 4 scénarios synthétiques
(`scripts/benchmark-search-budget.ts`, `PRODUCTION_BUCKET_CAP` mis à jour) :
même plafond atteint, temps toujours sous ~3 s.

### Suite — le partage à parts égales lui-même abandonné, au profit d'un budget FIXE par tranche

⚠️ **Question posée directement après le calibrage précédent** : `8000`
suffit pour 4 conditions à la fois, mais est-ce « assez » pour de bon, ou
juste le prochain mur ? Vérifié par la mesure plutôt que supposé : un cas
synthétique à 8 conditions simultanées (les 8 stats du jeu comme minimum en
même temps) reste ABSENT de toute rétention, même à `bucketCap=8000` — la
réponse est non, ce n'est PAS assez pour de bon. Le partage à parts égales
recule structurellement à mesure qu'on ajoute des conditions
(`bucketCap ÷ sliceCount` par tranche) : aucune valeur fixe de `bucketCap`
ne peut jamais couvrir « n'importe combien » de conditions à la fois, chaque
recalibration ne fait que reculer le mur d'un cran, au prix d'un temps de
recherche croissant (`maxNodes` doit suivre à chaque fois).

**Le partage à parts égales est abandonné.** Chaque tranche reçoit
maintenant `bucketCap` places EN PROPRE, indépendamment du nombre d'autres
tranches actives (voir `buildBuckets`, `genericCap`/`perOtherSliceCap`) — la
mémoire d'un compartiment grandit avec le nombre de conditions posées à la
fois (logique : c'est justement là qu'il en faut le plus), sans jamais
dégrader une tranche existante en ajoutant une autre. `BUCKET_CAP` change
donc de SENS (total partagé → budget par tranche) : recalibré à la baisse en
conséquence, pas juste laissé à son ancienne valeur — `8000` par tranche
aurait fait exploser la taille des compartiments (jusqu'à ×6 sur le cas
Sonia) et, confirmé par la mesure, fait RECULER des résultats déjà acquis
avec `maxNodes` inchangé (même piège habituel, à un autre niveau).

**Recalibré à `bucketCap=1500` par tranche** (`DEFAULT_MAX_NODES` laissé à
32 000 000, déjà large) — mesuré sur les TROIS cas réels connus plus un
test de stress à 5 conditions simultanées inventé pour l'occasion (Sonia +
un cinquième minimum, PV) : les quatre retrouvent leur build exact aux
défauts de production stricts, entre 33 et 107 s (Sonia 4 conditions 81 s,
deck 10 57 s, deck 11 33 s, Sonia 5 conditions 92-107 s selon l'essai) —
toujours sous la barre des 2 minutes. `bucketCap=2000` testé aussi (plus de
marge sur le rang) mais écarté : fait RECULER deck 10 Lushen (retrouvé à
1500, plus à 2000, `maxNodes` inchangé) — même compromis rétention/budget-de-
paires qu'à chaque recalibration précédente. Aucune régression sur les 4
scénarios synthétiques (`PRODUCTION_BUCKET_CAP` remis à jour).

⚠️ **Limite encore ouverte, mais hors de portée de cette recalibration** : le
cas à 8 conditions simultanées échoue TOUJOURS, mais pour une raison
différente — une des runes réelles ne survit plus à `filterSlot` (le
pré-filtrage PAR SLOT, en amont de `buildBuckets`), pas à la rétention par
compartiment. Dilution analogue, un autre étage du pipeline. Documenté comme
limite connue plutôt que corrigé : demander 8 conditions à la fois est un
usage extrême jamais rencontré en pratique, contrairement aux cas à 3-5 qui
ont motivé cette recalibration.

### Suite — la phase de préparation restait muette (aucune progression, Arrêter sans effet)

⚠️ **Signalé en usage réel** : avant même la première paire évaluée, une
phase de préparation (pré-filtrage par slot ×6, puis `buildBuckets` ×2)
pouvait durer de quelques secondes à environ une minute, PENDANT laquelle
l'utilisateur n'avait aucune information (barre à 0 %, « 0 combinaisons
examinées ») et le bouton Arrêter ne réagissait pas. Cause directe :
`buildBuckets` était une fonction ordinaire, pas un générateur — elle
s'exécutait entièrement d'un bloc, sans jamais rendre la main au Worker (le
seul point de passage existant était DANS la boucle d'appariement, qui ne
commence qu'une fois les DEUX moitiés entièrement construites). Aggravé par
la recalibration `bucketCap` par tranche (voir plus haut) : plus de
conditions ou de statistiques principales par slot élargissent le pool
pré-filtré ET le nombre de tranches à alimenter, donc CETTE phase précise
grandit avec la même complexité qui rend une recherche difficile — c'est
justement là qu'un utilisateur a le plus besoin de savoir que ça travaille.

**Corrigé** : `buildBuckets` est maintenant un GÉNÉRATEUR, comme
`searchBuildsSteps` — il rend la main à chaque rune de la première boucle
(`r0`), avec un point de passage dédié (`SearchProgress` devient une union :
`{phase:'building', half, scanned, total}` pendant la construction,
`{phase:'pairing', candidates, explored}` pendant l'appariement, l'ancien
comportement inchangé). Le Worker distingue les deux phases pour ses
messages de progression ET pour l'arrêt manuel (rien à ressortir pendant
`building` : aucun candidat n'a encore pu être trouvé, un résultat vide
tronqué est la seule réponse honnête). Côté écran, une barre dédiée affiche
« Préparation — moitié A/B : X / Y runes » pendant cette phase, remplacée
par l'ancienne barre détaillée une fois l'appariement commencé. Vérifié sans
régression de temps (yield à ~100-300 reprises par moitié seulement, coût
négligeable face au O(pool³) de la construction elle-même) ni de résultat
sur les cas réels connus.

### Suite — filterSlot élargi lui aussi, et budget de paires devenu ADAPTATIF

⚠️ **Trois signalements groupés, sur un même vrai compte** (Eivor Feu, deck 2
de DÉFENSE de siège — 7 conditions à la fois : PV/ATQ/DEF/Vitesse/Taux
Crit/Dmg Crit/RES) :

1. Le build réel restait introuvable, même après les corrections
   précédentes. Diagnostic (`monster-search-pipeline-diag.ts`, corrigé pour
   lire aussi les défenses de siège via un nouveau flag `--defense`, voir
   [deckMonster.ts](scripts/lib/deckMonster.ts)) : une rune du set demandé
   (« violent ») ne survivait plus à `filterSlot` — PAS à la rétention par
   compartiment (déjà corrigée), un étage plus tôt. Cause identique, un
   niveau plus haut dans le pipeline : `relevance()` (le score combiné qui
   pilote `matchCap`/`fillCap`) somme une contribution normalisée par
   condition — une rune qui n'aide que sur 3-4 stats sur 7 (la norme : une
   rune n'a que 6 emplacements de contribution au total, jamais assez pour
   peser sur 7-8 stats à la fois) se classe d'autant plus mal que les
   conditions sont nombreuses, même si elle reste indispensable. Mesuré :
   rang #111 parmi seulement 183 candidates DU MÊME SET, hors de portée de
   `matchCap=80`.
2. Le temps de recherche avait augmenté d'environ 50 % pour toute recherche,
   pas seulement les cas difficiles — attendu : `DEFAULT_MAX_NODES` avait
   été relevé à 32M pour couvrir Sonia deck 14 (4 conditions), un budget FIXE
   payé par TOUTE recherche même sans en avoir besoin. Mesuré : une recherche
   LÂCHE (un seul minimum posé) trouve déjà 2500-3500 bons candidats en
   4-12M paires — les 32M par défaut ne changent rien à la qualité, pur
   gaspillage de temps pour ce genre de recherche, largement le cas courant.
3. La phase de préparation ne donnait aucune information et le bouton
   Arrêter n'avait aucun effet pendant qu'elle tournait — voir la section
   juste au-dessus, déjà corrigée au moment de ces trois signalements.

**Corrigé (1) — `filterSlot` élargi au-delà de 4 conditions simultanées** :
`matchCap`/`fillCap` grandissent maintenant avec le nombre de conditions
posées (`+20` places par condition au-delà de 4), jamais en dessous de ce
que l'appelant demande — comportement strictement inchangé jusqu'à 4
conditions (aucune régression possible sur les cas déjà validés), élargi
seulement au-delà. Vérifié : les 6 runes réelles d'Eivor survivent
maintenant à `filterSlot` (`filterSlot=331/218/338/184/315/156` contre un
échec au slot 3 avant correctif).

**Corrigé (2) — budget de paires (`maxNodes`) devenu ADAPTATIF**, ancré sur
`sliceCount` (la même quantité que `buildBuckets`, voir son commentaire) :
`adaptiveMaxNodes(params)`, exportée et réutilisée par le Worker pour que la
barre de progression reste cohérente (elle lisait encore la constante fixe
`DEFAULT_MAX_NODES`, maintenant retirée). PROPORTIONNEL, ancré sur deck 10
Lushen (3 minimums, 5 tranches, besoin mesuré d'AU MOINS ~28M paires — échoue
à 24M, retrouvé à 28M) : `32M × sliceCount ÷ 5`, plancher à 8M pour les
recherches très lâches, PAS de plafond haut (continue de croître au-delà de
l'ancre). Résultat pour les cas déjà connus, TOUS à budget désormais
adaptatif (sans overrides manuels) : deck 10 (`sliceCount=5` → 32M, 66 s),
deck 11 (idem, 36 s), Sonia deck 14 (`sliceCount=6` → 38,4M, 89 s — PLUS de
marge qu'avant, pas moins), Sonia + 5 conditions (`sliceCount=7` → 44,8M,
90 s) — tous retrouvés exactement. Côté lâche : une recherche à 1 condition
passe de ~32M à 19,2M paires (`sliceCount=3`), une recherche PURE efficience
(aucun minimum) tombe au plancher et finit généralement en quelques
secondes (`maxCollected` devient alors le facteur limitant, pas `maxNodes`).

⚠️ **Le cas à 7 conditions d'Eivor Feu reste un cas à part, documenté, pas
silencieusement "résolu"** — malgré les deux correctifs ci-dessus : voir
« Limites connues ».

## Limites connues

- **Pré-filtrage heuristique par emplacement ET par compartiment** : pas de
  garantie d'optimalité globale absolue au-delà de ce que ces deux étages
  retiennent. `slotFilterCap` et `BUCKET_CAP` sont mesurés sur un compte réel
  (voir « Validation grandeur nature »), pas prouvés exhaustifs dans
  l'absolu. ⚠️ Les deux élagages SÛRS qui le précèdent (dominance,
  faisabilité — voir « Algorithme ») ne changent rien à cette limite : ils ne
  retirent QUE des runes prouvées inutiles, jamais une qui pourrait compter —
  c'est le pré-filtrage heuristique, en aval, qui reste sans garantie.
  ⚠️ Beaucoup de conditions à la fois (`minStats`) pouvaient diluer le
  pré-filtrage PAR SLOT (`filterSlot`, en amont de `buildBuckets`) de la même
  façon que la rétention par compartiment — **corrigé pour les cas courants**
  (jusqu'à 5-6 conditions à la fois, vérifié sans régression), voir « Suite —
  filterSlot élargi lui aussi » plus bas.
  ⚠️ **Reste insuffisant à 7 conditions simultanées, confirmé sur un vrai
  compte** (Eivor Feu, deck 2 de défense de siège — PV/ATQ/DEF/Vitesse/Taux
  Crit/Dmg Crit/RES à la fois) : `filterSlot` élargi ET `maxNodes` adaptatif
  (57,6M à `sliceCount=9`) appliqués ensemble, budget de temps large
  (243,6 s, largement sous le filet de sécurité à 10 min de l'écran) — le
  build réel reste introuvable (0/6 runes en commun avec le meilleur
  candidat trouvé). Documenté comme limite plutôt que forcé par une nouvelle
  recalibration : les deux correctifs précédents ont chacun été calibrés sur
  des cas mesurés (jusqu'à 5 conditions pour `filterSlot`, jusqu'à 5-6 pour
  `buildBuckets`/`maxNodes`) — extrapoler encore plus loin sans nouvelle
  mesure reviendrait à deviner, ce que cette session a précisément évité
  jusqu'ici. 7 conditions à la fois est un usage rare mais RÉEL (contrairement
  au cas synthétique à 8 conditions plus haut) : à reprendre si signalé à
  nouveau, probablement avec une approche différente (l'espace combinatoire
  semble croître plus vite que ce qu'un simple relèvement de budget peut
  suivre dans un temps raisonnable) plutôt qu'un quatrième calibrage des
  mêmes leviers.
- **Un set demandé pouvait saturer le pré-filtrage sur TOUS les emplacements,
  pas seulement ceux qui en ont besoin.** Exemple concret remonté : demander
  Rapide seul (4 pièces) sur un compte qui en possède beaucoup pouvait
  renvoyer des builds à 6 pièces Rapide plutôt que 4 Rapide + 2 runes d'un
  autre set performant — parce que `filterSlot` réservait une place
  « prioritaire » aux runes du set demandé sur les **6** emplacements
  (`matchCap`), alors que 4 suffiraient et les 2 autres auraient dû rester
  ouverts à toute alternative. **Corrigé** : `filterSlot` réserve désormais
  aussi une tranche garantie de runes **hors** du set demandé
  (`offSet`, taille `fillCap`, symétrique de `matches`) — sans elle, quand
  les meilleures runes toutes provenances du joueur sont justement du set
  demandé (courant : c'est souvent LE set qu'il a optimisé), `matches` ET la
  tranche générique se recouvraient presque entièrement, et aucune
  alternative d'un autre set n'avait jamais sa propre place garantie. Testé
  sur un vrai compte : nette amélioration confirmée par l'utilisateur.
  ⚠️ Reste néanmoins un correctif du PRÉ-FILTRAGE, pas une garantie : si les
  meilleures runes du joueur pour l'objectif choisi sont réellement toutes du
  set demandé, un résultat « tout-un-set » peut être la bonne réponse
  mathématique, pas un bug résiduel.
- Artéfacts et relique du monstre restent fixes ; l'outil ne travaille que
  sur les runes.
- L'exclusion v1 ne connaît que la **box** (6★ équipés) ; RTA, Siège et
  l'exclusion ciblée par monstre/rune sont prévus mais pas construits.
- ~~L'ordre dans lequel les paires de compartiments sont explorées reste
  arbitraire~~ **Corrigé** (voir « Suite — ordre d'exploration des paires… »
  ci-dessus) : les compartiments sont désormais triés par le meilleur
  `relevanceScore` qu'ils contiennent avant l'appariement. ⚠️ Reste une
  heuristique, pas un tri exact des PAIRES elles-mêmes (chaque moitié est
  triée indépendamment, pas le produit des deux) — un ordre encore plus fin,
  fondé sur le potentiel de l'OBJECTIF choisi plutôt que sur l'efficience
  agrégée seule, reste un chantier ouvert (voir aussi « bound-and-order au
  niveau des paires », discuté mais non construit — dépend d'un mode
  produit « objectif unique, arrêt précoce » qui n'existe pas encore).
- Seul le preset de `slotFilterCap` est un réglage utilisateur
  (« Options avancées ») ; `maxMs` (fixe, 10 min) et
  `maxCollected`/`maxNodes`/`BUCKET_CAP` restent des paramètres du moteur non
  exposés dans l'UI.
- **L'estimation du nombre de builds** (`estimateSearchSpace`) est un ordre
  de grandeur (le produit des pools filtrés par slot), pas le nombre
  réellement exploré par le meet-in-the-middle — et **la barre de
  progression** est elle-même approximative (voir « Interruption »), pas une
  mesure exacte d'avancement.
- L'objectif « Dégâts » est une **formule communautaire prédictive**, comme
  celles de la page Mécaniques — pas une simulation de combat réel.
