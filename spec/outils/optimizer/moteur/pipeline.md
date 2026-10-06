# Pipeline de la recherche de runes

**Statut :** ÉTAT ACTUEL — décrit le chemin d'une recherche de runes dans le code, de la recherche lancée par l'écran à la fin de l'appariement : préparation, construction des moitiés, appariement
**Lire si :** on modifie une étape de la recherche de runes ou ses Workers, et on cherche le fichier et la fonction qui la portent
**Voir aussi :** elagages.md, ../interruption.md, ../invariants.md

Ce fichier suit une recherche dans l'ordre où le code l'exécute, une section
par étape : ce qu'elle fait, le fichier et la fonction qui la portent, et le
fichier qui la détaille. Il s'arrête quand l'appariement rend son résultat à
l'écran. Les contraintes à ne pas casser sont dans
[../invariants.md § Algorithme](../invariants.md) et
[../invariants.md § Workers](../invariants.md).

| Étape | Fichier | Fonction | Détail |
| --- | --- | --- | --- |
| Lancement | `src/hooks/useBuildOptimSearch.ts` | `useBuildOptimSearch` (`run`, `stop`, `cancel`) | [interruption.md](../interruption.md) |
| Préparation | `src/workers/prepareForSearch.ts`, `src/lib/runeBuildOptim.ts` | `prepareOrRefuse`, `prepareSearch` | [elagages.md](elagages.md) |
| Construction des moitiés | `src/workers/runeBuildOptim.worker.ts`, `src/workers/buildHalf.worker.ts`, `src/lib/runeBuildOptim.ts` | `buildHalfInWorker`, `buildBuckets` | [elagages.md](elagages.md) |
| Choix du régime | `src/workers/runeBuildOptim.worker.ts`, `src/lib/runeBuildOptim.ts` | `totalPairCount` | [parallelisation.md](parallelisation.md) |
| Appariement séquentiel | `src/workers/pairingDriver.ts`, `src/lib/runeBuildOptim.ts` | `drivePairing`, `pairBuckets` | [elagages.md](elagages.md), [interruption.md](../interruption.md) |
| Appariement parallèle | `src/workers/parallelPairing.ts`, `src/workers/pairSliceBody.ts`, `src/workers/pairSlice.worker.ts` | `driveParallelPairing`, `runPairSlice`, `combineParallelPairingResults` | [parallelisation.md](parallelisation.md) |
| Fin de l'appariement | `src/workers/runeBuildOptim.worker.ts`, `src/hooks/useBuildOptimSearch.ts` | `useBuildOptimSearch` | — |

## Lancement

`handleSearch` (`src/components/outils/OptimizerSection.tsx`) construit les
`SearchParams` et appelle `run`, que fournit `useBuildOptimSearch`
(`src/hooks/useBuildOptimSearch.ts`) ; le hook est instancié une seule fois,
par `useOptimizerState`. `run` termine d'abord la recherche en cours
(`cancel`, qui appelle `terminate()` sur le Worker), remet à zéro statut,
résultat, progression et refus, retient le contexte relique de la recherche
lancée (`relicContext`), puis crée un Worker neuf sur
`src/workers/runeBuildOptim.worker.ts` et lui poste les `SearchParams`.

Chaque `run` incrémente un numéro de recherche (`runIdRef`) : un message
d'un Worker déjà remplacé est ignoré, même s'il arrive après le lancement
suivant. Le Worker répond par quatre sortes de messages (`WorkerResponse`) :
progression, résultat, refus, erreur. Le statut (`BuildOptimStatus`) passe à
`running`, puis à `done`, `refused` ou `error` ; `reset` revient à `idle`
sans relancer. `stop` poste `{ stop: true }` au Worker : l'arrêt coopératif,
décrit dans
[../interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](../interruption.md).

## Préparation

Le Worker (`self.onmessage` de `runeBuildOptim.worker.ts`) note l'instant de
départ (`startedAt`), puis appelle `prepareOrRefuse`
(`src/workers/prepareForSearch.ts`). Celui-ci enveloppe `prepareSearch`
(`src/lib/runeBuildOptim.ts`) et rend l'une de quatre issues nommées
(`PrepareOutcome`) :

- `refus` — `prepareSearch` a levé `RechercheRefusee` : pool de reliques
  vide en mode `recherche`, testé avant toute construction. Le Worker poste
  un message `refus`, le hook passe en `refused`.
- `error` — toute autre exception : message `error`, statut `error`.
  L'enveloppe existe parce qu'un rejet non intercepté dans le gestionnaire
  `async` du Worker ne produit ni réponse ni `onerror` côté parent : l'écran
  resterait en `running`.
- `empty` — `prepareSearch` a rendu `null`, un emplacement étant vide après
  le pré-filtrage : résultat vide, non tronqué.
- `prepared` — la `PreparedSearch`, que partagent les deux moitiés et
  l'appariement.

`prepareSearch` fixe les plafonds (`maxCollected`, défaut `MAX_COLLECTED` ;
`maxMs`, défaut `DEFAULT_MAX_MS` ; taille du pré-filtrage `slotFilterCap`,
défaut `MAX_PER_SLOT_MATCH`), pose son propre `startedAt`, dérive les bornes
des conditions minimum et maximum (`deriveMinMaxContext`) et les stats
protégées à la rétention (`retentionKeys` : minimums demandés et stats de
l'objectif ; `objectiveKeys` : l'objectif seul). Suivent quatre étages, dans
l'ordre de `PrepareStage` :

1. `mainstat` — `mainStatFilteredBySlot` : le pool par emplacement, la
   statistique principale imposée appliquée.
2. `dominance` — `contexteDominance`, puis `pruneDominated` emplacement par
   emplacement.
3. `feasibility` — `eliminateInfeasible`.
4. `filterslot` — `filterSlot`, le pré-filtrage heuristique.

L'observateur facultatif `onStage` reçoit l'état après chaque étage ; omis,
il ne change rien. Enfin, `prepareSearch` calcule ce que moitiés et
appariement partagent : pièces exigées par set demandé (`requiredPieces`),
crédit de joker Intangible (`jokerCredit`, par `anyJokerAvailable`), nombre
maximal de pièces de chaque set que l'AUTRE moitié peut apporter
(`maxSetCountsForSlots` : `maxSetsForA` sur les indices 3 à 5, `maxSetsForB`
sur 0 à 2) et capacité des compartiments (`bucketCap`, `bucketCapFor` de la
taille du pré-filtrage sauf valeur passée). Les élagages et le pré-filtrage
eux-mêmes : [elagages.md § Élagages sûrs](elagages.md) et
[elagages.md § Pré-filtrage heuristique et compartiments](elagages.md).

## Construction des moitiés

Le Worker construit les deux moitiés en parallèle, chacune dans un Worker
enfant (`buildHalfInWorker`, sur `src/workers/buildHalf.worker.ts`) : la
moitié A sur les indices d'emplacement 0 à 2 avec `maxSetsForA`, la moitié B
sur 3 à 5 avec `maxSetsForB`. La requête (`BuildHalfRequest`) porte le pool
pré-filtré et les champs de `PreparedSearch` utiles à la construction, plus
`adaptiveTrancheWeighting` et `combosOrderMode` repris des `SearchParams`.
Les deux moitiés sont indépendantes : chacune ne lit que des bornes
calculées par la préparation, jamais l'autre moitié construite.

Le Worker enfant pilote le générateur `buildBuckets` jusqu'au bout, poste sa
progression (runes du premier emplacement de la moitié déjà parcourues, sur
leur total) au plus une fois par palier de temps, puis un dernier point de
passage garanti, puis ses compartiments (`Bucket[]`). Le Worker parent les
relaie sans palier supplémentaire (`phase: 'building'`), et le hook garde la
progression des deux moitiés séparément (`halves.A`, `halves.B`).

`buildBuckets` énumère les combinaisons des trois emplacements de la moitié
et les range en compartiments, par le compte exact de pièces de chaque set
demandé et le nombre de jokers (`bucketKeyOf`). Il coupe une branche qui
porterait deux jokers ou qui ne peut plus compléter un set demandé
(`stillFeasible`), retient les combinaisons dans plusieurs tas en parallèle
(`heapPush`), bornés à partir de `bucketCap`, et rend les compartiments triés
par potentiel décroissant ; `combosOrderMode` ordonne les combinaisons à
l'intérieur d'un compartiment. Détail :
[elagages.md § Pré-filtrage heuristique et compartiments](elagages.md).

Un arrêt pendant cette phase termine les deux Workers enfants
(`terminate()`) et rejette l'attente (`stopBuildReject`) : la recherche rend
un résultat vide, tronqué, aucune paire n'ayant encore été examinée. Une
erreur d'un Worker enfant suit le même chemin : résultat vide tronqué, pas le
statut `error`.

## Choix du régime

Les deux moitiés construites, le Worker compte une seule fois l'espace exact
à parcourir, `totalPairCount(prepared, bucketsA, bucketsB)` : le nombre de
paires que l'appariement examinera s'il va au bout, avec les mêmes tests de
paire de compartiments et de combinaison A que `pairBuckets`
(`satisfiesSets`, jokers, `bucketPairFeasibleMin`, `comboAFeasible`).
⚠️ Les deux boucles se modifient ensemble : leur égalité est vérifiée par
`tests/rune-optim-differential.test.ts`.

Ce total sert de dénominateur à la progression et décide du régime : sous
`PARALLEL_PAIRING_THRESHOLD` (`src/workers/parallelPairing.ts`), appariement
séquentiel dans ce Worker ; à partir du seuil, appariement parallèle. Le
seuil est le seul critère. Détail du régime parallèle :
[parallelisation.md](parallelisation.md).

## Appariement séquentiel

`drivePairing` (`src/workers/pairingDriver.ts`) pilote pas à pas le
générateur `pairBuckets(prepared, bucketsA, bucketsB)`
(`src/lib/runeBuildOptim.ts`). Il poste la progression au plus une fois par
`PROGRESS_THROTTLE_MS`, avec les seuls candidats nouveaux depuis le message
précédent ; il rend la main à la boucle d'événements au plus une fois par
`YIELD_THROTTLE_MS`, ce qui laisse arriver le message d'arrêt ; à l'arrêt
(`isStopped`), il rend un résultat tronqué fait des candidats et du
quasi-succès déjà accumulés. Le Worker ajoute à chaque message `found`,
`totalPairs` et un pourcentage (`estimatePct`) ; le hook accumule les
candidats reçus pour l'aperçu, dans la limite de `PREVIEW_CANDIDATES_CAP`.
Barre et pourcentage : [../interruption.md § Barre de progression](../interruption.md).

`pairBuckets` parcourt toutes les paires de compartiments, par potentiel
combiné décroissant (`orderedCompartmentPairs`). Pour chaque paire de
compartiments : sets satisfaisables d'après les comptes agrégés
(`satisfiesSets`), au plus un joker pour les deux, borne optimiste des
minimums (`bucketPairFeasibleMin`). Pour chaque combinaison A :
`comboAFeasible`. Pour chaque combinaison B, la paire compte comme examinée
(`explored`) ; un point de passage tombe toutes les `CHECKPOINT_EVERY`
paires, puis le filet de temps est testé (`maxMs`, couru depuis
`prepared.startedAt`, construction des moitiés comprise).

Une paire examinée passe ensuite :

1. un test rapide des minimums et maximums sur les pourcentages et valeurs
   fixes cumulés par moitié, plus les apports maximaux (minimums) ou
   incompressibles (maximums) des sets, de la relique et des artéfacts ;
2. la revérification des sets sur les six vraies runes (`activeSets`,
   `missingSets`) ;
3. le calcul de la fiche (`computeStats`), sans la relique en mode
   `recherche`, dont l'apport s'ajoute au test suivant (`relTermMax`,
   `relTermMin`) ;
4. le test conjoint : la paire est retenue si UN apport d'artéfacts
   réellement atteignable (`artPossibles`, ou la paire figée à défaut) lui
   fait tenir toutes les conditions à la fois. Une tentative qui échoue
   alimente le quasi-succès (`nearMissByCondition`, `globalNearMiss`).

La collecte s'arrête au plafond `maxCollected`. Trois arrêts seulement : le
temps, le plafond de candidats, l'épuisement de l'espace ; aucun plafond de
paires. Le résultat (`SearchResult`) porte les candidats dans l'ordre de
leur découverte, `explored`, `truncated`, le quasi-succès, et la trace de
diagnostic si elle a été demandée (`traceur`). Détail des tests :
[elagages.md § Élagages sûrs](elagages.md).

## Appariement parallèle

À partir du seuil, `driveParallelPairing` (`src/workers/parallelPairing.ts`)
répartit les compartiments de la moitié A en tranches
(`partitionBucketsALPT`), au plus `PARALLEL_PAIRING_WORKERS` et jamais plus
que de compartiments, donne à chaque tranche une part égale du plafond de
candidats, et lance une tranche par Worker (`pairSliceInWorker`, coquille
`src/workers/pairSlice.worker.ts`). Chaque tranche reçoit la moitié B entière
et l'instant de départ global. `runPairSlice` (`src/workers/pairSliceBody.ts`)
y refait la préparation (`prepareSearch` : une `PreparedSearch` porte des
fonctions et ne traverse pas `postMessage`), remplace son `startedAt` par
l'instant global, puis pilote `pairBuckets` sur sa tranche par le même
`drivePairing`.

Les progressions des tranches s'additionnent ; les résultats se fusionnent
par `combineParallelPairingResults`, qui reçoit `totalPairs`. Un arrêt poste
`{ stop: true }` à chaque tranche ; les Workers sont terminés une fois les
résultats reçus. Une erreur d'une tranche est rattrapée : Workers terminés,
résultat vide tronqué. Détail : [parallelisation.md](parallelisation.md).

## Fin de l'appariement

Le Worker poste le résultat (`type: 'result'`) ; le hook l'enregistre
(`result`), efface la progression et passe en `done`.

Le même enchaînement existe hors Worker : `searchBuildsSteps` appelle
`prepareSearch`, `buildBuckets` pour A puis pour B dans le même fil, puis
`pairBuckets` ; `searchBuilds` le draine en un appel. C'est l'entrée des
tests et des scripts : ni Worker, ni appariement parallèle.
