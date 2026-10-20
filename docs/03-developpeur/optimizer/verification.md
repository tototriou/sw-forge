# Vérification

Voir aussi : invariants.md, harnais/mode-d-emploi.md, moteur/elagages.md, ../../02-app/optimizer/ (routage-par-tache.md).

Tout changement de `src/lib/runeBuildOptim.ts` suit la discipline du skill
`algo-verify` (`.claude/skills/algo-verify/SKILL.md`) : une référence de
contrôle indépendante, un test différentiel contre elle, et une mesure avant
de figer une constante. Les contrôles ci-dessous tournent dans `npm test`,
sauf les benchmarks et les scripts sur compte réel. Pendant le travail,
`node tests/run.mjs <filtre>` ne lance que les vérifications dont le nom
contient le filtre (registre : `tests/index.ts`), par exemple
`node tests/run.mjs rune-optim dominance`.

## Les contrôles, par nom de registre

| Nom dans `tests/index.ts` | Fichier | Ce qu'il contrôle |
| --- | --- | --- |
| `testRuneOptimDifferential` | `tests/rune-optim-differential.test.ts` | le moteur contre une référence naïve et exhaustive sur des pools tirés ; runes imposées tirées ; un bonus de set non demandé et une seconde activation d'un set demandé |
| `testRuneOptim` | `tests/rune-optim.test.ts` | cas écrits à la main : statistique principale imposée, conditions maximum, chaque élagage sûr isolé, runes imposées, joker, diagnostics |
| `testRuneOptimAurasCoupesMinimum`, `testRuneOptimAurasCoupesDiagnostics`, `testRuneOptimAurasCoupesRetention`, `testRuneOptimAurasCoupesBladeIntangible`, `testRuneOptimAurasCoupesDifferentiel`, `testRuneOptimAurasCoupesDominance` | `tests/rune-optim-auras-coupes.test.ts` | un oracle exhaustif indépendant des coupes sûres, auras propres au build comprises |
| `testDominanceReliqueCasMinimal`, `testDominanceReliqueCouverture`, `testDominanceReliqueRecherche`, `testDominanceReliqueTemoins`, `testDominanceReliqueWorkers`, `testDominanceReliqueDifferentiel`, `testDominanceReliqueDifferentielCible` | `tests/rune-optim-dominance-relique.test.ts` | un oracle noté : la dominance face à l'effet unique de la relique et aux lignes d'artéfact 218–221, paire tirée, différentiel ciblé |
| `testDominanceLignesQuatrePorteurs`, `testDominanceLignesJoker`, `testDominanceLignesLibre`, `testDominanceLignesProducteurs`, `testDominanceLignesWorkers` | `tests/rune-optim-dominance-lignes.test.ts` | les cas fixes des lignes 218–221 : porteurs, joker, « Libre », producteurs, Workers |
| `testRuneOptimScaleMonotonicity` | `tests/rune-optim-scale-monotonicity.test.ts` | à l'échelle d'un compte réel, élargir le pré-filtrage ne perd pas les demi-builds déjà retenus |
| `testAppariementRapide` | `tests/appariement-rapide.test.ts` | le noyau d'appariement sur tableaux typés : seuils aux frontières, oracle paire par paire (aucune paire sautée ne passe `quickOk`), différentiel contre `pairBuckets`, scènes à relique portée et paire d'artéfacts figée comprises |
| `testAppariementParallele`, `testAppariementParalleleWorkers`, `testAppariementParalleleCoupeWorkers`, `testAppariementParalleleBranchement` | `tests/appariement-parallele.test.ts` | le nombre de Workers et le régime ; le coordinateur parallèle contre le séquentiel (Workers simulés, puis vrais `worker_threads`) : plafond global, progression, arrêt manuel, filet de temps, panne ; un morceau coupé avant un morceau suivant achevé ; la tranche d'un Worker d'un morceau au suivant ; sur vrais `worker_threads`, des morceaux coupés en cours par le temps et par l'arrêt ; le branchement du chemin de production |
| `testValidationRapide` | `tests/validation-rapide.test.ts` | la validation typée de l'appariement (`ValidationTypee`) contre `activeSets`, `computeStats` et le test conjoint de `pairBuckets` : cas écrits, paire par paire, collecteur contre collecteur, appariement entier, contrat tenu ou non |
| `testResolutionRapide`, `testResolutionRapideNaN` | `tests/resolution-rapide.test.ts` | la résolution rapide de l'équipement (`src/lib/resolutionRapide.ts`) et le point d'entrée de l'app (`resoudreEquipementDuBuild`, avec les formes de la file) contre le calcul exhaustif (`resoudreEquipementDuBuildExhaustif`), build par build, sans et avec diagnostic ; les notes NaN et leur repli |
| `testConstructionRapide` | `tests/construction-rapide.test.ts` | la construction des moitiés sur tableaux typés (`construireMoitieRapide`, et son découpage en tranches) contre `buildBuckets` : égalité profonde des compartiments, préréglages Bas à Extrême, chaque `combosOrderMode`, évictions forcées ; et `construireMoitie` sur son repli |
| `testPrioriteStatsRetiree` | `tests/priorite-stats-retiree.test.ts` | `SearchParams.adaptiveTrancheWeighting` sans effet : même résultat champ vrai, faux ou absent, aux préréglages Haut et Extrême et sous `bucketCap` minuscule ; une recette qui le porte s'importe sans erreur, le CLI ne le relaie pas, et Haut ou Extrême ne change que `slotFilterCap` |
| `testRuneOptimNearMiss` | `tests/rune-optim-near-miss.test.ts` | le quasi-succès retenu à l'appariement, y compris après un arrêt manuel |
| `testRuneOptimDeadHalfPruning` | `tests/rune-optim-dead-half-pruning.test.ts` | l'élagage exact des demi-builds sans aucune pièce d'un set demandé à plus de 3 pièces |
| `testFilterSlotTopK` | `tests/rune-optim-filterslot-topk.test.ts` | le top-K de `filterSlot` par le vrai tas (`heapPush`) contre un tri complet |
| `testRuneOptimOnStage` | `tests/rune-optim-onstage.test.ts` | l'observateur `onStage` ne change rien au résultat de `prepareSearch` (détail : harnais/mode-d-emploi.md § L'observateur onStage) |
| `testRandomPool` | `tests/random-pool.test.ts` | le pool synthétique partagé (`scripts/lib/randomPool.ts`) tire toujours la même séquence |
| `testRelicOracle`, `testRelicOracleGroupesEffetUnique`, `testRelicOracleOptimumParScore` | `tests/relic-oracle.test.ts` | l'oracle de la dimension relique (`oracleSearch`, `scripts/lib/relicOracle.ts`) |
| `testRelicDifferentiel` | `tests/relic-differentiel.test.ts` | le différentiel de fidélité de la dimension relique : comparaison pure, puis orchestrateur contre `oracleSearch` si un export de compte est présent |
| `testDiagnosticHarness`, `testDiagnosticProfils`, `testDiagnosticDifferentiel`, `testDiagnosticDecouverte` | `tests/diagnostic-harness.test.ts` et voisins | le harnais de diagnostic (harnais/mode-d-emploi.md § Harnais de diagnostic) |

## Référence exhaustive : le test différentiel

`testRuneOptimDifferential` compare `searchBuilds` à `bruteForce`, une
référence qui énumère vraiment le produit des six emplacements, sans
pré-filtrage ni regroupement par compte de pièces, et ne partage avec le
moteur que `computeStats`, `activeSets`, `missingSets` et
`runeEfficiency` (`tests/rune-optim-differential.test.ts:19-22`,
`:37-82`). Comme le moteur, elle refuse deux runes Intangible dans un
même build (`:58-63`). Les pools font trois runes par emplacement, tirés par `randomPool` à graine fixe
(`mulberry32`) : assez petits pour la référence, et sous les plafonds de
pré-filtrage, si bien que le moteur voit tout le pool (`:91-99`).

Sur quinze scénarios tirés (sets demandés et minimums variés, `:89-110`) :

- même verdict de faisabilité ;
- aucun faux positif : chaque candidat rendu est recalculé et revérifié
  sans rien supposer de l'état du moteur ;
- même optimum d'efficience quand la recherche n'est pas tronquée ;
  tronquée, elle rend le meilleur trouvé, pas un optimum garanti, et
  l'optimum n'est pas comparé (`:121-132`) ;
- recherche non tronquée : `totalPairCount` vaut exactement `explored`, et
  `estimatePairBound` en reste un majorant. L'égalité tient parce que les
  deux appliquent les mêmes prédicats factorisés (`satisfiesSets`, joker,
  `bucketPairFeasibleMin`, `comboAFeasible`) et que `explored` s'incrémente
  avant `quickOk` : un filtre ajouté à l'un sans l'autre casse ici
  (`:159-213`).

Le moteur peut rendre moins de candidats que la référence avec le même
optimum : la dominance retire légitimement des combinaisons redondantes.
Ne pas comparer le nombre de candidats, qui diffère sans erreur ; le test
compare la faisabilité et l'optimum.

Les runes imposées (`requirement.lockedRunes`) ont leur balayage, dix
scénarios : la référence reçoit le même verrou appliqué au pool
(`applyLockToPool`), et chaque candidat doit porter la rune imposée sur son
emplacement (`:217-284`). Deux scénarios dédiés vérifient que
`guaranteedMin` anticipe dès `eliminateInfeasible` un bonus de set qu'aucun
combo ne garantit : Blade activé par les emplacements libres sans être
demandé, seul moyen d'atteindre un minimum de Taux Crit ; et une seconde
activation d'Energy, demandé une fois, seul moyen d'atteindre un minimum de
PV (`:286-416`).

## Cas écrits à la main

`testRuneOptim` (`tests/rune-optim.test.ts`) couvre :

- la statistique principale imposée des emplacements 2, 4 et 6 : une rune
  écartée quand sa principale ne correspond pas, une autre retenue
  (`:265-320`) ;
- les conditions maximum : rejet au-delà, acceptation en deçà, minimum égal
  au maximum égal à la valeur exacte accepté (`:322-357`) ;
- la dominance : une rune strictement dominée n'est jamais retenue
  (`:359-389`) ;
- la faisabilité d'un minimum à la frontière exacte : le meilleur cas
  possible passe, la rune incapable d'y arriver n'apparaît jamais
  (`:391-451`) ;
- le symétrique au maximum : une rune dont la seule contribution dépasse
  déjà le plafond est écartée, même si le reste du build resterait dessous
  (`:453-480`) ;
- l'efficacité de l'élagage, pas seulement sa sûreté : `explored` vaut
  exactement le nombre de candidats capables d'atteindre le minimum, pas la
  taille du pool (`:789-835`) ;
- les runes imposées : imposer la seule rune de son emplacement ne change
  rien, imposer un identifiant absent du pool ne donne aucun build, et une
  concurrente meilleure en efficience, même emplacement et même set, est
  écartée au profit de la rune imposée (`:85-133`). Ces cas gardent contre
  un verrou appliqué après la dominance ou le pré-filtrage, qui serait
  ignoré sans erreur.

Écueil des fixtures : deux runes qui ne diffèrent que sur la stat
contrainte se dominent, et la dominance les départage avant l'élagage de
faisabilité. Un cas qui vise la faisabilité donne à ses runes une stat
annexe, non contrainte, qui varie en sens opposé (`:400-404`, `:801-805`).

## Oracle exhaustif indépendant des coupes sûres

`testRuneOptimAurasCoupes…` (`tests/rune-optim-auras-coupes.test.ts`)
confronte `searchBuilds`, de bout en bout, à un oracle exhaustif sur le pool
avant préparation. L'oracle ne partage avec le moteur que `computeStats` et
`activeSets` ; il compte lui-même les activations d'aura, les +8 points
RES/PRE, le combo demandé et les conditions, sans appeler `prepareSearch` ni
aucune coupe (`:6-12`). Les heuristiques sont desserrées pour qu'une absence
soit imputable (`:185`).

À chaque run : aucun faux positif, même verdict de faisabilité, l'optimum
conservé sur chaque critère utile — l'efficience, les stats des conditions
et celles de l'objectif avec leurs auras de combat, toutes les stats en
« Efficience » ou sans objectif (`:121-131`) — et, pour chaque build valide
absent, sa première coupe lue dans le traceur : seules la dominance et les
étapes heuristiques (`HEURISTIQUES`) ont le droit d'en retirer, une coupe
sûre qui l'a rejeté fait échouer le test (`:209-262`).

Scénarios : un minimum RES ou PRE tenu par la seule aura propre, isolé
coupe par coupe (`eliminateInfeasible`, `bucketPairFeasibleMin`,
`comboAFeasible`, `quickOkMin`) ; maximum, et auras non comptées dans les
conditions (`compter: false`) ; diagnostics de faisabilité et quasi-succès ;
rétention sous `bucketCap` 1, qui distingue une perte heuristique d'un faux
rejet ; le témoin Blade non demandé et Intangible ; la dominance (auras,
Blade, joker, et la dominance générique qui reste là où elle est sûre) ; un
différentiel aléatoire sur soixante graines (6300 à 6359).

Limite : cet oracle ne note pas. Il compare un maximum par critère, sans
sort, sans artéfact ni relique : il est aveugle à l'effet unique de la
relique et aux lignes 218–221 (`:20-29`), que portent les oracles notés de
la section suivante. Ne pas étendre `criteresUtiles` aux stats de l'effet
unique ou des lignes : il recopierait la règle de `contexteDominance` qu'il
contrôle, au lieu de la juger.

## Échelle réelle et appariement parallèle

Le différentiel, à trois runes par emplacement, ne peut pas voir une perte
de rétention, qui n'apparaît qu'à des centaines de runes par emplacement.
`testRuneOptimScaleMonotonicity` tire 300 runes par emplacement et vérifie
qu'en passant du préréglage « Bas » à « Extrême », les demi-builds retenus
au premier survivent au second au-dessus du seuil `MIN_SURVIVAL_RATE` ; il
n'appelle que `buildBuckets`, l'étage où la perte se produit
(`tests/rune-optim-scale-monotonicity.test.ts:7-15`, `:42-48`, `:108-120`). Un
renouvellement en queue de classement est normal : exiger la survie de
tous les demi-builds, ou ne suivre que les meilleurs en efficience, ne
discrimine pas (`:17-29`).

L'appariement parallèle rend le résultat du séquentiel, plafond de
candidats compris : sa vérification est donc une égalité, jamais un seuil.

- `testAppariementParallele` (`tests/appariement-parallele.test.ts`) fait
  rendre leurs morceaux dans le désordre à des Workers simulés dans le
  processus : la fusion ne dépend que de l'ordre des morceaux, que la
  simulation exerce, et le résultat doit être identique au séquentiel, non
  tronqué comme sous petit plafond. Il vérifie aussi la progression,
  l'arrêt manuel, le filet de temps déjà dépassé, la panne d'un Worker et le
  refus hors contrat ; rien de ce qu'il vérifie ne lit l'horloge en cours de
  route.
- `testAppariementParalleleWorkers` rejoue l'égalité sur de vrais
  `worker_threads` concurrents, par le lanceur Node de production.
- Sous une troncature par le TEMPS ou par l'arrêt manuel, le parallèle peut
  rendre davantage que le séquentiel (il a parcouru plus dans le même
  délai) : aucune égalité n'y est attendue. Les tests y vérifient une
  sous-suite des candidats du séquentiel non tronqué, qui en est le préfixe
  exact jusqu'au premier morceau coupé, sur un morceau réellement coupé
  avant un morceau suivant achevé, et sur de vrais `worker_threads` dont
  les morceaux sont coupés en cours (`testAppariementParalleleCoupeWorkers`).
- Aux volumes réels, hors `npm test`, `scripts/banc-appariement-rapide.ts`
  compare le chemin de production, séquentiel et parallèle, à
  `pairBuckets`, sur les cas de `CASES` et sur une recette et un export.

## Vérification — oracle noté, paire tirée et différentiel ciblé

Deux protections de la dominance ne se voient qu'au score : l'effet unique
de la relique, et les lignes d'artéfact 218–221, qui ajoutent en « Dégâts
réels » un pourcentage des PV, de l'ATQ, de la DEF ou de la VIT de combat
(`ajoutArtefactBrut`) que `damageRelevantStats` exclut de l'objectif. Un
oracle qui ne note pas reste d'accord avec le moteur précisément là où les
deux ont tort (`tests/rune-optim-dominance-relique.test.ts:5-9`).

`testDominanceRelique…` (`tests/rune-optim-dominance-relique.test.ts`) :

- **La note est celle de la production, paire comprise.** L'oracle
  énumère le produit des six emplacements sans appeler `prepareSearch` ni
  aucune coupe, et note par `objectiveScore` avec les auras propres du
  build et l'effet unique de sa relique (`apportExclusive`) (`:5-16`). Un
  cas peut porter une paire fixe (`SearchParams.artifacts`) et un mode
  critique ; `verifier()` confronte, candidat par candidat, la note de
  l'oracle à `scoreDuCandidat` (`optionsDeClassement`) en relique fixe, et
  au score du couple retenu par la vraie résolution (`resoudreCandidat`,
  paire figée par `paireFixe`) en mode `recherche` (`:22-27`, `:286-300`,
  `:323-350`). La dominance a le droit de retirer un build valide, jamais
  l'optimum.
- **Différentiel aléatoire** (`testDominanceReliqueDifferentiel`, graines
  6400 à 6479) : paire (zéro à deux lignes 218–221) et mode critique,
  Critique ou Non critique, tirés après les autres tirages. Il reste
  aveugle aux mutations de sa propre protection : un clone par
  emplacement, au set tiré, rarement porteur (`:676-750`, `:758-760`).
- **Différentiel ciblé** (`testDominanceReliqueDifferentielCible`, graines
  6500 à 6559) : chaque scénario est construit pour que la protection porte
  l'optimum. B* est l'optimum de l'oracle sur un bruit (sets neutres hors
  du combo) ; ses runes de `setPieces(porteur)` emplacements libres sont
  clonées au set porteur, avec un identifiant plus grand ; la tranche de la
  relique tombe entre les deux assiettes, ou la paire porte la ligne de la
  stat du porteur (`:761-770`). Pièges traités : la stat du porteur n'est
  jamais gardée par l'autre canal (un scénario « ligne » tourne sans
  relique, ou avec des reliques qui ne la protègent pas ; un scénario
  « effet unique » porte une paire dont aucune ligne ne lit la stat du
  porteur) ; deux graines sur trois tournent sans Intangible — avec elle,
  `setPieces − 1` clones et une Intangible, chaque emplacement libre ayant
  son set neutre propre (`:771-780`). Blade fait partie du bruit des
  emplacements libres (`:847`).
  Le test compte, par cible, les scénarios où la protection agit et où
  l'optimum exige les clones porteurs — les détecteurs — et en exige au
  moins un par cible (`:939-1013`) : une mutation qui vide
  `statsDeLEffetUnique` ou `statsLuesParLesLignes` doit faire échouer au
  moins un scénario (`:781-782`). Un scénario où une autre relique
  éligible rend le porteur inutile ne peut rien détecter : l'optimum n'y
  exige pas ses clones.

`testDominanceLignes…` (`tests/rune-optim-dominance-lignes.test.ts`) porte
les cas fixes des lignes 218–221 : sans protection, Energy, Guard, Enhance
ou Determination tomberaient face à un Will aux mêmes stats, optimum perdu
(`:1-7`). Même oracle noté, paire comprise ; en « Libre », l'oracle énumère
lui-même toutes les paires équipables et prend la meilleure note de
l'équipement complet (`:13-21`). Cas : quatre porteurs avec un témoin et
une variante Intangible, un set formable seulement grâce au joker, la ligne
portée par une autre pièce que la représentative en « Libre », les
producteurs du champ (union, cas mixte, écran et CLI), les Workers et les
tranches qui le reçoivent.

## Benchmarks

Hors `npm test`, lancés à la demande : ils mesurent et ne vérifient rien,
sans assertion. Leurs chiffres ne sont pas recopiés ici : on relance le
script sur la machine du moment, en suivant le skill
`optimizer-perf-testing`.

- `npm run benchmark:optim` (`scripts/benchmark-optim.ts`) : pools
  synthétiques de 500 à 5000 runes au total, quatre scénarios de sets et de
  minimums, plusieurs réglages ; il calibre les constantes du moteur à des
  tailles proches des comptes réels, comme l'exige `algo-verify`.
- `npm run benchmark:search-budget` (`scripts/benchmark-search-budget.ts`) :
  `bucketCap` et `slotFilterCap` fixés aux valeurs de production, seul
  `maxCollected` varie ; par palier, le meilleur score, les candidats, les
  paires et le temps. Il répond à « que gagne-t-on à collecter plus ? »
  avant de toucher `MAX_COLLECTED`.
- `npm run benchmark:bucket-retention`
  (`scripts/benchmark-bucket-retention.ts`) : seul `bucketCap` varie, pour
  voir si la rétention par compartiment perd de bons candidats.
- `scripts/perf-battery.ts` : les cas connus en temps et en builds trouvés,
  `--save` pour figer la référence `scripts/perf-baseline.json`. Ne pas
  paralléliser ses mesures de temps : la contention entre processus
  fausserait ce qu'elles mesurent. `--monotonicity`, qui ne compare aucun
  temps, tourne sur des `worker_threads` (`scripts/lib/monotonicity-worker.ts`).
  Il construit les moitiés et apparie par le chemin de production
  (`construireMoitie`, `apparier`), en séquentiel même au-delà du seuil.
- `scripts/banc-appariement-rapide.ts` et
  `scripts/banc-construction-moities.ts` : le chemin de production de
  l'appariement et de la construction contre `pairBuckets` et
  `buildBuckets`, sur les cas connus et sur une recette et un export, avec
  le différentiel et des temps indicatifs par phase.
- `scripts/pairing-parallel-diag.ts` : le seuil de déclenchement et le
  nombre de workers, mesurés aux volumes réels pour l'appariement par
  `pairBuckets` réparti en tranches statiques — la référence, pas la
  production.

Il n'existe pas de budget de paires : la recherche n'est bornée que par le
plafond de candidats collectés (`MAX_COLLECTED`, surchargeable par
`SearchParams.maxCollected`), par le temps (`maxMs`) et par la taille exacte
de l'espace (`totalPairCount`) (`src/lib/runeBuildOptim.ts:1166-1189`). Un
en-tête de script qui cite `DEFAULT_MAX_NODES` décrit un budget supprimé.
Le plafond de collecte privilégie la qualité du résultat sur la vitesse ;
au préréglage le plus large, c'est la construction des compartiments, un
coût fixe de `slotFilterCap`, qui domine le temps, pas `maxCollected`
(`:1174-1189`).

## Validation grandeur nature

Les scripts `scripts/monster-*.ts` rejouent le moteur sur un compte réel,
pour des ordres de grandeur qu'un pool synthétique ne reproduit pas. Rien
n'y est écrit en dur : ils prennent en argument un export de compte et le
monstre, et pour la plupart le deck d'offense de siège qui le porte. Le
principe : retrouver le runage réel d'un monstre déjà runé, à partir de ses
propres stats comme critères.

- `scripts/monster-search-cap-sweep.ts` balaie `slotFilterCap` pour trouver
  à partir de quel pré-filtrage le runage réel est retrouvé ; il a servi à
  calibrer `BUCKET_CAP`.
- `scripts/monster-search-validate.ts` ne donne qu'un sous-ensemble des
  stats en critère, comme un joueur à l'écran, au préréglage « Moyen » par
  défaut.
- `scripts/monster-search-benchmark.ts` compare plusieurs stratégies de
  recherche sur ce même but.
- `scripts/monster-search-rank-diag.ts` donne le rang du demi-build réel
  dans son compartiment, pour chaque tranche de rétention.
- `scripts/monster-search-multicount-diag.ts` étudie un cas où élargir le
  pré-filtrage trouve moins de builds.
- `scripts/monster-build-lookup.ts` affiche l'équipement et les stats
  calculées d'un monstre, à comparer au jeu.

Sur un compte de plusieurs milliers de runes, le moteur a retrouvé
exactement le runage d'un monstre existant ; le préréglage « Extrême »
(300) est la valeur qui l'a permis sur un très gros compte
(`src/lib/runeBuildOptim.ts:604-607`). Un export de compte ne se commite
pas : le `pre-commit` refuse un fichier de plus de 5 Mo.
