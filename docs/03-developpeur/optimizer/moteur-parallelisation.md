# Parallélisation de l'appariement et Worker de résolution

**Statut :** ÉTAT ACTUEL — décrit l'appariement parallèle tel que le code l'exécute, au navigateur et en Node (tranches, partage du temps et du plafond de candidats, code commun aux deux plateformes), et le Worker de résolution de l'équipement d'un build
**Lire si :** on modifie `parallelPairing.ts`, `pairSliceBody.ts`, une coquille ou un lanceur de tranche (navigateur ou Node), le seuil du régime parallèle, ou le Worker de résolution (`resolutionBody.ts`, `resolution.worker.ts`, `resolutionDistante.ts`)
**Ne pas lire si :** on cherche l'enchaînement complet d'une recherche (moteur-pipeline.md) ou la file de résolution côté écran, ses deux voies et ses mesures (moteur-artefacts.md)
**Voir aussi :** moteur-pipeline.md, ../../02-app/optimizer/ (feat-interruption.md), harnais.md, verification.md, moteur-artefacts.md, invariants.md

Deux usages des Workers suivent le même patron : un corps neutre, qui porte
toute la logique et ne connaît aucune plateforme, et une coquille par
plateforme, qui ne fait que brancher la messagerie. L'appariement parallèle
répartit l'appariement d'une grosse recherche sur plusieurs fils ; le Worker
de résolution sort du fil de l'écran la résolution de l'équipement des
builds trouvés. Leur place dans une recherche :
[moteur-pipeline.md § Appariement parallèle](moteur-pipeline.md) et
[moteur-pipeline.md § Worker de résolution](moteur-pipeline.md). Les contraintes à ne pas
casser : [invariants.md § Workers](invariants.md).

| Fichier | Rôle | Plateforme |
| --- | --- | --- |
| `src/workers/parallelPairing.ts` | orchestration : répartition, partage du plafond, progression, fusion ; les deux constantes du régime | neutre |
| `src/workers/pairSliceBody.ts` | corps d'une tranche (`runPairSlice`) et types de son protocole | neutre |
| `src/lib/runeBuildOptim.ts` | `totalPairCount`, `partitionBucketsALPT`, `combineParallelPairingResults` | neutre |
| `src/workers/runeBuildOptim.worker.ts` | choix du régime, lanceur `pairSliceInWorker`, arrêt et erreur | navigateur |
| `src/workers/pairSlice.worker.ts` | coquille d'une tranche | navigateur |
| `scripts/lib/spawnSliceNode.ts` | lanceur `makeSpawnSliceNode`, paquet `ensurePairSliceBundle` | Node |
| `scripts/lib/pair-slice-worker.ts` | coquille d'une tranche | Node (`worker_threads`) |
| `src/workers/resolutionBody.ts` | corps de résolution (`CorpsResolution`), entrées et protocole | neutre |
| `src/workers/resolution.worker.ts` | coquille de résolution | navigateur |
| `src/workers/resolutionDistante.ts` | côté écran : quoi envoyer, annuler, écrire (`ResolutionDistante`) | neutre |

## Choix du régime

Les moitiés construites, le Worker principal compare l'espace exact à
parcourir, `totalPairCount(prepared, bucketsA, bucketsB)`, au seuil
`PARALLEL_PAIRING_THRESHOLD` (100 000 000 paires) : en dessous, appariement
séquentiel dans ce Worker ; à partir du seuil, appariement parallèle sur au
plus `PARALLEL_PAIRING_WORKERS` (4) tranches. Le seuil est le seul critère :
ni le mode exhaustif, ni le filet de temps, ni le plafond de candidats
n'entrent dans le choix. La construction des moitiés, elle, se fait toujours
dans deux Workers, quelle que soit la taille du cas
([moteur-pipeline.md § Construction des moitiés](moteur-pipeline.md)).

- Le nombre de tranches est fixe, jamais dérivé du nombre de cœurs
  (`navigator.hardwareConcurrency`) : ne pas le rendre automatique,
  davantage de fils a fait moins bien sur la plupart des gros cas mesurés.
- Sur un petit espace, démarrer et alimenter les fils coûte plus que le
  calcul gagné. Le seuil est placé entre une zone où le parallèle perd et
  une zone où il gagne, sans mesure fine entre les deux ; il a été calibré
  en recherche exhaustive, jamais recalibré pour une recherche que le filet
  de temps ou le plafond de candidats arrêtent avant la fin.
- Ne pas porter l'appariement sur GPU : sa chaîne de filtres à sortie
  anticipée fait diverger les fils, il faudrait des tableaux typés à
  disposition fixe qui n'existent pas, et WebGPU n'aurait aucun repli dans
  une application sans serveur ; le CPU suffit aux plus gros cas mesurés.

## Répartition et partage du plafond

`driveParallelPairing` découpe la moitié A, jamais la moitié B :

- `workerCount = Math.min(PARALLEL_PAIRING_WORKERS, bucketsA.length)` :
  jamais une tranche vide.
- `partitionBucketsALPT(bucketsA, workerCount)` répartit les compartiments
  par charge (`combos.length`) : du plus gros au plus petit, chacun à la
  tranche la moins chargée. Chaque tranche est ensuite remise dans l'ordre
  d'origine de `bucketsA`, par potentiel décroissant : chaque fil parcourt
  ses meilleurs compartiments d'abord. La fonction vit dans
  `runeBuildOptim.ts` pour être testable en Node.
  - Ne pas la remplacer par une assignation gloutonne en ordre de
    potentiel : à performance égale sur les cas mesurés, elle n'a aucune
    borne prouvée du pire déséquilibre, que LPT a.
  - Ne pas distribuer les compartiments par une file dynamique, un
    aller-retour de messages par compartiment ou par lot : à l'échelle
    réelle (quelques dizaines de compartiments), le coût des messages
    dépasse le gain, et un lot traité d'un bloc par un seul fil peut
    fortement retarder le premier candidat.
- Chaque tranche reçoit une `PairSliceRequest` : les paramètres de la
  recherche tels quels, sauf `maxCollected`, remplacé par
  `perWorkerMaxCollected = Math.max(1, Math.ceil(prepared.maxCollected / workerCount))` ;
  sa tranche de A (`bucketASlice`) ; la moitié B entière (`bucketsB`) ;
  l'instant de départ global (`startedAt`). Rien n'est partagé en mémoire :
  chaque fil reçoit sa copie par le clonage de `postMessage`.
- Les tranches de A sont disjointes : un candidat n'appartient qu'à la
  tranche qui contient sa combinaison A, la fusion n'a rien à dédoublonner,
  et la somme des espaces des tranches vaut `totalPairs` — la progression
  additionnée reste comparable au total.

Ce que le partage du plafond change :

- Sans troncature, le parallèle trouve exactement les mêmes candidats que le
  séquentiel. Sous troncature, le découpage change légitimement quels
  candidats sont gardés : chaque tranche s'arrête sur sa part, pas sur le
  plafond global.
- Une tranche qui remplit sa part s'arrête et laisse le reste de sa tranche
  non visité : la recherche est alors tronquée, motif `quotaTranche`
  ([moteur-parallelisation.md § Fusion des résultats](moteur-parallelisation.md)). Ce que
  l'écran en dit :
  [02-app/optimizer/ (feat-interruption.md) § Interruption — filet de temps, pré-filtrage et arrêt manuel](../../02-app/optimizer/).
- Ne pas remplacer la part fixe par un quota partagé que les fils se
  signaleraient par messages : sans mémoire partagée, le signal d'arrêt
  arrive en retard, et sous vraie concurrence le total dépasse le plafond.
  Ce mode (`shared`, dans `scripts/lib/pairing-quota-worker.ts`) n'est pas
  en production.

## Le corps d'une tranche

`runPairSlice(request, isStopped, onProgress)` (`src/workers/pairSliceBody.ts`)
exécute une tranche et rend son résultat (`PairSliceResultMessage`) ;
`isStopped` et `onProgress` sont ses deux seuls contacts avec la plateforme.

1. Il refait la préparation, `prepareSearch(params)` : une `PreparedSearch`
   porte des fonctions (`totalOf`), que le clonage de `postMessage` ne
   transporte pas. Sur les mêmes paramètres, la préparation de la tranche
   retrouve le pool du Worker principal ; seul `maxCollected` diffère. Si
   `prepareSearch` rend `null`, la tranche rend un résultat vide, non
   tronqué. Ne pas transmettre aux tranches le pool que le Worker principal
   a préparé pour leur épargner ce travail : son coût est faible depuis que
   la dominance précalcule la contribution des runes
   (`runeContributionAllKeys`), et ce champ de plus devrait suivre tous les
   constructeurs de la requête (skill `optimizer-field-propagation`).
2. Il remplace `prepared.startedAt`, que sa propre préparation vient de
   poser, par l'instant de départ global, AVANT tout usage du filet de
   temps : le test du temps de `pairBuckets` lit `prepared.startedAt`. Sans
   ce remplacement, le filet `maxMs` repartirait de la fin de la
   construction des moitiés au lieu du lancement de la recherche.
3. Il pilote `pairBuckets(prepared, bucketASlice, bucketsB)` par
   `drivePairing`, le pilote du séquentiel : progression au plus une fois
   par `PROGRESS_THROTTLE_MS`, main rendue au plus une fois par
   `YIELD_THROTTLE_MS`, et à l'arrêt un résultat tronqué fait de ce que la
   tranche a déjà trouvé ([moteur-pipeline.md § Appariement séquentiel](moteur-pipeline.md)).

Une tranche n'a aucune borne propre au parallèle : elle s'arrête sur le
filet de temps global, sur sa part du plafond de candidats, à la fin de sa
tranche ou sur l'arrêt manuel. Aucun plafond de paires.

## Coquilles et lanceurs

Seul le lancement d'une tranche dépend de la plateforme.
`driveParallelPairing` reçoit un lanceur (`SpawnSlice`) qui démarre une
tranche et rend une poignée (`SliceHandle`) : `done`, la promesse du
résultat ; `stop`, l'arrêt coopératif ; `terminate`, l'arrêt brutal.

| | Navigateur | Node |
| --- | --- | --- |
| Coquille | `src/workers/pairSlice.worker.ts` | `scripts/lib/pair-slice-worker.ts` |
| Lanceur | `pairSliceInWorker` (`runeBuildOptim.worker.ts`) | `makeSpawnSliceNode` (`scripts/lib/spawnSliceNode.ts`) |
| Requête | `new Worker(new URL('./pairSlice.worker.ts', import.meta.url), { type: 'module' })`, puis la requête par message | `new Worker(chemin du paquet, { workerData: request })` : la requête arrive à la construction |
| Arrêt | message `{ stop: true }` | message `{ stop: true }` |
| Erreur | `onerror` rejette `done` | l'événement `error` rejette `done` |

- Les deux coquilles ne portent aucune logique : elles appellent le même
  `runPairSlice` et branchent sa messagerie (`self.onmessage` et
  `postMessage` d'un côté, `workerData` et `parentPort` de l'autre). Les
  types du protocole (`PairSliceRequest`, `PairSliceResponse`…) vivent dans
  `pairSliceBody.ts` ; les deux coquilles les importent de là, jamais l'une
  de l'autre.
- Le message d'arrêt n'est lu que quand `drivePairing` rend la main, au
  plus tous les `YIELD_THROTTLE_MS` : sans cette respiration, une tranche ne
  le verrait qu'à la fin.
- Côté Node, un `worker_threads` exécute du JavaScript :
  `ensurePairSliceBundle` assemble la coquille par esbuild en un `.cjs`, une
  fois par processus, dans un dossier temporaire, et toutes les tranches le
  réutilisent ; le temps d'assemblage n'entre jamais dans une mesure
  d'appariement.
- ⚠️ Les deux lanceurs reconstruisent le `SearchResult` champ par champ
  (`candidates`, `explored`, `truncated`, `nearMissByCondition`,
  `globalNearMiss`, et `traceur` s'il est présent), jamais par recopie du
  message : un champ ajouté au résultat d'une tranche se reporte dans les
  deux, sinon il se perd en silence.

## Code commun aux deux plateformes

- `parallelPairing.ts` et `pairSliceBody.ts` n'importent jamais
  `worker_threads`, ni `self`, ni `postMessage`, ni le `Worker` du DOM :
  Vite tenterait de résoudre du code Node dans le paquet du navigateur
  (construction en échec, ou polyfill embarqué). La plateforme arrive donc
  par injection (le lanceur, `isStopped`, `onProgress`) : ne pas la
  remplacer par un test `if (isNode)`, qui ferait référencer les deux
  plateformes au module neutre.
- `PARALLEL_PAIRING_WORKERS` et `PARALLEL_PAIRING_THRESHOLD` vivent dans
  `parallelPairing.ts`, importable depuis Node : un outil Node lit ces
  valeurs, il ne les recode jamais, sinon il cesse de reproduire le régime
  que la production choisirait.
- Un outil Node qui veut reproduire la production apparie par ce code
  commun, `driveParallelPairing` avec `makeSpawnSliceNode`, comme le harnais
  ([harnais.md § Régime d'appariement : le seuil de la production](harnais.md)).
  Apparier en séquentiel là où la production parallélise, ou par une copie
  de la tranche, mesure un comportement qui n'existe pas. Les autres fils
  Node du dépôt ne sont pas le code de production :
  `scripts/lib/pairing-quota-worker.ts` est une copie (modes `fixed` et
  `shared`), `scripts/lib/pairing-worker.ts` un prototype de débit.
- L'injection coûte un appel par tranche, au plus quatre par recherche,
  jamais un appel par paire : la boucle de `drivePairing` reste dans le
  corps de la tranche.

## Orchestration et progression

`driveParallelPairing(spawnSlice, params, prepared, bucketsA, bucketsB, totalPairs, postProgress, startedAt, onHandles)`
(`src/workers/parallelPairing.ts`, `onHandles` facultatif) :

1. lance une tranche par appel du lanceur, puis passe les poignées à
   `onHandles`, pour que l'appelant les inscrive dans son registre d'arrêt
   (`activePairingWorkers` dans `runeBuildOptim.worker.ts`) : le module
   neutre ne connaît pas ce registre ;
2. agrège la progression : la dernière valeur `explored` de chaque tranche,
   et les candidats nouveaux de toutes ; il appelle
   `postProgress(explored, found, newCandidates)` au plus une fois par
   `PROGRESS_THROTTLE_MS`, avec la somme des `explored`, le nombre de
   candidats reçus et ceux pas encore transmis. Le Worker principal y
   ajoute `totalPairs` et le pourcentage (`estimatePct`) :
   [02-app/optimizer/ (feat-interruption.md) § Barre de progression](../../02-app/optimizer/) ;
3. attend toutes les tranches (`Promise.all` sur `done`), les termine
   toutes, rappelle `onHandles` avec un tableau vide, puis fusionne par
   `combineParallelPairingResults(results, perWorkerMaxCollected, prepared.maxCollected, totalPairs)`.

`totalPairs` est l'espace que l'appelant a calculé pour choisir le régime :
transmis à la fusion, jamais recalculé. Les candidats de la progression ne
servent qu'à l'aperçu ; le résultat qui compte est celui de la fusion.

## Fusion des résultats

`combineParallelPairingResults` (`src/lib/runeBuildOptim.ts`) :

- `candidates` : la concaténation des tranches, dans l'ordre des tranches ;
  `explored` : la somme.
- `truncated` n'est pas un « ou » des tranches : il vaut vrai dès qu'il y a
  un motif (`motifTroncature`), choisi dans cet ordre :
  1. `maxCollected` : le total atteint le plafond global ;
  2. `maxMs` : une tranche est tronquée avec moins de candidats que sa
     part, donc par le temps ;
  3. `quotaTranche` : une tranche est tronquée sur sa part et il reste des
     paires non visitées (`explored < totalPairs`) ; une part remplie sur
     la toute dernière paire ne laisse rien et ne tronque pas.
- La distinction entre le temps et la part est exacte, pas une
  heuristique : `pairBuckets` teste le temps avant d'ajouter un candidat, et
  la part juste après. Une tranche coupée par le temps a donc strictement
  moins de candidats que sa part, une tranche coupée par sa part en a
  exactement sa part.
- Un arrêt manuel n'a pas de motif propre : une tranche arrêtée a moins de
  candidats que sa part, et la fusion la lit comme le temps (`maxMs`) ;
  l'appariement séquentiel arrêté ne pose aucun motif. L'écran ne lit que
  `truncated`.
- Quasi-succès : par condition (`key` et `kind`), l'entrée dont le premier
  écart (`shortfalls[0]`) est le plus petit ; globalement, celui dont le
  plus grand écart relatif est le plus petit. Les écarts viennent des
  tranches : comparés, jamais recalculés.
- Trace de diagnostic : celle de la tranche qui a atteint la paire suivie
  (`appariement.paireAtteinte`), sinon la première ; son `budget` est
  remplacé par celui du résultat fusionné, sur une copie.

## Arrêt, erreur et nettoyage

- Arrêt manuel : le Worker principal reçoit `{ stop: true }` ; pendant
  l'appariement parallèle, il appelle `stop()` sur chaque poignée inscrite
  (`activePairingWorkers`). Chaque tranche rend ce qu'elle a trouvé,
  `Promise.all` se résout plus tôt avec un résultat tronqué, et les fils ne
  sont terminés qu'ensuite. `stop` et `terminate` ne sont pas
  interchangeables : terminer une tranche avant sa réponse perd ses
  candidats, et « Arrêter » rendrait moins que ce qui a été trouvé.
- Arrêt pendant la construction des moitiés :
  [moteur-pipeline.md § Interruption](moteur-pipeline.md).
- Erreur d'une tranche : sa promesse `done` est rejetée, `Promise.all`
  aussi, et `driveParallelPairing` sort sans terminer les autres tranches.
  Le Worker principal l'attrape : il termine les poignées encore inscrites
  et poste un résultat vide, tronqué. Il est le seul appelant à passer
  `onHandles` : le harnais, le différentiel d'extraction et
  `tests/auras-modele.test.ts` n'en passent pas et ne terminent rien sur erreur. Un
  appelant qui veut le même filet reçoit les poignées par `onHandles` et
  les termine lui-même.
- ⚠️ Ne pas retirer ce `try/catch` du Worker principal : un rejet non
  intercepté dans un `self.onmessage` asynchrone n'atteint pas le `onerror`
  du parent. Aucun message n'arriverait, l'écran resterait « en cours », et
  les tranches encore vivantes ne seraient jamais terminées.

## Worker de résolution

La résolution de l'équipement d'un build (paire d'artéfacts et relique)
suit le même patron : un corps neutre, `CorpsResolution`
(`src/workers/resolutionBody.ts`) ; une coquille navigateur,
`src/workers/resolution.worker.ts` ; et côté écran un module neutre,
`ResolutionDistante` (`src/workers/resolutionDistante.ts`), que le hook de
la file branche. Le corps et le module ne touchent ni `self` ni
`postMessage`, ni `worker_threads`, ni le DOM, ni React : Node et les tests
les exécutent tels quels. Le corps ne réimplémente rien : il reconstruit
l'entrée de production par `entreeResolutionDuBuild` et résout par
`resoudreEquipementDuBuild`, comme le fil de l'écran et le CLI
([moteur-pipeline.md § Résolution de l'équipement d'un build](moteur-pipeline.md)).
Pourquoi la file passe par ce Worker, ses deux voies de repli et ce qui a
été mesuré : [moteur-artefacts.md § Résolution hors du fil de l'écran](moteur-artefacts.md).

### Entrées sérialisables

Les entrées de la résolution directe ne traversent pas `postMessage` :
`ArtifactSearchParams` porte une fonction, `evaluer`, et l'entrée de
production porte des fonctions et des caches. Le contexte voyage donc en
données, `EntreesResolutionSerialisables` : la fiche (`fiche`), les
paramètres de paires sans `evaluer` (`artifactParams`), le régime effectif
(`regime`), le contexte de dégâts (`degats`, `null` hors « Dégâts réels »),
l'assiette des effets uniques de relique (`exclusive`), les conditions avec
auras (`requirement`) et le contexte relique de la recherche lancée
(`relicContext`). Le corps reconstruit le reste de l'autre côté.

- `entreesSerialisables` les produit depuis les arguments que l'écran passe
  à `entreeResolutionDuBuild` ; elle ne retire que `evaluer`, par
  décomposition : un champ ajouté à `ArtifactSearchParams` voyage sans
  qu'on le liste.
- `ProtocoleClonable` fait échouer `tsc` dès qu'un message ou une réponse
  du protocole porte une fonction, à toute profondeur ; la garde refuse
  aussi un objet à méthodes, que le clonage rendrait nu.
  `tests/resolution-worker.test.ts` le vérifie à l'exécution par
  `structuredClone`.
- Les runes d'un build voyagent avec sa demande ; elles viennent de
  `runesDuBuild` (`src/lib/relicQueue.ts`), le producteur de la résolution
  du fil de l'écran.

### Protocole et ordre

Vers le Worker (`MessageVersResolution`) :

- `contexte` (`idContexte`, `entrees`) remplace le précédent : les demandes
  encore en attente reçoivent `annule`, motif `contexte`, et les caches
  repartent à neuf (`nouveauxCachesResolution`), jamais réutilisés — le
  profil de dégâts est rangé par identifiants de pièces, qu'un autre
  inventaire réattribue ;
- `resoudre` (`idContexte`, `idDemande`, `cle`, `runes`) : une demande pour
  un build ; d'un autre contexte que le courant, elle reçoit aussitôt
  `annule`, motif `contexte` ;
- `annuler` (`idDemande` facultatif) retire la demande en attente visée, ou
  toutes ; chacune reçoit `annule`, motif `demande`. Une demande déjà
  résolue ne se rappelle pas.

Réponses (`ReponseResolution`), toutes marquées `idContexte`, `idDemande` et
`cle` : `resultat` ; `annule` ; `erreur` (`nom`, `message`, et `vide` d'une
`RechercheRefusee`). Exactement une réponse par demande reçue : la file
n'attend jamais un build qui ne viendra pas.

`recevoir` traite un message sans rien résoudre ; `etape` résout la plus
ancienne demande en attente, une seule. La coquille appelle `etape` dans une
tâche à part (`setTimeout`), une demande par tâche, pour qu'un nouveau
contexte ou une annulation arrivés entre deux résolutions passent avant la
suivante. La plateforme ne garantit pas l'ordre entre cette tâche et un
message déjà en attente : l'annulation n'est qu'une économie, la garantie
est du côté de l'appelant, qui ignore toute réponse d'une demande annulée ou
d'un contexte périmé. Le corps ne trie rien : la priorité (la page affichée
d'abord) se décide sur le fil de l'écran, par `prochainsATraiter`.

### Côté écran

`ResolutionDistante` décide quoi envoyer (`planifier`, dans l'ordre :
contexte, annulations, demandes ; détail dans
[moteur-pipeline.md § Worker de résolution](moteur-pipeline.md)), quoi écrire
(`recevoir`), quand publier et quand renoncer.

- Le contexte courant (`ContexteCourant`) est l'objet des entrées et la
  signature des réglages, comparés par identité à l'envoi ET à chaque
  réponse : une réponse arrivée entre un changement de réglage et le renvoi
  du contexte porte encore l'`idContexte` courant, c'est l'identité qui la
  démasque. Le contexte ne part que s'il reste du travail.
- `planifier` est idempotent. Au plus `DEMANDES_EN_VOL_MAX` (2) demandes
  sans réponse, annulées comprises : deux, pour que le Worker enchaîne la
  seconde sans attendre l'aller-retour vers un écran occupé ; pas plus,
  parce qu'une demande partie ne se double qu'en l'annulant. La plus
  ancienne en vol n'est jamais annulée : le corps l'a sans doute commencée.
- `recevoir` libère toujours la place en vol et rend une issue : `ecrite`,
  `ignoree` (motifs `contexte-perime`, `demande-annulee`,
  `annulee-par-le-corps`, `demande-inconnue`, `cle-differente`, `repli`) ou
  `erreur`. Une erreur n'est jamais tue, même pour une demande annulée :
  c'est la résolution de production qui a levé.
- Publication : `publier` (port) rend vrai si l'écran a reçu le cache, faux
  si la cadence l'a retenu. Après une écriture, la publication est forcée
  (`publicationForcee`) quand le build était le dernier non résolu de la
  page affichée, ou que la file se vide. Une écriture retenue est publiée de
  force quand la file se vide (`pomper`, réponse ignorée comprise) et au
  repli (`renoncer` rend vrai).
- Repli : une réponse `erreur` ou un envoi qui lève font `basculer` —
  renoncer (plus rien d'envoyé ni d'écrit, demandes en vol oubliées),
  publier de force s'il le faut, puis appeler le port `repli`, journalisé
  avec le nom, le message et le motif `vide` (`repliSurErreur`).
- Le hook de la file (`useArtifactOptimQueue`) fournit les ports
  (`PortsResolutionDistante`) et crée un seul Worker pour sa vie, au premier
  besoin, terminé au démontage. Hors d'un effet actif, une réponse libère
  sa place sans rien écrire. Une erreur du Worker, une réponse illisible ou
  une création impossible font aussi repasser la file sur le fil de
  l'écran, l'erreur journalisée par `console.error` ; le repli dure
  jusqu'au démontage.

## Vérifier un changement

- Le code commun s'exerce en Node tel quel :
  - `testAurasPariteRegimes` (`tests/auras-modele.test.ts`) force
    l'appariement parallèle, `driveParallelPairing` sur de vrais
    `worker_threads`, sur un petit pool sous le seuil (la production y
    choisirait le séquentiel), et compare ses builds à ceux du séquentiel
    et du CLI ; il vérifie aussi qu'une tranche, qui refait la préparation
    sur ses paramètres, retrouve le même pool après dominance ;
  - `testRelicSearch` (`tests/relic-search.test.ts`) vérifie que le lanceur
    Node rend la même trace de diagnostic que `runPairSlice` appelé
    directement ;
  - `testRuneOptimParallelTruncated` vérifie la fusion (motif, quasi-succès)
    sans fil ;
  - hors `npm test`, `scripts/parallel-pairing-extraction-diff.ts` compare,
    sans filet de temps ni plafond, `driveParallelPairing` sur de vrais fils
    à l'appariement séquentiel de référence, sur les cas de `CASES`
    (`scripts/lib/perfShared.ts`, qui lisent des exports de compte locaux) :
    mêmes candidats, sans doublon.
- ⚠️ `testRuneOptimParallelPairing` (`tests/rune-optim-parallel-pairing.test.ts`)
  n'exécute pas `runPairSlice` : ses fils sont la copie
  `scripts/lib/pairing-quota-worker.ts`, en mode `fixed`, qui reproduit la
  division du plafond. Un changement de `runPairSlice` ou de
  `driveParallelPairing` ne s'y voit pas. Ses deux régimes :
  [verification.md § Échelle réelle et appariement parallèle](verification.md).
- L'égalité exacte avec le séquentiel ne se démontre que sans troncature.
  Ne jamais simuler séquentiellement, dans un seul processus, ce qui dépend
  de l'horloge ou de la concurrence : le test du temps lit l'horloge, chaque
  tranche aurait un chrono neuf, et une perte par part trop petite
  passerait inaperçue.
- La coquille navigateur ne s'exerce qu'au navigateur, à la main, sur une
  recherche au-dessus du seuil : la progression avance (barre, compte de
  candidats) ; « Arrêter » pendant l'appariement rend les candidats déjà
  trouvés, pas zéro, sans blocage ; une recherche menée jusqu'au bout rend
  des résultats ; aucun Worker de tranche ne survit à la recherche, chemin
  d'erreur compris. Le Worker principal, lui, reste en vie après une
  recherche finie : il n'est terminé que par la recherche suivante ou au
  démontage (`src/hooks/useBuildOptimSearch.ts`). Pour comparer au navigateur sans outillage : exporter la recette,
  la rejouer sur la version d'avant le changement, comparer les premiers
  résultats.
- Worker de résolution : `testResolutionWorker`
  (`tests/resolution-worker.test.ts`) — corps neutre, entrées clonables,
  résolution par le corps derrière `structuredClone` identique à la
  résolution directe, caches neufs par contexte, une réponse par demande ;
  `testResolutionDistante` (`tests/resolution-distante.test.ts`) — envoi,
  annulation, réponses périmées jamais écrites, repli, publication, une file
  simulée qui remplit le même cache que la résolution directe, et le
  branchement du hook gardé par des contrôles de source. La coquille
  `resolution.worker.ts` ne se vérifie qu'au navigateur.
