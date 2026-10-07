# Diagnostics de la recherche de runes

**Statut :** ÉTAT ACTUEL — décrit les diagnostics du moteur de recherche de runes : preuve d'impossibilité par stat (`diagnoseFeasibility`), conditions bloquantes du pré-filtrage sûr (`rankBlockingConditions`), quasi-succès à l'appariement, et ce que l'estimation du pool n'affirme pas
**Lire si :** on modifie `diagnoseFeasibility`, `rankBlockingConditions`, `poolMinSlotSafe`, le quasi-succès de `pairBuckets` (`NearMiss`, `nearMissByCondition`, `globalNearMiss`) ou `estimateSearchSpace`, ou on se demande ce qu'un diagnostic « 0 résultat » prouve
**Ne pas lire si :** on cherche la disposition des encadrés à l'écran (../ecran/resultats.md) ou le mode d'emploi du harnais (../harnais.md)
**Voir aussi :** ../ecran/resultats.md, ../harnais.md, elagages.md, pipeline.md, ../invariants.md

Calcul pur dans `src/lib/runeBuildOptim.ts`. Les trois diagnostics lisent
les conditions par les mêmes bornes que la recherche (`deriveMinMaxContext` :
`guaranteed`, `guaranteedMin`, `artFlatMax`, `artFlatMin`, `relPctMax`,
`relPctMin`, `totalOf`), décrites dans
[elagages.md § Élagage sûr — faisabilité](elagages.md) ; ils n'en sont
fidèles que s'ils reçoivent les mêmes paramètres qu'elle (§ Paramètres
reçus par les diagnostics de l'écran).

## Trois diagnostics, trois questions

| Question | Fonction | Ce qu'elle affirme | Coût |
| --- | --- | --- | --- |
| Une condition, à elle seule, est-elle hors de portée ? | `diagnoseFeasibility` | une preuve, dans le seul sens « impossible » | une passe sur le pool |
| De combien desserrer une condition pour que le pré-filtrage sûr laisse passer plus de runes ? | `rankBlockingConditions` | un indice | une dichotomie par condition posée, chaque pas relance le pré-filtrage sûr |
| Quelle combinaison réellement examinée échoue de peu, et sur quoi ? | quasi-succès de `pairBuckets` | un constat sur ce que la recherche a examiné | aucune fiche calculée en plus |

Les deux premiers ne regardent que le pool de runes, avant toute recherche ;
le troisième vient de la recherche elle-même. La disposition à l'écran est
dans [../ecran/resultats.md § Diagnostic sur 0 résultat](../ecran/resultats.md) ;
le harnais : [../harnais.md § Faisabilité et blocages](../harnais.md).
Un libellé ne confond jamais preuve et indice.

## Preuve d'impossibilité par stat isolée

`diagnoseFeasibility(params)` rend un `StatFeasibility` par condition posée
(minimums, puis maximums) : `key`, `kind`, `requested`, `bound`,
`satisfiable`. Sans condition posée, un tableau vide.

- **Minimum** : `bound` est le meilleur total atteignable pour cette stat
  seule. Pour chaque emplacement, le meilleur pourcentage et la meilleure
  valeur fixe parmi les runes qui restent après statistique principale
  imposée et runes imposées (`mainStatFilteredBySlot`,
  `computeSlotMaxBounds`), pris séparément, donc possiblement sur deux runes
  différentes ; plus `guaranteedMin`, le meilleur apport d'artéfacts
  (`artFlatMax`) et le pourcentage de relique côté minimum (`relPctMax`),
  totalisés par `totalOf`. `satisfiable` vaut `bound >= requested`.
- **Maximum** : `bound` est le plancher incompressible, aucune rune
  n'apportant rien à la stat : base, bonus des sets demandés (`guaranteed`),
  apport d'artéfacts incompressible (`artFlatMin`) et relique côté maximum
  (`relPctMin`). `satisfiable` vaut `bound <= requested`.
- **Dissymétrie voulue** : chaque borne est plus large que tout build réel,
  donc `satisfiable: false` prouve qu'aucune combinaison de six runes ne
  tient la condition, et aucune recherche n'y changera rien.
  `satisfiable: true` ne prouve rien : chaque stat est jugée seule, et les
  conditions prises ensemble peuvent rester infaisables. C'est la même
  borne que l'élagage de faisabilité (`eliminateInfeasible`), agrégée sur
  les six emplacements au lieu d'être appliquée rune par rune.
- **Sets et joker** : `guaranteedMin` ne crédite des activations de set en
  plus que sur les emplacements libres, six moins les pièces des sets
  demandés (`additionalSetActivationHeadroom`) ; un combo de six pièces,
  4 + 2, n'en laisse aucun. Cela n'exclut pas l'Intangible : le joker
  remplace une pièce manquante d'un set incomplet et n'a besoin d'aucun
  emplacement excédentaire (texte du jeu, recopié au-dessus d'`activeSets`,
  `src/lib/effects.ts`). Pour les sets demandés, ce sont la construction des
  moitiés et l'appariement qui le comptent (`jokerCredit`, `satisfiesSets`),
  voir
  [elagages.md § Faisabilité de set, groupage par compte et jokers](elagages.md).

## Conditions bloquantes du pré-filtrage sûr

`rankBlockingConditions(params)` rend un `BlockingConditionsDiagnosis` :
`baselineMinSlot` et `impacts`, un `BlockingConditionImpact` par condition
posée (`key`, `kind`, `requested`, `threshold`, `delta`,
`poolMinSlotAtThreshold`). Sans condition posée : `baselineMinSlot` 0, aucun
impact.

- **La mesure** (`poolMinSlotSafe`) : la taille du plus petit des six
  emplacements après statistique principale imposée et runes imposées
  (`mainStatFilteredBySlot` : un emplacement verrouillé n'a plus qu'une
  rune, et la mesure vaut alors au plus 1), dominance
  (`pruneDominated`, contexte `contexteDominance`) et faisabilité
  (`eliminateInfeasible`), jamais `filterSlot`, les compartiments ni
  l'appariement. `baselineMinSlot` est cette mesure aux conditions
  actuelles. Le préréglage de pré-filtrage n'y entre pas : en changer ne
  change pas ce chiffre.
- **Un minimum** : retiré (ramené à 0), s'il ne fait pas grandir le plus
  petit pool, la condition est « sans gain » (`threshold`, `delta`,
  `poolMinSlotAtThreshold` à `null`). Sinon, une dichotomie trouve le plus
  petit `delta` entre 1 et le minimum pour lequel le plus petit pool dépasse
  `baselineMinSlot`, toutes les autres conditions inchangées ;
  `threshold` = minimum − `delta`.
- **Un maximum** : son plafond est l'arrondi supérieur du meilleur total
  atteignable (même formule que la borne d'un minimum dans
  `diagnoseFeasibility`) ; au-delà, un maximum n'écarte plus aucune rune.
  Plafond déjà sous le maximum, ou plus petit pool qui ne grandit pas au
  plafond : sans gain. Sinon, dichotomie entre 1 et plafond − maximum ;
  `threshold` = maximum + `delta`.
- **Ordre** : `delta` croissant, la condition la moins coûteuse à desserrer
  d'abord, les conditions sans gain en fin de liste.
- **Monotonie** : la dichotomie suppose que le plus petit pool grandit avec
  le desserrage ; c'est vérifié par un oracle qui balaie chaque valeur
  entière par `poolMinSlotSafe` (§ Vérification des diagnostics), jamais
  supposé dans le code.
- **Un indice, pas une preuve** : un plus grand pool sûr ne garantit pas
  qu'un build apparaisse, et l'inverse non plus : `filterSlot`, les
  compartiments et le test conjoint jugent ensuite. « Sans gain » sur toutes
  les conditions à la fois dit que le blocage est en aval du pré-filtrage
  sûr, ou dans la conjonction des conditions : c'est là que regarde le
  quasi-succès.
- **Coût** : de l'ordre de N × log(plage) passes de pré-filtrage sûr, N
  étant le nombre de conditions posées, jamais une recherche. D'où, à
  l'écran, l'interrupteur « Diagnostic approfondi sur 0 résultat »
  (`diagnoseBlockingEnabled`, désactivé par défaut) : le calcul n'a lieu que
  s'il est actif et que la recherche a rendu 0 résultat.

## Quasi-succès à l'appariement

Sous-produit de `pairBuckets` : au moment où une paire examinée échoue au
test conjoint, ses écarts sont comparés aux meilleurs déjà vus au lieu
d'être jetés. Jamais recalculé ailleurs, seulement fusionné et mis en forme.

### Ce que le quasi-succès retient

- **Une tentative** est une paire (combinaison A, combinaison B) jugée avec
  UN apport d'artéfacts du test conjoint : chacun des apports réellement
  atteignables (`artPossibles`), à défaut celui de la paire figée
  (`artFlatFige`). Une tentative en échec liste TOUTES ses conditions en
  échec, jamais seulement la première : un `StatShortfall` par condition
  (`key`, `kind`, `requested`, `actual`, `shortfall`, toujours positif).
- **Par condition** (`nearMissByCondition`) : seule compte une tentative qui
  échoue sur cette seule condition ; pour chaque couple `key`/`kind`, celle
  au plus petit `shortfall`, la première vue en cas d'égalité. Ne pas
  retenir « la plus proche sur cette condition, quoi qu'il arrive aux
  autres » : desserrer cette condition seule ne rendrait pas ce build
  valide. Une condition qui n'a jamais été seule en échec n'a pas d'entrée,
  jamais une entrée `null`.
- **Global** (`globalNearMiss`) : toute tentative en échec, quel que soit le
  nombre de conditions ratées ; sa distance est le plus grand écart relatif,
  `shortfall / requested` (minimum : (demandé − atteint) / demandé ;
  maximum : (atteint − demandé) / demandé). La plus petite distance gagne,
  la première vue en cas d'égalité. Un écart relatif rend comparables des
  stats d'échelles différentes (PV en milliers, Précision en dizaines), et
  le maximum juge un build sur sa pire condition manquée ; une somme
  mélangerait les unités.
- **`actual`** est la valeur que juge le test conjoint : fiche, décalage de
  l'apport essayé, terme relique en mode `recherche` (`relTermMax`,
  `relTermMin`), auras comptées par `totalCondition` avec les auras propres
  exactes des six runes.
- **`NearMiss`** : `runeIds`, `stats`, `effTotal`, `shortfalls`. `stats` est
  la fiche `computeStats` calculée avec la paire figée, et sans relique en
  mode `recherche` : les écarts viennent de l'apport essayé, la fiche non.
  `effTotal` est la somme sur six runes de la mesure Efficience ou Score
  active pendant la recherche.
- **Toujours calculé** : avec ou sans candidats. Une paire peut alimenter le
  quasi-succès avec un apport puis être retenue avec un autre. Seuls les
  rendus le taisent quand des candidats existent.

### D'où viennent les tentatives, et ce qui reste invisible

- Seule atteint le test conjoint une paire qui a franchi toutes les coupes
  en amont : sets d'après les comptes agrégés (`satisfiesSets`), au plus un
  joker, borne des minimums par compartiments (`bucketPairFeasibleMin`),
  `comboAFeasible`, le test rapide `quickOk`, la revérification des sets sur
  les six runes (`activeSets`, `missingSets`), puis `computeStats`. Détail :
  [pipeline.md § Appariement séquentiel](pipeline.md).
- **Aucune fiche en plus** : le quasi-succès ne compare que des totaux déjà
  calculés, pour les seules paires qui atteignent le test conjoint.
- **Ne voit que ce que la recherche examine réellement** : une paire coupée
  en amont, y compris par la rétention heuristique (`filterSlot`, plafond
  des compartiments), ou jamais atteinte avant l'arrêt (temps, plafond de
  candidats, arrêt manuel) reste invisible, même plus proche que celle
  rapportée. L'écran le dit sous l'encadré.
- **Il faut un écart entre `quickOk` et le test conjoint.** `quickOk` juge
  avec les bornes optimistes (`guaranteedMin`, `artFlatMax`, `relPctMax`) ;
  quand elles coïncident avec ce qu'une paire précise obtient (un seul set
  sans bonus de stat, aucun artéfact), tout ce qui échoue au test conjoint
  échoue déjà à `quickOk`, avant `computeStats` : quasi-succès vide. Il
  n'apparaît que par une activation de set possible mais non garantie, ou
  plusieurs apports d'artéfacts dont aucun ne couvre toutes les conditions
  (`artifactBounds.possibles`), ce qu'un compte réel a presque toujours
  (commentaire d'en-tête de `tests/rune-optim-near-miss.test.ts`).

### Types et transport du quasi-succès

- `nearMissByCondition` et `globalNearMiss` sont des champs OBLIGATOIRES de
  `SearchResult` : `tsc` fait échouer tout site qui construit un
  `SearchResult` sans eux, plutôt qu'un quasi-succès vide passe inaperçu. À
  l'inverse, `motifTroncature` et `traceur` sont optionnels à dessein.
- `PairingProgress` porte un instantané du quasi-succès (`nearMissSnapshot`)
  à chaque point de passage (`CHECKPOINT_EVERY`) : à l'arrêt manuel,
  `drivePairing` rend le quasi-succès accumulé avec les candidats, sous
  `truncated: true`.
- Trois sites reconstruisent un résultat champ par champ et recopient les
  deux champs : `drivePairing` (`src/workers/pairingDriver.ts`),
  `pairSliceInWorker` (`src/workers/runeBuildOptim.worker.ts`) et son jumeau
  Node, `makeSpawnSliceNode` (`scripts/lib/spawnSliceNode.ts`). Le message
  d'une tranche (`PairSliceResultMessage`, `src/workers/pairSliceBody.ts`)
  les porte. Un résultat vide (préparation impossible, erreur) les met à
  `[]` et `null`.
- **Fusion parallèle** (`combineParallelPairingResults`) : par condition, le
  plus petit `shortfall` entre tranches ; global, la plus petite distance
  relative, même formule que `pairBuckets`. En cas d'égalité, la tranche la
  plus tôt dans la liste. Une tranche sans quasi-succès n'efface rien. Le
  reste de l'appariement parallèle :
  [pipeline.md § Appariement parallèle](pipeline.md).

### Rendu du quasi-succès — écran, harnais, CLI

- **Écran** : l'encadré « Quoi ajuster pour trouver des builds », seulement
  si `result.candidates.length === 0` et qu'il existe au moins un
  quasi-succès ; sans réglage, puisqu'il ne coûte rien, à la différence du
  diagnostic approfondi. Le build le plus proche toutes conditions
  confondues, puis une ligne par condition.
- **Vocabulaire** : « suffirait », comme le « suffit » du diagnostic
  approfondi, jamais « manque » : « VIT −5 suffirait (≥ 105) ». Le nouveau
  seuil vaut le demandé moins l'écart (minimum) ou plus l'écart (maximum).
- **Score à l'écran** : la moyenne par rune de la mesure active,
  `candidateMetricTotal(miss, …) / 6` mise en forme par `formatRuneMetric`,
  libellée « Efficience moyenne » ou « Score moyen » comme sur les cartes
  (`BuildCandidateCard.tsx`) ; avec « PV effectifs » en plus (`pvEffectifs`
  sur `miss.stats`) quand c'est l'objectif. Ne pas afficher
  `candidateMetricTotal` brut à l'écran : une somme sur six runes, sans
  rapport avec l'échelle que le joueur lit sur les cartes.
- **Harnais** : `quasiSucces` (`parCondition`, `global`) quand il n'a aucun
  build à classer ; rendu texte « suffirait » par
  `scripts/diagnostic-harness.ts`.
- **CLI** (`scripts/optimizer-search.ts`) : sur 0 candidat, les mêmes lignes
  « suffirait » ; sans quasi-succès global, la ligne « aucune paire explorée
  n'a jamais atteint le test conjoint exact ».
- Harnais et CLI donnent `candidateMetricTotal` brut, la somme sur six
  runes, pas la moyenne de l'écran.

## Paramètres reçus par les diagnostics de l'écran

L'écran (`src/components/outils/OptimizerSection.tsx`) appelle
`diagnoseFeasibility` et `rankBlockingConditions` avec la base, les
artéfacts de la recherche, `artifactBounds`, la relique de la fiche, le
pool, les conditions avec auras et la mesure. Il ne leur passe ni
`relicContext`, ni `objective`/`objectiveStats`, ni
`statsLignesArtefactsEquipables`, que `handleSearch` passe à la recherche.
Ce qui en découle, lu dans le code :

- en mode `recherche` de la relique, leurs bornes relique (`relPctMax`,
  `relPctMin`) sont le pourcentage de la relique portée, pas les bornes du
  contexte relique avec lesquelles la recherche a élagué ;
- la dominance de `rankBlockingConditions` juge comme sans objectif
  (`contexteDominance` : toutes les stats), pas avec l'objectif de la
  recherche, ni avec les stats des lignes 218–221 des artéfacts
  équipables.

Le harnais leur passe les `SearchParams` complets de la recherche.

## Ce que l'estimation du pool n'affirme pas

- `estimateSearchSpace`, affichée avant de lancer
  ([../ecran/lancer-la-recherche.md § Lancer la recherche](../ecran/lancer-la-recherche.md)),
  est le produit des tailles de pool après statistique principale imposée
  et `filterSlot`, sans dominance ni faisabilité : un ordre de grandeur
  ([elagages.md § Pré-filtrage heuristique et compartiments](elagages.md)).
  Elle ne dit rien de la faisabilité : un grand produit n'annonce aucun
  build.
- Elle ne se compare pas à `baselineMinSlot` : l'une mesure après
  pré-filtrage heuristique sans élagage sûr, l'autre après élagages sûrs
  sans pré-filtrage heuristique. Ni au nombre de paires examinées
  (`totalPairCount`, que suit la barre de progression :
  [../interruption.md § Barre de progression](../interruption.md)).
- `estimatePairBound` est un majorant du nombre de paires, calculable avant
  les compartiments. Il n'est pas affiché : trop au-dessus de la réalité
  pour informer (commentaire du code). Seuls des scripts de mesure et le
  test différentiel l'appellent, ce dernier pour vérifier qu'il majore
  `totalPairCount`.

## Vérification des diagnostics

- `diagnoseFeasibility` : `tests/rune-optim.test.ts`, section « diagnostic
  de faisabilité ».
- `rankBlockingConditions` : `tests/rune-optim.test.ts`, section « palier 2
  — DE COMBIEN desserrer », dont l'oracle qui balaie chaque valeur entière
  d'un minimum et d'un maximum par `poolMinSlotSafe`, la fonction que la
  dichotomie appelle.
- Quasi-succès : `tests/rune-optim-near-miss.test.ts`, un scénario dont
  chaque valeur attendue est dérivée à la main (entrées par condition,
  global, coexistence avec un candidat retenu, aucune condition posée,
  condition triviale), et la survie du quasi-succès à un arrêt manuel par
  `drivePairing` ; `tests/rune-optim-parallel-truncated.test.ts`, la fusion
  entre tranches, y compris une tranche sans quasi-succès. Aucun oracle par
  balayage exhaustif des paires.
- **Écueil d'un test du quasi-succès** : un pool synthétique minimal (un seul
  set sans bonus de stat, aucun artéfact) n'exerce jamais son code, puisque
  `quickOk` y rejette déjà tout ce que rejetterait le test conjoint
  (§ D'où viennent les tentatives, et ce qui reste invisible). Construire
  l'écart, par exemple par `artifactBounds`.
