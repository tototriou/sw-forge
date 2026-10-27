# Optimizer — pistes de vitesse et de vérification

Voir aussi : pistes-optimizer.md, [../03-developpeur/optimizer/](../03-developpeur/optimizer/) (vérification, harnais), [../02-app/optimizer/](../02-app/optimizer/) (limites connues).

Même forme et même règle que [pistes-optimizer.md](pistes-optimizer.md) : une entrée donne le
**constat** (ce que le code fait, avec sa coordonnée), l'**idée** et ce qui
la **bloque** ; une variante écartée tient en une ligne « ne pas… parce
que… » dans la spec de son mécanisme. Ajouter une piste :
[pistes-optimizer.md § Ajouter une piste](pistes-optimizer.md).

## Vitesse de la recherche

Sur les cas mesurés, l'appariement prenait presque tout le temps de la
recherche, et une paire y coûtait bien moins qu'un calcul de stats complet :
les replis rapides de `pairBuckets` écartent presque toutes les paires avant
`computeStats`. Le gain le plus large viendrait donc d'explorer moins de
paires, pas de les parcourir plus vite. Au préréglage le plus large, c'est
la construction des compartiments qui domine
([03-developpeur/optimizer/verification/mesures.md § Benchmarks](../03-developpeur/optimizer/verification/mesures.md#benchmarks)).

Les entrées ci-dessous accélèrent la recherche sans changer ce qu'elle
cherche. Celles qui changent le pool, les garanties ou le résultat, même
pour aller plus vite, sont dans
[pistes-optimizer.md § Moteur de recherche des runes](pistes-optimizer.md) — explorer moins de
paires (§ Optimalité prouvée : Branch & Bound sur les paires, statuts du
résultat), couper plus tôt, autre partition des moitiés, GPU — et touchent
la justesse : aucune sans la référence exhaustive qu'exige le skill
`algo-verify` ([03-developpeur/optimizer/verification/runes.md § Référence exhaustive : le test différentiel](../03-developpeur/optimizer/verification/runes.md#référence-exhaustive--le-test-différentiel)).

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
  ([03-developpeur/optimizer/harnais/README.md](../03-developpeur/optimizer/harnais/README.md)) :
  à revérifier avec le nouvel ordre.

### Rendre la main moins souvent pendant l'appariement

- **Constat** : au navigateur, `drivePairing` rend la main toutes les
  50 ms (`YIELD_THROTTLE_MS`, `src/workers/pairingDriver.ts`) par un
  `setTimeout(0)`, que les navigateurs retardent de quelques millisecondes
  quand il s'enchaîne ([03-developpeur/optimizer/harnais/README.md § Note de plateforme : Node et navigateur](../03-developpeur/optimizer/harnais/README.md)).
  Le commentaire de la constante justifie le principe, ne pas rendre la
  main à chaque point de passage, pas la valeur 50.
- **Idée** : porter le délai à 200 ms : le surcoût de planification serait
  divisé par quatre, et « Arrêter » répondrait en 200 ms au plus.
- **Bloque** : jamais mesuré au navigateur, ni le gain ni la latence
  ressentie du bouton.

### Seuil et nombre de Workers de l'appariement parallèle

- **Constat** : `PARALLEL_PAIRING_THRESHOLD` a été placé, pour
  l'appariement par `pairBuckets`, entre une zone où le parallèle perdait et
  une zone où il gagnait, sans mesure entre les deux ; il n'est pas remesuré
  pour le noyau sur tableaux typés. La règle du nombre de Workers
  (`nombreDeTravailleurs` : cœurs physiques − 2, bornés à [2, 8] ; sans
  cœurs connus, la moitié des fils logiques − 2) est mesurée à 2, 4, 6 et
  8 Workers, mais sur une seule machine (8 cœurs, 16 fils), et ne suit pas
  la taille de l'espace : sous la seconde, 2 Workers battent 8, écart laissé
  sans règle propre aux petits espaces
  ([03-developpeur/optimizer/moteur/parallelisation.md § Choix du régime](../03-developpeur/optimizer/moteur/parallelisation.md#choix-du-régime)).
- **Idée** : mesurer le seuil pour le noyau, et la règle sur une machine
  sans deux fils par cœur ou à moins de 8 fils.
- **Bloque** : une campagne de mesure (`scripts/banc-appariement-rapide.ts`,
  `--workers=`, skill `optimizer-perf-testing`), jamais faite.

### Ordre des emplacements dans une moitié

- **Constat** : `buildBuckets` parcourt les trois emplacements d'une moitié
  dans l'ordre de `slotIdxs`, quel qu'il soit ; la faisabilité de set
  (`stillFeasible`) coupe une branche dès qu'elle ne peut plus atteindre le
  compte de pièces demandé
  ([03-developpeur/optimizer/moteur/elagages.md § Faisabilité de set, groupage par compte et jokers](../03-developpeur/optimizer/moteur/elagages.md#faisabilité-de-set-groupage-par-compte-et-jokers)).
- **Idée** : mettre en position extérieure l'emplacement le plus contraint,
  pour couper les branches mortes avant d'avoir parcouru les deux autres.
  Pur réordonnancement : la justesse ne change pas.
- **Bloque** : jamais construit ni mesuré.

### Recherche à beaucoup de conditions simultanées

- **Constat** : sur un cas réel à sept conditions simultanées, la seule
  construction des moitiés dépasse le filet de temps. Ce cas est absent
  exprès de la batterie de mesure (`scripts/lib/perfShared.ts`, commentaire
  qui précède `CASES`). Rien dans le moteur ne le traite.
- **Idée** : localiser où la construction passe son temps à ce nombre de
  conditions (harnais, arrêt après les demi-builds), puis la borner.
- **Bloque** : non remesuré sur le code actuel, et jamais retouché.

### WebAssembly

- **Constat** : le moteur calcule sur des objets JavaScript, sans tableaux
  typés.
- **Idée** : porter la boucle la plus chaude en WebAssembly.
- **Bloque** : suppose d'abord des tableaux typés à disposition fixe, qui
  n'existent pas ; le chantier le plus lourd et le plus risqué, jamais
  commencé.

### Changement de page des résultats

- **Constat** : passer à la page suivante prend ~80 ms en médiane et
  110 à 130 ms au 95e centile, sur toutes les recettes mesurées, pendant la
  file de résolution comme après. Le classeur compose la page en
  O(log N + 20) ([03-developpeur/optimizer/moteur/optimiseur-artefacts.md](../03-developpeur/optimizer/moteur/optimiseur-artefacts.md)) :
  le temps se passe après lui, dans l'envoi de l'instantané à l'écran
  (`src/hooks/useBuildOptimSearch.ts`) et le rendu des vingt cartes. Le
  budget visé pour un clic sur les résultats est de 100 ms au 95e centile ;
  le dépassement est accepté pour l'instant.
- **Idée** : profiler le geste dans l'app pour situer ces ~100 ms (transfert,
  rendu, effets), puis réduire la part qui domine.
- **Bloque** : aucun profil du geste ; changement de code à décider après.

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
  produit brut des pools, la mémoire de fin de fil et, avec
  `--progression`, une progression par rune extérieure
  ([03-developpeur/optimizer/harnais/extensions.md § La construction observée](../03-developpeur/optimizer/harnais/extensions.md#la-construction-observée)) ;
  il ne compte pas les combinaisons réellement énumérées, et le dernier
  intervalle mêle la dernière rune extérieure et l'épilogue
  ([02-app/optimizer/limites-connues.md § Harnais de diagnostic](../02-app/optimizer/limites-connues.md#harnais-de-diagnostic)). Sur
  la plupart des cas mesurés, la moitié A retenait moins de demi-builds par
  milliseconde que la moitié B, sans cause établie : énumération plus
  lente, énumération plus longue pour retenir autant (plafond `bucketCap`),
  ou ramasse-miettes ; la liste n'est pas close.
- **Idée** : deux instruments expérimentaux, jamais permanents : un
  compteur exact d'énumération dans la boucle interne de `buildBuckets`, et
  un chronomètre dans son épilogue, pour vérifier que le poids du dernier
  intervalle vient du tri des combinaisons retenues.
- **Bloque** : le compteur est du niveau C
  ([03-developpeur/optimizer/harnais/extensions.md § Étendre le harnais : quatre niveaux de coût](../03-developpeur/optimizer/harnais/extensions.md#étendre-le-harnais--quatre-niveaux-de-coût)) :
  il instrumente la boucle la plus chaude et change le temps qu'il mesure.
  Il ne s'ouvre que sur une question falsifiable — une moitié A à fort
  produit brut au débit pourtant équilibré énumère-t-elle tout son
  produit, ou coupe-t-elle tôt ? Le chronomètre, autour des tris de
  l'épilogue, hors de la triple boucle, est un observateur de plus dans
  `src/` (niveau B), jamais construit ; aucune piste sur le tri ne se tire
  avant lui.
  Suite de [pistes-optimizer.md § Partition des moitiés selon leur coût](pistes-optimizer.md).

## Vérifier le moteur

### Tests et scripts qui ne passent pas par la production

- **Constat** : plusieurs contrôles exercent une copie, qu'aucun `tsc` ne
  tient à jour.
  - La construction parallèle a deux coquilles autour de `construireMoitie`,
    chacune avec son relais de progression : `src/workers/buildHalf.worker.ts`
    et `scripts/lib/build-half-worker.ts`.
  - `tests/rune-optim-onstage.test.ts` garde sa propre copie du générateur
    de pool, identique à `scripts/lib/randomPool.ts`.
  - `scripts/monster-search-rank-diag.ts` prend l'apport d'artéfact de la
    paire portée, pas les bornes de la production : il mesure un moteur
    plus contraint.
- **Idée** : un corps neutre et deux coquilles pour la construction, comme
  pour l'appariement
  ([03-developpeur/optimizer/moteur/parallelisation.md § Coquilles et lanceurs](../03-developpeur/optimizer/moteur/parallelisation.md#coquilles-et-lanceurs)) ;
  migrer le générateur du test, sans changer son tirage ; brancher le script de rang sur
  `artifactBounds` avant de lui faire produire une mesure.
- **Bloque** : des changements de code, jamais faits.

### Oracle exhaustif du quasi-succès

- **Constat** : un scénario dérivé à la main
  ([03-developpeur/optimizer/ § Vérification des diagnostics](../03-developpeur/optimizer/))
  et, sur deux scénarios, l'oracle de `tests/rune-optim-auras-coupes.test.ts`
  vérifient les valeurs `actual` du quasi-succès, global et par condition,
  pour la paire retenue. Rien ne vérifie que cette paire est la PLUS
  PROCHE de toutes.
- **Idée** : balayer toutes les paires d'un petit pool, sans borne
  optimiste, et vérifier que le quasi-succès que `pairBuckets` retient
  est bien la plus proche, globalement et par condition.
- **Bloque** : jamais construit ; le pool doit exercer le test conjoint,
  que les replis rapides court-circuitent sur un pool trop simple.

### Harnais : défauts connus

- **Constat** : décrits dans
  [02-app/optimizer/limites-connues.md § Harnais de diagnostic](../02-app/optimizer/limites-connues.md#harnais-de-diagnostic) et
  [03-developpeur/optimizer/moteur/diagnostics.md § Rendu du quasi-succès — écran, harnais, CLI](../03-developpeur/optimizer/moteur/diagnostics.md#rendu-du-quasi-succès--écran-harnais-cli).
  - `--cas` ignore `--profil` sans le dire
    (`scripts/diagnostic-harness.ts`).
  - Le palier 1 annonce `combosOrderMode` « relevance (défaut) »
    (`scripts/lib/diagnosticConfig.ts`), quand `buildBuckets` prend
    `'objective'`.
  - Aucun profil de `scripts/lib/diagnosticProfils.ts` ne porte
    d'objectif : le différentiel ne compare aucun ordre d'énumération.
  - Trois scripts conservés ne reproduisent plus leur référence
    ([03-developpeur/optimizer/harnais/scripts.md § Les scripts voisins](../03-developpeur/optimizer/harnais/scripts.md#les-scripts-voisins)).
  - Le harnais et le CLI rendent le score brut du quasi-succès
    (`candidateMetricTotal`), l'écran la moyenne par rune.
- **Idée** : refuser `--cas` avec `--profil` ; corriger le libellé ; un
  profil qui porte un objectif ; recalibrer ou retirer les trois scripts
  ([03-developpeur/optimizer/harnais/scripts.md § Garder ou retirer un script de diagnostic](../03-developpeur/optimizer/harnais/scripts.md#garder-ou-retirer-un-script-de-diagnostic)) ;
  le score à l'échelle de l'écran.
- **Bloque** : des changements de code, jamais faits.
