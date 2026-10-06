# Algorithme (résumé fonctionnel)

**Statut :** ÉTAT ACTUEL — décrit la recherche des runes : meet-in-the-middle, élagages sûrs, pré-filtrage, compartiments et bornes de la recherche
**Lire si :** on modifie runeBuildOptim.ts : énumération, regroupement, élagages, rétention ou bornes de la recherche
**Voir aussi :** pipeline.md, artefacts.md, ../interruption.md, ../verification.md, ../invariants.md

Calcul pur dans `src/lib/runeBuildOptim.ts`, exécuté dans un Web Worker
(`src/workers/runeBuildOptim.worker.ts`) pour ne jamais geler l'interface.
Le chemin d'une recherche, du lancement au résultat affiché, est décrit dans
[pipeline.md § Pipeline de la recherche de runes](pipeline.md) ; ce fichier
dit ce que le moteur garde, coupe et retient, et lesquelles de ces coupes
sont sûres. Lancer une **nouvelle** recherche termine sèchement celle en
cours (`cancel`, `terminate()` sur le Worker), et la réponse de l'ancienne
n'écrase jamais la nouvelle demande. Arrêter la recherche **en cours** pour
en garder le résultat passe par un canal différent, coopératif :
[../interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](../interruption.md).

## Recherche des runes — meet-in-the-middle et élagages

- **Jamais de brute-force.** *Meet-in-the-middle* : les 6 emplacements sont
  scindés en **deux moitiés de 3** (emplacements 1 à 3, puis 4 à 6), chacune
  énumérée depuis le pool déjà pré-filtré (`buildBuckets`). Chaque
  combinaison d'une moitié est rangée dans un compartiment, selon le
  **compte exact** de pièces de chaque set demandé qu'elle apporte et son
  nombre de runes Intangible (`bucketKeyOf`) : deux compartiments dont les
  comptes s'additionnent pour satisfaire le combo s'apparient (`pairBuckets`)
  **sans jamais énumérer le produit complet** des runes individuelles. Ne
  pas revenir à un *branch-and-bound* linéaire sur les 6 emplacements : il
  ne détecte un combo de sets impossible qu'une fois les 6 runes choisies,
  et gaspille des branches entières.
- **Ordre fixe de la préparation** (`prepareSearch`, étapes de
  `PrepareStage`) : statistique principale imposée et runes imposées, puis
  les deux élagages sûrs (dominance, puis faisabilité), puis seulement le
  pré-filtrage heuristique. Un emplacement que l'une de ces étapes vide fait
  rendre `null` à `prepareSearch`, et la recherche un résultat vide.
- **Statistique principale imposée (emplacements 2, 4 et 6) et runes
  imposées** : appliquées **avant** tout le reste, dans la construction même
  du pool par emplacement (`mainStatFilteredBySlot`). Une rune dont la
  principale n'est pas dans la liste autorisée n'entre jamais en jeu ; un
  emplacement verrouillé ne garde que la rune choisie, et le reste du moteur
  travaille sur un pool simplement plus petit, sans connaître la notion de
  verrou
  ([../exclusion.md § Runes imposées — verrouiller un emplacement sur une rune précise](../exclusion.md)).

### Élagages sûrs

- **Jamais un faux rejet.** Les deux élagages qui suivent (`pruneDominated`
  puis `eliminateInfeasible`) ne retirent qu'une rune qui ne peut entrer
  dans aucun build valide, ou qu'une autre rune remplace sans rien perdre —
  auras **propres** au build, Intangible, effet unique de la relique et
  lignes d'artéfact 218–221 compris. Des oracles exhaustifs indépendants le
  vérifient : `tests/rune-optim-auras-coupes.test.ts`,
  `tests/rune-optim-dominance-relique.test.ts` et
  `tests/rune-optim-dominance-lignes.test.ts` (auras : voir
  [../../degats-reels/effets-equipe-et-leaders.md § Sets d'aura d'équipe — modèle](../../degats-reels/effets-equipe-et-leaders.md)).
- **Dominance** (`pruneDominated`, `isDominated`) : une rune A est retirée
  quand une rune B du **même** emplacement l'égale ou la dépasse sur le
  pourcentage **et** le plat de chacune des 8 stats, et sur l'efficience
  (`runeEfficiency`), avec un avantage strict quelque part : tout build
  valide qui utilise A reste valide, et au moins aussi bon, avec B à sa
  place. Pourcentage et plat se comparent séparément, jamais additionnés :
  ils ne sont pas sur la même échelle (`totalOf`). Deux runes identiques en
  tout point : seule celle de plus petit `id` reste.
  - **Quels sets se comparent** (`isSetComparable`) : deux runes du même set
    se comparent toujours, deux Intangible comprises ; un set demandé ou
    l'Intangible ne se compare qu'à lui-même, sinon une rune aux stats
    brutes meilleures mais inutile au combo prendrait la place d'une pièce
    essentielle. Entre deux sets hors combo différents, la comparaison n'a
    lieu que si tous deux sont **interchangeables**. `contexteDominance`
    les calcule une fois par recherche, sur le pool après statistique
    principale et verrous. Un set hors combo n'est **pas** interchangeable
    dans deux cas :
    - **son effet est utile et peut se former** : un set à bonus de fiche
      (`SET_STAT_BONUS`, Blade…) ou un set d'aura (`STAT_DE_L_AURA`) que des
      emplacements **distincts** du pool portent en nombre suffisant, une
      Intangible comprise, dans la limite des emplacements libres, et dont
      la stat compte pour la recherche. Elle compte si une condition
      minimum ou maximum porte sur elle (pour une aura, seulement RES ou
      PRE, interrupteur des auras RES/PRE activé), si c'est une stat de
      l'objectif (`objectiveKeysOf`), une stat dont dépend l'effet unique
      d'une relique que la recherche peut équiper (`statsDeLEffetUnique`,
      `src/lib/relicExclusive.ts` : sa stat de référence ou la stat qu'il
      améliore, sans restriction par objectif), ou, en « Dégâts réels », une
      stat lue par une ligne d'artéfact 218–221
      ([elagages.md § Dominance — lignes d'artéfact 218–221](elagages.md)).
      En « Efficience », ou sans objectif, toutes les stats comptent ;
    - **il compte pour le joker** : dès qu'une Intangible est disponible,
      un set qui peut être complet avec ses seules vraies runes
      (emplacements distincts, dans la limite des emplacements libres).
      L'Intangible ne complète un set que s'il est le seul incomplet
      (`activeSets`, `src/lib/effects.ts`) : Rage + Intangible + Will + Will
      est valide, mais remplacer un Will par un Violent laisse trois sets
      incomplets, et Rage n'est plus complété.

    Un set qui ne peut jamais être complet, ni former un effet utile, reste
    interchangeable : incomplet dans tout build, il n'empêche ni ne permet
    rien au joker.
  - **Les reliques que la recherche peut équiper** se dérivent du contexte
    relique (`reliquesEquipables`) : la relique fixe (`SearchParams.relic`)
    hors mode `recherche`, tout `relicContext.eligibles` en mode
    `recherche` — les candidates mêmes que la résolution parcourt
    (`resoudreEquipementDuBuild`), donc un sur-ensemble sûr de celle
    qu'elle retiendra. Aucune dominance de reliques ne les réduit avant :
    `relicDominates` n'est appelée que par les tests.
  - **Le Taux Crit** n'est pas une stat de l'objectif « Dégâts réels »
    (`damageRelevantStats`, `src/lib/damage.ts`), sauf pour un passif dont
    les dégâts en dépendent (`bonusDegatsSelonCr`) : il est plafonné à
    100 % en jeu, et ni « Critique » ni « Non critique » ne le lisent. Il
    ne protège donc un set que par les autres voies : une condition posée
    sur lui, l'effet unique d'une relique, ou « Efficience ». Ainsi, en « Dégâts réels » avec des minimums d'ATQ, de
    Taux Crit et de Dgts Crit, une Blade dominée reste et un Focus dominé
    part ; en « Efficience », Endure ou Blade formables restent, Violent ou
    Revenge partent, sauf si le joker les protège. En « PV effectifs » avec
    une relique Ténacité sur l'ATQ, un Fight reste : son aura peut faire
    franchir une tranche de l'effet unique.
  - ⚠️ **Ce que la garantie couvre** : l'optimum n'est garanti que pour les
    conditions, l'objectif (effet unique de la relique et lignes 218–221
    compris) et l'efficience. Un tri après coup sur une autre stat peut
    manquer un build qu'un bonus de set inutile à la recherche aurait
    porté. La rétention (`filterSlot`, `retentionKeys`), elle, reste
    aveugle aux stats de l'effet unique et des lignes 218–221, comme à
    toute stat hors objectif : heuristique, jamais garantie.
  - ⚠️ **Sur une stat plafonnée** (un maximum est demandé dessus), « plus »
    n'est plus sans risque : cela peut faire dépasser le plafond. Seule
    l'égalité stricte y est sûre à comparer.
  - **Garde-fou de coût** : la comparaison est quadratique ; au-delà de
    `DOMINANCE_MAX_POOL` (2000) runes sur un emplacement, `pruneDominated`
    renonce à cet élagage plutôt que de ralentir la recherche.

### Dominance — lignes d'artéfact 218–221

En « Dégâts réels », une stat lue par une ligne d'artéfact 218–221 (dégâts
supplémentaires en proportion des PV, de l'ATQ, de la DEF ou de la VIT) est
utile à la dominance au même titre qu'une stat de l'objectif : le score de
recherche la lit (`ajoutArtefactBrut`, `src/lib/damage.ts`), alors que
`damageRelevantStats` l'exclut de la rétention. Ainsi, un Energy reste face
à un Will aux mêmes stats dès qu'un artéfact que la recherche peut équiper
porte la ligne 218, même si les PV ne sont pas une stat du sort.

- Les stats protégées se dérivent de `statsLuesParLesLignes` : les lignes
  de la paire `SearchParams.artifacts`, toujours, unies au champ
  `SearchParams.statsLignesArtefactsEquipables` ; rien hors « Dégâts
  réels ». Les reliques équipables et ces stats sont des arguments
  obligatoires de `contexteDominance`.
- Le champ est produit par `statsLignesArtefactsEquipables`
  (`src/lib/artifactFiche.ts`) : l'union des lignes des candidats de
  `candidatsParSorte` des deux sortes, la vue complète, avant élagage et
  sans verrous, dont la résolution ne tire qu'une partie — un sur-ensemble
  sûr. L'écran l'appelle dans `handleSearch` sur `artifactParams` ; le CLI
  dans `resolveStatsLignesArtefacts` sur `artefactsDuCli`, sans liste de
  travail donc sans réservation : son union peut être plus large que celle
  de l'écran, jamais plus étroite.
- Absent (`ignoreArtifacts` au CLI, scripts, harnais), le champ laisse la
  dominance juste pour une paire figée, jamais pour une paire résolue par
  build en « Libre », où une pièce autre que la représentative peut porter
  la ligne.
- Ces lignes ne changent ni le pré-filtrage ni la rétention : un artéfact
  récolte les stats que le build possède déjà, il n'en fait pas chercher
  d'autres
  ([../../degats-reels/artefacts-et-degats-bruts.md § Dégâts supplémentaires proportionnels à une stat (218-221)](../../degats-reels/artefacts-et-degats-bruts.md)).

### Élagage sûr — faisabilité

- **Faisabilité** (`eliminateInfeasible`) : une rune ne peut entrer dans
  aucun build valide si, même complétée par le meilleur de chacun des 5
  autres emplacements, un minimum demandé reste hors de portée — ou si elle
  dépasse déjà, **à elle seule**, un maximum demandé (les autres
  emplacements ne peuvent qu'ajouter, jamais retirer). Ce meilleur est celui
  du pool **réellement possédé** (`computeSlotMaxBounds`), jamais une borne
  théorique du jeu codée en dur : plus étroit, et aussi sûr, puisque c'est
  un maximum observé.
  - ⚠️ **Côté minimum, la borne compte aussi ce que les sets pourraient
    encore ajouter** (`guaranteedMin`) : le bonus d'un set non demandé, ou
    d'une activation de plus d'un set demandé
    (`additionalSetActivationHeadroom`), et, interrupteur RES/PRE activé,
    8 points par activation Tolerance ou Accuracy **propre** possible
    (`auraResPreHeadroom`, `pointsAuraResPrePropres`) — une Intangible
    pouvant, dans les deux cas, en compléter la dernière pièce. Le compte
    porte sur tout le pool, plafonné aux emplacements libres : une borne
    volontairement large (plusieurs sets crédités sur les mêmes
    emplacements, le joker crédité à chacun), jamais trop basse. Côté
    maximum, seul l'inévitable compte (`guaranteed`, le bonus des sets
    demandés) : aucune de ces activations n'y est supposée.
  - ⚠️ **L'apport des artéfacts compte pour ce que l'inventaire peut
    donner, jamais pour ce qu'une paire choisie d'avance apporte**
    (`SearchParams.artifactBounds`, produit par `bornesArtefacts`,
    `src/lib/artifactOptim.ts`). Deux bornes distinctes : `max`, le meilleur
    apport atteignable, pour juger d'un minimum ; `min`, l'apport
    incompressible, pour juger d'un maximum. La paire représentative est
    choisie pour son score : prise comme borne, elle peut n'apporter aucune
    DEF quand l'inventaire en contient, et « Libre » rendrait alors moins de
    résultats qu'une principale imposée. Sans `artifactBounds` (scripts de
    diagnostic), l'apport de la paire représentative sert des deux côtés.
  - **La relique** entre de la même façon : la relique portée hors mode
    `recherche` ; en mode `recherche`, les bornes du contexte relique à sa
    place (`relPctMax` pour un minimum, `relPctMin` pour un maximum), jamais
    un cumul des deux.
  - Ces bornes (`deriveMinMaxContext`) servent aussi à l'appariement
    (`bucketPairFeasibleMin`, `comboAFeasible`, le repli `quickOk`) et aux
    diagnostics de faisabilité (`diagnoseFeasibility`,
    `rankBlockingConditions`).
- ⚠️ **Ces bornes sont calculées stat par stat**, donc plus optimistes que
  ce qu'une paire réelle peut fournir : deux emplacements ne portent que
  deux principales. Elles servent à couper, où être large ne coûte que du
  travail en trop. **La décision finale se prend sur de VRAIES paires**
  (`artifactBounds.possibles`) : un build n'est retenu que si l'une des
  combinaisons réellement équipables lui fait tenir *toutes* ses conditions,
  minimums et maximums avec la même paire. En mode `recherche` de la
  relique, ce test reste une borne, et le filtre exact a lieu à la
  résolution, avec la relique réelle (`respecteConditionsAvecRelique`).

### Paire d'artéfacts d'un build

- **La meilleure paire d'artéfacts d'un build suit le critère de
  classement**, et l'interrupteur « Adapter les artéfacts et reliques au
  tri », activé par défaut, décide lequel : le **tri affiché**, ou
  l'**objectif de la recherche**. Trier par PV effectifs ne retient pas les
  mêmes pièces que trier par Dégâts réels : un artéfact change les
  statistiques du monstre, donc le meilleur dépend de ce qu'on cherche. Le
  choix lui-même :
  [artefacts.md § Le choix des artéfacts — un second problème, séparé](artefacts.md).
- ⚠️ **Un artéfact ne fait varier que PV, ATQ et DEF** (sa principale est
  plate, `artifactFlatBonus`). D'où quatre régimes (`regimeArtefacts`,
  `src/lib/artifactEvaluation.ts`) :
  - **PV, ATQ ou DEF** — la paire maximise CETTE stat, pas la somme des
    principales, qui classerait par ATQ sur une ATQ qu'une autre paire
    dépasse. La stat est celle de la **fiche**, sans les points Bravoure,
    Éternité ni Origine : la valeur que la carte affiche et qui classe
    (`statTotal`, la même expression dans `scorerPour` et
    `evaluerPourRegime`). Le régime de l'équipement suivant le tri par
    défaut, trier par une stat ne fait donc pas préférer une relique
    Bravoure, Éternité ou Origine pour ses points. Deux reliques de même
    principale y sont souvent **ex æquo** : la relique **portée** l'emporte
    si elle est parmi les meilleures, sinon la plus petite `id`
    (`bestRelicForBuild`, option `departagePortee`, `src/lib/relicOptim.ts`).
  - **PV effectifs** et **Dégâts réels** — la paire maximise l'objectif ;
    deux reliques ex æquo se départagent par `id` croissant. Sans sort
    calculable, « Dégâts réels » se rabat sur le régime sans artéfact
    (`regimeEquipementDe`).
  - **Efficience, Vitesse, Taux CRIT, Dgts CRIT, Résistance, Précision** —
    aucun artéfact n'entre dans ces classements : rien à y maximiser, seule
    compte la faisabilité. Basculer de l'un à l'autre ne recalcule donc
    **rien**. La relique y est la portée si elle est candidate et faisable,
    sinon la première faisable par `id` croissant.

### Pré-filtrage heuristique et compartiments

- **Pré-filtrage heuristique par emplacement** (`filterSlot`), après les
  élagages sûrs : chaque emplacement ne garde qu'un nombre borné de runes
  candidates, réglé par le préréglage de l'écran (`slotFilterCap`,
  `SLOT_FILTER_PRESETS` : Bas 40, Moyen 80 par défaut, Haut 150,
  Extrême 300 ; 40 quand le paramètre est omis). Sont gardées, sans
  doublon :
  - les runes du ou des sets recherchés, Intangible comprises, les mieux
    classées par pertinence vis-à-vis des minimums demandés (`relevance`) ;
  - les meilleures toutes provenances, selon la même pertinence ;
  - **une tranche garantie de runes hors du set demandé** (`offSet`), de
    même taille que la précédente : sans elle, quand les meilleures runes du
    joueur sont justement du set demandé, aucune alternative d'un autre set
    n'a de place garantie, et la recherche ne propose que des builds
    tout-un-set ;
  - le meilleur de l'emplacement sur **chacune des 8 stats**, même sans
    minimum demandé dessus (`PER_STAT_KEEP`, 6 runes par stat), pour que le
    tri après coup reste honnête sur un critère non contraint. Les stats de
    l'objectif (`objectiveKeysOf`) en gardent davantage
    (`PER_STAT_KEEP_OBJECTIVE`, 24) : c'est ce choix, fait avant de lancer
    la recherche, qui oriente le type de rune étudié.
- **Au-delà de 4 conditions minimum posées à la fois**, les deux premiers
  paquets s'élargissent de 20 runes par condition de plus
  (`FILTER_SLOT_WIDENING_THRESHOLD`, `FILTER_SLOT_WIDENING_PER_CONDITION`) :
  la pertinence somme une contribution par condition, et une rune utile à
  une partie seulement des conditions se classe d'autant plus mal qu'elles
  sont nombreuses.
- **Combo à coût complet** (les sets demandés occupent les 6 emplacements,
  Rage + Blade par exemple) : aucune rune hors combo ne peut figurer dans un
  build valide, et `filterSlot` les écarte avant de classer — un élagage
  sûr, pas une heuristique. La tranche hors set y est vide.
- ⚠️ **Heuristique malgré tout** : au-delà de ce pré-filtrage, le résultat
  est « le meilleur trouvé parmi le pool retenu », pas une preuve
  d'optimalité sur l'inventaire entier
  ([../limites-connues.md § Limites connues](../limites-connues.md)).
- **L'estimation affichée avant de lancer** (`estimateSearchSpace`,
  [../ecran/lancer-la-recherche.md § Lancer la recherche](../ecran/lancer-la-recherche.md))
  est le produit des tailles de pool par emplacement après statistique
  principale imposée et pré-filtrage, par le même `filterSlot`
  (`buildFilteredBySlot`). Elle saute la dominance et la faisabilité : c'est
  un ordre de grandeur, pas le pool exact de la recherche, ni le nombre de
  paires que l'appariement visite.
- **Compartiments construits EN FLUX, bornés en mémoire** (`buildBuckets`) :
  chaque combinaison d'une moitié est évaluée puis, selon son mérite,
  retenue ou **immédiatement jetée** — jamais de tableau intermédiaire de
  `cap³` combinaisons, qui épuiserait la mémoire sur un vrai compte. La
  rétention se fait sur **plusieurs tas en parallèle** par compartiment, pas
  sur un seul score : une tranche générique (`relevanceScore`, l'efficience
  des 3 runes), une tranche combinée des minimums dès qu'un minimum est
  posé (`combinedRetentionScore`), et une tranche par stat à protéger
  (`retentionKeys` : les stats à minimum et celles de l'objectif, jamais
  celles à maximum, où « plus » n'est pas sûrement « mieux »). Un seul
  score agrégé écarterait des builds spécialisés sur une stat au profit de
  builds plus généralistes.
  - Chaque tranche a ses propres places, `bucketCap`, jamais une part d'un
    total : un total partagé diluerait chaque tranche à mesure qu'on pose
    des conditions. La mémoire d'un compartiment grandit donc avec le
    nombre de conditions. `bucketCap` vaut `bucketCapFor(slotFilterCap)`,
    soit `round(BUCKET_CAP × slotFilterCap / 40)` avec `BUCKET_CAP` = 3000 :
    il suit la largeur du pré-filtrage, qui multiplie les combinaisons en
    concurrence. `SearchParams.bucketCap` le remplace, pour la mesure
    seulement, jamais depuis l'écran.
  - Les tas sont binaires (`heapPush`) : une insertion ou une éviction
    coûte O(log cap), et une combinaison moins bonne que la pire déjà gardée
    s'écarte en un test. Les tranches sont fusionnées sans doublon et triées
    une seule fois par compartiment, à la fin.
  - « Prioriser les stats les plus difficiles » (`adaptiveTrancheWeighting`)
    répartit autrement les places des tranches par stat, selon leur
    dispersion, à budget total égal (`trancheReallocation`).
  - Les bornes d'élagage d'un compartiment (`maxPct`/`maxFlat`, par stat
    contrainte) s'étendent à partir de **toute** combinaison rencontrée,
    même celles finalement jetées : rester large ici ne coûte rien et
    n'écarte jamais une paire à tort.
  - À l'intérieur d'un compartiment, l'ordre des combinaisons suit
    `combosOrderMode` (défaut `'objective'` : les stats de l'objectif, à
    défaut `relevanceScore`).
- **Compartiments triés par potentiel décroissant** avant l'appariement
  (`Bucket.potential`) : le meilleur score de chaque tranche, rapporté au
  maximum que cette tranche atteint dans n'importe quel compartiment, pris
  sur toutes les tranches. Les paires de compartiments sont ensuite
  visitées par potentiel combiné décroissant (`orderedCompartmentPairs`) :
  les plus prometteuses d'abord, ce qui compte dès que le temps ou le
  plafond de candidats arrête la recherche avant d'avoir tout exploré.

### Faisabilité de set, groupage par compte et jokers

- **Faisabilité de set, précoce** (`stillFeasible`, pendant la construction
  d'une moitié, pas seulement à l'appariement) : pour chaque set demandé, si
  les pièces déjà choisies, plus le meilleur cas du reste de la moitié, plus
  le maximum que l'autre moitié peut apporter (`maxSetsForA`,
  `maxSetsForB`), plus un crédit de joker volontairement généreux
  (`jokerCredit`, 1 dès qu'une Intangible reste dans le pool pré-filtré) ne
  peuvent plus atteindre le compte requis, la branche est coupée avant même
  de choisir le 3ᵉ emplacement.
- Pendant cette construction, trois autres coupes sûres : une branche qui
  porte déjà deux Intangible (jamais appariable) ; pour un set demandé de
  plus de 3 pièces que les deux premiers emplacements n'ont pas entamé, sans
  joker, seules les runes de ce set ou les Intangible sont essayées au
  troisième ; et une moitié sans aucune pièce d'un tel set ni joker propre
  est écartée, l'autre moitié ne pouvant pas fournir toutes ses pièces.
- **Groupage par compte de pièces sûr, jamais approximatif dans le sens
  dangereux** (`satisfiesSets`) : le regroupement ne connaît que des
  comptes agrégés, pas les runes réelles. Il ne voit donc pas qu'un joker
  pourrait, dans la vraie combinaison, être disputé par une rune d'un set
  **hors combo demandé** (un Shield isolé, par exemple) : plus optimiste
  que la réalité, mais seulement dans le sens qui ne casse rien — s'il
  écarte une paire, la vraie combinaison échouerait aussi. Chaque candidat
  qu'il laisse passer est **revérifié sur les runes réelles** (`activeSets`,
  `missingSets`) avant d'être retenu.
- **Au plus 1 rune Intangible par proposition** : le jeu n'autorise à en
  sertir qu'une seule par monstre (voir
  [compte/calcul-runes.md § 5.2 Bonus de set — **à ne pas oublier**](../../../compte/calcul-runes.md)).
  Une paire de compartiments dont les jokers additionnés dépassent 1 est
  écartée **avant** d'ouvrir la boucle des combinaisons
  (`bA.jokers + bB.jokers > 1`) : ce compte, exact, définit le compartiment
  (`bucketKeyOf`), donc jamais un faux rejet. Sans ce garde-fou, une
  combinaison à deux Intangible pourrait être proposée : ses stats seraient
  justes (`activeSets` ne compte qu'un joker), mais elle resterait
  inéquipable en jeu.

### Élagage min/max, périmètre figé et exécution en générateur

- **Élagage de faisabilité MIN et MAX, pas d'optimisation vers un seul
  critère** : la recherche collecte un ensemble large mais borné de
  combinaisons valides (au plus `maxCollected`, défaut `MAX_COLLECTED`,
  100 000), pour permettre le tri après coup sur n'importe quel critère
  sans recalcul. Le maximum se prête à un élagage plus simple que le
  minimum : compléter les 6 runes ne peut qu'ajouter, donc dès qu'une
  combinaison de la moitié A dépasse seule un maximum (plus le contexte
  fixe), aucune moitié B ne la ramène sous la barre, et `comboAFeasible` la
  coupe sans ouvrir la boucle de B. Avant `activeSets` et `computeStats`, un
  repli exact sur les pourcentages et plats déjà cumulés par moitié écarte
  les paires qui échoueraient à coup sûr (`quickOk`).
- **Trois arrêts seulement** : le temps (`maxMs`, défaut `DEFAULT_MAX_MS` ;
  l'écran passe le sien), le plafond de candidats, l'épuisement de
  l'espace. Ne pas réintroduire de plafond de paires : `totalPairCount`
  compte exactement les paires que `pairBuckets` visite (mêmes prédicats,
  même ordre, égalité vérifiée par `tests/rune-optim-differential.test.ts`),
  si bien qu'un tel plafond ne protégerait de rien et changerait une future
  divergence de comptage en troncature silencieuse.
- **La recherche de runes optimise uniquement les 6 runes.** Les artéfacts
  y entrent comme **paire représentative**, qui note les candidats
  (`SearchParams.artifacts`), et comme **bornes d'inventaire** pour la
  faisabilité (`artifactBounds`) ; leur choix est un second problème,
  séparé ([elagages.md § Paire d'artéfacts d'un build](elagages.md)). La relique portée
  (`SearchParams.relic`) reste fixe hors mode `recherche`. En mode
  `recherche`, les bornes du contexte relique la remplacent pendant la
  recherche, le candidat est collecté sans relique, et la relique n'est
  choisie qu'à la résolution de l'équipement du build, qui repasse
  minimums et maximums avec elle :
  [pipeline.md § Résolution de l'équipement d'un build](pipeline.md). Dans
  les deux cas, une borne pendant la recherche, une pièce réelle après.
- Toutes les valeurs sont recalculées avec `computeStats`
  (`src/lib/stats.ts`), la même fonction que partout ailleurs dans l'app.
- **Écrit comme un générateur** (`searchBuildsSteps` : `prepareSearch`,
  puis `buildBuckets` pour chaque moitié, puis `pairBuckets`), pas une seule
  boucle qui tourne jusqu'au bout : l'appariement rend un point de passage
  toutes les `CHECKPOINT_EVERY` (500) paires explorées, la construction à
  chaque rune du premier emplacement de la moitié. `searchBuilds`, appelé
  par les tests et les scripts, ne fait que le drainer d'un bloc. Le Worker,
  lui, pilote ces étapes pas à pas et poste sa progression par paliers de
  temps :
  [../interruption.md § Barre de progression](../interruption.md).
- **Parallélisme, invisible à l'écran** : les deux moitiés se construisent
  en même temps dans deux Web Workers dédiés
  (`src/workers/buildHalf.worker.ts`), et l'appariement se répartit sur
  plusieurs Workers dès que l'espace compte au moins
  `PARALLEL_PAIRING_THRESHOLD` paires (`totalPairCount`), en recherche
  normale comme en mode « Rechercher jusqu'à épuisement complet ». Mêmes
  garanties : `tests/rune-optim-parallel-pairing.test.ts` compare le
  découpage au chemin séquentiel. Détail :
  [pipeline.md § Appariement parallèle](pipeline.md).

### Variantes écartées ou gardées en réserve

Chaque ligne dit une variante déjà essayée ou raisonnée, et pourquoi elle
n'est pas en production. Les pistes encore ouvertes sont dans
[../pistes.md](../pistes.md).

- Ne pas ajouter de dominance entre demi-builds (frontière de Pareto par
  compartiment, `skylineKeys`) : mesurée sur des comptes réels, son coût
  croît bien plus vite que linéairement avec le nombre de stats suivies,
  au point de ne pas finir à sept. Le prototype est resté dans le code,
  inutilisé ([../pistes.md § Prototypes de `buildBuckets`](../pistes.md)).
- Ne pas rendre la dominance directionnelle sur une stat qui n'a qu'un
  maximum (y tenir « moins » pour « mieux ») : un tri après coup par cette
  stat cherche les valeurs proches du plafond, pas les plus basses ; seule
  l'égalité y est sûre (§ Élagages sûrs), et la rétention écarte les
  maximums pour la même raison (`prepareSearch`, `retentionKeys`).
- Ne pas élargir un objectif pour retrouver plus de builds (l'union de
  Dégâts et de Vitesse, par exemple) : il retient plus de runes au
  pré-filtrage, ce qui accroît la concurrence dans les compartiments au
  lieu de la réduire ; à `bucketCap` égal, cette union n'a jamais fait
  mieux que Vitesse seule.
- Ne pas avantager au classement de rétention un demi-build parce que son
  Intangible complète un set de plus de 3 pièces : aucun cas réaliste de
  perte n'est connu. Quand le plafond de candidats arrête la recherche,
  le choix est déjà trop large ; quand c'est le temps, seul un set à très
  peu d'exemplaires est menacé, et son pool, minuscule, s'épuise vite.
- Ne pas remplacer le pré-filtrage par une enveloppe convexe : elle ne vaut
  que pour un critère fixé d'avance, combinaison linéaire de deux stats,
  alors que le tri se choisit après coup, et elle ignore les contraintes de
  set (raisonnement, non mesuré).
- Ne pas passer les stats en `Float32Array` : environ sept chiffres
  significatifs contre des stats au centième de pour cent, pour aucun coût
  de ramasse-miettes identifié (raisonnement, non mesuré).
- Gardée en réserve, pas adoptée : une autre façon de prioriser les stats
  les plus difficiles, qui répartit les places des tranches d'après des
  accumulateurs tenus pendant la construction
  (`scripts/patches/piste-a-tranche-weighting.patch`, qui ne s'applique
  plus tel quel). Elle coûte à la construction, là où
  `trancheReallocation` estime la dispersion sur le pool filtré avant la
  boucle, et son avantage pour trouver n'a été vu que sur un cas. À
  reprendre si l'interrupteur actuel laisse encore des recherches
  infructueuses.
