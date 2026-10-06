# Pipeline de la recherche de runes

**Statut :** ÉTAT ACTUEL — décrit le chemin d'une recherche de runes dans le code, de la recherche lancée par l'écran au résultat affiché : préparation, construction des moitiés, appariement, résolution de l'équipement, file, interruption
**Lire si :** on modifie une étape de la recherche de runes, de la résolution de l'équipement d'un build ou leurs Workers, et on cherche le fichier et la fonction qui la portent
**Voir aussi :** elagages.md, artefacts.md, ../interruption.md, ../ecran/resultats.md, ../invariants.md

Ce fichier suit une recherche dans l'ordre où le code l'exécute, une section
par étape : ce qu'elle fait, le fichier et la fonction qui la portent, et le
fichier qui la détaille. Il va du clic qui lance la recherche au résultat
affiché. La préparation, la construction des deux moitiés et leur
appariement trouvent les candidats, notés avec une paire d'artéfacts
supposée. Dès l'appariement, une file résout l'équipement réel des meilleurs
d'entre eux (paire d'artéfacts et relique), dans un Worker dédié quand il est
disponible. L'écran n'affiche que les builds ainsi vérifiés, sauf quand
l'optimisation d'artéfacts est coupée. La dernière section dit ce qu'un arrêt
avant terme rend. Les contraintes à ne pas casser sont dans
[../invariants.md § Algorithme](../invariants.md),
[../invariants.md § Artéfacts](../invariants.md) et
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
| Résolution de l'équipement d'un build | `src/lib/relicQueue.ts` | `entreeResolutionDuBuild`, `resoudreEquipementDuBuild` | [artefacts.md](artefacts.md), [reliques.md](reliques.md) |
| Worker de résolution | `src/workers/resolution.worker.ts`, `src/workers/resolutionBody.ts`, `src/workers/resolutionDistante.ts` | `CorpsResolution`, `ResolutionDistante` | [parallelisation.md](parallelisation.md) |
| File de résolution | `src/hooks/useArtifactOptimQueue.ts`, `src/lib/artifactQueue.ts` | `useArtifactOptimQueue`, `prochainsATraiter`, `voieDeLaFile` | [artefacts.md](artefacts.md) |
| Résultat affiché | `src/lib/artifactQueue.ts`, `src/components/outils/OptimizerSection.tsx` | `classementResolu`, `compositionDePage`, `compteConfirme` | [../ecran/resultats.md](../ecran/resultats.md) |
| Interruption | `src/hooks/useBuildOptimSearch.ts`, `src/workers/runeBuildOptim.worker.ts`, `src/workers/pairingDriver.ts` | `stop`, `drivePairing` | [../interruption.md](../interruption.md) |

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
`pairBuckets` ; `searchBuilds` le draine en un appel, sans Worker ni
appariement parallèle. Des tests et des scripts l'utilisent ; d'autres
pilotent l'appariement parallèle sous Node (`driveParallelPairing` avec
`makeSpawnSliceNode`, `worker_threads`), ou appellent `prepareSearch` et
`pairBuckets` directement.

## Résolution de l'équipement d'un build

La recherche de runes note ses candidats avec une paire d'artéfacts
supposée. L'équipement réel d'un build se résout ensuite, un build à la
fois, par `resoudreEquipementDuBuild` (`src/lib/relicQueue.ts`) : sa paire
d'artéfacts et, en mode relique `recherche`, sa relique, ensemble. Son entrée
(`EntreeResolution`) est assemblée par `entreeResolutionDuBuild`, le même
producteur pour la résolution sur le fil de l'écran (`resoudreEquipement`,
`OptimizerSection.tsx`), pour le CLI et pour le Worker de résolution.
L'équipement est celui de la fiche, dont seules les runes sont remplacées
par celles du candidat (`runesDuBuild`). La fabrique `faireParams(relique)`
rend les paramètres de `chercherPaires`, avec un `evaluer` du régime effectif
(`evaluerPourRegime`) calculé sur des stats qui incluent la relique essayée.

Deux cas :

- hors mode `recherche`, la relique portée est fixe : `resoudreReliqueFixe`
  parcourt les paires par score décroissant (`pairesParScore`) et retient la
  première qui tient les conditions (`respecteConditions`, nul quand
  `conditionsPaireFixePosees` ne trouve aucune condition à tester) ; si
  aucune ne les tient, la meilleure au score, avec `conforme: false` ;
- en mode `recherche`, chaque relique éligible du contexte (`eligibles`)
  remplace la portée ; pour chacune, le premier couple, par score
  décroissant, qui tient minimums et maximums
  (`respecteConditionsAvecRelique`) est retenu avec son score, et
  `bestRelicForBuild` (`src/lib/relicOptim.ts`) choisit le meilleur couple
  faisable entre reliques. Aucun couple faisable : `conforme: false`. Un pool
  d'éligibles vide lève `RechercheRefusee`.

Le résultat (`ResultatArtefacts`, `src/lib/artifactQueue.ts`) porte la paire,
ses artéfacts, les stats recalculées avec l'équipement retenu, la conformité
(`conforme`) et, en mode `recherche`, la relique retenue (`relique`). Il entre
dans le cache conforme ou non : c'est le classement qui écarte un build non
conforme (§ Résultat affiché ci-dessous). Les caches qu'une file partage
entre ses builds (`CachesResolution`, créés par `nouveauxCachesResolution`)
ne changent aucun résultat ; l'écran les recrée quand `signatureArtefacts`
ou `artifactParams` change. Détail du choix de la paire :
[artefacts.md § Quand ce choix a lieu](artefacts.md) et
[artefacts.md § Partage entre les builds d'une file](artefacts.md) ; de la
relique : [reliques.md](reliques.md).

## Worker de résolution

Quand il est disponible, la résolution tourne hors du fil de l'écran, dans un
Worker dédié (`src/workers/resolution.worker.ts`). La coquille ne porte
aucune logique : elle branche `self.onmessage` sur `CorpsResolution`
(`src/workers/resolutionBody.ts`), un module neutre que Node importe tel
quel. Vers le Worker, trois messages (`MessageVersResolution`) : `contexte`,
qui porte les entrées en données (`EntreesResolutionSerialisables`, dérivées
par `entreesSerialisables`, qui ne retire que `evaluer`) ; `resoudre`, une
demande pour un build, avec ses runes ; `annuler`. Chaque demande reçoit une
réponse (`ReponseResolution`) : `resultat`, `erreur` ou `annule`, marquée
`idContexte` et `idDemande`.

`recevoir` traite un message sans rien résoudre. Un nouveau contexte annule
les demandes en attente et repart de caches neufs
(`nouveauxCachesResolution`) ; une demande d'un autre contexte est annulée
aussitôt ; `annuler` retire la demande visée, ou toutes sans `idDemande`.
`etape` résout la plus ancienne demande en attente, une seule, par
`entreeResolutionDuBuild` puis `resoudreEquipementDuBuild`, la résolution du
fil de l'écran ; une exception devient une réponse `erreur` (nom, message,
et motif `vide` d'une `RechercheRefusee`). La coquille appelle `etape` dans
une tâche à part (`setTimeout`), une demande par tâche : un message arrivé
entre deux résolutions passe avant la suivante.

Côté écran, `ResolutionDistante` (`src/workers/resolutionDistante.ts`),
module pur, décide quoi envoyer ; le hook de la file ne fait que le brancher.
`planifier` rend, dans l'ordre :

1. le contexte, s'il a changé (identité des entrées ou signature) et qu'il
   reste du travail ; toutes les demandes en vol deviennent caduques ;
2. les annulations des demandes sorties des premiers restants, sauf la plus
   ancienne en vol, que le corps a sans doute commencée ;
3. les demandes, dans l'ordre des restants, jusqu'à `DEMANDES_EN_VOL_MAX`
   sans réponse, annulées comprises.

`recevoir` libère toujours la place en vol, mais n'écrit dans le cache que le
résultat d'une demande non annulée du contexte courant : une réponse périmée
n'est jamais écrite. Une réponse `erreur` ou un envoi qui lève (`pomper`),
une erreur du Worker ou une réponse illisible font renoncer (`renoncer`) :
le Worker est terminé, l'erreur journalisée (`console.error`), et la file
repasse sur le fil de l'écran avec le cache tel qu'il est. Un Worker
impossible à créer ne fait que basculer la file sur le fil de l'écran
(`setEnRepli`) : il n'y a rien à terminer. Détail : [parallelisation.md](parallelisation.md) et
[artefacts.md § Résolution hors du fil de l'écran](artefacts.md).

## File de résolution

`useArtifactOptimQueue` (`src/hooks/useArtifactOptimQueue.ts`) dit QUAND
résoudre ; `src/lib/artifactQueue.ts` dit QUI, dans quel ordre et par quelle
voie. L'écran lui passe :

- l'ordre de base (`fullSortedCandidates`) : les candidats triés par
  `sortCandidates` avec la paire supposée, ceux de l'aperçu de progression
  pendant l'appariement, puis ceux du résultat. Jamais le classement corrigé
  par la file elle-même ;
- un accesseur de la page affichée ;
- la résolution du fil de l'écran (`resoudreEquipement`), nulle quand il n'y a
  rien à optimiser ;
- la signature (`signatureArtefacts`), la cible `K` et les entrées hors fil
  (`ResolutionHorsFil`).

`prochainsATraiter` rend les builds à résoudre. D'abord ceux de la page
affichée absents du cache : `aVerifier` de `compositionDePage`, les builds
qui rempliront ses places en attente. Puis l'avance de fond, qui parcourt
l'ordre de base et s'arrête quand les confirmées rencontrées (résolues et
conformes) plus les non résolues rencontrées atteignent `K` ; un build écarté
(`conforme: false`) ne compte pas, la fenêtre s'allonge d'autant. `K` vient
de `cibleDeLaFile` : `kDeLaFile` du contexte relique de la recherche lancée
(`K_BUILDS_RECHERCHE_RELIQUE` en mode `recherche`, `K_BUILDS_OPTIMISES`
sinon), ou l'infini avec « Vérifier toutes les combinaisons trouvées », lu en
direct.

Avec le Worker, `pomper` relit la file et envoie les demandes à chaque rendu
et après chaque réponse. Un seul Worker sert toute la vie du hook : créé au
premier besoin, terminé au démontage. Après un repli, il n'est plus relancé.
Sur le chemin direct, un build est résolu par tâche, sur le fil de l'écran.
`voieDeLaFile` dit quand :

- `page` : une tâche immédiate (`MessageChannel`), tant que la page affichée
  porte un build non résolu ;
- `fond` : le temps d'inactivité (`requestIdleCallback`, repli `setTimeout`) ;
- `aucune` : rien n'est programmé.

Une seule tâche attend, toutes voies confondues. Une tranche de fond en
attente est annulée quand la page acquiert des builds non résolus. La voie ne
change ni les builds traités ni leur ordre.

Le cache (`parBuild`, clé `cleBuild` : les identifiants des six runes, triés)
ne fait que grandir sous une même signature. Il se vide quand
`signatureArtefacts` change, c'est-à-dire pour tout réglage qui change le
score d'une paire, l'inventaire ou les conditions : détail dans
[artefacts.md § Recalcul quand la paire peut changer](artefacts.md). Une
recherche relancée aux mêmes réglages garde donc ce que la précédente a
résolu. L'écran ne voit le cache qu'à sa publication, au plus une par
`PUBLICATION_MS`. Elle est forcée quand la file se vide, et quand le dernier
build non résolu de la page vient de l'être (`publicationForcee` côté
Worker).

Annulation : avec le Worker, `planifier` annule les demandes devenues
inutiles (page changée, meilleurs builds arrivés) ou caduques (nouveau
contexte). Sur le chemin direct, rien n'est en vol : la tâche en attente est
annulée quand l'effet se démonte (résolution, signature ou `K` changés), et
la tranche suivante relit la file à jour.

## Résultat affiché

`classementResolu` (`src/lib/artifactQueue.ts`) produit le classement
affiché (`affichees`), le même pour l'écran et le CLI. Il part de l'ordre de
base et retire les builds que la résolution a écartés (`conforme: false`). Il
départage à score égal par `ordonnerParDepartage` (relique retenue, puis
`cleBuild`) et lit chaque build à travers son équipement résolu
(`candidatAvecSaPaire`). Il retrie enfin par `sortCandidates`. Un build résolu
peut donc passer devant ; un build non résolu garde ses stats d'origine.

`compositionDePage` compose une page. Ses cartes sont les seuls builds
vérifiés, résolus et conformes, dans l'ordre du classement. Les places
restantes attendent, « Vérification… », tant qu'il reste des builds non
résolus, et `aVerifier` nomme ceux qui les rempliront : la page affichée que
sert la file. `compteConfirme` donne l'en-tête, en combinaisons confirmées,
et le nombre de pages ; `compteAffichable` donne le compte de la ligne de
progression. Sans file (optimisation d'artéfacts coupée), la page est la
tranche du classement. Détail de l'écran :
[../ecran/resultats.md § Compte des combinaisons confirmées et pagination](../ecran/resultats.md).

## Interruption

Une recherche s'arrête avant d'avoir tout examiné par le filet de temps, par
le plafond de candidats ou par l'arrêt manuel. Valeurs, réglages et
messages : [../interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](../interruption.md).

Le filet de temps, `maxMs` (défaut `DEFAULT_MAX_MS`), court depuis
`prepared.startedAt`. `pairBuckets` le teste à chaque point de passage
(§ Appariement séquentiel) et rend alors un résultat tronqué (`truncated`).
Quand `maxMs` n'est pas fini, le terme de temps d'`estimatePct` vaut 0.

L'arrêt manuel part du bouton « Arrêter » : il pose `stoppedManually` et
appelle `stop` (`useBuildOptimSearch`), qui poste `{ stop: true }` au Worker
de recherche. Le Worker (`self.onmessage`) lève son drapeau `stopped`, puis
agit selon la phase :

- construction des moitiés : les Workers enfants sont terminés
  (`terminate()`) et `stopBuildReject` fait sortir l'attente : résultat
  vide, tronqué ;
- appariement séquentiel : `drivePairing` lit `isStopped` à chaque pas du
  générateur et rend les candidats, `explored` et le quasi-succès
  accumulés, avec `truncated: true`. Le message d'arrêt n'est lu que quand le
  pilote rend la main (`YIELD_THROTTLE_MS`) ;
- appariement parallèle : chaque tranche reçoit `{ stop: true }` et rend ce
  qu'elle a trouvé ; `combineParallelPairingResults` fusionne.

Dans tous les cas, le Worker poste un résultat ordinaire (`type: 'result'`)
et le hook passe en `done`. Le message affiché sous un résultat tronqué
dépend de `stoppedManually`, remis à faux à chaque lancement par
`handleSearch` : le meilleur trouvé jusque-là après un arrêt manuel, une
invitation à resserrer les critères sinon. En parallèle, la fusion dérive un
motif (`motifTroncature`) : `maxCollected`, puis `maxMs`, puis `quotaTranche`.
Elle ignore l'arrêt manuel : une tranche arrêtée sous son quota y compte
comme `maxMs`. L'écran ne lit que `truncated`.

« Arrêter » n'arrête que la recherche de runes. La file de résolution lit le
résultat posté, tronqué ou non, et continue vers `K` confirmées. `cancel`, au
démontage et par `run` avant une nouvelle recherche, termine le Worker de
recherche sans rien récupérer (§ Lancement).
