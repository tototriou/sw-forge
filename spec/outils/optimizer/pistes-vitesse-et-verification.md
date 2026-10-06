# Optimizer — pistes de vitesse et de vérification

**Statut :** ÉTAT ACTUEL — liste les pistes futures qui accéléreraient la recherche des runes sans changer ce qu'elle cherche, et celles des instruments qui la mesurent ou la vérifient, chacune avec son constat, l'idée et ce qui la bloque
**Lire si :** on veut accélérer la recherche, ou on touche la batterie de mesure, le harnais de diagnostic, un script de diagnostic ou un test du moteur
**Ne pas lire si :** on cherche une piste de l'algorithme, des artéfacts, des dégâts ou de l'écran : pistes.md
**Voir aussi :** pistes.md, verification.md, harnais.md, limites-connues.md

Même forme et même règle que [pistes.md](pistes.md) : une entrée donne le
**constat** (ce que le code fait, avec sa coordonnée), l'**idée** et ce qui
la **bloque** ; une variante écartée tient en une ligne « ne pas… parce
que… » dans la spec de son mécanisme. Ajouter une piste :
[pistes.md § Ajouter une piste](pistes.md).

## Vitesse de la recherche

Sur les cas mesurés, l'appariement prenait presque tout le temps de la
recherche, et une paire y coûtait bien moins qu'un calcul de stats complet :
les replis rapides de `pairBuckets` écartent presque toutes les paires avant
`computeStats`. Le gain le plus large viendrait donc d'explorer moins de
paires, pas de les parcourir plus vite :
[pistes.md § Optimalité prouvée : Branch & Bound sur les paires, statuts du résultat](pistes.md),
[pistes.md § Ordre des emplacements dans une moitié](pistes.md). Ces pistes
touchent la justesse : aucune sans la référence exhaustive qu'exige le skill
`algo-verify` ([verification.md § Référence exhaustive : le test différentiel](verification.md)).
Au préréglage le plus large, c'est la construction des compartiments qui
domine ([verification.md § Benchmarks](verification.md)). Les entrées
ci-dessous retirent un coût sans rien changer à ce qui est exploré, sauf la
dernière.

### Le temps relu à chaque paire

- **Constat** : dans la boucle la plus interne de `pairBuckets`
  (`src/lib/runeBuildOptim.ts`), `overBudget()` lit l'horloge
  (`Date.now()`) à chaque paire explorée, alors que le point de passage
  (`CHECKPOINT_EVERY`, 500 paires) ne revient qu'une fois sur 500.
- **Idée** : ne lire l'horloge qu'aux points de passage ; le filet de temps
  serait dépassé d'au plus 500 paires.
- **Bloque** : jamais mesuré. Le coût d'un appel d'horloge face à celui
  d'une paire est une estimation, et le moteur JavaScript peut le réduire
  de lui-même : le mesurer d'abord (skill `optimizer-perf-testing`). Le
  harnais déduit le motif d'arrêt de l'ordre des tests dans la boucle
  ([harnais.md § Complétude : jamais un « 0 candidat » nu](harnais.md)) :
  à revérifier avec le nouvel ordre.

### Écarter les runes hors combo avant la dominance

- **Constat** : quand le combo demandé coûte les six emplacements,
  `filterSlot` écarte toute rune qui n'est ni d'un set demandé ni une
  Intangible (`hasFreeSlots`, `src/lib/runeBuildOptim.ts`) : un élagage
  sûr, mais au dernier étage de `prepareSearch`, après
  `mainStatFilteredBySlot`, `pruneDominated` et `eliminateInfeasible`.
  `pruneDominated` compare chaque paire de runes d'un emplacement, et y
  renonce au-delà de `DOMINANCE_MAX_POOL` (2 000 runes).
- **Idée** : appliquer cette coupe en tête. La dominance coûterait moins,
  et un emplacement repassé sous le seuil la retrouverait : un pool mieux
  élagué pour toute la suite, pas seulement plus vite.
- **Bloque** : jamais mesuré, et sans effet dès qu'un emplacement reste
  libre. `contexteDominance` et `eliminateInfeasible` se calculent sur le
  pool de l'étage, que la coupe réduirait : vérifier contre un oracle que
  rien n'en devient faux (skill `algo-verify`).

### Rendre la main moins souvent pendant l'appariement

- **Constat** : au navigateur, `drivePairing` rend la main toutes les
  50 ms (`YIELD_THROTTLE_MS`, `src/workers/pairingDriver.ts`) par un
  `setTimeout(0)`, que les navigateurs retardent de quelques millisecondes
  quand il s'enchaîne ([harnais.md § Note de plateforme : Node et navigateur](harnais.md)).
  Le commentaire de la constante justifie le principe, ne pas rendre la
  main à chaque point de passage, pas la valeur 50.
- **Idée** : porter le délai à 200 ms : le surcoût de planification serait
  divisé par quatre, et « Arrêter » répondrait en 200 ms au plus.
- **Bloque** : jamais mesuré au navigateur, ni le gain ni la latence
  ressentie du bouton.

### Seuil de l'appariement parallèle en recherche normale

- **Constat** : `PARALLEL_PAIRING_THRESHOLD` est placé entre une zone où le
  parallèle perd et une zone où il gagne, sans mesure entre les deux, et
  calibré en recherche exhaustive seulement
  ([moteur/parallelisation.md § Choix du régime](moteur/parallelisation.md)).
- **Idée** : mesurer la zone intermédiaire, et une recherche que le filet
  de temps ou le plafond de candidats arrêtent avant la fin.
- **Bloque** : une campagne de mesure (`scripts/pairing-parallel-diag.ts`,
  skill `optimizer-perf-testing`), jamais faite.

### Ce que garde une recherche arrêtée par le plafond de candidats

- **Constat** : `MAX_COLLECTED` atteint, la recherche s'arrête, et les
  candidats gardés sont les premiers collectés dans l'ordre d'exploration
  (compartiments par potentiel, `combosOrderMode`), pas forcément les meilleurs
  ([limites-connues.md § Recherche des runes — le meilleur trouvé, pas l'optimum prouvé](limites-connues.md)).
  Le joueur ne lit que le haut de ce classement.
- **Idée** : un ordre de collecte qui fasse arriver les meilleurs d'abord :
  une piste de pertinence, pas de vitesse.
- **Bloque** : jamais explorée. Se juge sur la qualité sous saturation,
  jamais sur les comptes ([moteur/artefacts.md § Mesurer un changement des bornes](moteur/artefacts.md)).

## Mesurer la recherche

### Une batterie au plus près de l'usage réel

- **Constat** : les cas de `scripts/perf-battery.ts`
  (`CASES`, `scripts/lib/perfShared.ts`) se cherchent en `efficience` avec
  `objectiveStats`, un seul en `ehp`, toujours à `slotFilterCap` 80 : le
  type `Case` ne porte aucun contexte de dégâts. Ces builds précis se
  cherchent pourtant en « Dégâts réels » : leurs temps ne disent rien de la
  vitesse ressentie, et aucun cas ne mesure le régime « Dégâts réels »,
  bornes d'artéfact comprises. Au préréglage « Bas », un build cible peut
  être écarté avant l'appariement : une question de justesse, que
  `--monotonicity` suit, préréglage par préréglage.
- **Idée** : au moins un cas en « Dégâts réels », avec son sort et sa
  cible, et le temps de découverte au préréglage « Bas ».
- **Bloque** : `Case` à étendre d'un contexte de dégâts ; la référence
  `scripts/perf-baseline.json` serait à figer de nouveau, ses repères
  devenant incomparables.

### Ce que coûte la construction des demi-builds

- **Constat** : le harnais rapporte, par moitié, les demi-builds retenus au
  produit brut des pools, la mémoire de fin de fil et une progression par
  rune extérieure ([harnais-extensions.md § La construction observée](harnais-extensions.md)) ;
  il ne compte pas les combinaisons réellement énumérées, et le dernier
  intervalle mêle la dernière rune extérieure et l'épilogue
  ([limites-connues.md § Harnais de diagnostic](limites-connues.md)). La
  moitié A retient moins de demi-builds par milliseconde que la moitié B
  sur la plupart des cas mesurés, sans cause établie : énumération plus
  lente, énumération plus longue pour retenir autant (plafond `bucketCap`),
  ou ramasse-miettes ; la liste n'est pas close.
- **Idée** : deux instruments expérimentaux, jamais permanents : un
  compteur exact d'énumération dans la boucle interne de `buildBuckets`, et
  un chronomètre dans son épilogue, pour vérifier que le poids du dernier
  intervalle vient du tri des combinaisons retenues.
- **Bloque** : tous deux sont du niveau C
  ([harnais-extensions.md § Étendre le harnais : quatre niveaux de coût](harnais-extensions.md)) :
  l'instrument change le temps qu'il mesure. Le compteur ne s'ouvre que
  sur une question falsifiable — une moitié A à fort produit brut au débit
  pourtant équilibré énumère-t-elle tout son produit, ou coupe-t-elle
  tôt ? —, et aucune piste sur le tri ne se tire avant le chronomètre.
  Suite de [pistes.md § Partition des moitiés selon leur coût](pistes.md).

## Vérifier le moteur

### Tests et scripts qui ne passent pas par la production

- **Constat** : plusieurs contrôles exercent une copie, qu'aucun `tsc` ne
  tient à jour.
  - `testRuneOptimParallelPairing` tronque sur de vrais fils, mais ses fils
    sont la copie `scripts/lib/pairing-quota-worker.ts`, pas `runPairSlice`
    ([moteur/parallelisation.md § Vérifier un changement](moteur/parallelisation.md)).
  - La construction parallèle a deux coquilles autour de `buildBuckets`,
    chacune avec son relais de progression : `src/workers/buildHalf.worker.ts`
    et `scripts/lib/build-half-worker.ts`.
  - `tests/rune-optim-onstage.test.ts` garde sa propre copie du générateur
    de pool, identique à `scripts/lib/randomPool.ts`.
  - `scripts/retention-dispersion-diag.ts` recopie `retentionScore`
    (`retentionScoreLocal`), et sa liste locale de cas a dérivé de
    `CASES` (`'degats_reels'` contre `'efficience'` et `objectiveStats`).
  - `scripts/monster-search-rank-diag.ts` prend l'apport d'artéfact de la
    paire portée, pas les bornes de la production : il mesure un moteur
    plus contraint.
- **Idée** : faire passer le test tronqué par `driveParallelPairing` avec
  `makeSpawnSliceNode`, et décider si son mode à plafond partagé reste une
  reproduction séparée ; un corps neutre et deux coquilles pour la
  construction, comme pour l'appariement
  ([moteur/parallelisation.md § Coquilles et lanceurs](moteur/parallelisation.md)) ;
  migrer le générateur du test, sans changer son tirage ; exporter
  `retentionScore` et reprendre `CASES` ; brancher le script de rang sur
  `artifactBounds` avant de lui faire produire une mesure.
- **Bloque** : des changements de code, jamais faits. D'ici là, un
  changement de `runPairSlice` n'est couvert sous troncature réelle par
  aucun test.

### Oracle exhaustif du quasi-succès

- **Constat** : le quasi-succès n'est vérifié que sur un scénario dont
  chaque valeur est dérivée à la main
  ([moteur/diagnostics.md § Vérification des diagnostics](moteur/diagnostics.md)).
- **Idée** : balayer toutes les paires d'un petit pool, sans borne
  optimiste, et comparer au quasi-succès que `pairBuckets` retient.
- **Bloque** : jamais construit ; le pool doit exercer le test conjoint,
  que les replis rapides court-circuitent sur un pool trop simple.

### Harnais : défauts connus

- **Constat** : décrits dans
  [limites-connues.md § Harnais de diagnostic](limites-connues.md) et
  [moteur/diagnostics.md § Rendu du quasi-succès — écran, harnais, CLI](moteur/diagnostics.md).
  - `--cas` ignore `--profil` sans le dire
    (`scripts/diagnostic-harness.ts`).
  - Le palier 1 annonce `combosOrderMode` « relevance (défaut) »
    (`scripts/lib/diagnosticConfig.ts`), quand `buildBuckets` prend
    `'objective'`.
  - Aucun profil de `scripts/lib/diagnosticProfils.ts` ne porte
    d'objectif : le différentiel ne compare aucun ordre d'énumération.
  - Trois scripts conservés ne reproduisent plus leur référence
    ([harnais-scripts.md § Les scripts voisins](harnais-scripts.md)).
  - Le harnais et le CLI rendent le score brut du quasi-succès
    (`candidateMetricTotal`), l'écran la moyenne par rune.
- **Idée** : refuser `--cas` avec `--profil` ; corriger le libellé ; un
  profil qui porte un objectif ; recalibrer ou retirer les trois scripts
  ([harnais-scripts.md § Garder ou retirer un script de diagnostic](harnais-scripts.md)) ;
  le score à l'échelle de l'écran.
- **Bloque** : des changements de code, jamais faits.
