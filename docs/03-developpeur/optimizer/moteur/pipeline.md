# Pipeline de la recherche de runes

Voir aussi : elagages.md, artefacts.md, ../../../02-app/optimizer/ (feat-interruption.md, ecran/resultats.md), ../invariants.md.

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
| Lancement | `src/hooks/useBuildOptimSearch.ts` | `useBuildOptimSearch` (`run`, `stop`, `cancel`) | [02-app/optimizer/feat-interruption.md](../../../02-app/optimizer/feat-interruption.md) |
| Préparation | `src/workers/prepareForSearch.ts`, `src/lib/runeBuildOptim.ts` | `prepareOrRefuse`, `prepareSearch` | [elagages.md](elagages.md) |
| Construction des moitiés | `src/workers/runeBuildOptim.worker.ts`, `src/workers/buildHalf.worker.ts`, `src/lib/rechercheRunes.ts`, `src/lib/constructionRapide.ts`, `src/lib/demiBuildsTypes.ts` | `buildHalfInWorker`, `construireMoitieTypee`, `construireMoitieRapideTypee` | [elagages.md](elagages.md) |
| Choix du régime | `src/workers/runeBuildOptim.worker.ts`, `src/workers/parallelPairing.ts`, `src/lib/appariementRapide.ts` | `compterPaires`, `verifierContrat`, `regimeAppariement`, `nombreDeTravailleurs` | [parallelisation.md](parallelisation.md) |
| Appariement séquentiel | `src/workers/pairingDriver.ts`, `src/lib/rechercheRunes.ts`, `src/lib/appariementRapide.ts` | `lancerAppariement`, `drivePairing`, `apparier`, `apparierRapide` | [elagages.md](elagages.md), [02-app/optimizer/feat-interruption.md](../../../02-app/optimizer/feat-interruption.md) |
| Appariement parallèle | `src/lib/appariementRapideParallele.ts`, `src/workers/appariementRapide.worker.ts`, `src/lib/travailleurAppariement.ts`, `src/lib/appariementRapide.ts` | `apparierRapideEnParallele`, `servirAppariement`, `parcourirMorceau` | [parallelisation.md](parallelisation.md) |
| Fin de l'appariement | `src/workers/runeBuildOptim.worker.ts`, `src/hooks/useBuildOptimSearch.ts` | `useBuildOptimSearch` | — |
| Résolution de l'équipement d'un build | `src/lib/relicQueue.ts`, `src/lib/resolutionRapide.ts`, `src/lib/resolutionExhaustive.ts` | `entreeResolutionDuBuild`, `resoudreEquipementDuBuild`, `resoudreEquipementDuBuildRapide`, `resoudreEquipementDuBuildExhaustif` | [artefacts.md](artefacts.md), [reliques.md](reliques.md) |
| Worker de résolution | `src/workers/resolution.worker.ts`, `src/workers/resolutionBody.ts`, `src/workers/resolutionDistante.ts` | `CorpsResolution`, `ResolutionDistante` | [parallelisation.md](parallelisation.md) |
| File de résolution | `src/hooks/useArtifactOptimQueue.ts`, `src/lib/artifactQueue.ts` | `useArtifactOptimQueue`, `prochainsATraiter`, `voieDeLaFile` | [artefacts.md](artefacts.md) |
| Résultat affiché | `src/lib/artifactQueue.ts`, `src/components/outils/OptimizerSection.tsx` | `classementResolu`, `compositionDePage`, `compteConfirme` | [02-app/optimizer/ecran/resultats.md](../../../02-app/optimizer/ecran/resultats.md) |
| Interruption | `src/hooks/useBuildOptimSearch.ts`, `src/workers/runeBuildOptim.worker.ts`, `src/workers/pairingDriver.ts` | `stop`, `drivePairing` | [02-app/optimizer/feat-interruption.md](../../../02-app/optimizer/feat-interruption.md) |

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
suivant. Le Worker répond par cinq sortes de messages (`WorkerResponse`) :
bloc de candidats, progression, résultat, refus, erreur. Le statut (`BuildOptimStatus`) passe à
`running`, puis à `done`, `refused` ou `error` ; `reset` revient à `idle`
sans relancer. `stop` poste `{ stop: true }` au Worker : l'arrêt coopératif,
décrit dans
[02-app/optimizer/feat-interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](../../../02-app/optimizer/feat-interruption.md#interruption--filet-de-temps-pré-filtrage-et-arrêt-manuel).

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
eux-mêmes : [elagages.md § Élagages sûrs](elagages.md),
[elagages.md § Élagage sûr — faisabilité](elagages.md) et
[elagages.md § Pré-filtrage heuristique et compartiments](elagages.md).

## Construction des moitiés

Le Worker construit les moitiés en parallèle, UN Worker enfant par moitié
ET par préréglage construit (`construireMoitiesEmboiteesTypees`,
`src/lib/constructionEmboitee.ts`, avec `buildHalfInWorker` sur
`src/workers/buildHalf.worker.ts`) : le préréglage de la recherche, puis
chaque préréglage plus étroit (`PreparedSearch.cransEmboites`, préréglages
emboîtés), soit 2 Workers à Bas et jusqu'à 8 à Extrême, tous lancés
ensemble. La moitié A porte sur les indices d'emplacement 0 à 2 avec
`maxSetsForA`, la moitié B sur 3 à 5 avec `maxSetsForB`. Chaque requête
(`BuildHalfRequest` = `RequeteMoitie`, produite par `requetesDeLaMoitie`,
jamais assemblée à la main) porte UN préréglage : son rang
(`rangPrereglage` : 0 pour celui de la recherche, puis l'ordre de
`cransEmboites`, par lequel un outil de mesure repère le fil de la
recherche), son pool, son `bucketCap`,
son crédit de joker, les bornes de sets de l'autre moitié tirées de son
pool, les champs communs de `PreparedSearch`, `cransEmboites` vide, et
`combosOrderMode` repris des `SearchParams` ; `adaptiveTrancheWeighting`,
sans effet, n'y est pas relayé. Les deux moitiés sont indépendantes :
chacune ne lit que des bornes calculées par la préparation, jamais l'autre
moitié construite.

Chaque Worker enfant pilote le générateur `construireMoitieTypee`
(`src/lib/rechercheRunes.ts`) jusqu'au bout, poste sa progression au plus
une fois par palier de temps, puis un dernier point de passage garanti, puis
ses compartiments (`CompartimentType[]`), dont les tampons sont transférés.
Le Worker de recherche fait l'union des
rétentions de chaque moitié (`UnionDesRetentionsTypees`) dans l'ORDRE des
préréglages, du préréglage de la recherche au plus étroit, quel que soit
l'ordre d'arrivée des Workers : il rend exactement ce que `construireMoitieTypee`
rend d'un bloc, préréglage après préréglage, dans un seul fil
(`tests/retention-emboitee.test.ts`). Pourquoi des Workers séparés plutôt
qu'une seule passe qui remplirait la liste de chaque préréglage :
[elagages.md § Préréglages emboîtés](elagages.md#préréglages-emboîtés).

La progression d'une moitié est UN compte, `scanned` sur `total` : la somme
de ce qu'ont parcouru ses Workers (les runes du premier emplacement de leur
pool), sur la somme de leurs totaux (`totalConstruction` ; une même rune
compte une fois par préréglage). À Moyen, `total` vaut donc les runes du
premier emplacement de Moyen plus celles de Bas ; à Bas, celles de Bas
seules. Le Worker de recherche relaie chaque somme sans palier
supplémentaire (`phase: 'building'`), et le hook garde la progression des
deux moitiés séparément (`halves.A`, `halves.B`). Le compte ne recule jamais
et finit à `total`. Ce n'est pas une mesure du travail : une rune d'un
préréglage plus étroit coûte moins (ses deux autres emplacements sont plus
petits), et ses Workers finissent avant celui du préréglage de la recherche.

Hors Worker, `construireMoitieTypee` fait le
même travail d'un bloc : le préréglage de la recherche, puis chaque
préréglage plus étroit, et l'union au fil de l'eau ; le compte de sa
progression enchaîne les préréglages dans cet ordre. Sans préréglage plus
étroit (Bas), le résultat et les points de passage sont ceux du préréglage
seul. Détail :
[elagages.md § Préréglages emboîtés](elagages.md#préréglages-emboîtés).

La construction énumère les combinaisons des trois emplacements de la moitié
et les range en compartiments, par le compte exact de pièces de chaque set
demandé et le nombre de jokers (`bucketKeyOf`). Elle coupe une branche qui
porterait deux jokers ou qui ne peut plus compléter un set demandé
(`stillFeasible`), retient les combinaisons dans plusieurs tas en parallèle
(`heapPush`), bornés à partir de `bucketCap`, et rend les compartiments triés
par potentiel décroissant ; `combosOrderMode` ordonne les combinaisons à
l'intérieur d'un compartiment. Détail :
[elagages.md § Pré-filtrage heuristique et compartiments](elagages.md).

`construireMoitieTypee` confie la construction de chaque préréglage à un noyau
sur tableaux typés, `construireMoitieRapideTypee` (`src/lib/constructionRapide.ts`),
qui rend exactement les compartiments de `buildBuckets`, la référence :

- aucune allocation par combinaison : les sommes de chaque triplet vont dans
  un tampon, son compartiment est un entier (comptes en base 4, jokers en
  tête), une entrée de tas un couple (score, code du triplet) ; les
  triplets restés dans les tas sont dédupliqués dans le même ordre, puis
  écrits directement dans les colonnes de `ColonnesCombos`
  (`src/lib/demiBuildsTypes.ts`) : trois identifiants, pourcentages et
  valeurs plates des stats suivies, score générique, tous en `Float64Array`.
  Aucun `HalfCombo` entre la construction et l'appariement de l'écran ;
- mêmes nombres au bit près : mêmes expressions dans le même ordre
  (`p0 + p1 + p2`, `ceil(b × pct / 100) + flat`, la tranche combinée sommée
  minimum par minimum) ; même tas, comparaison par comparaison et échange
  par échange, donc mêmes ex æquo et même ordre final ;
- le code d'un triplet, `(idx0 × n1 + idx1) × n2 + idx2`, croît dans l'ordre
  d'énumération de `buildBuckets` : il donne l'ordre de création des
  compartiments et celui des clés de `maxPct`/`maxFlat` ;
- le même point de passage, une fois par rune du premier emplacement.

L'union conserve aussi des colonnes : elle copie seulement les lignes
manquantes des crans plus étroits, puis trie les indices par
`ordonnerCombos`, le tri stable partagé avec la référence objet. Comptes,
jokers, bornes et potentiel restent des métadonnées par compartiment.
`Float64` préserve les entrées fractionnaires ; les codes des triplets
passent d'`Int32` à `Float64` au-delà de 2³¹ − 1, les capacités des tas ne
sont pas tronquées en entiers 32 bits. La comparaison de capacité garde
la sémantique de `heapPush`, y compris pour un override fractionnaire,
négatif ou infini.

La référence objet reste disponible à l'outillage : `construireMoitie`
(CLI), `construireMoitieRapide` et
`objetsDesCompartiments` matérialisent les objets quand leur consommateur
en a besoin. `motifRepliConstruction` garde les replis de cette API objet
vers `buildBuckets` (traceur, codes ou capacités hors Int32). Un traceur
de diagnostic demande cette référence, jamais le chemin de l'écran.
`searchBuildsSteps` construit directement les deux moitiés en colonnes.
Le harnais suit le même chemin : `construireMoitiesEnParallele` orchestre
`construireMoitiesEmboiteesTypees` ; chaque fil Node appelle
`construireMoitieTypee` et transfère les tampons des colonnes. Les outils
qui lisent encore les runes des `HalfCombo` passent explicitement par
`construireMoitiesObjetsEnParallele`. Les diagnostics `--suivre` adaptent
seulement les moitiés suivies, hors des chronos de phase ; le traceur séquentiel
garde son adaptation objet à l'entrée de `pairBuckets`.

Un arrêt pendant cette phase termine tous les Workers enfants de construction
(`terminate()`) et rejette l'attente (`stopBuildReject`) : la recherche rend
un résultat vide, tronqué, aucune paire n'ayant encore été examinée. Une
erreur d'un Worker enfant suit le même chemin : résultat vide tronqué, pas le
statut `error`.

## Choix du régime

Les deux moitiés construites, le Worker compte une seule fois l'espace exact
à parcourir, `compterPaires(prepared, bucketsA, bucketsB)` : le nombre de
paires que l'appariement examinera s'il va au bout, avec les mêmes tests de
paire de compartiments et de combinaison A que `pairBuckets`
(`satisfiesSets`, jokers, `bucketPairFeasibleMin`, `comboAFeasible`).
⚠️ Ce compte, `totalPairCount` sur la référence objet et l'appariement
doivent rester égaux : leurs prédicats sont partagés, et le différentiel
`tests/construction-colonnes.test.ts` compare leurs comptes.

Ce total sert de dénominateur à la progression et décide du régime, avec le
contrat numérique du noyau (`verifierContrat`) : `regimeAppariement`
(`src/workers/parallelPairing.ts`) rend le séquentiel, dans ce Worker, sous
`PARALLEL_PAIRING_THRESHOLD` ou hors contrat ; le parallèle à partir du
seuil, sur `nombreDeTravailleurs(navigator.hardwareConcurrency,
coeursPhysiques)` Workers (cœurs physiques moins deux ; les cœurs viennent
de la demande, lus par l'application de bureau, `null` sur le site où ils
se déduisent des fils logiques).
Détail du régime parallèle et de la règle du nombre de Workers :
[parallelisation.md § Choix du régime](parallelisation.md).

## Appariement séquentiel

La collecte du Worker écrit directement les six identifiants, huit totaux et
l'efficience en colonnes Float64, selon le schéma de `candidatsCompacts.ts`.
La validation typée partage son expression des totaux avec `lignes` ; le
repli objet n'en garde qu'un candidat temporaire. Les quasi-succès restent
des objets. Les outils gardent les colonnes jusqu'au scellement ; leurs
objets de sortie servent au classement et au différentiel.

Les blocs scellés portent des ordinaux contigus et sont transférés une seule
fois. Leurs quinze colonnes sont ajustées à la longueur écrite avant de
quitter le collecteur : exactement `15 × 8 × longueur` octets de tampons,
même pour un bloc d'une ligne ou coupé à la fusion. Une sous-vue d'un tampon
plus grand ne respecte pas ce contrat et le récepteur la refuse. Le bilan
final scelle leur nombre sans réémettre l'aperçu. La page
matérialise les 3 000 premières lignes pour l'aperçu, puis les suivantes à la
fin, en réutilisant les objets déjà publiés. Les autres blocs attendent en
colonnes et sont libérés à leur adaptation ; aucun écran ne change de contrat.
L'API synchrone `apparier` conserve aussi les colonnes entre ses points de
passage et ne projette ses objets qu'à son retour.

`lancerAppariement` (`src/workers/pairingDriver.ts`) est le lanceur de
l'écran et des outils Node. En séquentiel, `drivePairing` pilote pas à pas le
générateur `apparierRapide` avec sa sortie en colonnes. `EmetteurCandidats`
transfère les blocs dans l'ordre, avec une fenêtre de seize blocs non
acquittés au plus. Il attend la page seulement à saturation de cette
fenêtre ; le scellement attend tous les acquittements avant le bilan final.
Le pilote vide aussi les blocs dès que deux sont prêts, sans attendre le
palier de progression. Il rend la main à la boucle d'événements (`cederLaMain` : message de
canal, non bridé) au plus une fois par `YIELD_THROTTLE_MS`, ce qui laisse arriver le message d'arrêt ; à l'arrêt
(`isStopped`), il rend un résultat tronqué fait des candidats et du
quasi-succès déjà accumulés. Les messages de progression portent `found`,
`totalPairs` et un pourcentage (`estimatePct`), espacés au plus par
`PROGRESS_THROTTLE_MS` sauf vidage des blocs. `RecepteurCandidats` garde les
blocs reçus, les contrôle et matérialise l'aperçu dans la limite de
`PREVIEW_CANDIDATES_CAP`, dont le tableau reste stable une fois plein.
Barre et pourcentage : [02-app/optimizer/feat-interruption.md § Barre de progression](../../../02-app/optimizer/feat-interruption.md#barre-de-progression).

`apparier` confie l'appariement au noyau sur tableaux typés,
`apparierRapide` (`src/lib/appariementRapide.ts`), qui rend exactement le
résultat de `pairBuckets` (`src/lib/runeBuildOptim.ts`), la référence ; hors
contrat numérique, `apparierSansSauts` parcourt les colonnes sans saut,
avec les expressions et points de passage de la référence. Avec un traceur,
`pairBuckets` lui-même
(détail du noyau : [noyau-appariement.md § Trois sauts](noyau-appariement.md#trois-sauts)).
L'un et l'autre parcourent toutes les paires de compartiments, par potentiel
combiné décroissant (`orderedCompartmentPairs`). Pour chaque paire de
compartiments : sets satisfaisables d'après les comptes agrégés
(`satisfiesSets`), au plus un joker pour les deux, borne optimiste des
minimums (`bucketPairFeasibleMin`). Pour chaque combinaison A :
`comboAFeasible`. Pour chaque combinaison B, la paire compte comme TRAITÉE
(`explored`) : `pairBuckets` la juge une à une ; le noyau saute sans les
juger les paires qui échoueraient sûrement au test rapide (1 ci-dessous) et
visite les autres dans le même ordre. Un point de passage tombe toutes les
`CHECKPOINT_EVERY` paires traitées, sautées comprises, et le filet de temps
est testé (`maxMs`, couru depuis `prepared.startedAt`, construction des
moitiés comprise) à chaque point de passage.

Une paire visitée passe ensuite :

1. un test rapide des minimums et maximums sur les pourcentages et valeurs
   fixes cumulés par moitié, plus les apports maximaux (minimums) ou
   incompressibles (maximums) des sets, de la relique et des artéfacts ;
2. la revérification des sets sur les six vraies runes (`activeSets`,
   `missingSets`) ;
3. le calcul de la fiche (`computeStats`), sans la relique en mode
   `recherche` ; en ce mode, une fiche de plus par relique représentative
   (`fichesDuTestConjoint`) ;
4. le test conjoint : la paire est retenue si UN apport d'artéfacts
   réellement atteignable (`artPossibles`, ou la paire figée à défaut) et,
   en mode `recherche`, UNE relique représentative lui font tenir toutes
   les conditions à la fois
   ([reliques.md § Contexte transporté, bornes relâchées, filtre exact](reliques.md)).
   Une tentative qui échoue alimente le quasi-succès
   (`nearMissByCondition`, `globalNearMiss`).

Le calcul de distance se coupe seulement quand ni le quasi-succès par
condition ni le global ne peuvent s'améliorer ;
[noyau-appariement.md](noyau-appariement.md) précise cette règle.

La collecte s'arrête au plafond `maxCollected`. Trois arrêts seulement : le
temps, le plafond de candidats, l'épuisement de l'espace ; aucun plafond de
paires. Le résultat (`SearchResult`) porte les candidats dans l'ordre de
leur découverte, `explored`, `truncated`, le quasi-succès, et la trace de
diagnostic si elle a été demandée (`traceur`). Détail des tests :
[elagages.md § Élagage sûr — faisabilité](elagages.md) et
[elagages.md § Faisabilité de set, groupage par compte et jokers](elagages.md).

## Appariement parallèle

À partir du seuil, contrat tenu, `apparierRapideEnParallele`
(`src/lib/appariementRapideParallele.ts`) découpe l'espace en morceaux de
lignes consécutives, dans l'ordre de `pairBuckets`, et les distribue à la
demande à ses Workers (`lancerTravailleurNavigateur`, coquille
`src/workers/appariementRapide.worker.ts`). Chaque Worker reçoit une fois
les paramètres, l'instant de départ global et sa copie des compartiments sur
tableaux typés, transférée ; il y refait la préparation (`prepareSearch` :
une `PreparedSearch` porte des fonctions et ne traverse pas `postMessage`),
remplace son `startedAt` par l'instant global, puis apparie chaque morceau
reçu par le noyau (`parcourirMorceau`, piloté par tranches par
`servirAppariement`).

Les résultats se fusionnent dans l'ORDRE des morceaux : le parallèle rend le
résultat du séquentiel, plafond de candidats global compris, à la seule
différence d'une recherche coupée par le temps ou arrêtée. La progression
compte les paires traitées et les candidats des morceaux déjà fusionnés,
comme le résultat. Un arrêt cesse de distribuer, arrête chaque Worker à sa
ligne suivante et rend tout ce qui a été trouvé ;
une erreur d'un Worker est rattrapée : tous les Workers terminés, erreur
journalisée, et ce qui a été fusionné avant elle rendu, tronqué. Détail : [parallelisation.md § Répartition et partage du plafond](parallelisation.md),
[parallelisation.md § Fusion des résultats](parallelisation.md) et
[parallelisation.md § Arrêt, erreur et nettoyage](parallelisation.md).

## Fin de l'appariement

Le Worker transfère les derniers blocs, attend leur acquittement, puis poste
le bilan (`type: 'result'`, nombre, comptes, quasi-succès, troncature), sans
candidats. Le hook scelle le nombre reçu, adapte les lignes restantes en
objets, libère les colonnes, enregistre le résultat, efface la progression
et passe en `done`. Les objets d'aperçu gardent leur identité. Une plage
manquante, répétée ou hors schéma est refusée par le récepteur.
Ce refus est journalisé, passe le hook en `error` et termine le Worker avec
ses enfants ; toute réponse tardive est invalidée. Un rejet de publication
finale dans le Worker principal poste un message `error` par la garde de
messagerie, qui couvre aussi les appels depuis les chemins de repli.

Le même enchaînement existe hors Worker : `searchBuildsSteps`
(`src/lib/rechercheRunes.ts`, à part de `runeBuildOptim.ts` pour qu'aucun
import n'y fasse de cycle) appelle
`prepareSearch`, `construireMoitieTypee` pour A puis pour B dans le même fil, puis
`apparier` ; `searchBuilds` le draine en un appel, sans Worker ni
appariement parallèle. Des tests l'utilisent. Le CLI (`runSearchToCompletion`,
asynchrone) et le harnais construisent les moitiés typées dans leurs Workers
Node, choisissent le régime avec les règles de l'écran, puis passent par
`apparierNode` et `lancerAppariement` : mêmes crédits et distribution
compacte, objets seulement après scellement. Un traceur séquentiel reste
l'instrument explicite de l'oracle objet.
Des scripts de diagnostic appellent `buildBuckets` et `pairBuckets`
directement : ils mesurent la référence, pas la production.

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

- hors mode `recherche`, la relique portée est fixe : la paire retenue est
  la première, par score décroissant, qui tient les conditions
  (`respecteConditions`, nul quand `conditionsPaireFixePosees` ne trouve
  aucune condition à tester) ; si aucune ne les tient, `conforme: false` ;
- en mode `recherche`, chaque relique éligible du contexte (`eligibles`)
  remplace la portée ; pour chacune, le premier couple, par score
  décroissant, qui tient minimums et maximums
  (`respecteConditionsAvecRelique`) est retenu avec son score, et
  `bestRelicForBuild` (`src/lib/relicOptim.ts`) choisit le meilleur couple
  faisable entre reliques. Aucun couple faisable : `conforme: false`. Un pool
  d'éligibles vide lève `RechercheRefusee`.

Ce point d'entrée passe par la résolution rapide (`src/lib/resolutionRapide.ts`),
qui juge la faisabilité d'une paire sur ses principales avant de la noter :
une relique dont aucune forme de paire n'est faisable n'est pas notée, et
seules les paires faisables le sont. Pour un build conforme, le résultat est
celui du calcul exhaustif (`resoudreEquipementDuBuildExhaustif`,
`src/lib/resolutionExhaustive.ts`), qui note toutes les paires ; un build
rejeté ne porte ni paire ni relique, son diagnostic ne se calculant qu'à la
demande : [reliques.md § Résolution rapide — le chemin de l'app](reliques.md#résolution-rapide--le-chemin-de-lapp).

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
relique : [reliques.md § Résolution exacte par build, file, classement](reliques.md).

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
impossible à créer bascule la file de la même façon (`basculerEnRepli`),
l'erreur journalisée, mais sans demande à abandonner ni Worker à terminer. Détail : [parallelisation.md § Worker de résolution](parallelisation.md) et
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

Le cache de `useArtifactOptimQueue` journalise les écritures des deux voies
de résolution. Les instantanés restent des `Map`, associés à leur journal
par identité ; aucun changement de l'appel de l'écran n'est nécessaire.
`classementResolu` utilise le magasin et l'index compacts pour les publications
versionnées compatibles, et le classement complet de référence sinon.
Le tableau affiché reste complet ; sa matérialisation parcourt les références,
sans décompacter tous les candidats. Les contrôles et les notes suivent les
seules versions modifiées. Contrat, ordre exact et replis :
[optimiseur-artefacts.md](optimiseur-artefacts.md#magasin-compact-et-publications-versionnées).

`classementResolu` (`src/lib/artifactQueue.ts`) produit le classement
affiché (`affichees`), le même pour l'écran et le CLI. Il part de l'ordre de
base et retire les builds que la résolution a écartés (`conforme: false`). Il
départage à score égal par relique retenue puis `cleBuild` et lit chaque
build à travers son équipement résolu (`candidatAvecSaPaire`). L'index suit
le même ordre que `ordonnerParDepartage` puis `sortCandidates`. Un build résolu
peut donc passer devant ; un build non résolu garde ses stats d'origine.

`compositionDePage` compose une page. Ses cartes sont les seuls builds
vérifiés, résolus et conformes, dans l'ordre du classement. Les places
restantes attendent, « Vérification… », tant qu'il reste des builds non
résolus, et `aVerifier` nomme ceux qui les rempliront : la page affichée que
sert la file. `compteConfirme` donne l'en-tête, en combinaisons confirmées,
et le nombre de pages ; `compteAffichable` donne le compte de la ligne de
progression. Sans file (optimisation d'artéfacts coupée), la page est la
tranche du classement. Détail de l'écran :
[02-app/optimizer/ecran/resultats.md § Compte des combinaisons confirmées et pagination](../../../02-app/optimizer/ecran/resultats.md#compte-des-combinaisons-confirmées-et-pagination).

## Interruption

Une recherche s'arrête avant d'avoir tout examiné par le filet de temps, par
le plafond de candidats ou par l'arrêt manuel. Valeurs, réglages et
messages : [02-app/optimizer/feat-interruption.md § Interruption — filet de temps, pré-filtrage et arrêt manuel](../../../02-app/optimizer/feat-interruption.md#interruption--filet-de-temps-pré-filtrage-et-arrêt-manuel).

Le filet de temps, `maxMs` (défaut `DEFAULT_MAX_MS`), court depuis
`prepared.startedAt`. Le noyau le teste à chaque point de passage, chaque
Worker du parallèle aussi à chaque entrée de ligne, et rend alors un résultat
tronqué (`truncated`). Les points de passage comptent les paires sautées :
l'arrêt peut tomber jusqu'à `CHECKPOINT_EVERY − 1` paires plus loin qu'avec
`pairBuckets`, sur une recherche coupée par le temps seulement.
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
- appariement parallèle : le Worker appelle l'arrêt que le coordinateur lui
  a donné (`arreterAppariement`) ; plus aucun morceau ne part, chaque
  Worker reçoit l'arrêt entre deux tranches de `TRANCHE_MS` (100 ms) et rend
  son morceau en cours tel quel, et tout ce qui a été trouvé est fusionné et
  rendu, tronqué.

Dans tous les cas, le Worker poste un résultat ordinaire (`type: 'result'`)
et le hook passe en `done`. Le message affiché sous un résultat tronqué
dépend de `stoppedManually`, remis à faux à chaque lancement par
`handleSearch` : le meilleur trouvé jusque-là après un arrêt manuel, une
invitation à resserrer les critères sinon. Le résultat ne porte pas de
motif : l'écran ne lit que `truncated`.

« Arrêter » n'arrête que la recherche de runes. La file de résolution lit le
résultat posté, tronqué ou non, et continue vers `K` confirmées. `cancel`, au
démontage et par `run` avant une nouvelle recherche, termine le Worker de
recherche sans rien récupérer (§ Lancement).
