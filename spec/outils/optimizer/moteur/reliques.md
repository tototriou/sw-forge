# Dimension relique du moteur

**Statut :** ÉTAT ACTUEL — décrit la relique dans le moteur : ce qu'il lit d'une pièce, le contexte relique, les bornes relâchées pendant la recherche, la résolution exacte par build, le score de l'effet unique, la pertinence et la dominance non branchées, l'oracle
**Lire si :** on modifie la relique dans runeBuildOptim.ts, relicOptim.ts, relicQueue.ts, relicExclusive.ts ou l'oracle relicOracle.ts
**Ne pas lire si :** on cherche le bloc « Relique » de l'écran (../ecran/relique.md) ou la lecture d'une relique dans l'export (../../../compte/calcul-runes.md)
**Voir aussi :** pipeline.md, elagages.md, artefacts.md, ../ecran/relique.md, ../verification.md, ../invariants.md

La principale d'une relique est un pourcentage de PV, d'ATQ ou de DEF
(codes 100, 101, 102), sommé avec les pourcentages des runes et des sets
avant l'unique multiplication par la base : `base + ceil(base × Σ% / 100) +
plats` (`computeStats`, `src/lib/stats.ts`). Changer de relique change donc
quelles runes atteignent les minimums. Ne pas choisir la relique après coup,
sur le build déjà gagnant, parce qu'un build infaisable avec la relique
portée peut devenir faisable avec une autre. La différence avec un artéfact
est arithmétique : sa principale est plate et s'ajoute après la
multiplication. D'où un vecteur de bornes en pourcentage, propre à la
relique, à côté des bornes plates des artéfacts, dans la même fonction
(`deriveMinMaxContext`, `src/lib/runeBuildOptim.ts`).

La propriété exclusive de la relique (son effet unique) n'entre jamais dans
`computeStats` ni dans les conditions : elle ne compte qu'au score.

Le moteur procède en deux temps, comme pour les artéfacts : une recherche de
runes aux bornes relâchées, puis une résolution exacte, build par build, de
la paire d'artéfacts et de la relique ensemble. Le chemin complet d'une
recherche : [pipeline.md § Pipeline de la recherche de runes](pipeline.md).

## Ce que le moteur lit d'une relique

- **`RelicDetail`** (`src/types.ts`), produit par `relicToDetail`
  (`src/lib/importAccount.ts`) : `id` (le `rid` de l'export), `upgrade`
  (`upgrade_curr`), `main` (code 100, 101 ou 102 et sa valeur, lue dans
  `pri_effect`) et, facultatif, `unique` (`type`, `tranche`, `percent`, lus
  dans `sec_effect`). `percent` manque sur un fichier de prépa exporté par
  une version antérieure. Rien d'autre n'est lu : `durability`, `extra`,
  `source` (sens inconnu) et `locked` restent dans l'export. La lecture du
  champ `sec_effect` et la table des seize types :
  [../../../compte/calcul-runes.md § Les 16 propriétés uniques — table OFFICIELLE](../../../compte/calcul-runes.md).
- **La valeur de la principale vaut niveau + 3** (relevé dans l'export) :
  +0 donne 3 %, +11 donne 14 %. Le moteur lit `main.value`, jamais une
  valeur recalculée depuis `upgrade` ; un écart est compté à l'import
  (`relicUpgradeMismatches`), jamais corrigé. Les trois principales sont
  donc sur la même échelle : une PV % +14 et une DEF % +14 ont la même
  valeur brute. Ne pas noter une relique par la valeur de sa principale,
  parce que deux reliques de statistiques différentes y seraient ex æquo et
  que l'ordre d'itération les départagerait : elle se note par son effet
  sur le score du régime (§ Régimes : ce qui note la relique).
- **Une relique n'est pas exclusive** : la même pièce peut être portée par
  plusieurs exemplaires à la fois (relevé dans l'export). Le moteur n'en
  réserve donc aucune : le contexte se forme sur l'inventaire entier
  (`relics` à l'écran, `LoadedMonster.allRelics` au CLI), sans exclusion ni
  réservation, à la différence des runes et des artéfacts.
- **Une seule relique par monstre**, lue sur l'unité (`unit.relics[0]`) :
  l'export n'a pas de liste de reliques propre à la RTA, quand il en a une
  pour les runes et les artéfacts (`world_arena_rune_equip_list`,
  `world_arena_artifact_equip_list`). La relique est donc la même en Box,
  en RTA et en siège.
- **Le nombre d'exemplaires qui portent une même relique est limité en jeu**
  (`RELIC_MAX_INSTANCES`, 150, `src/lib/effects.ts`, une valeur de jeu qui a
  déjà changé une fois). Le moteur ne l'oppose jamais : il retient la
  meilleure relique sans vérifier la place restante. Seul le détail de la
  relique affiche l'occupation (`formatRelicUsage`, `RelicDetailBox`) :
  [../ecran/resultats.md § Validation d'un build et relique](../ecran/resultats.md).

## Le contexte relique

- **L'intention** (`RelicIntent`, `src/hooks/useOptimizerState.ts`) porte
  le mode, la principale, le type et le seuil. Deux constructeurs, mêmes
  règles : `relicIntentDepuisEtat` (écran) et `recipeToRelicIntent`
  (`scripts/lib/recipeToSearchParams.ts`). Mode `off` quand l'optimisation
  d'artéfacts et reliques est coupée ; `equipped` quand la principale vaut
  « Garder la relique équipée » ; `recherche` sinon. Sans principale dans la
  recette, le CLI calcule le défaut contre la relique portée
  (`defaultRelicMainChoice`), comme l'écran.
- **`resoudreContexteRelique(intention, reliqueEquipee, inventaire)`**
  (`src/lib/relicOptim.ts`) résout l'intention une fois, en un
  `RelicContext` : `mode`, `principale`, `type`, `seuil`, `equipee`,
  `eligibles`, `vide`, `bornes`, `empreinte`. Moteur, file, CLI, oracle et
  écran consomment ce contexte, jamais leur propre lecture des réglages.
  Trois producteurs le posent dans `SearchParams.relicContext` : l'écran
  (`OptimizerSection.tsx`), `recipeToSearchParams` et
  `buildCaseSearchParams` (`scripts/lib/perfShared.ts`, pour `perf-battery`
  et l'oracle `--case`, seulement si le cas porte une relique).
- **Par mode** :
  - `off` : aucune éligible, bornes nulles ; la relique portée reste
    appliquée par le moteur, par `SearchParams.relic` ;
  - `equipped` : la seule relique portée, et ses bornes ; sans relique
    portée, `vide: 'equipee'`, et le moteur cherche sans relique, sans
    refus ;
  - `recherche` : `eligibleRelics` filtre l'inventaire par la principale si
    elle est imposée, puis par le type s'il est imposé, puis par le seuil
    (`upgrade >= seuil`). Le premier filtre qui vide le pool donne `vide`
    (`inventaire`, `principale`, `type` ou `seuil`). Les éligibles ne sont
    réduits par aucune dominance (§ Pertinence et dominance — écrites, non
    appelées en production).
- **Le seuil** vaut +6 par défaut (`DEFAULT_RELIC_MIN_UPGRADE`) et va de +0
  à +15, le niveau maximal d'une relique en jeu, jamais le maximum d'un
  compte. Une recette hors bornes est ramenée dans [0, 15] à la lecture
  (`src/lib/optimizerRecipe.ts`). C'est un filtre d'entrée, jamais un
  critère de classement.
- **Les bornes** (`RelicBounds`) : `max` est la meilleure principale
  éligible de chaque statistique, les trois indépendantes
  (`relicPctMaxByStat`) ; `min` est la plus petite principale éligible sur
  la statistique imposée, 0 sur les deux autres et partout sans principale
  imposée (`relicPctMinByStat`).
- **L'empreinte** joint le mode, chaque éligible triée par `id` (`id`,
  code et valeur de la principale, `upgrade`, type, tranche et pourcentage
  de l'exclusive), la principale, le type et le seuil. Deux inventaires qui
  ne diffèrent que par l'ordre donnent la même empreinte ; une pièce
  réimportée avec d'autres valeurs la change.
- **Pool vide en mode `recherche` : refus nommé.** `prepareSearch` lève
  `RechercheRefusee` (`motif: 'relique-pool-vide'`, `vide`) avant toute
  construction, jamais une recherche sans relique à la place. Le Worker le
  transmet par `prepareOrRefuse` comme message `refus`, et le hook passe en
  `refused` ([pipeline.md § Préparation](pipeline.md)) ; le CLI
  (`scripts/optimizer-search.ts`), `perf-battery` et l'oracle l'impriment.
  `resoudreEquipementDuBuild` lève la même erreur si on l'appelle sur un
  contexte sans éligible.

## Contexte transporté, bornes relâchées, filtre exact

- **`SearchParams.relic` reste la relique portée** ;
  `SearchParams.relicContext` est recopié tel quel dans
  `PreparedSearch.relicContext`. En mode `recherche`, une candidate
  remplace la portée à la résolution exacte, jamais un cumul des deux.
- **Deux vecteurs de pourcentage** (`MinMaxContext.relPctMax`, `relPctMin`,
  calculés par `deriveMinMaxContext`). Hors mode `recherche` (contexte
  absent, `off`, `equipped`), les deux valent `relicPctBonus(relic)`, le
  pourcentage de la relique portée. En mode `recherche`, `relPctMax` vaut
  `relicContext.bornes.max` et sert les vérifications de MINIMUM,
  `relPctMin` vaut `relicContext.bornes.min` et sert les vérifications de
  MAXIMUM ; `relic` n'est pas lu.
- **Le pourcentage reste fondu dans le `ceil`** : `totalOf(k, pct, flat)`
  vaut `B + ceil(B × pct / 100) + flat` sur PV, ATQ et DEF, où `pct`
  contient la borne de relique. `ceil` étant monotone, le total est un
  majorant du réel avec `relPctMax`, un minorant avec `relPctMin`. Le
  vecteur sert à `eliminateInfeasible` (minimum par `relPctMax`, maximum
  par `relPctMin`), `bucketPairFeasibleMin`, `comboAFeasible`, au repli
  `quickOk` de `pairBuckets`, à `totalPairCount` et aux diagnostics
  (`diagnoseFeasibility`, `poolMinSlotSafe`, `rankBlockingConditions`), qui
  reçoivent tous `params.relicContext`. Ces bornes et celles des artéfacts :
  [elagages.md § Élagage sûr — faisabilité](elagages.md).
- **En mode `recherche`, le candidat est collecté sans relique**
  (`GearSet.relic = undefined`, `pairBuckets`) : la relique portée n'est
  pas une hypothèse de la recherche, elle peut être hors du pool. Le test
  conjoint final y ajoute un terme additif : `relTermMax(k) = ceil(B × Lmax /
  100)` côté minimum, `relTermMin(k) = floor(B × Lmin / 100)` côté maximum.
  Ne pas y mettre un `ceil` séparé côté maximum, parce qu'il rejetterait un
  build faisable : avec B = 101 et R = L = 1 %, le réel vaut 104, le `ceil`
  séparé 105, et un maximum à 104 tomberait.
- **Ce test reste une borne en mode `recherche`** : les bornes accordent la
  meilleure PV %, la meilleure ATQ % et la meilleure DEF % à la fois, alors
  qu'une relique n'a qu'une principale. Aucun faux négatif au test de
  faisabilité, mais des faux positifs, que la résolution exacte rejette. Le
  score qui ordonne les candidats avant elle est donc calculé sans relique,
  non exact.
- **La relique n'entre dans aucun ordre de rétention** (`filterSlot`,
  `retentionScore`, `combinedRetentionScore` ne lisent que les runes). Les
  faux positifs occupent pourtant des places bornées (`slotFilterCap`, les
  tranches de `bucketCap`, `MAX_COLLECTED`) et peuvent évincer un vrai
  candidat avant la résolution : une perte par dilution, possible, jamais
  supposée absente (§ Oracle de la dimension relique).
- **Pendant la recherche relâchée, le moteur ne lit l'effet unique que par
  la dominance des runes** : les reliques qu'il peut équiper
  (`reliquesEquipables` : la relique portée hors mode `recherche`, tout
  `relicContext.eligibles` en mode `recherche`) y protègent les stats de
  leur effet unique (`statsDeLEffetUnique`) :
  [elagages.md § Élagages sûrs](elagages.md). Le score, lui, le lit une
  fois la relique connue : `objectiveScore` reçoit son apport, neutre
  (`APPORT_NEUTRE`) tant qu'aucune relique n'est résolue.
- **Le filtre final exact** est `respecteConditionsAvecRelique(gear,
  relique, requirement)` : `computeStats` avec la candidate à la place de
  `gear.relic`, puis `respecteMinEtMax`, minimums ET maximums, avec les
  auras propres des six runes du build. Hors mode `recherche`, son pendant
  `respecteConditionsPaireFixe` ne teste que les minimums et les maximums
  de RES et de PRE.
- Ne pas faire de la relique une septième variable de
  `buildBuckets`/`pairBuckets`, parce que cela touche le cœur de
  l'algorithme : référence de contrôle, différentiel et benchmark d'abord
  (skill `algo-verify`). Ne pas construire non plus une seconde mécanique de
  bornes à côté de celle des artéfacts : les deux vivent dans
  `deriveMinMaxContext`.

## Le traceur d'un build

Instrument de diagnostic, absent en production. `SearchParams.traceur`
(`TraceurRequete`, six identifiants de runes alignés sur les emplacements
1 à 6) fait produire par le moteur `SearchResult.traceur` (`TraceCandidat`) :

- par étage de préparation (`PrepareStage`), la présence de chacune des six
  runes ; l'étage `feasibility` est le verdict d'`eliminateInfeasible` rune
  par rune ;
- pour chaque moitié (`TraceMoitie`) : générée ou coupée avant tout
  compartiment (`filterSlot`, `stillFeasible`, `jokers`, `demiBuildMort`),
  son compartiment, l'occupation avant rétention, sa présence dans chaque
  tranche à la clôture et dans le compartiment final ;
- à l'appariement : paire de compartiments atteinte, `satisfiesSets`,
  `jokers`, `bucketPairFeasibleMin`, `comboAFeasible`, `quickOkMin`,
  `quickOkMax`, `missingSets`, validation finale, collecte ; le budget
  (`tronque`, `motif`) et des compteurs.

La présence par tranche ne s'observe que sur le chemin séquentiel
(`searchBuilds`) : sur le chemin Workers, les moitiés se construisent dans
un autre fil. Un rejet par pré-filtrage (`prepareSearch` rend `null`) ne
perd pas la trace : `prepareSearch` la passe à `onReject`, et
`searchBuildsSteps` la pose sur le résultat vide qu'il construit. Les deux
adaptateurs qui reconstruisent `SearchResult` à la main
(`scripts/lib/spawnSliceNode.ts`, `pairSliceInWorker` dans
`src/workers/runeBuildOptim.worker.ts`) recopient `traceur`. Le harnais
s'en sert pour `--suivre` (`scripts/lib/diagnosticHarness.ts`), le
différentiel relique pour classer une perte
(`scripts/lib/relicDifferentiel.ts`).

## Résolution exacte par build, file, classement

- **Paire d'artéfacts et relique se résolvent ensemble**,
  `resoudreEquipementDuBuild(entree)` (`src/lib/relicQueue.ts`) : la
  principale de la relique entre dans `computeStats` avant les plats
  d'artéfact, donc la meilleure paire dépend de la relique. Ne pas choisir
  la paire avec la relique portée puis ajouter une relique, parce que le
  couple noté n'existerait pas. Ce module ne dit que COMMENT résoudre ;
  QUAND et QUI relèvent de la file :
  [pipeline.md § File de résolution](pipeline.md).
- **L'entrée** (`EntreeResolution`) est assemblée par
  `entreeResolutionDuBuild`, pour l'écran, le CLI, le Worker de résolution
  et le différentiel (`scripts/lib/relicDifferentiel.ts`) : `gear`
  (l'équipement de la fiche, ses seules runes remplacées par celles du
  candidat), `faireParams(relique)` (les paramètres de `chercherPaires`,
  dont l'`evaluer` du régime effectif note chaque paire sur
  `statsParPaire({ ...gear, relic: relique })`, auras propres du build et
  canal de l'effet unique compris), `respecteConditions` (le prédicat hors
  mode `recherche`, `null` quand `conditionsPaireFixePosees` ne trouve
  aucune condition), `requirement` (minimums ET maximums, auras comprises),
  `regimeAucun`, `regimeDeStat`, `relicContext` et `caches`.
- **Hors mode `recherche`** (contexte absent, `off`, `equipped`) :
  `resoudreReliqueFixe` avec la relique portée (`gear.relic`, le même
  paramètre que le moteur). Les paires par score décroissant
  (`pairesParScore`) ; la première qui tient `respecteConditions` est
  retenue ; aucune : la meilleure au score, `conforme: false`. Cette
  fonction garde la structure de l'ancienne boucle de la file ; ses entrées
  ont changé depuis (auras propres, maximums RES/PRE, effet unique), et
  `tests/relic-queue.test.ts` ne compare sa copie de cette boucle à
  l'évaluateur courant que sur trois candidats d'une seule fixture. Les
  modes `off` et `equipped` y rendent, octet pour octet, le résultat du
  chemin sans contexte.
- **En mode `recherche`, un ordre fixe** :
  1. énumérer `relicContext.eligibles`, jamais recalculés ;
  2. pour chaque candidate, `pairesParScore(faireParams(candidate))` : la
     candidate remplace la portée dans les stats ;
  3. pour chaque paire, par score décroissant,
     `respecteConditionsAvecRelique({ ...gear, artifacts }, candidate,
     requirement)` : le couple qui viole une condition est éliminé avant
     d'être noté ;
  4. la note du premier couple faisable est `PaireArtefacts.score`, le
     score que l'`evaluer` du régime a donné à la paire : une seule note,
     jamais une seconde calculée à côté ;
  5. `bestRelicForBuild(candidates, evaluate, { regimeAucun, equipee,
     departagePortee })` choisit entre candidates (§ Régimes : ce qui note
     la relique) ;
  6. aucun couple faisable : `conforme: false`, et le résultat porte, pour
     diagnostic, le meilleur couple au score de l'éligible de plus petite
     `id`.

  Jamais « le meilleur, puis le filtre » : un build faisable avec une
  autre relique serait perdu. Le couple retenu repasse le filtre exact ; un
  échec lève une erreur (garde défensive, pas un filtre).
- **Le résultat** (`ResultatArtefacts`) porte la paire, ses artéfacts, les
  stats recalculées avec l'équipement retenu, `conforme`, et en mode
  `recherche` la relique retenue (`relique`, son `id` est le `rid`) et
  `sansEffetSurLeTri`. Le classement (`affichees`, par `classementResolu`)
  écarte un build non conforme et classe sur ces stats, qui incluent la
  relique : [pipeline.md § Résultat affiché](pipeline.md).
- **Non-régression conditionnelle** : une principale en pourcentage ne fait
  jamais baisser PV, ATQ ni DEF, donc un build résolu monte ou reste par
  rapport à son état collecté. Mais si la relique portée est exclue du pool
  (principale, type ou seuil, `reliqueEquipeeExclue(ctx)`), la meilleure
  admissible peut noter moins qu'elle, et le candidat le porte.
- **L'état pour l'écran**, `etatReliqueDuBuild(resultat, ctx, portee)` :
  `fixe` (pas de dimension relique : la portée, ou rien), `en attente`
  (mode `recherche`, build absent du cache de la file : ses stats sont
  celles du moteur, sans relique, son score n'est pas exact), `rejete`
  (aucun couple faisable, jamais affiché), `resolue` (la relique retenue,
  avec `sansEffetSurLeTri` et `equipeeExclue`).
- **Le contexte que la file consomme est celui de la recherche lancée** :
  `useBuildOptimSearch` expose `relicContext`, posé par `run(params)` et
  effacé par `reset` ; l'écran le lit (`relicContextRecherche`), jamais les
  réglages courants. Il fixe aussi le nombre de combinaisons que la file
  confirme (`kDeLaFile`, 300 en mode `recherche`, 100 sinon) :
  [artefacts.md § Le choix des artéfacts — un second problème, séparé](artefacts.md).
- **Le cache de la file** (`parBuild`) est vidé par la signature des
  réglages (`signatureReglages`), dont la part relique est
  `empreinteRelique`, l'empreinte du contexte lancé (`null` sans contexte),
  à côté du régime effectif (`objective`), de `damageSetup` et de la relique
  portée. Un tri qui ne change pas de régime effectif ne vide rien.

## Régimes : ce qui note la relique

- **Un seul régime pour la paire et la relique** : `regimeEquipement =
  regimeEquipementDe(regimeArtefacts(adapterArtefactsAuTri ? sortBy :
  objective), contexte de dégâts disponible)` (`OptimizerSection.tsx`,
  `src/lib/artifactEvaluation.ts`). « Dégâts réels » sans sort calculable
  est rabattu sur `aucun` une fois, à l'écran, jamais absorbé par
  `evaluerPourRegime`.
- **`degats_reels` et `ehp`** : la note compte l'effet unique de la relique
  essayée (§ L'effet unique — score de la propriété exclusive). Ex æquo :
  `id` croissant.
- **`hp`, `atk`, `def`** : `evaluerPourRegime` note la FICHE (`statTotal`,
  la même expression que le tri par stat, `scorerPour`, et que la carte),
  sans l'effet unique. Deux reliques de même principale y sont donc ex
  æquo : la relique portée l'emporte si elle est parmi les meilleures,
  sinon la plus petite `id` (`regimeDeStat`, option `departagePortee` de
  `bestRelicForBuild`). Ce départage porte sur le CHOIX, pas sur le score.
  Conséquence : « Adapter les artéfacts et reliques au tri » étant activé
  par défaut, trier par une stat ne fait pas préférer une Bravoure, une
  Éternité ou une Origine pour ses points.
- **`aucun`** (Efficience, Vitesse, VIT, Taux CRIT, Dgts CRIT, RES, PRE) :
  aucune note à maximiser. La relique portée si elle est candidate et
  faisable, sinon la première faisable par `id` croissant ;
  `sansEffetSurLeTri` le transporte jusqu'à la carte.
- Tests : `testTriParStatSurLaFiche`, `testDepartageReliquePortee`
  (`tests/relic-exclusive.test.ts`).

## L'effet unique — score de la propriété exclusive

Relevé en jeu, `src/lib/relicExclusive.ts` :

- **`gain = ⌊Y / t⌋ × percent`** (`tranchesAtteintes`) : par tranches
  entières, jamais au prorata (1 % par tranche de 1 000 ATQ : 1 % à 1 000
  comme à 1 800, 2 % à 2 000), sans plafond. `t` et `percent` sont lus dans
  la pièce, jamais recalculés depuis son niveau.
- **`Y` est la statistique de référence du type au début du combat**
  (`statsDebutCombat`, `src/lib/damage.ts`) : base, runes, artéfacts,
  principale de la relique et effets de set (tout ce que `computeStats` a
  posé), puis compétences d'invocateur, leader skill et sets d'aura (ceux
  des autres monstres et ceux que forment les runes du build), sans aucun
  buff d'ATQ, de DEF ou de VIT ni bonus de passif. Sur PV, ATQ et DEF,
  invocateur, lead et auras entrent dans un seul `ceil` :
  [../../degats-reels/effets-equipe-et-leaders.md § Sets d'aura d'équipe — modèle](../../degats-reels/effets-equipe-et-leaders.md).
- **La principale de la relique essayée entre dans `Y`, son gain non** :
  une seule relique, aucune boucle. Par construction de `RELIC_UNIQUE`, la
  stat améliorée n'est jamais la stat de référence (Bravoure améliore l'ATQ
  depuis la VIT, la DEF ou les PV ; Éternité la DEF depuis l'ATQ, la VIT ou
  les PV ; Origine les PV depuis l'ATQ, la VIT ou la DEF) : le score se
  calcule en une passe. Un type futur qui romprait cette propriété se
  traite, il ne s'absorbe pas. La VIT n'est jamais un gain : seulement une
  stat de référence (types 7, 11 et 14).
- **L'apport se recalcule par paire** (`evaluerPourRegime`) : la principale
  plate d'un artéfact entre dans `Y`, et deux paires peuvent franchir des
  tranches différentes.
- **Placement** (`apportExclusive`, `ApportExclusive`) :
  - Conquête (types 1 à 3) : pourcentage additif dans le terme DMG% de
    `computeTotalDamage` (`reliqueDmgPct`), pour le sort et chaque passif
    offensif ; jamais dans le terme Additionnel :
    [../../degats-reels/valeurs-de-jeu-curees.md § Les valeurs de jeu — curées, avec leur source (ex-A.2 ter)](../../degats-reels/valeurs-de-jeu-curees.md) ;
  - Ténacité (4 à 6) : réduction des dégâts reçus. Les PV effectifs
    deviennent des PV effectifs équivalents, `pvEffectifs / (1 − X / 100)`
    (`facteurTenacite`), dérivé de l'équation des dégâts en posant
    Variance = 1 et Additionnel = 0 : une simplification, pas un relevé.
    `X ≥ 100` lève une erreur. `pvEffectifs` ne compte aucune ligne
    d'artéfact de dégâts subis : la Ténacité y est la seule réduction ;
  - Bravoure (7 à 9, ATQ), Éternité (10 à 12, DEF), Origine (13 à 15,
    PV) : des points, `base × gain / 100`, ajoutés par `statsAvecApport`
    aux seules stats qui notent, jamais à `computeStats` ni aux conditions,
    qui jugent la stat hors combat. Ces stats sont celles que reçoit
    `computeTotalDamage` : les points augmentent donc aussi la stat dont
    les lignes d'artéfact 218–221 prennent leur pourcentage ;
  - Régénération (16) : aucun objectif ne mesure soins et boucliers ;
    neutre.
- **Neutres, jamais estimés ni éliminés** : pas d'exclusive, un type
  inconnu de `RELIC_UNIQUE`, une pièce sans `percent`, Régénération, un
  gain nul. `exclusiveChiffrable` (`relicOptim.ts`) dit quels types ont une
  formule ; `tests/relic-exclusive.test.ts` vérifie, sur les seize types,
  qu'il concorde avec un apport non neutre.
- **L'arrondi des points de Bravoure, d'Éternité et d'Origine n'est pas
  relevé** : le code n'en pose aucun. L'écart est borné par un point de
  stat, mais l'écart de score qui en découle peut inverser deux builds
  proches. Ne pas recopier l'arrondi de `computeStats` par analogie.
- **Une seule note** : l'apport sert à la même note pour choisir la paire,
  choisir la relique et classer (`objectiveScore`, `scoreDuCandidat`),
  jamais un score d'exclusive ajouté après coup.

## Pertinence et dominance — écrites, non appelées en production

`dimensionsRetenues` et `relicDominates` (`src/lib/relicOptim.ts`) ne sont
appelées que par `tests/relic-optim.test.ts`. Aucune dominance de reliques
ne réduit le pool en production : la résolution essaie toute relique
éligible, et la dominance des runes protège l'effet unique de toutes.

- **`dimensionsRetenues(objectif, sort, minimums, maximums)`** rend une
  `RelicDimensions` :
  - `principaleStats` : les statistiques de l'objectif, unies à celles sous
    un minimum actif. « Dégâts réels » : celles du scaling du sort ;
    « PV effectifs » : PV et DEF ; Efficience et Vitesse : aucune, donc les
    seuls minimums ;
  - `exclusiveTypesPertinents`, dérivés du groupe de `RELIC_UNIQUE`
    (`relicUniqueNature`), jamais une table de codes recopiée : « Dégâts
    réels » retient Conquête et le groupe qui améliore une stat du scaling ;
    « PV effectifs » retient Ténacité, Éternité et Origine ; Efficience et
    Vitesse, aucun. Régénération n'est jamais pertinente ;
  - `maxActifs` : les statistiques sous un maximum ;
  - `scorePartiel` : vrai si un type pertinent n'est pas chiffrable. Il
    vaut faux sur les quatre objectifs actuels.
- **`relicDominates(a, b, dimensions)`** : `a` domine `b` seulement si les
  deux ont la même statistique de principale, sans maximum actif dessus, et
  `a ≥ b` sur sa valeur ; si l'exclusive est compatible (même type connu,
  avec une tranche de `a` au plus égale et un pourcentage au moins égal, les
  deux présents ; ou deux types connus avec `b` non pertinente) ; et si `a`
  est strictement meilleure sur au moins un axe pertinent. Un type inconnu
  d'un côté, ou deux exclusives pertinentes de types différents, ne se
  comparent jamais. Un maximum casse la monotonie : sous un plafond de PV,
  une +14 peut rendre infaisable ce qu'une +12 rend faisable.
- Ne pas ajouter de dominance numérique entre deux types différents, parce
  que l'ordre dépend du build (`Y`) : une Éternité·VIT passe devant une
  Origine·DEF sur un runage rapide, derrière sur un runage défensif. Entre
  deux pièces du même type, la tranche et le pourcentage suffisent.

## Oracle de la dimension relique

`oracleSearch(params, relicContext, options)` (`scripts/lib/relicOracle.ts`)
est la référence de contrôle de la dimension relique, hors de l'interface :
exacte pour cette seule dimension, relative au moteur de runes et à sa
configuration. Elle ne prouve pas l'exactitude du moteur de runes.

- **Un run par groupe** (`groupesOracle`) : les reliques éligibles, sans
  dominance, regroupées par principale (code et valeur) ET par stats de
  l'effet unique (`statsDeLEffetUnique`). Grouper sur la seule principale
  protégerait l'effet unique de la première relique du groupe, puis
  noterait les autres sur des builds que la dominance d'un run a pu perdre.
  Hors mode `recherche`, un seul run, avec la relique portée.
- **Chaque run** (`oracleSearchRuns`) appelle `searchBuilds` avec les mêmes
  `SearchParams`, sauf `relic`, remplacée par la première relique du
  groupe par `id`, et `relicContext`, effacé : l'oracle n'applique aucune
  des bornes relâchées qu'il sert à vérifier.
- **La fusion** (`fusionnerRunsOracle`) note chaque build avec la meilleure
  relique de son groupe (`bestRelicForBuild`, effet unique compris, régime
  `aucun` en Efficience et en Vitesse) et garde, par build, le meilleur
  score, puis le plus petit `rid`. L'optimum est le meilleur
  `OracleCandidate.score`, ex æquo par `rid` croissant puis ordre
  d'insertion, jamais un `sortCandidates` qui renoterait sans l'effet
  unique. L'oracle ne connaît que les quatre objectifs, jamais un régime de
  stat (`scoreOracleDuCandidat`). `complet` est vrai si aucun run n'est
  tronqué.
- **Refus** : un pool vide en mode `recherche` lève la même
  `RechercheRefusee` que le moteur, jamais un résultat vide.
- `realDamage` et `exclusive` voyagent par les `options` de l'appel, hors
  `SearchParams` ; le même contexte `exclusive` doit être donné à l'oracle
  et à la résolution comparée.
- **Lancement** : `npx tsx scripts/lib/relicOracle.ts --case=<index>` ou
  `<export.json> <recette.json>` ; l'orchestrateur
  `scripts/relic-differentiel.ts` lance un processus par run et réutilise
  la même fusion.
- **Contrôles** : `tests/relic-queue.test.ts` compare la résolution
  complète (moteur relâché puis `resoudreEquipementDuBuild`) à l'oracle sur
  neuf fixtures écrites à la main (`CORPUS_5A`,
  `tests/relic-search.test.ts`), et classe toute perte : faux négatif
  (échec), dilution ou troncature. Aucune perte n'y est un faux négatif ;
  sur la fixture C (`bucketCap` 10), l'optimum est perdu par dilution.
  Registre des contrôles : [../verification.md § Les contrôles, par nom de registre](../verification.md).
