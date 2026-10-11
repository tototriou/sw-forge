# Harnais de diagnostic

**Statut :** ÉTAT ACTUEL — mode d'emploi du harnais de diagnostic de l'Optimizer et ce qu'il garantit, avec le code qui porte chaque garantie
**Lire si :** on diagnostique une recherche (une rune, un demi-build, un « 0 résultat », une configuration, un temps) ou on modifie `scripts/lib/diagnosticHarness.ts` et ses voisins
**Ne pas lire si :** on cherche seulement les règles en bref : invariants.md § Harnais
**Voir aussi :** harnais-extensions.md, harnais-scripts.md, invariants.md, verification.md, ../../02-app/optimizer/ (routage-par-tache.md)

Le harnais rejoue une recherche de l'Optimizer en Node et dit ce qu'elle a
fait : configuration appliquée, survie d'une rune étage par étage, régime,
complétude, temps par phase. Il **orchestre et observe** les fonctions de
production et ne réimplémente **aucune** étape algorithmique
(`scripts/lib/diagnosticHarness.ts:1-23`). Il remplace le script de diagnostic
ad hoc, qui reconstruit à la main des morceaux du pipeline et en dérive sans
que rien ne le signale. Ses contraintes sont résumées dans
invariants.md § Harnais ; ce fichier en est la source et dit où le code porte
chacune (`fichier:lignes`). [harnais-extensions.md](harnais-extensions.md)
décrit le reste : construction observée, build cible, différentiel.

## Les scripts du harnais

| Fichier | Rôle |
|---|---|
| `scripts/diagnostic-harness.ts` | ligne de commande mince : valide les arguments, résout la configuration, appelle le cœur, met en forme |
| `scripts/lib/diagnosticHarness.ts` | le cœur : enchaîne les phases de production et observe chacune |
| `scripts/lib/diagnosticConfig.ts` | paramètres effectifs, origine de chacun, drapeau de fidélité (palier 1) |
| `scripts/lib/diagnosticTypes.ts` | le vocabulaire, types seuls |
| `scripts/lib/randomPool.ts` | le pool synthétique à graine |
| `scripts/lib/chargerRecette.ts` | recette + export de compte vers `SearchParams`, séquence partagée avec `scripts/optimizer-search.ts` |
| `scripts/lib/buildHalvesNode.ts`, `scripts/lib/build-half-worker.ts` | les deux moitiés, sur deux `worker_threads`, par le vrai `buildBuckets` |
| `scripts/lib/spawnSliceNode.ts`, `scripts/lib/pair-slice-worker.ts` | l'appariement parallèle : coquille Node du `runPairSlice` de production |
| `scripts/lib/diagnosticLot.ts`, `scripts/lib/diagnosticProfils.ts`, `scripts/lib/diagnosticDifferentiel.ts` | modes lot (`--cas`), profils synthétiques (`--profils`, `--profil`) et différentiel entrelacé (`--differentiel`), dont l'usage est en tête du CLI (l. 31-58) |
| `scripts/diagnostic-harness-parite.ts` | parité contre l'ancienne reconstruction (voir « Validation du harnais ») |
| `scripts/monster-search-rank-diag.ts` | rang d'un demi-build dans les tranches internes de `buildBuckets`, que le harnais n'observe pas |

Le code du harnais vit dans `scripts/lib/`, jamais dans `src/lib/` : un outil
de diagnostic n'a rien à faire dans le bundle de l'app. Il ne touche la
production que par l'observateur `onStage` et par l'export de symboles que le
moteur utilisait déjà (`PER_STAT_KEEP`, `PER_STAT_KEEP_OBJECTIVE`,
`bucketCapFor`, `ALL_STAT_KEYS`, `weightedContribution` :
`src/lib/runeBuildOptim.ts`, l. 1227, 1233, 1385, 1393, 1497), réutilisés
plutôt que recopiés. Le CLI se lance par `npx tsx scripts/diagnostic-harness.ts …`,
comme `scripts/perf-battery.ts:506` se relance ; il bundle ses deux workers par
esbuild dans le dossier temporaire du système, une fois, avant toute mesure
(`scripts/lib/buildHalvesNode.ts:57-70`, `scripts/lib/spawnSliceNode.ts:27-41`).

## Lancer un diagnostic

Usage, d'après l'en-tête du CLI (`scripts/diagnostic-harness.ts:21-84`) :

```
diagnostic-harness.ts --compte=<export.json> --recette=<recipe.json>
                      [--rta | --siege=<deckId>[:defense]]
diagnostic-harness.ts --synthetique --seed=42 --runes=20 --cap=80
                      [--sets=violent,will] [--min=spd:130,cr:40] [--max=res:60]
                      [--assortiment=joker|sans-joker|varies] [--verrous=<slot:runeId,…>]
Options communes :
  --apercu            palier 1 seulement — n'exécute RIEN
  --arret=<étape>     mainstat | dominance | feasibility | filterslot
                      | demi-builds | appariement | classement (défaut)
  --suivre=<id,…>     suit ces runes d'étage en étage
  --blocages          cherche, par condition, DE COMBIEN la desserrer suffit
  --repetitions=<n>   répétitions de la mesure de temps (défaut 1)
  --json              résultat brut, sans mise en forme
Overrides (chacun MARQUE le run comme divergent de la prod) :
  --slotFilterCap=<n> --bucketCap=<n> --maxCollected=<n> --maxMs=<n>
  --regime=sequentiel|parallele --combos=potential|relevance|combined|objective
```

Chaque argument passe par un lecteur typé et borné : une valeur inconnue, un
entier hors borne ou un identifiant illisible est refusé avec ce qui était
attendu, jamais remplacé par un repli (`scripts/diagnostic-harness.ts:123-198`).

## Deux sources : une recette ou un pool synthétique

Une recette répond à « pourquoi ce cas de mon compte donne-t-il ça ? »
(fidélité maximale, chemin de prod complet) ; un pool synthétique, à « quel
comportement produit ce mécanisme, de façon reproductible ? » (pool forcé). La
provenance figure toujours dans le résultat (`source`, `descriptionSource`,
`scripts/lib/diagnosticHarness.ts:257-262`). La **recette** est le format
qu'exporte l'écran (`parseOptimizerRecipe`, `src/lib/optimizerRecipe.ts:468`),
chargé par `chargerRecette` (`scripts/lib/chargerRecette.ts:1-20`, `:65`), la
séquence de `scripts/optimizer-search.ts` mise en commun : repli d'un objectif
retiré, chargeur box, RTA ou siège, contrôle du `com2usId`, données
d'exclusion chargées seulement si la recette en déclare, puis
`recipeToSearchParams` (`scripts/lib/recipeToSearchParams.ts:487`), qui résout
`artifactBounds` et `objectiveStats` comme l'écran. Elle n'imprime rien : elle
rend des avertissements. Le **pool synthétique** vient de
`randomPool(mulberry32(seed), runes, sets)` sur la base de monstre fixe des
tests et benchmarks (`scripts/lib/diagnosticConfig.ts:55-60`, `:114-137`) ;
assortiments `SETS_JOKER` (défaut), `SETS_SANS_JOKER`, `SETS_VARIES`
(`scripts/lib/randomPool.ts:79-85`). `--verrous` reproduit sans compte réel une
rune imposée. Ce pool n'est pas réaliste (sous-stats tirées uniformément) : une
question qui dépend du réalisme des runes se pose sur un compte réel
(`scripts/lib/randomPool.ts:27-32`).

La séquence de tirage de `randomPool` est un contrat : intervertir deux tirages
décale tout le pool sans qu'un test de moteur échoue lisiblement, d'où les
empreintes de `tests/random-pool.test.ts`, relevées sur le code d'avant la
mise en commun (`scripts/lib/randomPool.ts:17-25`). Les générateurs
volontairement biaisés (quatre fichiers, `scripts/lib/randomPool.ts:34-42`) ne
passent pas par ce module : leur biais est le sujet de ce qu'ils mesurent, les
migrer changerait leurs pools.

## Les phases et les points d'arrêt

La séquence est celle de `src/workers/runeBuildOptim.worker.ts`
(`scripts/lib/diagnosticHarness.ts:4-8`, `:987-1075`) :

| Phase | Fonctions de production | Ce que le harnais observe |
|---|---|---|
| **A — Préparation** | `prepareSearch` : principale → `pruneDominated` → `eliminateInfeasible` → `filterSlot` | 4 étages via `onStage`, puis le `PreparedSearch` |
| **B — Demi-builds** | `buildBuckets` pour A et pour B, en parallèle | compartiments, demi-builds, `totalPairCount` |
| **C — Appariement** | `pairBuckets` en séquentiel, ou `driveParallelPairing` | `SearchResult`, complétude |
| **D — Classement** | `sortCandidates` | candidats classés |

`--arret` désigne une phase, ou un étage de la phase A. S'arrêter à un étage
ne coupe pas `prepareSearch` : la préparation tourne entière, la restitution
s'arrête à cet étage, et rien de la construction, où est le vrai coût, n'est
lancé (`scripts/lib/diagnosticTypes.ts:85-93`). Le point d'arrêt naturel pour
relire avant de payer est entre préparation et construction. Un arrêt avant
l'appariement ne rend aucun verdict de complétude
(`tests/diagnostic-harness.test.ts:145-156`). Il n'y a pas de point de
reprise : reprendre au milieu exigerait un instantané réinjectable,
fonctionnalité distincte d'un point d'arrêt et non son inverse.

## Classement : toujours par sortCandidates

`SearchResult.candidates` sort dans l'ordre de COLLECTE : `candidates[0]`
n'est pas le meilleur build. Le harnais classe la liste ENTIÈRE par
`sortCandidates` avec `optionsDeClassement`, le producteur de l'écran et du
CLI (`scripts/lib/diagnosticHarness.ts:2016-2048`). En « Dégâts réels », il
construit le contexte de dégâts comme le CLI (`buildRealDamageContext`) ; sans
lui, `sortCandidates` laisse l'ordre de collecte sans lever
(`tests/diagnostic-harness.test.ts:1039-1069`). Le total affiché vient de
`candidateMetricTotal`, recalculé depuis les vraies runes dans la métrique
courante, jamais de `effTotal`, figé à la recherche. Le rang d'un build se
prend sur la liste entière ; la coupe aux 20 premiers (`TAILLE_TOP_RENDU`,
`scripts/lib/diagnosticHarness.ts:1995-2001`) n'est que celle de l'affichage.

## L'observateur onStage

`prepareSearch` réassigne son tableau par emplacement à chaque étage, et seul
le dernier état sort dans `PreparedSearch`. Pour distinguer une rune PROUVÉE
impossible d'une rune seulement écartée par le pré-filtrage, un outil devrait
sinon rappeler les fonctions une par une — un second pipeline. D'où
`onStage?: (stage: PrepareStage, bySlot: RuneDetail[][]) => void`
(`src/lib/runeBuildOptim.ts:3928-3951`) :

- SECOND argument de `prepareSearch`, pas champ de `SearchParams` : ce type
  traverse `postMessage`, où une fonction n'est pas sérialisable (`:3953-3969`) ;
- appelé après chacun des quatre étages, dans l'ordre (`:4037-4049`) ;
- `PrepareStage` est une union FERMÉE, jamais un `string` : une faute de
  frappe échoue à la compilation (`:3917-3926`) ;
- il reçoit la référence réelle de l'étage suivant et ne la mute jamais ;
- omis, comportement strictement inchangé : quatre tests de branche par appel,
  y compris dans `pairSlice.worker.ts`, qui rappelle `prepareSearch`.

`tests/rune-optim-onstage.test.ts:118-190` vérifie un `PreparedSearch`
identique avec et sans observateur, les quatre étages signalés dans l'ordre
(même quand la préparation échoue), et qu'un étage ne fait que retirer, sans
déplacer de rune. Le harnais y branche `releverPreparation`
(`scripts/lib/diagnosticHarness.ts:743-760`) : identifiants et tailles par étage.

## Le palier 1 : configuration effective et fidélité

Le palier 1 est instantané : `resoudreConfig`
(`scripts/lib/diagnosticConfig.ts:86-229`) calcule la configuration sans rien
exécuter, le CLI l'imprime toujours en premier, et `--apercu` s'arrête là
(`scripts/diagnostic-harness.ts:1040-1058`). Elle est résolue UNE fois : le run
exécute celle que le palier 1 a décrite, sans relire recette ni export
(`scripts/lib/diagnosticHarness.ts:188-218`).

**Chaque paramètre effectif affiche son origine** : `recette`,
`config synthétique`, `défaut moteur`, `DÉRIVÉ de <param>`, `OVERRIDE`,
`recette (non surchargeable)` (`scripts/lib/diagnosticTypes.ts:147-167`). La
table couvre la surface d'override et les paramètres effectifs non
surchargeables : objectif et stats d'objectif, `adaptiveTrancheWeighting`,
métrique, recherche exhaustive, composition du pool, verrous, artéfacts,
bornes d'artéfact, relique, contexte relique, exclusions
(`scripts/lib/diagnosticConfig.ts:260-319`).

**La recette reste la vérité prod** : les overrides vivent dans une section
distincte de la configuration (`overrides`), jamais fondus dans la recette.
Chaque paramètre porte la valeur qu'aurait la production ; dès qu'un seul
diffère, le run est marqué « FIDÉLITÉ DES PARAMÈTRES SUIVIS : DIVERGE DE LA
PROD » et chaque écart nommé (`bucketCap = 500  (prod : 6000)`), sinon
« conforme à la production pour ce cas »
(`scripts/lib/diagnosticConfig.ts:334-353`, `:378-395`). Suit, dans les deux
cas, ce que la comparaison ne prouve pas : composition du pool (affichée,
jamais comparée), paramètre absent de la table, coquille Node contre
navigateur. La marque fait partie du résultat (`fidelite`), donc de `--json` :
un nombre du harnais détaché de son contexte ne peut pas passer pour « ce que
fait la prod » (`tests/diagnostic-harness.test.ts:88-143`).

## Les overrides et leurs deux pièges

La surface d'override est ce que la recette ne porte pas — `bucketCap`,
`maxCollected`, `maxMs`, `combosOrderMode`, le régime — plus `slotFilterCap`,
que la recette porte en préréglage (`scripts/lib/diagnosticTypes.ts:53-81`).

**Aucun plafond de paires.** Le moteur n'en a plus ; un harnais qui en
rétablirait un mesurerait une recherche tronquée que la production ne fait
pas. `maxMs` est la seule borne qui puisse tronquer, et le premier paramètre à
vérifier : 15 s par défaut moteur (`DEFAULT_MAX_MS`,
`src/lib/runeBuildOptim.ts:1196`), 10 min à l'écran (`HARD_TIMEOUT_MS`,
`src/components/outils/OptimizerSection.tsx:864`), sans limite en recherche
exhaustive. En synthétique sans `maxMs`, le harnais applique les 10 min de
l'écran et le dit (`scripts/lib/diagnosticConfig.ts:138-148`).

**Piège A — la cascade.** Sans override, `bucketCap` est DÉRIVÉ :
`bucketCapFor(slotFilterCap)` = `round(BUCKET_CAP × slotFilterCap /
MAX_PER_SLOT_MATCH)` (`src/lib/runeBuildOptim.ts:1377-1387`). Surcharger
`slotFilterCap` déplace aussi `bucketCap` ; la table l'annonce « DÉRIVÉ de
slotFilterCap » (`scripts/lib/diagnosticConfig.ts:166-177`,
`tests/diagnostic-harness.test.ts:72-86`).

**Piège B — le défaut du moteur n'est pas celui de la production.** Un run qui
omet `slotFilterCap` prend 40 (`MAX_PER_SLOT_MATCH`) et 3000 de `bucketCap` ;
la production, au préréglage « Moyen » de l'écran, 80 et 6000
(`src/lib/runeBuildOptim.ts:609-630`) : la moitié de la rétention sur les deux
axes, en silence. En mode recette, le préréglage de la recette fait foi ; en
synthétique, le harnais EXIGE `--cap` (sans défaut) et refuse le run sans lui
(`scripts/lib/diagnosticConfig.ts:116-124`, `scripts/diagnostic-harness.ts:384-397`,
`tests/diagnostic-harness.test.ts:54-70`). Ce piège est un défaut du MOTEUR, et
sa correction naïve (`MAX_PER_SLOT_MATCH = 80`) casserait la production : la
même constante est l'ancre de `bucketCapFor`
(`src/lib/runeBuildOptim.ts:1366-1377`), dont le résultat tomberait de 6000 à
3000. Le défaut de `filterSlot` et l'ancre de `bucketCapFor` sont deux
changements séparables.

## Suivi d'une rune, étage par étage

`--suivre=<id,…>` rend la présence de chaque rune à chaque étage et sa
PREMIÈRE disparition, avec la nature de l'étage et ce qu'elle signifie
(`suivrePiece`, `scripts/lib/diagnosticHarness.ts:1880-1894` ; natures,
`:113-135`) :

| Étage | Nature | Ce qu'une disparition signifie |
|---|---|---|
| `mainstat` | contrainte | la rune ne peut pas porter la principale imposée |
| `dominance`, `feasibility` | sûr | PROUVÉ : ne peut entrer dans aucun build valide |
| `filterslot` | mixte | ambigu : `filterSlot` élague sûrement en tête (« combo à coût complet ») ET retient heuristiquement (top-K) |

Une disparition au pré-filtrage est donc annoncée AMBIGUË, jamais comme un
verdict sur l'utilité de la rune ; un identifiant absent du pool est dit
absent au départ, jamais « éliminé au premier étage »
(`tests/diagnostic-harness.test.ts:459-495`). Sur la même option :

- une rune qui atteint l'entrée réelle de `filterSlot` (sortie de
  `feasibility`, lue par `onStage`) reçoit son rang exact sur `relevance()` et
  par stat, avec les budgets `PER_STAT_KEEP`/`PER_STAT_KEEP_OBJECTIVE`
  (`detailFiltrage`, `scripts/lib/diagnosticHarness.ts:1269-1317`) ;
- les 3 identifiants d'une même moitié (emplacements 1-3 ou 4-6) donnent le
  rang du demi-build dans son compartiment et ses voisins (`:347-360`,
  `:1325-1355`) ;
- les 6 identifiants d'un build donnent son admissibilité et un verdict
  structuré (usage en tête du CLI).

Le résultat rend aussi les bornes appliquées par l'étage de faisabilité
(`bornesFaisabilite`, `:1250-1267`) : sans elles, « aucune rune éliminée » ne
se distingue pas de « la borne attendue n'est pas active ».

## Étendre le suivi aux artéfacts et aux reliques

`suivrePiece` est générique sur une population, des étages nommés et un
identifiant ; seules les runes y sont branchées. Qui l'étend :

- ne recopie pas les étages des runes : un artéfact ou une relique a les siens ;
- traite un `ArtifactDetail.id ≤ 0` comme « pas une vraie pièce » : la sonde
  d'`analyserPertinence` fabrique des artéfacts d'identifiant 0
  (`src/lib/artifactOptim.ts:324-330`) ; `RelicDetail.id` existe
  (`src/types.ts:228-233`) ;
- rend l'état AMBIGU : un artéfact portant un effet dont on ignore le sens
  n'est jamais élagué par dominance (`Pertinence.ambigus`,
  `src/lib/artifactOptim.ts:311-320`) — survivre parce qu'ambigu n'est pas
  survivre parce que bon ;
- rend, avec une élimination par dominance, les dimensions comparées, qui
  suivent le réglage (`croissants`, même interface), jamais une table figée ;
- sait qu'une pièce peut survivre à tous les filtres et n'entrer dans aucune
  combinaison retenue (voir « Limite : la rétention interne de buildBuckets »).

## Complétude : jamais un « 0 candidat » nu

Après l'appariement, `evaluerCompletude`
(`scripts/lib/diagnosticHarness.ts:1834-1868`) rend `complet`,
`incomplet — raison : maxMs | maxCollected | quotaTranche`, ou
`INCOHÉRENT — incomplet, motif NON déductible`.

- **Trois motifs seulement** (`MotifTroncature`, `src/lib/runeBuildOptim.ts:503`) ;
  `quotaTranche`, en parallèle seulement, est une tranche arrêtée sur sa part
  du plafond alors qu'il restait des paires.
- **Le motif se LIT quand le résultat le porte** : `combineParallelPairingResults`
  (`src/lib/runeBuildOptim.ts:4501`) le pose sur le résultat fusionné (ordre
  fixe : plafond global, temps, quota de tranche), avec le `totalPairs` que le
  harnais a calculé pour choisir le régime et transmis à `driveParallelPairing`
  (`scripts/lib/diagnosticHarness.ts:1103-1117`). Sinon, en séquentiel, il se
  DÉDUIT : `pairBuckets` teste le temps AVANT de pousser un candidat et le
  plafond APRÈS ; tronquée au plafond atteint, c'est le plafond, sinon le temps.
- **Autodiagnostic** : `totalPairCount` est la borne exacte de l'espace (égale
  à `explored` sans troncature, vérifié par `tests/rune-optim-differential.test.ts`).
  Le harnais affiche toujours `explored / totalPairs` ; un run annoncé complet
  qui n'a pas tout exploré sort INCOHÉRENT, sans motif inventé — jamais
  `complet` avec une incohérence. Ne pas remplacer `complet` par un statut
  à plusieurs valeurs : l'API testée changerait de type pour ce que dit déjà `incoherence`.
- **Une configuration invalide n'est pas un verdict.** Un emplacement vide
  fait rendre `null` à `prepareSearch` : le harnais dit « préparation
  impossible » et nomme la cause lue dans le verrou et le pool
  (`scripts/lib/diagnosticHarness.ts:1208-1248`) — rune imposée absente du pool,
  rune imposée à un autre emplacement (un verrou ne déplace pas une rune, il
  vide l'emplacement), sinon l'étage qui a vidé l'emplacement. Tests :
  `tests/diagnostic-harness.test.ts:372-457` et `:571-605`.

## Faisabilité et blocages

Le harnais appelle `diagnoseFeasibility` et `rankBlockingConditions` en
gardant leur sémantique (`scripts/lib/diagnosticHarness.ts:1144-1196`) :

- les **preuves** (`diagnoseFeasibility`, une passe) sont toujours calculées
  et rendues : `satisfiable: false` PROUVE l'impossibilité sur une stat isolée ;
  `satisfiable: true` veut dire « rien ne prouve l'impossibilité », pas « un
  build existe » — les contraintes prises ensemble peuvent rester infaisables,
  et la sortie le dit ;
- les **blocages** (`rankBlockingConditions`) sont un INDICE : pour chaque
  condition, de combien la desserrer pour que le pré-filtrage laisse passer
  plus. Coûteux (une dichotomie par condition), ils ne sont calculés que sur
  `--blocages`, ou d'office quand la configuration n'a aucune issue ou que la
  recherche ne rend rien (`:289-294`, `:434-442`), leur coût rendu avec eux.

Deux fonctions séparées (`evaluerFaisabilite`, `evaluerBlocages`), hors des
chronomètres de phase (`tests/diagnostic-harness.test.ts:537-569`).

## Temps par phase

Le budget `maxMs` court depuis `startedAt`, construction des demi-builds
comprise : le harnais mesure donc `preparation`, `demiBuilds`, `appariement`
et `total`, jamais le seul appariement présenté comme durée du run
(`agregerTemps`, `scripts/lib/diagnosticHarness.ts:1958-1989`). `demiBuilds`
est le temps réel de la phase ; `demiBuildA` et `demiBuildB`, à côté, le coût
de chaque fil — paralléliser ne fait jamais mieux que la moitié la plus lourde.
Seules les phases qui ont tourné sont rendues, jamais à 0 ms. La fenêtre
`preparation` enclot l'observateur du harnais, absent en production ; son coût,
mesuré, est imprimé avec la série (`:1929-1956`). Bundling, faisabilité et
blocages restent hors des chronomètres (`tests/diagnostic-harness.test.ts:158-193`).

## Séries de temps et comparaison

Aucun temps n'est livré nu : chaque phase est une série de N répétitions
(`serie`, `scripts/lib/diagnosticHarness.ts:1900-1916`) — le MINIMUM (une
interférence ne peut qu'ajouter du temps), la médiane, la dispersion
`(max − min) / min`. Une mesure à une seule répétition porte « aucune
conclusion comparative permise » ; `--repetitions` règle N.

Toute sortie de temps porte l'avertissement de comparaison (`:1979-1987`) :
deux runs séparés puis soustraits forment un protocole en BLOCS, dont le biais
de position (échauffement, ramasse-miettes, fréquence) se reproduit et
ressemble à un résultat ; ne jamais conclure sur un écart plus petit que la
dispersion. Pour comparer deux conditions, entrelacer les répétitions (témoin,
A, B, témoin, A, B…), jamais les grouper : `scripts/perf-battery-compare.ts`
le fait sur la batterie de cas, `--differentiel` sur un profil synthétique.
Toute mesure suit le skill `optimizer-perf-testing`
(`tests/diagnostic-harness.test.ts:497-519`).

## Régime d'appariement : le seuil de la production

Le harnais ne choisit pas : une fois les moitiés construites,
`totalPairs = totalPairCount(prepared, bucketsA, bucketsB)` ; à partir de
`PARALLEL_PAIRING_THRESHOLD` (100 M de paires, `src/workers/parallelPairing.ts:58`),
appariement parallèle sur au plus 4 workers, sinon séquentiel
(`scripts/lib/diagnosticHarness.ts:1046-1051`) — la règle de
`src/workers/runeBuildOptim.worker.ts:330-341`. Le régime s'affiche avec sa
raison, « comme la production pour ce cas »
(`scripts/lib/diagnosticHarness.ts:361-375`, `tests/diagnostic-harness.test.ts:360-370`).

**La construction est toujours parallèle.** La production lance ses deux Web
Workers de construction dans tous les cas
(`src/workers/runeBuildOptim.worker.ts:305-310`) ; le harnais aussi, sur deux
`worker_threads` qui appellent le vrai `buildBuckets`
(`scripts/lib/buildHalvesNode.ts:116`), jamais selon la taille du cas. Ce
n'est pas qu'une question d'affichage : `maxMs` courant depuis `startedAt`, une
construction séquentielle volerait du budget à l'appariement et trouverait
moins de candidats sur un run tronqué par le temps
(`scripts/lib/buildHalvesNode.ts:5-12`).

**L'appariement parallèle est le code de production** :
`driveParallelPairing` (même répartition, division du plafond et fusion que le
navigateur) reçoit le lanceur Node (`scripts/lib/spawnSliceNode.ts:51`), qui
exécute `runPairSlice` dans `scripts/lib/pair-slice-worker.ts`, coquille Node
du même corps que `src/workers/pairSlice.worker.ts`
(`scripts/lib/diagnosticHarness.ts:1077-1118`). Des implémentations Node de
l'appariement parallèle, seule celle-là est le code de production :
`scripts/lib/pairing-quota-worker.ts` est une reproduction au mode `shared`
jamais mis en production, `scripts/lib/pairing-worker.ts` un prototype de débit
brut.

## Forcer un régime

Forcer un régime (`--regime=sequentiel|parallele`) est un override comme les
autres : la table l'annonce `OVERRIDE`, le drapeau de fidélité bascule
(`scripts/lib/diagnosticConfig.ts:208-213`), et l'explication dit « régime
FORCÉ — ne décrit la production que par coïncidence »
(`scripts/lib/diagnosticHarness.ts:368-371`). Deux usages légitimes : la
**reproductibilité** — en parallèle, l'ordre de collecte dépend de
l'ordonnancement des fils, et sous troncature les deux régimes ne gardent pas
les mêmes candidats ; le séquentiel donne un ordre rejouable (`:250-255`) — et
le **différentiel parallèle contre séquentiel** sur le même cas, pour détecter
une perte due à la parallélisation. Hors de ces usages, un régime forcé produit
un chiffre qui ne décrit la production dans aucun cas.

## Pilotage : le harnais orchestre étage par étage

Le harnais n'appelle pas `runSearchToCompletion` (`scripts/lib/runSearch.ts`),
qui enchaîne les phases d'un bloc et TOUJOURS en séquentiel — il ne modélise
que ce régime et peut trouver moins de candidats que l'écran sur une grande
recherche tronquée (`scripts/lib/runSearch.ts:14-24`) —, alors que le régime
dépend de `totalPairCount`, connu après la construction ; piloter étage par
étage sert aussi aux points d'arrêt et aux temps. Chaque appel est celui de la
production (`scripts/lib/diagnosticHarness.ts:10-17`). Il n'utilise pas
`drivePairing`, boucle autour d'UN `pairBuckets` dont la progression par
message, la main rendue et l'arrêt coopératif servent le navigateur
(`src/workers/pairingDriver.ts:43-78`) : en séquentiel, il vide
`pairBuckets(prepared, bucketsA, bucketsB)`
(`scripts/lib/diagnosticHarness.ts:1060-1065`), appel nu qui explore ce que la
production explore.

Passer un vrai `prepared` à `buildBuckets` ou `pairBuckets` n'est pas une
reconstruction : la production fait de même. La reconstruction, c'est rebâtir
le contexte à la main ; appeler une vraie fonction sur une entrée qu'elle ne
reçoit pas en production (`filterSlot` sur un pool qui n'a pas traversé les
étages précédents) est une infidélité plus subtile, que `--arret` évite. Un
script qui pilote un générateur et s'arrête plus tôt mesure une recherche
tronquée et doit le dire ; le harnais ne coupe jamais `pairBuckets` en route,
et un arrêt avant l'appariement ne rend aucune complétude.

## Note de plateforme : Node et navigateur

Le navigateur rend la main toutes les 50 ms pendant l'appariement
(`YIELD_THROTTLE_MS`, `src/workers/pairingDriver.ts:32`) et plafonne à ~4 ms un
`setTimeout(0)` enchaîné, Worker compris : un surcoût d'ordre ~7 % que Node ne
paie pas. Ce chiffre est ARITHMÉTIQUE, non mesuré, et ce n'est pas le seul
écart (JIT, démarrage des workers, sérialisation) : la direction de l'écart
n'est pas établie, un temps du harnais n'est ni un plancher ni un plafond pour
le navigateur, et les temps Node ne sont pas directement transposables. La note
est imprimée avec toute mesure de temps (`noteNavigateur`,
`scripts/lib/diagnosticConfig.ts:342-351`), et le test interdit qu'elle
affirme une direction (`tests/diagnostic-harness.test.ts:122-135`).

## Validation du harnais

1. **Parité avec l'ancienne reconstruction** —
   `diagnostic-harness-parite.ts [--cas=<index|nom|tous>]`
   (`scripts/diagnostic-harness-parite.ts:1-28`), sur les cas réels de
   `scripts/lib/perfShared.ts` (`CASES`, partagés avec `perf-battery`, qui
   exigent les exports de compte). L'ancienne reconstruction y est une copie
   littérale, à ne pas corriger. Attendus
   (`scripts/diagnostic-harness-parite.ts:222-246`) : `mainstat` et
   `dominance` IDENTIQUES ; en `feasibility`, le harnais garde AU MOINS autant
   de runes (l'ancien chemin ignore `guaranteedMin`, `artFlatMin` et les bornes
   d'inventaire) ; `filterslot` sans attente stricte. Une divergence inattendue
   fait sortir en erreur.
2. **Fidélité aux primitives** — par construction.
3. **Invariants**, dans `node tests/run.mjs` (registre `tests/index.ts:382-385`) :
   un étage ne crée jamais de rune, sa sortie est incluse dans son entrée,
   aucune rune ne change d'emplacement (`testRuneOptimOnStage`) ; même graine,
   même pool (`testRandomPool`) ; complétude toujours explicite, configuration,
   points d'arrêt, motifs, suivi, séries, preuves, causes
   (`testDiagnosticHarness`) ; classement « Dégâts réels »
   (`testDiagnosticHarnessClassementDegatsReels`). La parité sur compte réel
   et toute recherche complète sur un compte réel restent hors de la suite.

## Limite : la rétention interne de buildBuckets

La rétention INTERNE de `buildBuckets` n'est pas observable. Un demi-build
écarté par le plafond de compartiment ne laisse aucune trace dans les
compartiments finaux, et `BuildingProgress` ne compte que la boucle
EXTÉRIEURE : le `yield` est hors des boucles internes et `total` vaut la
longueur du premier emplacement de la moitié
(`src/lib/runeBuildOptim.ts:2685-2691`) ; les sous-arbres élagués n'y laissent
rien, et remonter cette progression ne donne pas un débit d'énumération. Y
répondre exigerait un second observateur dans `buildBuckets`, boucle chaude où
son coût ne serait plus négligeable. Le harnais dit donc « absent des
compartiments », jamais « écarté par la tranche N ».

Le rang d'un demi-build dans chaque tranche de rétention (générique, combinée,
par stat) reste la question de `scripts/monster-search-rank-diag.ts`
(`monster-search-rank-diag.ts <export.json> <deckId> <nomMonstre> [--defense]
[statKeys=atk,cr,cd] [objective=degats] [slotFilterCap=80]`, l. 15), qui
reconstruit la préparation à la main : sa fidélité n'est pas celle du harnais,
et `algo-verify` s'applique à toute conclusion qu'on en tire.

## Ce que le harnais n'absorbe pas

Ni `scripts/perf-battery.ts`, `scripts/perf-battery-compare.ts`, les
`benchmark-*` et les `optimum-*`, outils de mesure à part avec leur coquille
(`scripts/lib/buildHalvesNode.ts:27-31`) ; ni la coquille navigateur (Web
Worker du DOM, lancement par Vite), seule partie de l'appariement qui diffère
entre les deux plateformes ; ni les scripts d'investigation d'une question
close. Un script ad hoc reste légitime pour une question que le harnais ne
couvre pas (l'intérieur de `buildBuckets`, une charge concurrente, un
prototype d'algorithme) ; `algo-verify` s'applique alors intégralement.
