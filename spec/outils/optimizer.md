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
6. **Artéfacts** — interrupteur **« Ignorer les statistiques des
   artéfacts »** (même `<Switch>` que « Stats de base exclues », voir plus
   bas), **décoché par défaut** (comportement historique inchangé : les
   artéfacts réellement équipés comptent). Décoché, deux listes déroulantes
   apparaissent — une par emplacement (**Attribut**, **Type**, voir
   `ARTIFACT_KINDS`) — proposant : **« Comme équipé »** (défaut, reprend
   l'artéfact réellement porté à cet emplacement **du build de BASE**, voir
   « Sélecteur de monstre » ci-dessus), **ATQ +100**, **DEF +100**,
   **PV +1500** (les trois valeurs de statistique principale d'artéfact
   possibles en jeu — la valeur elle-même n'est jamais un choix libre, seule
   la stat l'est), ou **« Aucun »** (retire cet emplacement même s'il est
   réellement équipé).
   ⚠️ **Un même monstre peut porter des artéfacts DIFFÉRENTS selon le
   contexte** (build de base, RTA, un deck d'offense ou de défense de
   siège — des presets de runage/artéfacts séparés, pas une seule vérité par
   monstre). Le sélecteur de monstre de l'Optimizer n'expose QUE le build de
   base — `« Comme équipé »` par défaut n'est donc qu'une hypothèse
   implicite (« le build de base »), pas une garantie de correspondre au
   build qu'on cherche réellement à reproduire. Choisir une statistique
   explicite permet d'hypothéquer l'artéfact d'un AUTRE contexte (RTA, un
   deck de siège) sans avoir besoin de changer de monstre affiché ni de le
   posséder pour de vrai.
   ⚠️ **Ces stats deviennent le PLANCHER des conditions ci-dessous**, pas
   une valeur qui s'ajoute silencieusement : voir « Conditions » →
   « Interrupteur Stats de base exclues » pour le détail exact du calcul.
   Les cartes de résultats affichent les artéfacts **effectivement utilisés
   par la recherche** (réels, hypothétiques ou aucun selon ces réglages), pas
   forcément les vrais — pour rester cohérentes avec les stats calculées ;
   « Équipement actuel » plus haut continue lui de montrer les vrais
   artéfacts, jamais modifié par ces réglages.
7. **Conditions** — les 8 stats (`RECO_STATS`) : PV, ATQ, DEF, VIT, Taux
   Crit, Dmg Crit, RES, Précision. Chaque stat porte **deux champs, minimum
   et maximum**, tous deux facultatifs — **champ vide = pas de contrainte**
   sur ce côté (pas de case à cocher séparée : la présence d'une valeur EST
   la décision).
   - **Interrupteur « Stats de base exclues »** (`<Switch>`, même composant
     que « Garder mes données » du menu ⚙ — remonté dans
     [Switch.tsx](src/components/Switch.tsx), voir [README.md](../README.md))
     au-dessus de la grille, **activé par défaut** : n'affecte **que** PV,
     ATQ, DEF et VIT — ces 4 stats ont une base qui grandit avec le
     niveau/l'éveil et que l'équipement vient gonfler en % ou en plat, donc
     raisonner « bonus apporté par l'équipement » a un sens. Activé, le champ
     porte sur ce que l'**équipement** (runes **et** artéfacts comptés, voir
     « Artéfacts » ci-dessus) doit apporter **au-dessus de la base nue** du
     monstre choisi — comme en jeu : un monstre sans la moindre rune mais
     avec deux artéfacts ATQ +100 affiche déjà +200 de bonus ATQ, pas 0.
     Désactivé, il porte sur le **total**.
     ⚠️ **Taux Crit, Dmg Crit, RES et Précision restent TOUJOURS en total**,
     quel que soit ce réglage — elles partent d'une petite valeur d'éveil
     fixe plutôt que d'une base qui grandit, donc « bonus vs total » n'a pas
     le même sens pour elles ; leur champ **évolue selon la valeur d'éveil
     du monstre** (repère affiché en `placeholder`), pas selon ce réglage.
   - ⚠️ **La valeur stockée ne change jamais de nature** : c'est une lecture
     dérivée (`total − base`, `base` = la base NUE du monstre, jamais les
     artéfacts — voir plus bas) qui est recalculée à l'affichage, pas une
     conversion appliquée une fois puis oubliée. Désactiver l'interrupteur
     change donc immédiatement les 4 champs concernés (sans perte), et
     **saisir** une valeur pendant qu'il est activé l'enregistre convertie en
     total (`base + valeur saisie`) — la valeur saisie représente donc le
     bonus **équipement complet** (runes et artéfacts additionnés), pas les
     runes seules : soustraire aussi les artéfacts aurait mélangé deux
     référentiels différents (`base` reste la base nue dans la conversion,
     seul le PLANCHER affiché ci-dessous change selon les artéfacts comptés).
   - Sans monstre sélectionné, la base vaut 0 : les deux lectures coïncident.
   - ⚠️ **Aucun champ ne descend sous ce qu'on a déjà GARANTI sans la moindre
     rune** — le plancher, pas la valeur de conversion ci-dessus : en lecture
     Total, la base nue du monstre **plus** les artéfacts effectivement
     comptés (0 si `ignoreArtifacts` ou aucun artéfact choisi sur cette
     stat) ; en lecture « bonus », les artéfacts effectivement comptés SEULS
     (0 si aucun) — cohérent avec le fait qu'en bonus, la base nue est déjà
     soustraite par la conversion elle-même. Affiché en `placeholder` tant
     que rien n'est saisi.
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
8. **« Utiliser tout l'inventaire »** — case à cocher, **cochée par
   défaut** (voir « Exclusion des runes » ci-dessous et « Suite — case
   cochée par défaut »).
9. **« Options avancées »** (repliées par défaut) : **pré-filtrage par
   emplacement**, en **presets** (`<Segmented>`) plutôt qu'un curseur libre —
   défaut **Moyen**. Voir « Interruption » pour ce que chaque niveau change
   concrètement. Pas de réglage de temps limite : voir « Interruption ».
   Sous ce réglage, un second interrupteur **« Diagnostic approfondi sur 0
   résultat »**, **décoché par défaut** — voir « Suite — palier 2 du
   diagnostic » plus bas pour ce qu'il calcule et pourquoi il n'est pas
   activé d'office (plus coûteux que le palier 1, toujours actif lui).
10. **Estimation du nombre de builds** — dès qu'un monstre et un set sont
   choisis, une ligne affiche le produit des pools filtrés par emplacement
   (`estimateSearchSpace` dans
   [runeBuildOptim.ts](src/lib/runeBuildOptim.ts)), recalculée en direct à
   chaque changement de critère. ⚠️ **Un ordre de grandeur, pas le nombre
   réellement exploré** : le meet-in-the-middle n'énumère jamais ce produit
   en entier (voir « Algorithme ») — c'est un repère pour juger si les
   critères actuels sont trop larges ou trop stricts, pas une promesse de
   temps de calcul.
11. **« Rechercher »** — lance le calcul. Changer un des critères ci-dessus
    ne relance **rien automatiquement** : il faut recliquer, comme
    « (Ré)analyser mes decks » dans les recommandations de siège (« rien
    n'est confronté par défaut »). Un bouton **« Arrêter »** apparaît à côté
    pendant le calcul — il interrompt la recherche et garde le **meilleur
    trouvé jusque-là**, plutôt que de tout perdre (voir « Interruption »).
12. **Barre de progression** — pendant le calcul, une barre qui se **remplit
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
    ⚠️ **Sur 0 résultat**, un encadré diagnostic apparaît sous le titre « Aucune
    combinaison ne répond à ces critères » — voir « Suite — diagnostic de
    faisabilité sur 0 résultat » : soit une liste PROUVÉE de conditions
    mathématiquement hors de portée (avec leur borne exacte), soit un message
    neutre orientant vers la conjonction des contraintes ou un pré-filtrage
    plus large si aucune ne l'est individuellement.
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

**« Utiliser tout l'inventaire »**, cochée par défaut (voir « Suite — case
cochée par défaut » plus bas), porte la recherche sur l'**inventaire
entier** — y compris des runes qu'il faudrait retirer d'un autre monstre
pour composer le build proposé.

Décochée, la recherche **exclut** les runes déjà portées par un **autre**
monstre de la box : elle ne propose alors que des combinaisons réellement
montables sans dérunir quelqu'un — un mode volontairement plus restrictif,
pour qui veut une réponse directement applicable en jeu sans y réfléchir. Les
runes déjà portées par le monstre **choisi** (n'importe lequel de ses
exemplaires) restent TOUJOURS disponibles quel que soit ce réglage, elles
sont « à soi ».

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

### Suite — case cochée par défaut, et renommée

Décochée par défaut à l'origine (voir « Décisions actées » en tête de ce
document) : le raisonnement de départ était qu'un résultat directement
montable sans rien déséquiper est le cas d'usage le plus courant.

**Revu suite à un signalement concret** : un compte de siège réel où un
demi-build attendu semblait introuvable, alors qu'il s'agissait en réalité de
runes légitimement portées par D'AUTRES monstres depuis un re-runage (voir
« Limites connues » — chaque deck de siège garde son propre PRESET de
runage, indépendant de ce qui est réellement équipé aujourd'hui). Rien à
l'écran ne signalait que des runes avaient été silencieusement écartées pour
cette raison — la case décochée par défaut rendait ce comportement, pourtant
voulu, plus surprenant qu'utile pour la majorité des recherches. **Cochée
par défaut** désormais : un joueur qui veut spécifiquement une réponse
montable sans rien déséquiper doit la décocher explicitement, plutôt que
l'inverse. Renommée **« Utiliser tout l'inventaire »** (plus clair que
« Explorer », qui suggérait à tort un mode secondaire/exploratoire alors que
c'est maintenant le comportement par défaut).

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

### Suite — diagnostic de faisabilité sur 0 résultat (`diagnoseFeasibility`)

Question posée directement après la « Suite » précédente : entre « le build
n'existe pas » et « le moteur l'a éliminé avant de le trouver », l'écran
renvoyait le même message dans les deux cas — aucun moyen de savoir lequel.
Deux avis externes soumis en réaction, l'un proposant un diagnostic
incrémental (retirer une condition à la fois et recompter), l'autre un
remplacement par un solveur de contraintes (CP-SAT/OR-Tools). Le second est
écarté : cette app n'a **aucun backend** (tout tourne en local, dans un
Worker, principe déjà central à toute l'app — voir l'en-tête de ce document)
et un solveur compilé en WASM (bundle lourd, support navigateur inégal)
contredirait cette conception sans bénéfice démontré sur CE problème précis
(le meet-in-the-middle exploite déjà la structure du problème — deux
moitiés indépendantes — qu'un solveur généraliste ne redécouvre pas
forcément). Le premier avis, en revanche, pointait juste : cette ambiguïté
EXISTE réellement, et une bonne part du diagnostic était déjà calculée en
interne sans jamais remonter à l'écran.

**Construit** : `diagnoseFeasibility` (exportée dans `runeBuildOptim.ts`)
réutilise `computeSlotMaxBounds` — la même borne SÛRE que `eliminateInfeasible`
calcule déjà, rune par rune, mais ici **agrégée** sur les 6 emplacements pour
un diagnostic lisible. Pour chaque condition posée, ISOLÉE des autres :
- **Minimum** : le meilleur TOTAL atteignable (somme du meilleur pct/flat
  réellement possédé par slot pour cette stat, + bonus de set garanti +
  artéfacts effectivement comptés + relique). Si le seuil demandé dépasse
  cette borne, **aucune** combinaison de 6 runes ne peut jamais l'atteindre —
  une preuve mathématique, pas une supposition.
- **Maximum** : le plancher INCOMPRESSIBLE — ce qu'on a même en choisissant
  des runes qui n'apportent RIEN à cette stat (les runes ne peuvent jamais
  retirer). Si ce plancher dépasse déjà le maximum demandé, même seul, c'est
  également une preuve.

⚠️ **Dissymétrie volontaire et fondamentale : ça prouve une IMPOSSIBILITÉ,
ça ne prouve JAMAIS une possibilité.** `satisfiable=true` sur CHAQUE
condition prise isolément ne garantit PAS qu'un build satisfaisant TOUTES à
la fois existe — c'est exactement le piège déjà documenté plus haut (« Suite
— pourquoi ce correctif d'ordre n'a rien changé en usage réel » : le deck 10
Lushen, chaque condition individuellement large, leur CONJONCTION rare).
Distinguer CE cas-là (conjonction rare mais chaque condition atteignable) de
la troncature heuristique (`filterSlot`/`buildBuckets` qui a réellement
perdu un build valide) resterait indiscernable sans une recherche complète —
non tenté ici, le gain (un seul cas sans ambiguïté, gratuit) valait mieux
qu'une réponse partielle prétendant couvrir tous les cas.

**Affiché** (`OptimizerSection.tsx`) uniquement quand une recherche renvoie 0
candidat : liste rouge des conditions PROUVÉES hors de portée avec leur
borne exacte, ou — si aucune ne l'est individuellement — un message neutre
orientant vers la conjonction des contraintes ou un pré-filtrage plus large,
plutôt que de laisser deviner. Coût négligeable (une passe O(pool), pas une
recherche : recalculé à chaque rendu, jamais un problème même quand jamais
affiché). Couvert par
[tests/rune-optim.test.ts](tests/rune-optim.test.ts) : la borne minimum
exacte (frontière — un cran au-dessus échoue, pile dessus passe), le
plancher maximum (base nue incompressible), et l'absence de condition posée
(tableau vide, pas huit verdicts « satisfaisables »).

### Suite — palier 2 du diagnostic : quelle condition est la plus bloquante (`rankBlockingConditions`)

Prolongement direct du palier 1 ci-dessus, pour le cas qu'il ne couvre pas :
0 résultat, mais AUCUNE stat n'est individuellement prouvée hors de portée
(le message neutre du palier 1). L'avis externe qui avait suggéré ce
diagnostic proposait de retirer une condition à la fois et de relancer une
recherche complète pour recompter les résultats — écarté tel quel : au
budget adaptatif actuel (voir plus haut), une recherche complète coûte déjà
jusqu'à ~1-2 minutes, et il faudrait en relancer une PAR condition posée —
inacceptable pour un simple diagnostic.

**Retenu à la place** : ne relancer QUE le pré-filtrage SÛR
(`mainStatFilteredBySlot` → `pruneDominated` → `eliminateInfeasible`, jamais
`filterSlot`/`buildBuckets`/l'appariement — le vrai coût combinatoire), une
fois par condition retirée tour à tour, en gardant toutes les autres posées.
Mesure retenue : la taille du pool le plus restreint parmi les 6 emplacements
(`Math.min` des 6 tailles) — comparée à la même mesure avec TOUTES les
conditions actuelles. Coût O(N × pool), N = nombre de conditions posées, un
ordre de grandeur au-dessus du palier 1 (une seule passe) mais toujours sans
commune mesure avec une recherche complète.

⚠️ **Un INDICE, pas une preuve** — contrairement au palier 1. Le pré-filtrage
sûr ne voit que des runes prises isolément, jamais des combinaisons de 6 : une
condition qui libère peu de candidats à CE stade peut quand même être, une
fois combinée aux autres via `filterSlot`/`buildBuckets`, la vraie
responsable du 0 résultat (ou l'inverse). Un signal pour orienter où
desserrer en premier, pas un verdict définitif — d'où le nom « diagnostic
approfondi », pas « la vraie raison ».

⚠️ **Décoché par défaut, dans « Options avancées »** — demande explicite :
même si son coût réel reste loin d'une recherche complète, il s'ajoute
CONCRÈTEMENT après un échec (« ça va rajouter du temps après un test
échoué »), donc rendu optionnel plutôt que systématique comme le palier 1.
Calculé UNIQUEMENT quand il sera réellement affiché (activé ET une recherche
vient de renvoyer 0 résultat), jamais à chaque frappe.

**Affiché** (`OptimizerSection.tsx`), quand activé et 0 résultat : la taille
du pool le plus restreint actuellement, puis chaque condition posée avec la
taille qu'aurait ce même pool sans elle, triées par gain décroissant — la
plus prometteuse à desserrer en premier apparaît en tête. Quand désactivé,
une simple invitation discrète à l'activer, pour ne pas laisser deviner que
l'option existe. Couvert par
[tests/rune-optim.test.ts](tests/rune-optim.test.ts) : deux conditions dont
une seule est réellement bloquante (l'autre déjà triviale, sans le moindre
gain à la retirer) — vérifie le classement ET les tailles exactes, pas
seulement l'ordre.

⚠️ **Factorisation au passage** : `diagnoseFeasibility`, `rankBlockingConditions`
ET `searchBuildsSteps` calculaient chacun séparément `minEntries`/
`maxEntries`/`constrainedKeys`/`guaranteed`/`artFlat`/`relPct`/`totalOf` à
partir de `minStats`/`maxStats` — trois implémentations qui auraient pu
diverger. Regroupé dans `deriveMinMaxContext` (interne à `runeBuildOptim.ts`),
réutilisée par les trois. Vérifié sans régression sur l'intégralité du
harnais existant (recherche réelle inchangée, refactor pur).

### Suite — repli EXACT avant `activeSets`/`computeStats` dans la boucle d'appariement

Avant ce correctif, CHAQUE paire explorée dans `searchBuildsSteps`
(`for comboB of bB.combos`) allouait le tableau des 6 runes, appelait
`activeSets` puis `computeStats`, AVANT même de vérifier si la paire pouvait
satisfaire les minimums/maximums demandés — y compris pour l'écrasante
majorité des paires vouées à échouer sur une recherche serrée.

**Constat qui a permis le correctif** : `comboA.pct[k] + comboB.pct[k]`
(+ `flat`) — déjà accumulés par moitié, voir `HalfCombo` — est EXACTEMENT ce
que `computeStats` calculerait pour la stat `k` sur les 6 runes réunies :
même formule (`totalOf`, `base + ceil(base×pct/100) + flat` pour PV/ATQ/DEF,
`base + flat` sinon). Un repli sur pure arithmétique, EXACT (pas une borne
optimiste comme `comboAOk`/`pairFeasibleMin` plus haut), suffit donc à
rejeter une paire sans jamais allouer le tableau de runes ni appeler
`activeSets`/`computeStats` — reporté à APRÈS ce repli, uniquement pour les
paires qui le passent.

⚠️ Ne remplace PAS la revérification finale sur les VRAIES stats plus bas :
`guaranteed` (le bonus de set) suppose TOUJOURS que seuls les sets de
`requirement.sets` sont actifs — le cas marginal où les emplacements
« libres » d'un combo formeraient EUX-MÊMES un bonus de set non demandé
échappait à ce repli, comme il échappait déjà à `comboAOk` — **corrigé**,
voir « Suite — bonus de set NON demandé anticipé dès le pré-filtrage »
ci-dessous ; `computeStats`, toujours appelé en aval, reste la décision
finale.

**Mesuré sur des comptes réels**, budget de nœuds identique avant/après (le
correctif change la VITESSE, jamais QUELS candidats sont explorés) :

| Cas | Avant | Après |
|---|---|---|
| Deck 10, Lushen | 57-66 s | **12,8 s** (≈×4,5) |
| Sonia, deck 14 | 81-89 s | **24,3 s** (≈×3,5) |
| Deck 11, Lushen | 33-36 s | **14,8 s** (≈×2,3) |
| Eivor, deck 2 défense (7 conditions, cas non résolu ci-dessus) | 243,6 s | **104,5 s** (≈×2,3) |

Confirmé sans régression sur l'intégralité du harnais existant, y compris le
test différentiel (meet-in-the-middle vs brute-force). Le cas Eivor reste
non résolu après ce correctif (0/6 rune en commun avec le meilleur candidat)
— attendu : accélérer la recherche ne change pas QUELS candidats sont
explorés, voir « Limites connues ».

### Suite — dominance de demi-builds (skyline), mesurée puis écartée

Piste explorée en prototype avant intégration : généraliser la dominance de
runes individuelles (`isDominated`/`pruneDominated`, voir « Algorithme »)
UN CRAN AU-DESSUS, sur des demi-builds de 3 runes (`HalfCombo`). Un
demi-build A est dominé par B si B est AU MOINS aussi bon que A sur CHAQUE
dimension suivie (pct et flat comparés SÉPARÉMENT — même piège que
`isDominated` à éviter, mélanger les deux échelles serait faux), avec un
avantage strict quelque part — une PREUVE, comme la dominance de runes
individuelles, pas une heuristique de plus.

Implémenté en PROTOTYPE OPT-IN dans `runeBuildOptim.ts`
(`dominatesHalfCombo`, `insertIntoSkyline`, paramètre `skylineKeys?` de
`buildBuckets`) : `undefined` par défaut sur TOUS les appels de production
actuels — coût nul, comportement inchangé, vérifié sans régression sur
l'intégralité du harnais (336 vérifications). Mesuré via
[scripts/monster-search-skyline-diag.ts](scripts/monster-search-skyline-diag.ts)
sur des comptes réels, à dimensionnalité croissante :

| Cas | Dimensions suivies | Surcoût construction |
|---|---|---|
| Deck 10 | 3 (atk, cr, cd) | ×2,19 (6,4 s → 14,0 s) |
| Sonia, deck 14 | 4 (+ spd) | ×6,96 (15,2 s → 106,1 s) |
| Eivor, deck 2 défense | 7 (hp, atk, def, spd, cr, cd, res) | **jamais terminé** — 62 min de temps CPU continu (quasi 100 % d'un cœur), toujours pas de résultat même pour la passe DE RÉFÉRENCE (sans skyline), tâche arrêtée manuellement |

**Constat** : le surcoût croît beaucoup plus vite que linéairement avec le
nombre de dimensions suivies — une « malédiction de la dimensionnalité »
confirmée par la mesure, pas seulement supposée en théorie. À 7 dimensions
(le cas Eivor, précisément celui qui aurait le plus besoin d'un filet
complémentaire), même la construction PAR TRANCHES existante (sans aucune
skyline) devient déjà coûteuse : à 7 `retentionKeys`, `buildBuckets`
maintient 9 tranches par compartiment (1 générique + 1 combinée + 7 par
stat) sur des pools de plusieurs centaines de runes par emplacement.

**Décision : NON intégrée à la recherche de production.** Le code reste dans
le dépôt, testé
([tests/rune-optim.test.ts](tests/rune-optim.test.ts), 11 vérifications) et
zéro-coût par défaut, au cas où un usage à faible dimensionnalité (≤ 3-4
`retentionKeys`) le justifierait plus tard — mais aucun appel de production
ne passe `skylineKeys` aujourd'hui.

⚠️ **Une variante « k-dominante » (dominé sur AU MOINS k des n dimensions,
pas nécessairement toutes) a été envisagée puis écartée sans être
construite** : relâcher le critère de dominance casse justement la propriété
qui rendait la skyline stricte intéressante (une PREUVE, jamais un
demi-build utile écarté à tort) — avec k < n, ça redevient une heuristique
comme une autre, qui referait alors le même travail que le système de
tranches par `retentionKey` DÉJÀ en production (garder les meilleurs par
dimension), mais à un coût moins prévisible (comparaison contre chaque
membre existant de la skyline, O(taille × n) par insertion) pour une taille
de skyline toujours inconnue sans nouvelle mesure — contre un coût déjà
borné et linéaire (`bucketCap` par tranche) pour le système existant.

### Suite — bonus de set NON demandé anticipé dès le pré-filtrage (`guaranteedMin`)

Correctif du cas limite ci-dessus (repéré théoriquement en amont, confirmé
par un scénario différentiel dédié — un set demandé sans bonus de stat + un
set Taux Crit accidentel sur les emplacements libres, seul moyen d'atteindre
le minimum posé : le moteur éliminait à tort la totalité du pool dès
`eliminateInfeasible`, avant même le meet-in-the-middle, alors que la
combinaison était réellement valide).

**Principe** : `guaranteedSetBonus` reste inchangé (ne compte QUE les sets de
`requirement.sets`), mais une nouvelle fonction,
`unrequestedSetBonusHeadroom(pool, requirement, base)`, calcule EN PLUS une
borne SÛRE mais délibérément GROSSIÈRE du bonus qu'un set NON demandé
pourrait apporter en s'activant sur les emplacements « libres » (`6 -
setsCost(requirement.sets)`) : pour chaque set À BONUS DE STAT
(`SET_STAT_BONUS` — Energy, Guard, Swift, Fatal, Blade, Rage, Focus, Endure)
absent de `requirement.sets`, si le pool en contient assez pour remplir au
moins une activation dans le budget d'emplacements libres, son bonus est
ajouté. Compté GLOBALEMENT (tous emplacements confondus, sans répartition
précise ni exclusion des runes déjà utilisées ailleurs) — même philosophie
que `diagnoseFeasibility` (« une borne optimiste par stat isolée, jamais une
preuve de faisabilité conjointe ») : peut surestimer ce qu'une paire de
demi-builds précise atteint RÉELLEMENT, jamais le sous-estimer — la
revérification via `computeStats` reste, comme toujours, la seule décision
finale.

⚠️ **Réservé aux vérifications de MINIMUM, jamais de maximum** — dissymétrie
volontaire : un bonus qui POURRAIT s'activer ne DOIT pas s'activer (un build
peut toujours écarter les runes du set en question), l'inverse exact du
raisonnement pour un minimum, où seul le MEILLEUR cas compte. L'ajouter au
plancher d'un maximum aurait réintroduit, à l'envers, le même genre de faux
rejet que ce correctif élimine côté minimum. Le combiner à `guaranteedSetBonus`
donne `guaranteedMin`, un nouveau champ de `MinMaxContext` (interne), utilisé
à la place de `guaranteed` PARTOUT où un calcul isole le MEILLEUR cas
atteignable : `eliminateInfeasible` (bestPct/bestFlat), `pairFeasibleMin`,
`comboAOk` (repli côté minimum), `quickOk` (repli côté minimum), et le
palier 1 du diagnostic (`diagnoseFeasibility`, bestPct/bestFlat — le même
angle mort pouvait aussi afficher à tort « mathématiquement hors de
portée »). `guaranteed` (sans le supplément) reste utilisé tel quel pour
CHAQUE calcul de maximum (worstPct/worstFlat, plancher du diagnostic) —
inchangé, toujours correct sans ce correctif.

**Coût** : `unrequestedSetBonusHeadroom` est calculée UNE SEULE FOIS par
recherche (O(taille du pool) + O(8 sets à bonus)), jamais dans la boucle
chaude d'appariement — le surcoût est négligeable, confirmé sur un compte
réel (recherche complète sur un monstre réel : ~16,5 s pour 5 000 001 nœuds
explorés, cohérent avec les mesures de vitesse précédentes, aucune
régression perceptible).

Vérifié : le scénario différentiel dédié
([tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts))
trouve désormais la combinaison (Taux Crit = 27, base 15 + bonus Blade
accidentel 12, exactement la valeur attendue), sans régression sur
l'intégralité du harnais existant (339 vérifications) ni sur `tsc --noEmit`.

### Suite — parallélisation de la construction des deux moitiés (2 Workers)

`buildBuckets('A', …)` et `buildBuckets('B', …)` sont deux appels
INDÉPENDANTS (aucun ne dépend du résultat CONSTRUIT de l'autre — seulement de
`maxSetsForA`/`maxSetsForB`, deux bornes calculées d'avance à partir du pool,
jamais du contenu des compartiments de l'autre moitié), mais tournaient en
série sur un seul cœur. Les lancer chacun dans son propre Worker les fait
tourner sur deux cœurs à la fois.

**Refactor préalable, comportement inchangé** : `searchBuildsSteps` (jusque-là
un seul bloc : préparation → `buildBuckets('A')` → `buildBuckets('B')` →
appariement) est scindé en `prepareSearch` (préparation, pure, retourne un
contexte `PreparedSearch` partagé) et `pairBuckets` (l'appariement, inchangé,
reçoit les deux moitiés déjà construites). `searchBuildsSteps` redevient un
simple enchaînement des trois — utilisé tel quel par `searchBuilds`, les
tests et les scripts, qui n'ont pas besoin de paralléliser. Vérifié IDENTIQUE
par l'intégralité du harnais existant (comportement, pas seulement
compilation).

**Côté Worker** (`runeBuildOptim.worker.ts`) : appelle `prepareSearch`, puis
lance A et B chacun dans un nouveau Worker dédié
([src/workers/buildHalf.worker.ts](src/workers/buildHalf.worker.ts),
minimal — pilote juste `buildBuckets` pas à pas), attend les deux
(`Promise.all`), puis pilote `pairBuckets` pas à pas comme avant. Un arrêt
manuel PENDANT la construction tue directement les deux Workers enfants
(`terminate()`, cascade garantie par la spec HTML sur les Workers imbriqués)
plutôt qu'un arrêt coopératif à répercuter sur deux Workers à la fois — plus
simple et tout aussi fiable, `buildHalf.worker.ts` n'a donc besoin de gérer
qu'un seul message (la demande initiale).

**UI** ([useBuildOptimSearch.ts](src/hooks/useBuildOptimSearch.ts),
[OptimizerSection.tsx](src/components/outils/OptimizerSection.tsx)) : deux
barres de progression empilées pendant la phase `building` (une par moitié,
`halves.A`/`halves.B` accumulées indépendamment dans l'état — l'ancien
`progress` ne gardait que le DERNIER message reçu, ce qui aurait fait
« disparaître » une moitié dès que l'autre poste un message).

**Deux bugs trouvés et corrigés en usage réel** (vérification en navigateur,
pas seulement `tsc`/tests — voir la note de bas de section « Vérification ») :

1. **Message tardif d'une recherche déjà remplacée.** Relancer une recherche
   pendant qu'une précédente tournait encore pouvait figer l'affichage avec
   une valeur périmée : `cancel()` tue l'ancien Worker, mais un message qu'il
   avait DÉJÀ posté juste avant peut encore être délivré après coup, et son
   gestionnaire restait branché. Plus probable depuis ce correctif (deux
   Workers enfants de plus par recherche, donc deux fois plus de messages en
   vol à l'instant d'un arrêt/relance). **Corrigé** : chaque `run()`
   incrémente un `runId` ; tout message reçu par un gestionnaire qui ne porte
   plus le `runId` COURANT est ignoré — indépendant de la rapidité réelle de
   `terminate()`.
2. **La barre ne semblait jamais atteindre 100 %.** Le calcul, LUI, allait
   bien jusqu'au bout (la boucle qui pilote `buildBuckets` dans
   `buildHalf.worker.ts` ne saute JAMAIS une étape de `gen.next()`, seulement
   des `postMessage` throttlés) — mais les tout derniers points de passage
   tombaient souvent dans la même fenêtre de throttle que le précédent et
   étaient absorbés, sans qu'aucun message final ne suive. Aggravé par un
   second throttle, PARTAGÉ entre les deux moitiés, côté relais du Worker
   parent (un message de A pouvait faire sauter celui de B juste après, et
   inversement). **Corrigé** : un point de passage final GARANTI (scanned =
   total), jamais throttlé, envoyé juste avant le résultat de chaque moitié ;
   le relais du parent ne throttle plus (chaque enfant throttle déjà ses
   propres messages, un double throttle partagé n'apportait rien qu'un risque
   d'interférence entre les deux moitiés).

⚠️ Aucun des deux bugs n'affectait la JUSTESSE du résultat final (les
demi-builds manquants à l'écran l'étaient uniquement dans l'AFFICHAGE, jamais
dans le calcul réellement utilisé par `pairBuckets`) — confirmé en relisant
le code AVANT de corriger, pas juste supposé après coup.

**Vérification** : `tsc --noEmit` et les 339 vérifications existantes après
chaque changement (le refactor `prepareSearch`/`pairBuckets` est un
comportement PROUVÉ identique par le harnais différentiel) ; `npm run build`
confirme que Vite bundle correctement le Worker imbriqué (chunk
`buildHalf.worker-*.js` séparé). Le fonctionnement RÉEL en navigateur (deux
Workers effectivement parallèles, cohérence de l'affichage, bouton Arrêter
pendant les deux phases) a été testé par l'utilisateur — aucun outil
d'automatisation de navigateur n'était disponible pour le vérifier de façon
autonome.

### Suite — escalade automatique du budget de nœuds

**Signalé sur un vrai compte** (Sonia, `tototriou-12889591.json`, deck 6
offense — set Swift, statistique principale VIT/Taux Crit/ATQ%, objectif
Dégâts, 4 minimums à la fois ATQ/VIT/Taux Crit/Dmg Crit exactement aux
valeurs réelles) : introuvable malgré « Utiliser tout l'inventaire » cochée.
Diagnostic (`monster-search-buildbuckets-diag.ts`, `half-build-rank-diag.ts`,
scripts de mesure) : les deux demi-builds réels étaient bien présents et
atteignables dans leurs compartiments (rang #813/7581 en A, #5717/7988 en
B — classés loin, mais PRÉSENTS, pas éliminés), et un build équilibré sur
les 4 stats à la fois se classe structurellement bas dans un tri qui ne
regarde que le MEILLEUR axe pris isolément (même mécanisme documenté plus
haut pour deck 10 Lushen, confirmé par la mesure : le `relevanceScore` du
demi-build réel de Sonia dépassait celui des 10 mieux classés du même
compartiment — ce n'est pas un demi-build médiocre, c'est un généraliste
noyé parmi des spécialistes).

**Le vrai obstacle n'était pas cet ordre, mais le budget.** Le plafond
adaptatif (`adaptiveMaxNodes`) s'épuisait en 22 s (38 400 000 nœuds, 0
résultat) — alors que le filet de TEMPS réel de l'écran est de 10 minutes
(`HARD_TIMEOUT_MS`). Un plafond de nœuds relevé à la main (500 000 000, même
budget-temps) retrouve le build exact en 32 s, en n'explorant que 86,8M
nœuds — bien moins que le plafond relevé, et surtout bien moins que le
temps disponible ne l'aurait permis. `adaptiveMaxNodes` est calibré sur
d'anciens cas réels pour rester dans les 30-100 s (voir les calibrages
successifs de `BUCKET_CAP`/`DEFAULT_MAX_NODES` plus haut), mais ne
s'adapte PAS à la vitesse réelle observée sur CE compte précis : un compte
qui va vite épuise son budget de nœuds bien avant son budget de temps, sans
jamais s'en servir.

**Corrigé par une escalade automatique, pas par un nouveau calibrage
statique** — les calibrages précédents ne faisaient que reculer le même mur
d'un cran (voir « Suite — BUCKET_CAP relevé une troisième fois »), et
relever la valeur DE BASE pénaliserait tous les cas rapides en les faisant
tourner plus longtemps pour rien. À la place :

- `pairBuckets` reçoit désormais un `NodeBudget` — un objet **MUTABLE**
  (`{ max: number }`), pas un nombre figé. Par défaut (tout appelant qui ne
  fournit rien : `searchBuildsSteps`, `searchBuilds`, les tests, les
  scripts) : `{ max: prepared.maxNodes }` jamais muté, comportement
  STRICTEMENT identique à avant.
- Le Worker ([runeBuildOptim.worker.ts](src/workers/runeBuildOptim.worker.ts))
  construit ce `NodeBudget` lui-même et le RELÈVE (×2) entre deux points de
  passage dès qu'il s'approche du plafond courant, tant qu'il reste du
  budget-temps (marge de sécurité 95 % de `maxMs`) et que le plafond de
  candidats n'est pas déjà atteint. Le générateur `pairBuckets`, DÉJÀ piloté
  pas à pas pour la barre de progression et le bouton Arrêter, continue
  alors EXACTEMENT où il en était (mêmes compartiments, mêmes combos,
  `explored` jamais remis à zéro) — ni `prepareSearch`, ni `buildBuckets`
  (les deux moitiés), ni la moindre paire déjà explorée ne sont jamais
  recalculés. Le budget-TEMPS (`overBudget`, déjà vérifié par `pairBuckets`
  lui-même, jamais dupliqué) reste l'arbitre final : une recherche sans
  réponse s'arrête toujours par manque de TEMPS, plus par manque de nœuds.
- ⚠️ **Piège rencontré en écrivant le test** (et donc un vrai risque
  d'implémentation à retenir) : le relais ne peut intervenir qu'à un POINT
  DE PASSAGE (`yield`, tous les `CHECKPOINT_EVERY` = 500 nœuds), alors que
  le repli interne (`explored > nodeBudget.max`) est vérifié à CHAQUE paire.
  Un plafond relevé avec une marge PLUS PETITE que `CHECKPOINT_EVERY`
  arriverait trop tard — la recherche aurait déjà tronqué avant le
  prochain point de passage. D'où la marge `<= CHECKPOINT_EVERY` (pas un
  chiffre arbitraire) dans la condition d'escalade du Worker.
- La barre de progression (`estimatePct`) utilise désormais le plafond
  VIVANT (`nodeBudget.max`), pas la valeur figée d'origine — sans ça, elle
  resterait bloquée à 100 % (ou au-delà) après une escalade. Un recul
  visible de la barre au moment d'une escalade est attendu, et bien moins
  trompeur qu'un 100 % qui ne correspondrait plus à rien.

**Vérifié** : un test dédié
([tests/rune-optim.test.ts](tests/rune-optim.test.ts)) pilote `pairBuckets`
à la main avec un plafond initial minuscule, l'escalade progressivement
(comme le Worker) et vérifie que le nombre de paires explorées et de
candidats trouvés est EXACTEMENT identique à une recherche avec un grand
plafond dès le départ — la garantie qui compte n'est pas seulement « le
résultat final est correct » (un déterministe qui relancerait tout depuis le
début le serait aussi), mais que `nodeBudget.max` est bien lu EN DIRECT à
chaque vérification, jamais figé au démarrage du générateur. 345
vérifications passent, `tsc --noEmit` propre, `npm run build` inchangé.

⚠️ Ne règle pas nécessairement TOUS les cas difficiles (Eivor à 7 conditions
reste un cas à part, voir plus haut) — mais répond directement au cas où le
budget de nœuds s'épuise bien avant le budget-temps, ce qui semble être la
situation la plus courante sur un compte avec beaucoup de runes.

### Suite — espace de recherche affiché en direct, puis affiné en DEUX passes

Ajouté dans la foulée : l'écran affiche désormais, pendant la phase
d'appariement, le plafond de nœuds VIVANT (`nodeBudgetMax`, qui grandit avec
l'escalade ci-dessus) et la taille RÉELLE de l'espace de recherche à épuiser
(`totalPairCount` — le nombre de paires (comboA, comboB) que l'algorithme
visiterait au pire, calculé une fois les deux moitiés construites, PAS
l'estimation brute pré-recherche déjà existante).

**Première version trop large, corrigée en DEUX temps sur le MÊME
signalement réel** (Sonia, deck 6) — les deux versions intermédiaires ont
été vérifiées directement sur ce cas via les scripts de diagnostic
(`monster-search-focused-diag.ts`) avant d'être retenues, pas seulement
supposées correctes :

1. **v1 (sets/joker seuls)** : espace annoncé à 652M, recherche EXHAUSTIVE
   (pas tronquée) arrêtée à ~87M — l'écran laissait croire à tort qu'il
   restait ~85 % du travail.
2. **v2 (+ `pairFeasibleMin`)** — le filtre qui élimine toute une paire de
   compartiments dont même le MEILLEUR cas combiné (bornes `maxPct`/
   `maxFlat` du COMPARTIMENT) ne peut pas atteindre les minimums. **Mesurée
   AVANT d'être présentée comme LA correction : 652M → 638M seulement.**
   Cette borne, agrégée au niveau du compartiment entier, est trop
   optimiste pour rejeter grand-chose sur un pool large et varié — chaque
   stat individuelle atteint son maximum QUELQUE PART dans le compartiment,
   même si aucun VRAI demi-build ne les atteint toutes à la fois. Le vrai
   écart (638M → ~87M) était ailleurs.
3. **v3 (+ `comboAOk`)** — le filtre qui élimine un comboA PRÉCIS (pas une
   borne de compartiment agrégée) apparié au MEILLEUR cas de la moitié B.
   Vérifiée directement sur le cas Sonia AVANT d'être retenue : `638M` →
   **86 818 232**, identique AU NŒUD PRÈS au nombre réellement exploré par
   la recherche exhaustive sur ce cas précis.

Les deux filtres sont désormais factorisés (`bucketPairFeasibleMin`,
`comboAFeasible`) pour que `pairBuckets` (l'appariement réel) et
`totalPairCount` (l'estimation) appliquent EXACTEMENT les mêmes filtres —
aucun risque de désaccord entre ce qui est annoncé et ce qui est réellement
visité, puisque ce n'est plus deux implémentations séparées. Coût
additionnel : O(Σ comboA par paire de compartiments compatible) — jamais la
boucle B (comboB), donc toujours bien moins cher que la recherche
elle-même (143 099 comboA vérifiés sur le cas Sonia, contre 86,8M paires
que la vraie recherche visite).

⚠️ Reste, en toute rigueur, une borne SUPÉRIEURE et non le compte exact
garanti dans TOUS les cas — `quickOk` (l'ultime repli EXACT par PAIRE,
DANS la boucle B elle-même) pourrait en théorie réduire encore, et le
reproduire ici referait tout le travail de la boucle. En pratique, sur le
cas réel mesuré, `pairFeasibleMin` + `comboAOk` suffisaient à retomber
EXACTEMENT sur le compte réel — documenté à l'écran comme « au pire »,
prudence qui reste justifiée même si l'écart observé est souvent nul.

**Vérifié** : sur les 15 scénarios aléatoires du harnais différentiel
(sets/minStats variés, plusieurs compartiments — contrairement au pool
synthétique à un seul compartiment utilisé pour vérifier l'escalade), la
propriété `totalPairCount ≥ paires réellement explorées` (recherche
exhaustive) est vérifiée systématiquement — la plupart des scénarios
tombent EXACTS, comme sur le cas réel. 361 vérifications passent au total,
`tsc --noEmit` propre.

⚠️ **Leçon retenue** : la première mesure (v2, `pairFeasibleMin` seul) a
été prise APRÈS avoir présenté la correction comme faite, pas avant — elle
a révélé que l'hypothèse initiale (« c'est `pairFeasibleMin` qui manque »)
était incomplète. Mesurer sur le cas réel AVANT d'annoncer un correctif
comme résolu (pas seulement après) reste la discipline à suivre.

### Suite — activation supplémentaire d'un set DÉJÀ demandé (`additionalSetActivationHeadroom`)

**Signalé sur un vrai compte** (`ß☆Enzo-6399149.json`, Ciri, défense équipe
3 — statistique principale PV/PV/PV, objectif PV effectifs, PV/DEF/VIT/
Précision exacts) : demander Energy(2p)+Shield(2p)+Energy(2p) retrouve le
build réel ; relâcher à Energy+Shield SEUL (retirer une des deux occurrences
d'Energy — une contrainte strictement plus large) ne le retrouve PAS, alors
que les DEUX demi-builds réels restent parfaitement présents et bien classés
dans leurs compartiments (`rang #1290/4655` et `#2/784` — PAS le mécanisme de
dilution ci-dessus, vérifié explicitement en isolant les deux causes).

**Cause distincte, confirmée par la mesure** : `guaranteedSetBonus` ne
compte QU'UNE activation d'Energy (une seule occurrence dans
`requirement.sets`, soit `pct.hp = 15`), alors que le build réel active
Energy **deux fois** (`activeSets` sur le build réel : `energy+shield+
energy`) — +30 % PV réels, pas +15 %. `eliminateInfeasible`/`pairFeasibleMin`/
`comboAOk` sous-estiment donc le PV maximal atteignable et rejettent le
build à tort, avant même la revérification finale. Même famille que le
correctif « bonus de set NON demandé » plus haut, mais pour un set qui EST
demandé — un angle mort différent, non couvert par `guaranteedMin` tel
qu'il existait.

**Corrigé en généralisant** `unrequestedSetBonusHeadroom` en
`additionalSetActivationHeadroom` : la MÊME formule couvre maintenant les
deux cas — un set NON demandé a 0 pièce déjà réservée par
`guaranteedSetBonus` (comportement inchangé) ; un set DÉJÀ demandé `n` fois
a `n × setPieces(set)` pièces déjà réservées, et seul le SURPLUS de pièces
disponibles dans le pool AU-DELÀ de cette réserve compte comme headroom
supplémentaire. Un seul appel, un seul filtre, à la place de deux concepts
séparés.

⚠️ **Fausse piste explicitement écartée avant ce correctif** : le joker
(rune Intangible) présent sur le build cible n'est PAS la cause — vérifié en
isolant le headroom (voir « Suite — dilution des compartiments » ci-dessus,
même vérification appliquée ici) : ni la cause de ce bug-ci, ni du bug de
dilution des compartiments. Les DEUX bugs se sont avérés indépendants, tous
les deux confirmés par la mesure avant correction.

**Vérifié** : un scénario différentiel dédié
([tests/rune-optim-differential.test.ts](tests/rune-optim-differential.test.ts))
— Energy demandé une fois, le pool en fournit 4 (2 activations réelles),
Shield comble les emplacements restants, aucune rune ne porte de PV brut —
confirme que le moteur trouve désormais la combinaison (PV = base(8000) +
2×15 % = 10400), avec Energy réellement actif deux fois. Reproduit sur le
compte réel : le build Ciri est retrouvé de façon exhaustive
(`totalPairCount` = paires explorées = 5 817 892, aucune troncature).
Sonia (deck 6, le cas ayant motivé le premier correctif `guaranteedMin`)
revérifié sans régression après cette généralisation — mêmes 86 818 232
paires, même résultat. 365 vérifications passent, `tsc --noEmit` propre.

### Suite — relecture critique du pipeline, et BUCKET_CAP relevé une quatrième fois

Après les deux correctifs ci-dessus (dilution Lushen documentée comme
limite, angle mort Ciri corrigé), relecture volontairement critique de tout
le pipeline (`filterSlot` → `buildBuckets` → `pairBuckets`) pour distinguer
trois choses : de vrais problèmes, des constantes calibrées à la main jamais
retestées, et des décisions prises pour un problème qui ne se pose peut-être
plus. Constat central : **le rejet historique de `bucketCap=2000`** (voir
« BUCKET_CAP relevé une troisième fois » plus haut) **supposait un budget de
paires FIXE** — un compartiment plus gros coûte plus cher à parcourir, donc
sans plus de budget, la recherche épuise son budget sur MOINS de paires,
faisant reculer un résultat déjà trouvé. Cette hypothèse a cessé d'être
vraie depuis l'escalade automatique du budget de nœuds (voir « Suite —
escalade automatique du budget de nœuds » plus haut) : l'ancien raisonnement
ne s'applique qu'à budget figé, or ce n'est plus le cas.

**« Phase 0 » — remesuré, pas supposé.** Les deux scripts de mesure
([scripts/set-relax-diag.ts](scripts/set-relax-diag.ts),
[scripts/monster-search-validate.ts](scripts/monster-search-validate.ts))
ont d'abord dû être corrigés pour rejouer la VRAIE escalade (identique à
`runeBuildOptim.worker.ts` : `nodeBudget` mutable relevé entre deux appels à
`gen.next()`) au lieu d'appeler `searchBuilds` à budget fixe — sans quoi
`bucketCap` plus haut aurait mécaniquement reproduit le rejet historique
sans jamais tester l'hypothèse. Batterie rejouée à `bucketCap=1500`
(l'ancien défaut) contre `3000`, sur TOUS les cas réels connus :

| Cas réel | 1500 | 3000 |
|---|---|---|
| Lushen deck 15, Rage+Blade (set réel) | trouvé | trouvé, 13,2 s, exhaustif |
| **Lushen deck 15, Rage seul (cas cible)** | ❌ absent, exhaustif à 110M paires | ✅ **trouvé, 51,7 s, exhaustif (297M paires)** |
| Lushen deck 10 (tototriou, cas du rejet historique) | trouvé, 37,0 s | trouvé, 130,1 s |
| Lushen deck 11 (tototriou) | trouvé | trouvé, 1,7 s |
| Sonia deck 6 (tototriou) | trouvé, 13,9 s | trouvé, 58,0 s |
| Sonia deck 14 (4 minimums) | trouvé, 36,9 s | trouvé, 106,9 s |
| Ciri défense équipe 3 | trouvé, < 1 s | trouvé, < 1 s |

Aucune régression sur aucun cas déjà acquis — le pire temps mesuré (130 s,
deck 10 Lushen) reste largement sous les 10 minutes réelles de l'écran
(`HARD_TIMEOUT_MS`). Et ça résout le cas cible (Lushen deck 15, `rage`
demandé seul) sans aucune formule de mise à l'échelle par `distinctKeys` —
un simple relèvement de constante, validé sur toute la batterie.
**`BUCKET_CAP` relevé 1500 → 3000** (`runeBuildOptim.ts`).

⚠️ **Découverte annexe, hors périmètre de cette recalibration** : le cas
Eivor (défense deck 2, 7 conditions à la fois — déjà documenté comme cas à
part, voir « Suite — filterSlot élargi… ») échoue pour une raison DIFFÉRENTE
et indépendante de `bucketCap` : `buildBuckets` (qui n'est borné par aucun
budget de temps) prend à lui seul plus de temps que `maxMs`, donc
`pairBuckets` démarre déjà hors budget-temps (1 seule paire explorée avant
arrêt, mesuré). La phase de construction devrait sans doute avoir son propre
filet de temps — non traité ici, à reprendre avec le point 4 de la todo de
réflexion (pondération adaptative).

### Suite — point 4 (pondération adaptative par tranche) : méthodologie de test AVANT implémentation

**Le constat de départ** (repris de la discussion sur les stats principales,
voir plus haut) : `buildBuckets` donne aujourd'hui le MÊME budget
(`bucketCap`) à CHAQUE tranche par stat, qu'elle soit tendue (peu de
demi-builds y excellent, une tranche dédiée protège quelque chose de réel)
ou molle (presque tout demi-build déjà bon la satisfait, une tranche dédiée
n'ajoute presque rien à ce que la tranche générique couvre déjà). Avant
d'écrire une ligne de code dans `buildBuckets`, toute cette section construit
l'infrastructure de mesure et vérifie que l'hypothèse tient — dans l'esprit
déjà établi sur ce document (mesurer avant de conclure, `pairFeasibleMin`
étant le contre-exemple cité en interne de ce qui arrive quand on ne le fait
pas).

**Philosophie retenue pour juger tout changement sur ce moteur, pas
seulement le point 4** : deux axes, jamais un seul.
1. **Correction** — le changement permet-il de retrouver des builds qu'on ne
   retrouvait pas avant (sans jamais en faire perdre un déjà acquis) ?
2. **Vitesse jusqu'à la RÉPONSE**, pas jusqu'à la fin de la recherche — le
   temps qui compte pour l'utilisateur est celui entre le clic sur
   « Rechercher » et l'apparition du build cible parmi les candidats, PAS le
   moment où la recherche s'arrête (elle continue ensuite jusqu'au budget ou
   au budget-temps, fidèle au moteur réel, mais ça n'intéresse plus
   l'utilisateur une fois la réponse trouvée).

**Infrastructure construite pour l'axe vitesse — [scripts/perf-battery.ts](scripts/perf-battery.ts)**,
avec un historique persistant suivi par git
([scripts/perf-baseline.json](scripts/perf-baseline.json)) pour comparer un
changement futur à un « avant » réel, pas reconstruit de mémoire. Plusieurs
écueils rencontrés et corrigés EN CONSTRUISANT cet outil, tous instructifs :
- **Chaque mesure tourne dans son PROPRE processus** (répétée `--repeats`
  fois, le minimum retenu) : enchaîner 7 cas dans un seul processus long
  fait dériver la mesure d'un facteur ×10 à ×27 sur les cas les plus légers
  (pression mémoire/GC accumulée par les cas précédents, pas un vrai
  ralentissement algorithmique) — a fait échouer un cas à tort avant
  correction.
- **Chronométré depuis `prepareSearch`, décomposé par PHASE** (préparation /
  construction / appariement, cette dernière encore scindée en « jusqu'au
  build trouvé » et « reste jusqu'à épuisement ») — une première version qui
  ne chronométrait que l'appariement (comme les scripts de la Phase 0)
  masquait un coût de construction resté invisible dans TOUTES les mesures
  précédentes de ce document.
- **La construction des deux moitiés tourne en vrai parallèle**, via deux
  `worker_threads` Node (équivalent serveur des deux Web Workers de l'app
  réelle, voir « Suite — parallélisation… » plus haut) — une version
  antérieure les construisait séquentiellement dans le même processus,
  gonflant artificiellement le temps de construction mesuré.
- **Conditions vérifiées fidèles à l'écran réel, point par point** avant
  toute mesure jugée valable : `maxMs=HARD_TIMEOUT_MS` (10 min, pas une
  valeur plus courte inventée), `slotFilterCap=80` (preset « Moyen », le
  défaut réel), `bucketCap`/`maxNodes` non surchargés (défauts de
  production), `metric='eff'` et `artifacts`/`relic` alignés sur les
  défauts réels de l'écran.
- **Les paramètres réellement utilisés sont enregistrés dans chaque entrée
  de la baseline** (`bucketCap`, `slotFilterCap`, `retentionKeys`,
  `minStats`…) — pour qu'un futur changement de constante se voie dans le
  diff du fichier suivi par git, sans avoir à deviner sous quelles
  conditions un ancien chiffre a été mesuré.

**Signal retenu pour piloter la pondération — écarté puis trouvé.**
`diagnoseFeasibility` (déjà dans le code, utilisé pour le diagnostic à 0
résultat) a été essayé en premier — mesuré sur les deux scénarios mainstat
déjà discutés (Vitesse/TC/ATQ vs ATQ/Dégâts Crit/ATQ), l'écart de marge
(« mou ») entre le plafond théorique et le seuil demandé allait dans le bon
sens (140 vs 103) mais restait faible, parce que cette borne est calculée en
ISOLANT chaque stat indépendamment des autres (le meilleur emplacement par
slot POUR CETTE STAT SEULE) — elle ne voit jamais la vraie tension, qui
naît de la CONJONCTION de plusieurs conditions sur les MÊMES 3 runes.
Remplacé par la **dispersion (coefficient de variation) de
`retentionScore(pct, flat, key)`** — EXACTEMENT la métrique déjà utilisée
par le classement réel — mesurée sur la population reconstituée de la
tranche générique (top `bucketCap` par `relevanceScore`, voir
[scripts/retention-dispersion-diag.ts](scripts/retention-dispersion-diag.ts)).
Signal net et mécaniquement explicable, confirmé à la fois en synthétique et
sur la batterie réelle : une stat couverte par une principale garantie dans
une moitié a un CV bas (déjà satisfaite par presque tout le monde) ; une
stat sans cette couverture a un CV nettement plus haut (différencie
vraiment) — jusqu'à ×4 d'écart mesuré sur Lushen entre `cd` (couverte,
CV=0,082) et `cr` (non couverte, CV=0,539) dans la même moitié.

**Cas de stress synthétique — [scripts/stress-tranche-weighting-diag.ts](scripts/stress-tranche-weighting-diag.ts).**
Une condition tendue (Précision, rare dans le pool, aucune principale ne la
couvre) noyée parmi des conditions molles (VIT via principale garantie,
PV/ATQ/DEF abondants en sous-stats). Deux stats initialement retenues pour
le volet molle ont dû être écartées EN CONCEVANT ce cas — pas après coup :
Taux Crit (un seuil dérivé automatiquement pouvait dépasser 100 %, plafond
réel du jeu, rendant le scénario irréaliste) et RES (partage la même
exclusivité de slot que Précision — slot 6 pour les deux — redondant avec le
cas TC/DCC du slot 4 déjà exploré, pas un deuxième angle utile). Résultat :
la moitié B cible reste ABSENTE de tout compartiment retenu même à
`bucketCap` relevé UNIFORMÉMENT à 12 000 (×4 le budget de production),
pendant que les tranches molles restent largement sous-utilisées (CV bas)
au budget de production. **Preuve plus forte que prévu** : un relèvement
uniforme (l'outil déjà en main depuis la Phase 0) a une limite structurelle
— il grossit aussi les tranches qui n'en ont pas besoin, jamais assez
sélectivement celle qui en a besoin. Seule une redistribution CIBLÉE (retirer
aux tranches molles pour donner à la tendue, à budget total inchangé) peut
plausiblement combler cet écart — non vérifiable avec un simple paramètre
existant, exige l'implémentation réelle.

**Deux pistes d'implémentation identifiées, ni l'une ni l'autre codée à ce
stade** — à tester l'une contre l'autre sur `perf-battery.ts` (delta vs
baseline) ET sur le cas de stress ci-dessus avant de choisir :
- **A — accumulateurs vivants pendant la passe unique.** `buildBuckets`
  scanne déjà tous les triplets ; maintenir en plus deux nombres (somme,
  somme des carrés) par `retentionKey`, mis à jour en O(1) à chaque
  insertion/éviction du tas générique, puis élaguer chaque tas par-stat à sa
  taille réallouée une fois le CV connu en fin de passe. Une seule passe,
  CV exact, mais pas d'économie de pic mémoire pendant la construction
  elle-même (les tas grossissent avant d'être réduits).
- **B — proxy analytique par slot, avant la triple boucle.** Mesurer, par
  SLOT (pas par triplet, donc O(pool) et non O(pool³)), la variance déjà
  visible dans les candidats d'un slot pour chaque stat — fixe le budget par
  tranche AVANT de commencer, aucun gaspillage transitoire, aucune passe
  supplémentaire. Approximation plus grossière (ignore les corrélations
  visibles seulement une fois les triplets formés et élagués), jamais encore
  mesurée.
- Une troisième option (deux passes complètes, la plus fidèle) est écartée
  d'emblée : elle doublerait le coût de la phase déjà identifiée comme la
  plus chère pour beaucoup de cas (construction — voir le Chronographe
  Optimizer, `scripts/perf-baseline.json`).

### Suite — piste A implémentée : cinq itérations, une seule qui tient

**Mécanisme retenu.** `buildBuckets` construit chaque tranche par stat en
SURPROVISIONNÉ (`RETENTION_OVERPROVISION_FACTOR × bucketCap` places, facteur
3 retenu — places, pas `bucketCap`) pendant la passe, tout en maintenant un
tas global DÉDIÉ (séparé des tas génériques par compartiment) qui
reconstitue en direct le TOP `bucketCap` par `relevanceScore` sur TOUTE la
moitié — la même population que celle validée par
`scripts/retention-dispersion-diag.ts`. Deux accumulateurs (somme,
somme-des-carrés) PAR `retentionKey`, mis à jour en O(1) à chaque
insertion/éviction de ce tas (`HeapPushResult`, jamais besoin de
reparcourir), donnent le CV de chaque stat une fois la triple boucle
terminée. Chaque tranche par stat est alors ÉLAGUÉE à sa taille réallouée —
budget total inchangé (`retentionKeys.length × bucketCap`), un plancher à
10 % de la part égale, réparti proportionnellement au CV **au carré** (le
linéaire s'est révélé trop timide : un écart de ×3 sur le CV n'ouvrait
qu'environ 50 % du budget total à la tranche dominante).

**Cinq versions du signal de dispersion, dans l'ordre, mesurées sur un
vrai cas de régression (Sonia deck 6, `tototriou-12889591.json`)** :

1. **CV agrégé sur les 3 runes, principale INCLUSE** (première version) —
   régression confirmée : `atk` réduit à 320 places en moitié A, `spd` au
   plancher, `cr` à 300 en moitié B → cible ABSENTE des deux moitiés, alors
   qu'elle était trouvée avant (55,3 s).
2. **Même agrégat, part au CARRÉ** (au lieu de linéaire) — toujours
   régression, la carence venait d'ailleurs.
3. **CV PAR SLOT individuel (3 par stat), principale INCLUSE, maximum
   retenu** — corrige l'intuition (un slot à principale garantie ne doit pas
   écraser la variance des 2 autres) mais introduit un bruit pire : une
   seule rune sans la sous-stat contribue zéro, gonflant artificiellement le
   CV d'un slot (mesuré : `cd` à CV=6,39 en moitié B, écrasant `atk`/`spd`
   au plancher dans les deux moitiés). Toujours régression.
4. **CV agrégé (retour à la version 1), principale EXCLUE du calcul**
   (`runeSubOnlyContribution`, sous-stats + innée uniquement) — **corrige la
   régression**. Root cause confirmée : une principale garantie (ex. Taux
   Crit au slot 4 pour Sonia) contribue une valeur stable à CHAQUE candidat
   de ce slot, noyant statistiquement la vraie dispersion des slots sans
   cette garantie. Une rune ne pouvant JAMAIS avoir sa propre principale
   dupliquée en sous-stat (règle du jeu, voir la mémoire
   sw-rune-mainstat-rules), l'exclure fait tomber la contribution de ce slot
   à EXACTEMENT zéro pour cette stat — pas juste « bas », structurellement
   nul.
5. **CV PAR SLOT, mais cette fois principale EXCLUE aussi** — retestée
   spécifiquement pour vérifier si le bruit de la version 3 venait d'un
   mélange des deux problèmes (principale qui masque + rareté par rune) ou
   d'un SEUL. Résultat : CV STRICTEMENT IDENTIQUES à la version 3 sur Sonia
   deck 6 (`cd`=6,39 inchangé) — aucun slot n'a Dégâts Crit en principale
   pour ce cas précis (`mainStats={2:VIT,4:TC,6:ATQ%}`), l'exclusion n'avait
   donc rien à retirer. Confirme que le bruit du par-slot est un problème
   DISTINCT et INDÉPENDANT de la principale : la rareté d'une sous-stat sur
   une seule rune (present/absent, effet de seuil) reste bruitée quelle que
   soit la présence d'une principale liée. Toujours régression — la version
   4 (agrégat, principale exclue) reste la seule qui tienne, précisément
   parce que sommer 3 runes lisse déjà ce bruit par construction, sans
   avoir besoin d'un traitement par slot séparé.

**Résultat batterie complète, version 4** (`scripts/perf-battery.ts`, voir
le Chronographe Optimizer) : 7/7 cas trouvés, aucune régression. Sonia
deck 6 non seulement retrouvé mais **9,0 s plus rapide** qu'avant (55,3 s →
46,2 s) ; Sonia deck 14 gagne **19,5 s** (96,2 s → 76,8 s). Les 5 autres cas
sont légèrement plus lents (+1,7 s à +6,2 s) — coût de construction des tas
surprovisionnés, payé même quand la réallocation ne change rien à l'issue.

### Suite — deux cas de stress synthétiques pour valider la piste A

**Premier cas** (`scripts/stress-tranche-weighting-diag.ts`) : une condition
tendue (Précision, rare, aucune principale ne la couvre) noyée parmi des
conditions molles, avec une vague de « spécialistes Précision » injectée
pour créer une vraie compétition. Calibré par tâtonnement, il s'est avéré
**sur-calibré** : la cible reste absente même à `bucketCap` uniforme relevé
à 20 000 (×6,7 le budget de production) — bien au-delà de ce qu'AUCUNE
réallocation raisonnable ne peut combler. Conservé tel quel comme cas
extrême documenté (preuve qu'un relèvement uniforme a une limite
structurelle — il grossit aussi les tranches qui n'en ont pas besoin), mais
écarté comme objectif à atteindre.

**Second cas** (`scripts/stress-tranche-weighting-attainable-diag.ts`),
calibré différemment — mesurer le rang RÉEL de la cible (sans aucun
plafond) AVANT de choisir les paramètres, plutôt qu'ajuster à l'aveugle.
Deux corrections de méthode par rapport au premier cas :
- Les DEUX moitiés ont une principale imposée sur leurs 3 slots à option
  exclusive (VIT/TC/RES) — le premier cas ne contraignait que le slot 2,
  laissant la moitié B ~74× plus grande que la moitié A (pool non filtré
  par principale), donc structurellement hors de portée quel que soit le
  réglage.
- Principales des slots 1/3/5 FIXES (ATQ+/DEF+/PV+ — voir la mémoire
  sw-rune-mainstat-rules), pas tirées au hasard parmi 3 options comme dans
  le premier script — une erreur de modélisation qui, corrigée, a
  elle-même fait exploser la taille du pool (moins de différenciation entre
  candidats similaires → moins d'élagage par dominance) : le pool de base a
  dû être réduit (150 → 40 runes/slot) pour revenir dans une plage
  mesurable.

Rang réel mesuré (sans plafond) : moitié A #3980, moitié B #1910 par
Précision seule — la moitié A dépasse tout juste le plafond de production
(3000). À `bucketCap=3000` avec la piste A active : la tranche `acc`
réalloue à 9000 (moitié A) et 8269 (moitié B), les DEUX moitiés sont
retenues. `totalPairCount` reste réaliste (170M, du même ordre qu'un vrai
cas comme Lushen deck 10) — contrairement au premier cas, ce n'est pas un
extrême artificiel : c'est la démonstration propre qu'on cherchait,
un cas qui échouerait à plafond uniforme et réussit avec la réallocation.

### Suite — bilan de la piste A

**Avantages mesurés** :
- Corrige une régression réelle (Sonia deck 6) tout en l'accélérant.
- Aucune régression sur le reste de la batterie de cas réels connus.
- Démontre un gain de CORRECTION concret sur un cas construit spécifiquement
  pour ça (le second cas de stress), pas seulement un gain de vitesse.
- Le mécanisme retenu (accumulateurs O(1), une seule passe, exclusion de la
  principale) est maintenant bien compris et documenté — la root cause
  (principale garantie qui noie la dispersion) est un principe général,
  pas un rustine ad hoc pour Sonia seule.

**Défauts mesurés** :
- **Coût de construction accru sur la MAJORITÉ des cas** (5/7 cas plus
  lents, +1,7 s à +6,2 s) — le surprovisionnement (×3) des tranches par
  stat se paie même quand la réallocation ne change rien à l'issue de la
  recherche.
- **Il a fallu 5 itérations pour trouver un signal qui ne régresse pas** —
  trois intuitions raisonnables a priori (CV au carré seul ; CV par slot ;
  CV par slot + principale exclue) se sont révélées insuffisantes ou pires à
  l'usage, seulement démasquées par la mesure sur un vrai cas — y compris la
  découverte que le bruit du par-slot est INDÉPENDANT du problème de
  principale (deux causes distinctes, pas une seule à corriger). Signal de
  fragilité : rien ne garantit qu'un cas réel pas encore rencontré ne révèle
  pas un autre angle mort du même genre.
- **Complexité ajoutée non négligeable** : un facteur de surprovision, un
  exposant de mise à l'échelle (carré), un plancher (10 %), un tas global
  supplémentaire par moitié — plusieurs constantes choisies par mesure sur
  une poignée de cas, pas dérivées d'un principe qui garantirait leur
  généralité.
- Le premier cas de stress (extrême) confirme une limite structurelle : au
  DELÀ d'un certain déséquilibre, aucune réallocation à budget total
  constant ne peut suffire — seul un budget total plus grand aiderait, ce
  qui recrée le compromis coût/bénéfice que ce point cherchait justement à
  éviter.

**Conclusion** : la piste A tient sa promesse sur le cas qui l'a motivée et
sur un cas construit pour la tester, sans régression mesurée — mais au prix
d'une complexité et d'un coût de construction réels, et après plusieurs
fausses pistes qui auraient pu passer pour des corrections valables sans la
discipline de mesure déjà établie sur ce document. Elle est un candidat
sérieux, pas une évidence — la comparaison avec la piste B (ci-dessous)
reste nécessaire avant de choisir laquelle adopter, voire si les deux valent
la peine face à leur coût.

### Suite — piste B envisagée à la lumière de la piste A

Le principal enseignement de la piste A à transposer : **la principale d'un
slot doit être exclue du signal de dispersion**, quelle que soit la façon
dont ce signal est calculé — ce n'est pas spécifique à un calcul par
accumulateurs en direct, c'est une propriété du JEU (une rune ne peut
jamais avoir sa propre principale dupliquée en sous-stat) qui s'applique
également à un calcul analytique fait à l'avance.

**Conception envisagée** : au lieu d'accumuler pendant la triple boucle
(coût payé à CHAQUE recherche, y compris les surprovisionnements), calculer
AVANT même de commencer — sur `prepared.filtered[slotIdx]`, le pool DÉJÀ
filtré par slot (centaines de candidats, pas des millions de triplets) —
pour chaque slot de la moitié et chaque `retentionKey`, la moyenne et la
variance de `runeSubOnlyContribution(r, key)` (déjà écrite pour la piste A,
directement réutilisable) sur ce pool. En additionnant les 3 variances par
slot (en supposant une indépendance raisonnable entre slots — pas exacte,
mais un premier ordre défendable) et leurs 3 moyennes, on obtient une
ESTIMATION du CV du demi-build complet, calculée en O(taille du pool), pas
O(pool³) — puis réutiliser EXACTEMENT la même formule de réallocation déjà
validée (part au carré, budget total fixe, plancher à 10 %) pour fixer,
DÈS LE DÉBUT de la triple boucle, la bonne taille de chaque tas par stat —
sans jamais construire en surprovisionné, donc sans le coût de construction
supplémentaire mesuré sur la piste A.

**Pourquoi cette agrégation (somme des variances par slot) plutôt que le
maximum essayé — et raté — en piste A** : la version 3 de la piste A
calculait la variance sur un ÉCHANTILLON dynamique et bruité (les demi-builds
qui survivent effectivement au tas générique, en cours de construction) —
un rune isolé n'ayant simplement pas la sous-stat contribue zéro, gonflant
artificiellement le signal. Ici, la variance se calcule sur le POOL FILTRÉ
COMPLET d'un slot (une centaine à quelques centaines de candidats, une
POPULATION stable, pas un échantillon en évolution) — le même genre de
mesure que celle déjà validée dans `scripts/retention-dispersion-diag.ts`,
juste à un stade plus précoce du pipeline.

**Risque assumé, à mesurer plutôt que supposer** : c'est une APPROXIMATION —
elle ne voit jamais les effets de conjonction qui n'apparaissent qu'une
fois les triplets réellement formés et élagués par faisabilité (le piège
déjà documenté plus haut sur ce point, « l'aiguille dans une botte de
foin »). L'hypothèse d'indépendance entre slots (somme des variances) n'est
pas garantie exacte non plus. Et la construction du second cas de stress
vient de révéler un exemple concret de surprise possible : rendre les
principales des slots 1/3/5 entièrement réalistes (fixes, pas aléatoires) a
fait EXPLOSER la taille du pool retenu (moins de différenciation entre
candidats → moins d'élagage par dominance) — un effet de bord non anticipé
avant de le mesurer. Rien ne garantit que la piste B n'a pas son propre
angle mort du même genre, encore invisible. Plan de test IDENTIQUE à celui
de la piste A avant de conclure quoi que ce soit : `perf-battery.ts` contre
la même baseline, et les deux cas de stress (l'extrême, pour confirmer qu'il
reste hors de portée des deux côtés — pas un point de comparaison utile ;
l'atteignable, pour vérifier qu'elle récupère aussi la cible, idéalement
SANS le surcoût de construction mesuré sur la piste A).

### Suite — piste B implémentée : l'hypothèse de vitesse ne se vérifie pas

**Avant d'implémenter B, la piste A a été retirée du code de production**
(pas jugée mauvaise — retirée pour tester B sur la même base propre, comme
convenu). Son implémentation exacte reste disponible :
[scripts/patches/piste-a-tranche-weighting.patch](scripts/patches/piste-a-tranche-weighting.patch)
(`git apply` pour la réappliquer), doublé d'un `git stash` local — voir
[scripts/patches/README.md](scripts/patches/README.md).

**Implémentation** : `runeSubOnlyContribution` (même exclusion de la
principale que la piste A) réutilisée telle quelle. AVANT la triple boucle,
pour chaque `retentionKey`, calcule la moyenne et la variance de cette
contribution sur le pool DÉJÀ FILTRÉ de chacun des 3 slots de la moitié
(`filtered[i0/i1/i2]`), additionne les 3 variances et les 3 moyennes
(indépendance approximative entre slots), en tire un CV — puis réutilise la
MÊME formule de réallocation que la piste A (part au carré, budget total
`retentionKeys.length × bucketCap` inchangé, plancher à 10 %). Chaque tas
par stat est construit DIRECTEMENT à sa taille réallouée, sans jamais
surprovisionner ni élaguer après coup.

**Correction confirmée** : Sonia deck 6 retrouvé (comme la piste A). Les
deux cas de stress synthétiques donnent EXACTEMENT le même verdict que la
piste A : le cas extrême reste hors de portée (moitié B absente), le cas
atteignable récupère les DEUX moitiés (rang #3980/#1910 par Précision
seule, comme précédemment).

**Mais l'hypothèse de vitesse ne se vérifie PAS** — résultat le plus
important de cette comparaison :

| Cas | Avant | Piste A | Piste B |
|---|---|---|---|
| Lushen d15 réel | 24,9 s | 30,7 s (+5,8) | 28,1 s (+3,2) |
| Lushen d15 Rage seul | 53,4 s | 59,6 s (+6,2) | 59,2 s (+5,8) |
| Lushen d10 | 110,4 s | 113,4 s (+3,0) | **118,9 s (+8,5)** |
| Lushen d11 | 13,1 s | 14,8 s (+1,7) | 12,5 s (−0,6) |
| Sonia d6 | 55,3 s | **46,2 s (−9,0)** | 50,2 s (−5,1) |
| Sonia d14 | 96,2 s | **76,8 s (−19,5)** | **102,8 s (+6,6)** |
| Ciri | 11,8 s | 13,5 s (+1,7) | 13,9 s (+2,2) |

Sur Sonia deck 14, le temps de CONSTRUCTION est quasi identique entre A et B
(15,5 s dans les deux cas) — le pré-calcul O(pool) de B ne coûte
effectivement presque rien, exactement comme prévu. La différence se joue
ailleurs : l'APPARIEMENT prend 84,7 s au total pour B contre 58,6 s pour A
sur ce même cas (trouvé en 6,5 s contre 3,4 s, donc toujours rapide, mais
plus long à épuiser complètement) — la répartition DIFFÉRENTE des plafonds
entre A et B change la QUALITÉ de ce qui est retenu, pas seulement le coût
de construction. Hypothèse non vérifiée : rien ne garantissait que
l'estimation analytique de B (sur le pool filtré, avant combinatoire)
produirait la MÊME réallocation que le suivi en direct de A (sur les
demi-builds qui survivent réellement) — elles divergent suffisamment sur ce
cas pour inverser l'avantage.

**Bilan de la comparaison** : aucune des deux pistes ne domine clairement
l'autre sur l'axe vitesse — B légèrement meilleur sur 2 cas (Lushen d11,
Lushen d15 réel), nettement pire sur 1 (Sonia d14), comparable sur le reste.
Les deux corrigent la régression de correction visée (Sonia d6), A un peu
plus (−9,0 s contre −5,1 s). Aucune décision d'adoption prise à ce stade —
voir la conclusion générale ci-dessous.

### Suite — fix du cache de bundle esbuild dans `perf-battery.ts`

**Bug découvert en comparant une baseline fraîche à l'ancienne** : le
graphique Chronographe montrait un delta NÉGATIF (mieux) sur Sonia deck 14
entre deux baselines au code STRICTEMENT identique, alors que les segments
visibles (préparation + construction + appariement) étaient, eux, plus
longs sur la nouvelle mesure — contradiction visuelle/chiffrée. Cause :
`ensureBuildHalfWorkerBundle()` ([perf-battery.ts](scripts/perf-battery.ts))
bundlait le Worker via esbuild dans un dossier temporaire RECRÉÉ à chaque
appel (`mkdtempSync`), mis en cache seulement en mémoire du PROCESSUS — or
chaque cas de la batterie tourne dans son propre processus Node isolé (voir
plus haut, « chronométré depuis l'ENTRÉE... »), donc ce cache ne survivait
jamais d'un cas à l'autre : CHAQUE cas rebundlait depuis zéro. Ce temps de
bundling n'entre dans AUCUN segment mesuré (`prepMs` et `buildWallMs` sont
chronométrés strictement avant/après cette étape) — il ne contaminait donc
que `totalMs`/`foundMs`, d'un bruit variable et parfois important (+2,6 s
observé sur ce cas précis entre deux mesures).

**Correctif** : le bundle est maintenant mis en cache sur un chemin FIXE
(`%TEMP%/sw-forge-perf-buildhalf-cache`), invalidé seulement si
`build-half-worker.ts` a changé depuis (comparaison de `mtime`) — un seul
bundling pour toute une batterie (voire entre plusieurs batteries
successives), au lieu d'un par cas. `totalMs`/`foundMs` redeviennent des
métriques utilisables directement pour comparer deux mesures, plus besoin
de se rabattre sur `buildWallMs`/`pairingTotalMs` uniquement.

⚠️ Ce fix ne corrige que les mesures FUTURES — les `totalMs`/`foundMs` déjà
enregistrés dans `scripts/perf-baseline.json` et les logs de comparaison
piste A/piste B plus haut sur ce document restent contaminés, aucun
recalcul rétroactif n'est possible (le bundling n'a jamais été chronométré
séparément). `prepMs`, `buildWallMs`, `pairingFoundMs`, `pairingTotalMs` de
ces mesures passées, eux, n'ont jamais été affectés.

87 dossiers de bundle laissés par l'ancien comportement (~1,5 Mo au total)
ont été nettoyés de `%TEMP%` après le fix — cruft sans impact mesurable sur
les temps observés (voir l'investigation de dérive ci-dessous).

### Suite — piste B GATÉE derrière un paramètre, coût vérifié nul par défaut

Avant tout bouton dans l'UI : `buildBuckets` reçoit un nouveau paramètre
optionnel `adaptiveTrancheWeighting` (défaut `false`), qui encadre tout le
mécanisme de la piste B (calcul de `reallocatedCap` avant la triple boucle,
et son utilisation comme plafond par tranche). Désactivé, le comportement
retombe EXACTEMENT sur `perOtherSliceCap` comme avant l'introduction de la
piste B — aucun appel supplémentaire, aucune structure supplémentaire
construite.

**Pourquoi cette vérification était nécessaire, et pas juste supposée** :
la piste A modifie la signature partagée de `heapPush` (`void` →
`HeapPushResult`, un objet alloué à CHAQUE insertion/éviction, y compris
sur les appels qui n'ont rien à voir avec la pondération adaptative) — un
risque de coût caché sur le chemin par défaut, jamais mesuré, qui reste
d'ailleurs une inconnue non résolue si la piste A devait un jour être
réactivée. La piste B, elle, ne touche PAS `heapPush` : son seul
changement dans la boucle chaude est l'argument `cap` passé à un appel déjà
existant — gater ce choix (`reallocatedCap[...]` vs `perOtherSliceCap`) ne
devrait, en théorie, rien coûter. « En théorie » vérifié par la mesure, pas
supposé.

**Premier essai, alarme fausse** : comparer la piste B gatée à la baseline
PERSISTÉE (mesurée plusieurs heures plus tôt) a montré un surcoût
systématique de +0,9 s à +3,0 s sur les 7 cas (moyenne +1,6 s) — dans le
même sens partout, donc pas un bruit qui s'annule, en apparence un vrai
coût du code gaté. **Deuxième mesure, dos-à-dos** : remettre le code
d'ORIGINE (sans aucune trace de piste B, même gatée) de côté et le mesurer
IMMÉDIATEMENT après, dans les mêmes conditions machine que la piste B
gatée, donne un delta moyen de −0,29 s, dispersé des deux côtés de zéro —
dans l'enveloppe de bruit établie ci-dessous. Conclusion : le +1,6 s
initial venait de la dérive de la MACHINE entre les deux instants de
mesure, pas du code — voir l'investigation ci-après. **Le flag est
confirmé gratuit**, prêt à servir de socle à un bouton « Prioriser les
stats les plus difficiles » dans l'UI (nom choisi pour refléter le
mécanisme réel — un arbitrage entre STATS demandées en compétition pour le
budget de rétention, pas une détection de runes individuellement rares).

⚠️ **Reconfirmé après coup, avec une méthodologie plus rigoureuse.** Ce
« deuxième mesure, dos-à-dos » a été fait AVANT le fix du bug de cache de
`perf-battery.ts` (voir « Suite — point 1 implémenté et mesuré » plus bas,
qui a débusqué ce bug) — il était donc lui-même à risque du même piège
(deux mesures comparant en réalité le même bundle figé, indépendamment du
`git stash`/`pop` de `runeBuildOptim.ts`). Revérifié PROPREMENT une fois le
bug corrigé : `git worktree` isolé sur `main` (jamais touché à la branche
de travail courante), pas de `git stash` en place — état A (`main` tel
que livré, flag désactivé) contre état B (aucune trace de la piste B,
`runeBuildOptim.ts` du commit `2739f6b`, juste avant l'apparition du
paramètre). Premier essai avec un écart de plusieurs minutes entre A et B :
**+40 % à +70 % de retard sur B, systématique** — semblait d'abord indiquer
un vrai coût. Rejoué immédiatement (A puis B, sans rien d'autre entre les
deux) : l'état A REJOUÉ montre le MÊME retard que B (le code strictement
identique mesuré ~15-20 min plus tôt était largement plus rapide) — preuve
directe de dérive machine, pas de différence de code. Comparaison finale,
dos-à-dos immédiat : delta moyen −0,31 s, dispersé des deux côtés de zéro
sur les 7 cas — dans l'enveloppe de bruit. **Conclusion inchangée, cette
fois sur un socle de mesure vérifié sain.**

### Suite — investigation de la dérive : la machine, pas le script

Question posée après la fausse alerte ci-dessus : la dérive observée
vient-elle de la machine, ou d'un artefact qui s'ACCUMULE au fil des
exécutions de `perf-battery.ts` lui-même (fichiers non nettoyés, cache qui
grossit) ?

**Méthode** : tracer `buildWallMs` du cas Ciri (appariement quasi nul,
signal de construction quasi pur) sur les 8 exécutions de la session,
DANS L'ORDRE CHRONOLOGIQUE réel plutôt que par type de mesure :

| Heure locale | `buildWallMs` | Mesure |
|---|---|---|
| 14 août 22:08 | 9,2 s | baseline (070013b) |
| 15 août 00:28 | 10,9 s | piste A |
| 15 août 02:14 | 10,9 s | piste A v2 |
| 15 août 07:19 | 11,3 s | piste B |
| 15 août 07:50 | **9,0 s** | baseline fraîche |
| 15 août 08:10 | 9,7 s | baseline (persistée) |
| 15 août 09:44 | 10,9 s | piste B gatée |
| 15 août 09:59 | 11,0 s | baseline (dos-à-dos) |

**Verdict** : la chute nette à 07:50 (9,0 s, plus bas que le tout premier
point de la veille) après un pic à 11,3 s est incompatible avec un artefact
qui s'accumule — le nombre d'exécutions ne fait qu'augmenter avec le temps,
un tel artefact ne peut mécaniquement pas produire une valeur plus basse
qu'au début. Pistes disque écartées par la mesure : les 92 dossiers de
bundle laissés par l'ancien comportement (~1,5 Mo, voir ci-dessus) sont
bien trop petits pour expliquer des écarts de plusieurs secondes, et
présents aussi bien aux points bas qu'aux points hauts de la courbe ; aucun
cache tsx/esbuild qui grossirait avec les exécutions n'a été trouvé.
Facteur retenu à la place : plusieurs utilitaires tournant en fond en
continu sur cette machine (iCUE, MSI Afterburner, HueSync, plusieurs
fenêtres VS Code) — une charge de fond variable selon ce qui tourne au
moment précis de chaque mesure, pas selon la durée de la session.

**Implication pratique** : une comparaison entre deux mesures prises à des
heures différentes n'est fiable que pour un delta relatif GROSSIER — la
seule façon d'obtenir un delta fin et fiable est de mesurer les deux codes
à comparer L'UN APRÈS L'AUTRE, dans la même fenêtre de temps (méthode
utilisée pour valider le flag ci-dessus).

### Suite — enveloppe de bruit de référence, pour juger les futurs deltas

**Objectif** : donner un ordre de grandeur objectif — un delta futur
en-dessous de cette enveloppe doit être tenu pour potentiellement du bruit
(sauf comparaison dos-à-dos), un delta au-delà est probablement réel.
Calculée sur `buildWallMs` (jamais contaminé par le bug de bundling
ci-dessus, contrairement à `totalMs`/`foundMs`), les 4 mesures de baseline
STRICTEMENT identique (aucune piste active) prises à des instants
différents de cette session : 14 août 22:08 (070013b), 15 août 07:50, 15
août 08:10 (persistée), 15 août 09:59.

| Cas | Échantillons (s) | Moyenne | Écart-type | **CV** | Étendue |
|---|---|---|---|---|---|
| Lushen d15 R+B | 10,2 / 11,9 / 11,4 / 14,1 | 11,9 s | 1,4 s | **12,0 %** | 10,2–14,1 s (33 %) |
| Lushen d15 R seul | 6,6 / 6,0 / 6,1 / 7,8 | 6,6 s | 0,7 s | **10,9 %** | 6,0–7,8 s (27 %) |
| Lushen d10 | 4,8 / 4,6 / 4,4 / 6,0 | 5,0 s | 0,6 s | **12,4 %** | 4,4–6,0 s (31 %) |
| Lushen d11 | 10,2 / 9,5 / 10,4 / 11,9 | 10,5 s | 0,9 s | **8,3 %** | 9,5–11,9 s (23 %) |
| Sonia d6 | 11,0 / 10,0 / 10,5 / 12,4 | 11,0 s | 0,9 s | **8,1 %** | 10,0–12,4 s (22 %) |
| Sonia d14 | 12,3 / 11,9 / 13,1 / 15,8 | 13,3 s | 1,5 s | **11,5 %** | 11,9–15,8 s (29 %) |
| Ciri | 9,2 / 9,0 / 9,7 / 11,0 | 9,7 s | 0,8 s | **8,0 %** | 9,0–11,0 s (21 %) |

**CV moyen ≈ 10 %, étendue moyenne ≈ 27 % de la moyenne** — sur cette
machine, dans les conditions de cette session (plusieurs heures, charge de
fond variable, voir l'investigation ci-dessus).

**Règle pratique retenue** : un delta de `buildWallMs` sur UNE mesure
isolée, inférieur à ~2× le CV du cas concerné (donc grossièrement sous les
15-25 % selon le cas), doit être considéré comme potentiellement du bruit
— ni confirmé, ni infirmé par cette seule mesure. Au-delà, ou confirmé par
une comparaison dos-à-dos (deux codes mesurés l'un après l'autre, comme
pour la vérification du flag ci-dessus), le delta peut être tenu pour réel.
`totalMs`/`pairingTotalMs` n'ont pas encore d'enveloppe de référence
propre — accumuler plusieurs mesures POST-FIX (cache de bundle) avant de
leur faire confiance quantitativement ; en attendant, `buildWallMs` reste
la métrique la plus sûre pour juger un changement touchant `buildBuckets`.

### Suite — piste A : état sauvegardé, pas abandonnée

Décision prise en clôturant cette itération : la piste B sert de socle au
bouton « Prioriser les stats les plus difficiles » (opt-in, coût nul par
défaut vérifié ci-dessus). La piste A n'est PAS retenue pour l'instant,
mais n'est pas fermée pour autant — une question précise reste ouverte, à
reprendre ici plutôt qu'à relancer depuis zéro.

**Où tout est conservé** :
- `git stash@{0}` (message : « piste A (ponderation adaptative CV agrege,
  principale exclue)… ») — l'implémentation complète telle que testée.
- [scripts/patches/piste-a-tranche-weighting.patch](scripts/patches/piste-a-tranche-weighting.patch)
  (236 lignes) et [scripts/patches/README.md](scripts/patches/README.md).
- Les cinq itérations, les deux cas de stress, et le bilan avantages/
  défauts complet : voir « Suite — piste A implémentée », « Suite — deux
  cas de stress synthétiques » et « Suite — bilan de la piste A »
  ci-dessus sur ce document.

⚠️ **Ni le stash ni le patch ne s'appliquent plus proprement** —
vérifié : `git apply --check` échoue (`patch does not apply` sur
`runeBuildOptim.ts:1022`). Les deux ont été capturés AVANT l'ajout du
paramètre `adaptiveTrancheWeighting` (piste B gatée, voir ci-dessus) : le
fichier a bougé depuis. Réactiver la piste A demandera une réapplication
MANUELLE (relire le patch, reporter les changements à la main sur le code
actuel), pas un `git apply`/`git stash pop` direct.

**La question précise qui reste ouverte** — pas « laquelle coûte le moins
cher » (déjà tranché : les deux ont un coût réel et comparable), mais
« laquelle TROUVE MIEUX, une fois que l'utilisateur a déjà accepté de payer
plus cher en cliquant sur un mode opt-in ? ». Signal jamais approfondi :
sur Sonia deck 14, la piste A ne s'est pas contentée d'être « pareille » à
B — elle a trouvé la cible plus vite (3,4 s contre 6,5 s) ET épuisé la
recherche plus vite (76,8 s contre 102,8 s au total). Explication
plausible : A observe la dispersion RÉELLE des demi-builds construits, B
l'ESTIME via une hypothèse d'indépendance entre slots qui, sur ce cas
précis, a produit une réallocation différente et moins bonne. Un seul cas
ne suffit pas à conclure que c'est systématique — mais c'est le genre
d'avantage qu'on attendrait justement de la piste A si son raisonnement
théorique (pas d'approximation) est juste.

**Avant de rouvrir le dossier**, dans l'ordre :
1. Rebaser le patch sur l'état actuel de `runeBuildOptim.ts`.
2. Gater la piste A derrière un paramètre comme pour B, et vérifier — chose
   JAMAIS faite pour A — que le changement de signature de `heapPush`
   (`void` → `HeapPushResult`, appliqué à TOUS les appels, pas seulement
   ceux de la piste A) ne coûte rien en mode désactivé. C'est l'inconnue
   technique qui a fait préférer B comme socle de l'opt-in.
3. Chercher d'autres cas où A et B divergent en QUALITÉ de résultat (pas en
   coût), pour voir si l'avantage vu sur Sonia d14 est systématique ou un
   coup de chance sur ce cas précis.

**Quand y revenir** : si l'usage réel du bouton « Prioriser les stats les
plus difficiles » (piste B) montre que des utilisateurs cliquent dessus et
ne trouvent quand même pas ce qu'ils cherchent — pas avant, pour éviter de
spéculer sur un avantage vu une seule fois.

### Suite — les toggles « Prioriser… » et « Utiliser tout l'inventaire »,
### deux points d'interrogation cliquables

Le bouton « Prioriser les stats les plus difficiles » devient un TOGGLE
(désactivé par défaut, comme « Stats de base exclues »), pas un bouton qui
lance sa propre recherche — `handleSearch` lit l'état au moment du clic sur
« Rechercher », un seul déclencheur pour les deux modes. Même traitement
pour « Utiliser tout l'inventaire ». Les deux réglages, plus « Stats de
base exclues » et « Ignorer les statistiques des artéfacts », partagent le
même bouton d'aide que « Mon compte → Courbes » : le composant générique
`src/components/HelpPopover.tsx`, pour ne pas dupliquer la gestion
d'ouverture/fermeture à chaque nouvel usage.

⚠️ **Mis à jour depuis** : `HelpPopover` ne dessine plus son bouton ni sa bulle
à la main. Il passe par la librairie — `BoutonIcone` (cadre, zone tactile, état
actif), `FlottantAuto` pour la bulle à la souris (bord, ombre et `z-index` lui
appartiennent, plus de `<div absolute z-…>` maison) et `MobileSheet` pour le
**panneau montant** sur téléphone. Les quatre aides d'ici en profitent sans y
toucher. Voir [spec/compte/runes.md](../compte/runes.md) § « L'aide a DEUX
supports ».

### Suite — résultats affichés EN DIRECT pendant l'appariement

Jusqu'ici, `BuildCandidateCard` n'apparaissait qu'une fois `result` posé —
après épuisement complet du budget ou arrêt manuel, jamais PENDANT la
recherche, alors que `pairBuckets` produit déjà `candidates` à chaque point
de passage (`PairingProgress.candidates`, jamais transmis au-delà du
Worker jusqu'ici). Trois relais mis à jour :

- `WorkerPairingMessage.newCandidates` (`runeBuildOptim.worker.ts`) —
  UNIQUEMENT les candidats trouvés depuis le dernier message, pas la liste
  entière accumulée : `progress.candidates` peut grossir jusqu'à
  `maxCollected` (100 000 par défaut) sur une recherche lâche,
  retransmettre le même préfixe en entier à chaque point de passage
  throttlé (~150 ms) recopierait des dizaines de fois la même chose pour
  rien.
- `useBuildOptimSearch.ts` accumule ces deltas dans `progress.candidates`
  (fusion, pas remplacement — même patron que `halves` pour la phase
  `building`), plafonné à `PREVIEW_CANDIDATES_CAP=3000` : l'aperçu
  n'affiche jamais plus de 20 cartes triées, aucune raison de trier un
  tableau bien plus gros à chaque tick pendant une recherche très lâche. Le
  résultat FINAL (`result.candidates`), lui, n'est jamais tronqué par ce
  plafond — seul l'aperçu EN DIRECT l'est.
- `OptimizerSection.tsx` : `candidatesSource` bascule entre `result.
  candidates` (terminé) et `progress.candidates` (en cours, phase
  `pairing`) ; le panneau de résultats s'affiche dès qu'au moins un candidat
  existe dans l'une ou l'autre source, avec un intitulé distinct pendant la
  recherche (« N combinaison(s) trouvée(s) pour l'instant — recherche en
  cours… », `N` = `progress.found`, le vrai compte, pas la taille de
  l'aperçu plafonné). Les diagnostics « 0 résultat »/bandeau tronqué restent
  gatés strictement sur `result` (n'ont de sens qu'une fois la recherche
  réellement terminée).

⚠️ Non vérifié visuellement (pas d'outil de pilotage de navigateur
disponible dans cet environnement au moment de l'implémentation) —
`tsc --noEmit` et les 365 tests existants passent, mais la vérification en
conditions réelles (le tri qui se met à jour en direct, le décompte qui
avance, le passage propre au résultat final) reste à faire manuellement.

✅ Vérifié en usage réel par l'utilisateur, fonctionne comme attendu.

### Suite — relecture du pipeline, pistes d'accélération

Relecture volontairement critique de tout `runeBuildOptim.ts` (`prepareSearch`
→ `buildBuckets` → `pairBuckets`) pour chercher des gains de vitesse, sur
deux axes distincts : le temps jusqu'au PREMIER résultat, et le temps
jusqu'à ÉPUISEMENT complet de l'espace de recherche.

**Constat déjà documenté, à ne pas re-découvrir** : sur un cas SERRÉ (peu
de candidats satisfont toutes les conditions à la fois, voir « Suite —
pourquoi ce correctif d'ordre n'a rien changé en usage réel »), la
recherche tourne TOUJOURS jusqu'à `maxNodes`/`maxCollected` — l'ordre
d'exploration ne peut alors changer ni le temps total ni le nombre de
paires visitées, seulement le moment où le résultat apparaît dans la
progression. Ça borne ce qu'un meilleur tri peut encore apporter.

**Découverte nouvelle en relisant `buildBuckets` ligne à ligne** : dans la
triple boucle (`for r0 / for r1 / for r2`), `runeEfficiency(r0)` et
`runeContribution(r0, k)` sont recalculés à CHAQUE itération de la double
boucle r1×r2, alors que `r0` est fixe pour toute cette double boucle — pur
calcul redondant. Au préréglage « Moyen » (`slotFilterCap=80`,
80³=512 000 itérations par moitié) : `runeEfficiency` est appelé ~1,5M de
fois quand 240 suffiraient (une fois par rune par slot) ; avec 4
`trackedKeys` typiques, `runeContribution` ~6,1M de fois quand ~960
suffiraient. `counts` est en plus recalculé via `runes.filter(...)` alors
que `haveR01` (déjà accumulé incrémentalement pour `stillFeasible`, juste
au-dessus) contient déjà presque tout le nécessaire.

**Priorités proposées** (voir aussi la todo de réflexion en tête de
session) :
1. Précalculer par rune, une fois avant la triple boucle, l'efficience et
   la contribution à chaque `trackedKey` — élimine la redondance ci-dessus,
   comportement strictement identique, vérifiable par le harnais
   différentiel. Cible directement la construction (« avant
   l'appariement »).
2. `filterSlot` : remplacer les 8 tris complets par stat par une sélection
   top-K via le tas déjà existant (`heapPush`) — même famille de gain, plus
   petit (pool bien plus petit que pool³), gratuit dans la même passe.
3. Paralléliser la boucle d'appariement elle-même (point 9 de la todo) —
   cible « épuiser tout l'espace », l'axe que l'ordre ne peut pas
   améliorer pour un cas serré (voir le constat ci-dessus) : seul plus de
   cœurs en parallèle réduit ce temps-là.
4. Tableaux typés (point 8) et WebAssembly (point 10) — repoussés après
   1-3 : gain marginal incertain tant que la redondance du point 1 n'est
   pas éliminée, et les deux chantiers les plus lourds/risqués du lot.
5. Filet de temps pour `buildBuckets` (Eivor deck 2, déjà documenté plus
   haut) — pas une optimisation de vitesse, une robustesse manquante.

### Suite — point 1 implémenté et mesuré : ~1,9× sur la construction

**Implémentation** : `precomputeSlot(pool)` calcule, une fois par rune de
chaque slot d'une moitié, `{ eff, isJoker, contribPct[], contribFlat[] }`
(tableaux alignés sur `trackedKeys`, pas d'objet à clés dynamiques dans la
boucle chaude). La triple boucle passe d'itérateurs `for...of` à des index
(`idx0/idx1/idx2`) pour lire ces précalculs par position — les trois pools
d'une même moitié sont toujours disjoints (une rune n'appartient qu'à un
seul `slot`), donc l'indexation par position est aussi sûre qu'une table
par id, sans le coût d'une table de hachage. `counts` réutilise `haveR01`
(déjà accumulé pour `stillFeasible`) au lieu de `runes.filter(...)`.
Comportement strictement identique — vérifié : `tsc --noEmit` propre, 385
vérifications passées (harnais différentiel inclus).

⚠️ **Bug de méthodologie trouvé EN MESURANT, pas en écrivant le code** : la
première comparaison dos-à-dos donnait un delta suspect (×2,4, cohérent
d'un cas à l'autre — pas du bruit) puis, en revérifiant par acquit de
conscience, une SECONDE comparaison (code d'origine restauré, remesuré)
donnait des chiffres IDENTIQUES au bit près à la première — impossible si
le code différait vraiment. Cause : `ensureBuildHalfWorkerBundle`
(`perf-battery.ts`, voir « Suite — fix du cache de bundle esbuild »
au-dessus) n'invalidait son cache disque que si `build-half-worker.ts`
LUI-MÊME changeait — jamais si un fichier qu'il IMPORTE
(`runeBuildOptim.ts`, embarqué DANS le bundle par esbuild) changeait. Les
deux mesures tournaient donc sur le même bundle figé, ni l'une ni l'autre
ne reflétait le code réellement testé. **Corrigé** : chemin de cache
dérivé du PID de l'orchestrateur (`--bundle-dir=`, transmis aux enfants),
un bundle FRAIS par exécution complète de la batterie plutôt qu'un cache
partagé entre exécutions séparées — élimine le risque à la racine, au prix
d'un rebundling (~1 s) une fois par exécution plutôt que jamais. Dossier
nettoyé en fin d'exécution (`rmSync`), pas d'accumulation dans `%TEMP%`.

**Mesure corrigée, dos-à-dos** (`build réel`, code d'origine → précalculé) :

| Cas | Avant | Après | Facteur |
|---|---|---|---|
| Lushen d15 R+B | 9,1 s | 5,2 s | ×1,75 |
| Lushen d15 R seul | 4,4 s | 2,2 s | ×2,00 |
| Lushen d10 | 4,3 s | 2,3 s | ×1,87 |
| Lushen d11 | 8,2 s | 4,6 s | ×1,78 |
| Sonia d6 | 9,7 s | 5,1 s | ×1,90 |
| Sonia d14 | 11,3 s | 5,1 s | ×2,22 |
| Ciri d.eq3 | 6,8 s | 3,5 s | ×1,94 |
| **Moyenne** | | | **×1,92** |

Gain cohérent sur les 7 cas (1,75× à 2,22×), pas un pic isolé — confirme la
redondance mesurée en lisant le code (voir plus haut) plutôt que de la
supposer. Prochaine étape naturelle : le point 2 (top-K par tas dans
`filterSlot`), moins d'impact attendu mais même famille de gain, avant de
passer à la parallélisation de l'appariement (point 3/9).

### Suite — accélération GPU envisagée pour l'appariement, puis nuancée

Question posée face à des espaces de recherche déjà mesurés à ~500M paires
(voir « Suite — relecture critique du pipeline… »), potentiellement
plusieurs milliards à l'avenir (comptes plus gros, `bucketCap` relevé) :
le GPU ne serait-il pas la bonne réponse pour le point 3 ci-dessus ?

**Réponse nuancée : pas comme prochain levier, pour trois raisons.**

1. **Divergence de branchement.** Un GPU excelle sur du travail massif ET
   SANS branchement. La boucle d'appariement est l'inverse : une CHAÎNE de
   filtres séquentiels à sortie anticipée (`satisfiesSets` → joker →
   `pairFeasibleMin` → `comboAFeasible` → `quickOk` → seulement alors
   `activeSets`+`computeStats`) — l'écrasante majorité des paires s'arrête
   tôt. Sur un GPU, des threads voisins qui prennent des chemins
   différents se SÉRIALISENT (divergence de warp/wavefront) : l'essentiel
   de l'avantage théorique disparaît sur ce genre de logique.
2. **Prérequis dur, pas encore fait.** `HalfCombo.pct`/`flat` sont des
   `Record<string, number>` — un GPU a besoin de tableaux typés à
   disposition FIXE connue d'avance. Le point 8 (tableaux typés) devient un
   préalable obligatoire, pas une option indépendante.
3. **Coût de compatibilité, dans une app 100 % cliente.** WebGPU (le seul
   qui offre de vrais compute shaders, pas WebGL) reste incomplètement
   supporté selon navigateur/appareil — sans serveur de repli (voir
   README, « 100 % local, aucune donnée envoyée »), un chemin CPU complet
   resterait nécessaire de toute façon, doublant la maintenance pour un
   gain incertain.

**Où le GPU aurait vraiment un sens, si le besoin se confirme** : pas sur
toute la boucle, mais sur la seule étape `quickOk` (somme de
`pct[k]+flat[k]` des deux moitiés comparée aux seuils) — purement
arithmétique, sans branchement si écrite comme un masque plutôt qu'un
`if`. Une architecture à deux temps serait cohérente : un noyau GPU qui
calcule ce test en masse sur des lots de paires, puis seules les rares
survivantes repassent au CPU pour `activeSets`/`computeStats` (trop
complexe/branchu pour un GPU).

**Décision** : mesurer d'abord la parallélisation CPU de l'appariement
(point 9) — bien moins cher à construire, mêmes structures de données,
aucun problème de compatibilité. Le GPU reste une piste réelle à
reconsidérer SI l'échelle réellement observée (pas hypothétique) dépasse
ce que la parallélisation CPU peut suivre — pas avant.

### Suite — leçons retenues sur la méthodologie de mesure

Le chantier du point 1 a fait remonter plusieurs pièges de méthodologie,
racontés en contexte dans les sections ci-dessus — consignés ICI sous
forme de règles réutilisables, pour ne pas les redécouvrir un par un la
prochaine fois qu'un chiffre de `perf-battery.ts` semble décisif.

1. **Un delta trop net doit se vérifier par un second dos-à-dos, pas
   juste être cru.** ×2,4 cohérent sur les 7 cas RESSEMBLE à un vrai
   signal — c'est exactement ce qui a caché le bug de cache : deux
   mesures « différentes » qui donnent des chiffres IDENTIQUES au bit
   près sont le vrai signal d'alarme (un delta réel varie légèrement
   d'une mesure à l'autre, même bruit inclus).
2. **Un cache de bundle doit invalider sur TOUT ce qu'il embarque, pas
   sur le seul fichier d'entrée.** `esbuild bundle: true` inline les
   imports (`runeBuildOptim.ts` DANS `build-half-worker.cjs`) — vérifier
   la date d'un seul fichier laisse les dépendances transitives invisibles
   au cache. Principe retenu : soit invalider sur un chemin PROPRE À
   CHAQUE EXÉCUTION (ce qui a été fait — un bundle frais par lancement de
   la batterie, jamais partagé entre deux lancements séparés), soit sur
   le graphe de dépendances complet (plus fragile à maintenir à la main).
3. **La date d'un commit Git n'est PAS la date d'implémentation.** Les
   commits de cette session ont été groupés en fin de travail, des heures
   après avoir écrit et utilisé le code — comparer des horodatages de
   commits pour reconstituer un ordre chronologique d'événements est une
   fausse preuve. La bonne source : l'ordre des sections « Suite — » déjà
   écrites dans ce document au moment des faits (ou, à défaut, relire le
   fil de la conversation directement).
4. **La dérive machine peut friser +40 à +70 % sur 15-20 minutes**, pas
   seulement les ~10-27 % déjà caractérisés sur une session plus longue.
   Signal qui doit alerter : un effet dans le sens ILLOGIQUE (retirer du
   code qui ralentit l'exécution) — dans ce cas, rejouer IMMÉDIATEMENT un
   des deux côtés suffit à trancher : s'il affiche maintenant le même
   retard que l'autre alors qu'il était rapide quelques minutes plus tôt,
   c'est la machine, pas le code.
5. **`git worktree` plutôt que `git stash`/`checkout` pour comparer deux
   états de code** : un checkout isolé dans un répertoire séparé élimine
   tout risque pour la branche de travail en cours — rien à restaurer
   après coup puisque rien n'a bougé. Deux pièges pratiques rencontrés en
   le mettant en place : `node_modules` et les fichiers de compte réels
   (non suivis par Git) doivent être liés explicitement ; et lier des
   fichiers en bloc par motif (`*.json`) peut écraser des fichiers SUIVIS
   par Git (ici `tsconfig.json`/`package-lock.json`) par la version de la
   branche courante au lieu de celle du commit visé — sans conséquence ici
   (contenu identique, vérifié après coup), mais à lier fichier par fichier
   la prochaine fois plutôt qu'en bloc.
6. **Une affirmation « coût nul » sur du code gaté doit être revérifiée
   si l'outil de mesure change après coup.** La vérification de la piste B
   gatée a été faite avec un outil qui s'est révélé bogué APRÈS — sans
   trace de cette dépendance, la conclusion serait restée invalidée sans
   qu'on le sache. Réflexe à garder : quand `perf-battery.ts` change,
   redemander « est-ce qu'une conclusion existante s'appuyait sur l'ancien
   comportement de l'outil ? » plutôt que de supposer que ça ne concerne
   que les mesures futures.

## Limites connues

- ~~Un set NON demandé qui s'activerait par accident via les emplacements
  « libres » du combo échappait à TOUS les élagages~~ **Corrigé** (voir
  « Suite — bonus de set NON demandé anticipé dès le pré-filtrage »
  ci-dessus).

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
  mêmes leviers. ⚠️ Le repli exact avant `activeSets`/`computeStats`
  (≈×2,3 sur ce même cas, voir « Suite — repli EXACT… ») accélère la
  recherche SANS changer quels candidats sont explorés : le cas reste non
  résolu après ce correctif. La piste de dominance de demi-builds (skyline,
  voir « Suite — dominance de demi-builds… ») a aussi été mesurée
  spécifiquement sur ce cas et écartée : à 7 dimensions suivies, même la
  construction PAR TRANCHES existante (sans aucune skyline) devient déjà
  trop coûteuse pour aboutir dans un temps raisonnable.
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
- ~~Relâcher un set demandé peut, à l'inverse, faire DISPARAÎTRE un build
  pourtant déjà trouvable avec le set complet demandé~~ **Corrigé** (voir
  « Suite — relecture critique du pipeline, et BUCKET_CAP relevé une
  quatrième fois » ci-dessus, `bucketCap` 1500 → 3000) — c'était un problème
  de RÉTENTION, pas un problème de temps (contrairement à ce qu'on pourrait
  attendre : « ça devrait juste prendre plus longtemps »). Signalé sur un vrai
  compte (`ß☆Enzo-6399149.json`, Lushen deck 15 offense, ATQ/Taux Crit/Dmg
  Crit exacts) : demander Rage(4p)+Blade(2p) retrouve le build réel ; demander
  Rage(4p) SEUL (une contrainte strictement plus large — tout build valide
  pour la première l'est aussi pour la seconde) ne le retrouve PAS.
  Diagnostiqué précisément (`scripts/set-relax-diag.ts`) : les 6 runes réelles
  (Blade comprises) survivent parfaitement au pré-filtrage par emplacement
  dans LES DEUX cas — la perte a lieu à la rétention par compartiment
  (`buildBuckets`, `bucketCap`). Les compartiments sont partitionnés par
  compte de pièces des SEULS sets demandés : avec Rage+Blade, un compartiment
  « 2 Rage + 1 Blade » est étroit, le bon demi-build y a peu de concurrence ;
  avec Rage seul, ce même demi-build tombe dans un compartiment « 2 Rage +
  n'importe quelle 3ᵉ rune » bien plus large et hétérogène (toutes les autres
  provenances possibles de la 3ᵉ rune s'y retrouvent mélangées), diluant sa
  place dans les `bucketCap=1500` places par tranche. Mesuré :
  `totalPairCount` passe de 39,7M (Rage+Blade) à 107,5M (Rage seul) — presque
  ×3, confirmant que l'espace réellement explorable grandit bien comme
  attendu — mais le demi-build B cible devient totalement ABSENT de tout
  compartiment retenu, pas seulement classé plus bas. Confirmé en relevant
  `bucketCap` à 8000 à titre de test : le demi-build réapparaît (rang
  #4293/26105), preuve que c'est bien la rétention, pas une élimination
  prouvée à tort, qui est en cause. À l'époque du signalement, relever
  `bucketCap` par défaut aurait reproduit l'historique documenté plus haut
  (« BUCKET_CAP relevé une troisième fois… ») : sans l'escalade automatique
  du budget de nœuds (voir plus haut), chaque relèvement reculait le mur d'un
  cran sans jamais le résoudre pour de bon. **Ce n'est plus le cas depuis
  l'escalade** — remesuré (« Phase 0 », voir « Suite — relecture critique du
  pipeline » ci-dessus) sur toute la batterie de cas réels connus, aucune
  régression : `bucketCap` relevé 1500 → 3000, ce cas précis retrouvé
  exhaustivement en 51,7 s.
  ⚠️ **Piste creusée pour ce cas précis : le joker (rune Intangible) n'est
  JAMAIS crédité, dans le CLASSEMENT au sein d'un compartiment, de la valeur
  qu'il débloque en complétant un set.** Vérifié précisément dans le code :
  un joker obtient bien une place RÉSERVÉE au pré-filtrage par emplacement
  (`filterSlot`, tranche `matches`, inconditionnel — voir plus haut) et sa
  propre dimension dans la signature d'un compartiment (`jokers` dans
  `bucketKeyOf`, séparé du compte de pièces) — mais `retentionScore`/
  `combinedRetentionScore` (ce qui décide QUI survit à `bucketCap` DANS un
  compartiment) ne lisent que `pct`/`flat`, la somme des SOUS-STATS BRUTES
  des 3 runes du demi-build — jamais le bonus de set que la présence du
  joker pourrait débloquer, qui vit uniquement dans `guaranteed`/
  `guaranteedMin`, une CONSTANTE GLOBALE ajoutée pareillement à tous les
  demi-builds, invisible à ce classement. Un demi-build à joker médiocre en
  sous-stats brutes mais qui complète un set précieux ne reçoit donc AUCUN
  avantage de classement pour cela — même mécanisme « généraliste noyé
  parmi des spécialistes » que documenté plus haut pour Sonia, mais
  potentiellement aggravé pour les demi-builds à joker en particulier.
  ⚠️ Confirmé comme une nuance RÉELLE mais DISTINCTE de la cause du cas
  Lushen ci-dessus : `unrequestedSetBonusHeadroom` (l'estimation, pas le
  classement) crédite déjà correctement le bonus Blade même sans tenir
  compte du joker dans CE cas précis (assez de vraies runes Blade dans le
  pool pour ne pas en avoir besoin) — vérifié en isolant le headroom seul.
  Le joker n'est donc PAS l'explication du cas Lushen, mais reste une piste
  distincte à surveiller sur un compte avec moins de runes disponibles pour
  le set concerné.
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
