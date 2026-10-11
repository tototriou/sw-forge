# Vérification

**Statut :** ÉTAT ACTUEL — décrit les contrôles qui couvrent l'algorithme de recherche : référence exhaustive, oracles, différentiels tirés et ciblés, benchmarks et validation sur un compte réel
**Lire si :** on modifie l'algorithme de recherche et qu'il faut savoir quels contrôles le couvrent, ou en écrire un
**Ne pas lire si :** on cherche comment l'algorithme coupe l'espace (moteur-elagages.md) ou comment diagnostiquer une recherche (harnais.md)
**Voir aussi :** invariants.md, harnais.md, moteur-elagages.md, ../../02-app/optimizer/ (routage-par-tache.md)

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
| `testRuneOptimParallelPairing` | `tests/rune-optim-parallel-pairing.test.ts` | l'appariement découpé en tranches contre l'appariement séquentiel |
| `testRuneOptimParallelTruncated` | `tests/rune-optim-parallel-truncated.test.ts` | la fusion des résultats des tranches (`combineParallelPairingResults`) : signal `truncated` et quasi-succès |
| `testRuneOptimNearMiss` | `tests/rune-optim-near-miss.test.ts` | le quasi-succès retenu à l'appariement, y compris après un arrêt manuel |
| `testRuneOptimDeadHalfPruning` | `tests/rune-optim-dead-half-pruning.test.ts` | l'élagage exact des demi-builds sans aucune pièce d'un set demandé à plus de 3 pièces |
| `testFilterSlotTopK` | `tests/rune-optim-filterslot-topk.test.ts` | le top-K de `filterSlot` par le vrai tas (`heapPush`) contre un tri complet |
| `testRuneOptimOnStage` | `tests/rune-optim-onstage.test.ts` | l'observateur `onStage` ne change rien au résultat de `prepareSearch` (détail : harnais.md § L'observateur onStage) |
| `testRandomPool` | `tests/random-pool.test.ts` | le pool synthétique partagé (`scripts/lib/randomPool.ts`) tire toujours la même séquence |
| `testRelicOracle`, `testRelicOracleGroupesEffetUnique`, `testRelicOracleOptimumParScore` | `tests/relic-oracle.test.ts` | l'oracle de la dimension relique (`oracleSearch`, `scripts/lib/relicOracle.ts`) |
| `testRelicDifferentiel` | `tests/relic-differentiel.test.ts` | le différentiel de fidélité de la dimension relique : comparaison pure, puis orchestrateur contre `oracleSearch` si un export de compte est présent |
| `testDiagnosticHarness`, `testDiagnosticProfils`, `testDiagnosticDifferentiel`, `testDiagnosticDecouverte` | `tests/diagnostic-harness.test.ts` et voisins | le harnais de diagnostic (harnais.md § Harnais de diagnostic) |

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

`testRuneOptimParallelPairing` a deux régimes
(`tests/rune-optim-parallel-pairing.test.ts:1-42`) :

- sans plafond de temps ni de collecte, découper `bucketsA` en 1, 2, 3 ou
  4 tranches et apparier chacune indépendamment rend les mêmes paires
  explorées et exactement le même ensemble de candidats que le séquentiel ;
  une simulation séquentielle y suffit, le résultat ne dépendant ni du
  temps ni de la concurrence (`:141-185`) ;
- tronqué par un `maxMs` réaliste (30 s, `:240`), sur de vrais
  `worker_threads` concurrents qui partagent le même temps et divisent le
  plafond de candidats comme `driveParallelPairing`
  (`src/workers/parallelPairing.ts:121`) : chaque tranche reste sous son
  plafond, et une tranche non tronquée retrouve exactement ce qu'une
  référence sans plafond trouve sur la même tranche ; au moins un scénario
  doit tronquer, sinon le régime n'a pas été exercé, et au moins une
  tranche doit être tronquée — par son plafond ou par le temps : le test
  lit `truncated`, qui ne distingue pas les deux
  (`tests/rune-optim-parallel-pairing.test.ts:186-351`). Une
  simulation séquentielle y serait trop généreuse : un chrono neuf par
  tranche et le plafond global non divisé masquent une perte par famine
  de quota (`:18-42`).

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
- `scripts/pairing-parallel-diag.ts` : la calibration, aux volumes réels, du
  seuil de déclenchement et du nombre de workers de l'appariement parallèle
  (`tests/rune-optim-parallel-pairing.test.ts:49-51`).

Il n'existe pas de budget de paires : la recherche n'est bornée que par le
plafond de candidats collectés (`MAX_COLLECTED`, surchargeable par
`SearchParams.maxCollected`), par le temps (`maxMs`) et par la taille exacte
de l'espace (`totalPairCount`) (`src/lib/runeBuildOptim.ts:1167-1190`). Un
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
(`src/lib/runeBuildOptim.ts:605-608`). Un export de compte ne se commite
pas : le `pre-commit` refuse un fichier de plus de 5 Mo.
