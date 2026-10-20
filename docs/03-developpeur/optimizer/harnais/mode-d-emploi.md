# Harnais de diagnostic

Voir aussi : extensions.md, scripts.md, ../invariants.md, ../verification.md, ../../../02-app/optimizer/ (routage-par-tache.md).

Le harnais rejoue une recherche de l'Optimizer en Node et dit ce qu'elle a
fait : configuration appliquée, survie d'une rune étage par étage, régime,
complétude, temps par phase. Il **orchestre et observe** les fonctions de
production et ne réimplémente **aucune** étape algorithmique
(`scripts/lib/diagnosticHarness.ts:1-23`). Il remplace le script de diagnostic
ad hoc, qui reconstruit à la main des morceaux du pipeline et en dérive sans
que rien ne le signale. Ses contraintes sont résumées dans
../invariants.md § Harnais ; ce fichier en est la source et dit où le code porte
chacune (`fichier:lignes`). [extensions.md](extensions.md)
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
| `scripts/lib/buildHalvesNode.ts`, `scripts/lib/build-half-worker.ts` | les deux moitiés, sur deux `worker_threads`, par la construction de production (`construireMoitie`) |
| `scripts/lib/appariementRapideNode.ts`, `scripts/lib/appariement-rapide-worker.ts` | l'appariement parallèle : lanceur et coquille Node du serveur de production (`servirAppariement`, qui appelle `initialiserTravailleur` puis `parcourirMorceau` par tranches) |
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
(`scripts/lib/buildHalvesNode.ts`, `scripts/lib/appariementRapideNode.ts`).

## Lancer un diagnostic

Usage, d'après l'en-tête du CLI (`scripts/diagnostic-harness.ts:21-86`) :

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
attendu, jamais remplacé par un repli (`scripts/diagnostic-harness.ts:125-200`).

## Deux sources : une recette ou un pool synthétique

Une recette répond à « pourquoi ce cas de mon compte donne-t-il ça ? »
(fidélité maximale, chemin de prod complet) ; un pool synthétique, à « quel
comportement produit ce mécanisme, de façon reproductible ? » (pool forcé). La
provenance figure toujours dans le résultat (`source`, `descriptionSource`,
`scripts/lib/diagnosticHarness.ts:260-265`). La **recette** est le format
qu'exporte l'écran (`parseOptimizerRecipe`, `src/lib/optimizerRecipe.ts:478`),
chargé par `chargerRecette` (`scripts/lib/chargerRecette.ts:1-20`, `:65`), la
séquence de `scripts/optimizer-search.ts` mise en commun : repli d'un objectif
retiré, chargeur box, RTA ou siège, contrôle du `com2usId`, données
d'exclusion chargées seulement si la recette en déclare, puis
`recipeToSearchParams` (`scripts/lib/recipeToSearchParams.ts:496`), qui résout
`artifactBounds` et `objectiveStats` comme l'écran. Elle n'imprime rien : elle
rend des avertissements. Le **pool synthétique** vient de
`randomPool(mulberry32(seed), runes, sets)` sur la base de monstre fixe des
tests et benchmarks (`scripts/lib/diagnosticConfig.ts:54-59`, `:113-136`) ;
assortiments `SETS_JOKER` (défaut), `SETS_SANS_JOKER`, `SETS_VARIES`
(`scripts/lib/randomPool.ts:69-75`). `--verrous` reproduit sans compte réel une
rune imposée. Ce pool n'est pas réaliste (sous-stats tirées uniformément) : une
question qui dépend du réalisme des runes se pose sur un compte réel
(`scripts/lib/randomPool.ts:25-30`).

La séquence de tirage de `randomPool` est un contrat : intervertir deux tirages
décale tout le pool sans qu'un test de moteur échoue lisiblement, d'où les
empreintes de `tests/random-pool.test.ts`, relevées sur le code d'avant la
mise en commun (`scripts/lib/randomPool.ts:15-23`). Les générateurs
volontairement biaisés (`scripts/lib/randomPool.ts:32-37`) ne
passent pas par ce module : leur biais est le sujet de ce qu'ils mesurent, les
migrer changerait leurs pools.

## Les phases et les points d'arrêt

La séquence est celle de `src/workers/runeBuildOptim.worker.ts`
(`scripts/lib/diagnosticHarness.ts:4-8`, `:995-1093`) :

| Phase | Fonctions de production | Ce que le harnais observe |
|---|---|---|
| **A — Préparation** | `prepareSearch` : principale → `pruneDominated` → `eliminateInfeasible` → `filterSlot` | 4 étages via `onStage`, puis le `PreparedSearch` |
| **B — Demi-builds** | `construireMoitie` pour A et pour B, en parallèle | compartiments, demi-builds, `totalPairCount` |
| **C — Appariement** | `apparier` en séquentiel, ou `apparierRapideEnParallele` | `SearchResult`, complétude |
| **D — Classement** | `sortCandidates` | candidats classés |

`--arret` désigne une phase, ou un étage de la phase A. S'arrêter à un étage
ne coupe pas `prepareSearch` : la préparation tourne entière, la restitution
s'arrête à cet étage, et rien de la construction, où est le vrai coût, n'est
lancé (`scripts/lib/diagnosticTypes.ts:87-95`). Le point d'arrêt naturel pour
relire avant de payer est entre préparation et construction. Un arrêt avant
l'appariement ne rend aucun verdict de complétude
(`tests/diagnostic-harness.test.ts:145-156`). Il n'y a pas de point de
reprise : reprendre au milieu exigerait un instantané réinjectable,
fonctionnalité distincte d'un point d'arrêt et non son inverse.

## Classement : toujours par sortCandidates

`SearchResult.candidates` sort dans l'ordre de COLLECTE : `candidates[0]`
n'est pas le meilleur build. Le harnais classe la liste ENTIÈRE par
`sortCandidates` avec `optionsDeClassement`, le producteur de l'écran et du
CLI (`scripts/lib/diagnosticHarness.ts:1963-1995`). En « Dégâts réels », il
construit le contexte de dégâts comme le CLI (`buildRealDamageContext`) ; sans
lui, `sortCandidates` laisse l'ordre de collecte sans lever
(`tests/diagnostic-harness.test.ts:984-1014`). Le total affiché vient de
`candidateMetricTotal`, recalculé depuis les vraies runes dans la métrique
courante, jamais de `effTotal`, figé à la recherche. Le rang d'un build se
prend sur la liste entière ; la coupe aux 20 premiers (`TAILLE_TOP_RENDU`,
`scripts/lib/diagnosticHarness.ts:1942-1948`) n'est que celle de l'affichage.

## L'observateur onStage

`prepareSearch` réassigne son tableau par emplacement à chaque étage, et seul
le dernier état sort dans `PreparedSearch`. Pour distinguer une rune PROUVÉE
impossible d'une rune seulement écartée par le pré-filtrage, un outil devrait
sinon rappeler les fonctions une par une — un second pipeline. D'où
`onStage?: (stage: PrepareStage, bySlot: RuneDetail[][]) => void`
(`src/lib/runeBuildOptim.ts:3710-3733`) :

- SECOND argument de `prepareSearch`, pas champ de `SearchParams` : ce type
  traverse `postMessage`, où une fonction n'est pas sérialisable (`:3881-3896`) ;
- appelé après chacun des quatre étages, dans l'ordre (`:3964-3976`) ;
- `PrepareStage` est une union FERMÉE, jamais un `string` : une faute de
  frappe échoue à la compilation (`:3846-3854`) ;
- il reçoit la référence réelle de l'étage suivant et ne la mute jamais ;
- omis, comportement strictement inchangé : quatre tests de branche par appel,
  y compris dans chaque Worker d'appariement parallèle, qui rappelle `prepareSearch`.

`tests/rune-optim-onstage.test.ts:118-191` vérifie un `PreparedSearch`
identique avec et sans observateur, les quatre étages signalés dans l'ordre
(même quand la préparation échoue), et qu'un étage ne fait que retirer, sans
déplacer de rune. Le harnais y branche `releverPreparation`
(`scripts/lib/diagnosticHarness.ts:741-758`) : identifiants et tailles par étage.

## Le palier 1 : configuration effective et fidélité

Le palier 1 est instantané : `resoudreConfig`
(`scripts/lib/diagnosticConfig.ts:85-228`) calcule la configuration sans rien
exécuter, le CLI l'imprime toujours en premier, et `--apercu` s'arrête là
(`scripts/diagnostic-harness.ts:1030-1047`). Elle est résolue UNE fois : le run
exécute celle que le palier 1 a décrite, sans relire recette ni export
(`scripts/lib/diagnosticHarness.ts:191-221`).

**Chaque paramètre effectif affiche son origine** : `recette`,
`config synthétique`, `défaut moteur`, `DÉRIVÉ de <param>`, `OVERRIDE`,
`recette (non surchargeable)` (`scripts/lib/diagnosticTypes.ts:149-169`). La
table couvre la surface d'override et les paramètres effectifs non
surchargeables : objectif et stats d'objectif, métrique, recherche
exhaustive, composition du pool, verrous, artéfacts, bornes d'artéfact, relique, contexte relique, exclusions
(`scripts/lib/diagnosticConfig.ts:259-317`).

**La recette reste la vérité prod** : les overrides vivent dans une section
distincte de la configuration (`overrides`), jamais fondus dans la recette.
Chaque paramètre porte la valeur qu'aurait la production ; dès qu'un seul
diffère, le run est marqué « FIDÉLITÉ DES PARAMÈTRES SUIVIS : DIVERGE DE LA
PROD » et chaque écart nommé (`bucketCap = 500  (prod : 6000)`), sinon
« conforme à la production pour ce cas »
(`scripts/lib/diagnosticConfig.ts:332-351`, `:377-394`). Suit, dans les deux
cas, ce que la comparaison ne prouve pas : composition du pool (affichée,
jamais comparée), paramètre absent de la table, coquille Node contre
navigateur. La marque fait partie du résultat (`fidelite`), donc de `--json` :
un nombre du harnais détaché de son contexte ne peut pas passer pour « ce que
fait la prod » (`tests/diagnostic-harness.test.ts:88-143`).

## Les overrides et leurs deux pièges

La surface d'override est ce que la recette ne porte pas — `bucketCap`,
`maxCollected`, `maxMs`, `combosOrderMode`, le régime — plus `slotFilterCap`,
que la recette porte en préréglage (`scripts/lib/diagnosticTypes.ts:54-83`).

**Aucun plafond de paires.** Le moteur n'en a plus ; un harnais qui en
rétablirait un mesurerait une recherche tronquée que la production ne fait
pas. `maxMs` est la seule borne qui puisse tronquer, et le premier paramètre à
vérifier : 15 s par défaut moteur (`DEFAULT_MAX_MS`,
`src/lib/runeBuildOptim.ts:1174`), 10 min à l'écran (`HARD_TIMEOUT_MS`,
`src/components/outils/OptimizerSection.tsx:918`), sans limite en recherche
exhaustive. En synthétique sans `maxMs`, le harnais applique les 10 min de
l'écran et le dit (`scripts/lib/diagnosticConfig.ts:137-147`).

**Piège A — la cascade.** Sans override, `bucketCap` est DÉRIVÉ :
`bucketCapFor(slotFilterCap)` = `round(BUCKET_CAP × slotFilterCap /
MAX_PER_SLOT_MATCH)` (`src/lib/runeBuildOptim.ts:1352-1363`). Surcharger
`slotFilterCap` déplace aussi `bucketCap` ; la table l'annonce « DÉRIVÉ de
slotFilterCap » (`scripts/lib/diagnosticConfig.ts:165-176`,
`tests/diagnostic-harness.test.ts:72-86`). Il déplace aussi les préréglages
emboîtés, dont la rétention s'ajoute à celle du run : tous ceux de
`slotFilterCap` inférieur, chacun à son propre `bucketCap` dérivé, qu'un
override de `bucketCap` ne touche pas
([moteur/elagages.md § Préréglages emboîtés](../moteur/elagages.md#préréglages-emboîtés)).

**Piège B — le défaut du moteur n'est pas celui de la production.** Un run qui
omet `slotFilterCap` prend 40 (`MAX_PER_SLOT_MATCH`) et 3000 de `bucketCap` ;
la production, au préréglage « Moyen » de l'écran, 80 et 6000
(`src/lib/runeBuildOptim.ts:593-614`), plus la rétention de Bas emboîtée : la
moitié de la rétention sur les deux axes, en silence. En mode recette, le préréglage de la recette fait foi ; en
synthétique, le harnais EXIGE `--cap` (sans défaut) et refuse le run sans lui
(`scripts/lib/diagnosticConfig.ts:115-123`, `scripts/diagnostic-harness.ts:387-400`,
`tests/diagnostic-harness.test.ts:54-70`). Ce piège est un défaut du MOTEUR, et
sa correction naïve (`MAX_PER_SLOT_MATCH = 80`) casserait la production : la
même constante est l'ancre de `bucketCapFor`
(`src/lib/runeBuildOptim.ts:1341-1352`), dont le résultat tomberait de 6000 à
3000. Le défaut de `filterSlot` et l'ancre de `bucketCapFor` sont deux
changements séparables.

## Suivi d'une rune, étage par étage

`--suivre=<id,…>` rend la présence de chaque rune à chaque étage et sa
PREMIÈRE disparition, avec la nature de l'étage et ce qu'elle signifie
(`suivrePiece`, `scripts/lib/diagnosticHarness.ts:1827-1841` ; natures,
`:115-137`) :

| Étage | Nature | Ce qu'une disparition signifie |
|---|---|---|
| `mainstat` | contrainte | la rune ne peut pas porter la principale imposée |
| `dominance`, `feasibility` | sûr | PROUVÉ : ne peut entrer dans aucun build valide |
| `filterslot` | mixte | ambigu : `filterSlot` élague sûrement en tête (« combo à coût complet ») ET retient heuristiquement (top-K) |

Une disparition au pré-filtrage est donc annoncée AMBIGUË, jamais comme un
verdict sur l'utilité de la rune ; un identifiant absent du pool est dit
absent au départ, jamais « éliminé au premier étage »
(`tests/diagnostic-harness.test.ts:404-440`). Sur la même option :

- une rune qui atteint l'entrée réelle de `filterSlot` (sortie de
  `feasibility`, lue par `onStage`) reçoit son rang exact sur `relevance()` et
  par stat, avec les budgets `PER_STAT_KEEP`/`PER_STAT_KEEP_OBJECTIVE`
  (`detailFiltrage`, `scripts/lib/diagnosticHarness.ts:1223-1270`) ;
- les 3 identifiants d'une même moitié (emplacements 1-3 ou 4-6) donnent le
  rang du demi-build dans son compartiment et ses voisins (`:353-366`,
  `:1344-1374`) ;
- les 6 identifiants d'un build donnent son admissibilité et un verdict
  structuré (usage en tête du CLI).

Le résultat rend aussi les bornes appliquées par l'étage de faisabilité
(`bornesFaisabilite`, `:1269-1286`) : sans elles, « aucune rune éliminée » ne
se distingue pas de « la borne attendue n'est pas active ».

## Étendre le suivi aux artéfacts et aux reliques

`suivrePiece` est générique sur une population, des étages nommés et un
identifiant ; seules les runes y sont branchées. Qui l'étend :

- ne recopie pas les étages des runes : un artéfact ou une relique a les siens ;
- traite un `ArtifactDetail.id ≤ 0` comme « pas une vraie pièce » : la sonde
  d'`analyserPertinence` fabrique des artéfacts d'identifiant 0
  (`src/lib/artifactOptim.ts:324-330`) ; `RelicDetail.id` existe
  (`src/types.ts:233-238`) ;
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
(`scripts/lib/diagnosticHarness.ts:1781-1815`) rend `complet`,
`incomplet — raison : maxMs | maxCollected`, ou
`INCOHÉRENT — incomplet, motif NON déductible`.

- **Deux motifs seulement** (`MotifTroncature`, `src/lib/runeBuildOptim.ts`) :
  le plafond de candidats est global dans les deux régimes.
- **Le motif se DÉDUIT**, dans les deux régimes : l'appariement teste le
  temps AVANT de collecter un candidat et le plafond APRÈS ; tronquée au
  plafond atteint, c'est le plafond, sinon le temps. Exact en parallèle aussi,
  la fusion gardant le plafond global dans l'ordre séquentiel.
- **Autodiagnostic** : `totalPairCount` est la borne exacte de l'espace (égale
  à `explored`, les paires traitées, sans troncature, vérifié par
  `tests/rune-optim-differential.test.ts`).
  Le harnais affiche toujours `explored / totalPairs` ; un run annoncé complet
  qui n'a pas tout exploré sort INCOHÉRENT, sans motif inventé — jamais
  `complet` avec une incohérence. Ne pas remplacer `complet` par un statut
  à plusieurs valeurs : l'API testée changerait de type pour ce que dit déjà `incoherence`.
- **Une configuration invalide n'est pas un verdict.** Un emplacement vide
  fait rendre `null` à `prepareSearch` : le harnais dit « préparation
  impossible » et nomme la cause lue dans le verrou et le pool
  (`scripts/lib/diagnosticHarness.ts:1162-1202`) — rune imposée absente du pool,
  rune imposée à un autre emplacement (un verrou ne déplace pas une rune, il
  vide l'emplacement), sinon l'étage qui a vidé l'emplacement. Tests :
  `tests/diagnostic-harness.test.ts:371-402` et `:516-550`.

## Faisabilité et blocages

Le harnais appelle `diagnoseFeasibility` et `rankBlockingConditions` en
gardant leur sémantique (`scripts/lib/diagnosticHarness.ts:1098-1150`) :

- les **preuves** (`diagnoseFeasibility`, une passe) sont toujours calculées
  et rendues : `satisfiable: false` PROUVE l'impossibilité sur une stat isolée ;
  `satisfiable: true` veut dire « rien ne prouve l'impossibilité », pas « un
  build existe » — les contraintes prises ensemble peuvent rester infaisables,
  et la sortie le dit ;
- les **blocages** (`rankBlockingConditions`) sont un INDICE : pour chaque
  condition, de combien la desserrer pour que le pré-filtrage laisse passer
  plus. Coûteux (une dichotomie par condition), ils ne sont calculés que sur
  `--blocages`, ou d'office quand la configuration n'a aucune issue ou que la
  recherche ne rend rien (`:295-300`, `:443-451`), leur coût rendu avec eux.

Deux fonctions séparées (`evaluerFaisabilite`, `evaluerBlocages`), hors des
chronomètres de phase (`tests/diagnostic-harness.test.ts:482-514`).

## Temps par phase

Le budget `maxMs` court depuis `startedAt`, construction des demi-builds
comprise : le harnais mesure donc `preparation`, `demiBuilds`, `appariement`
et `total`, jamais le seul appariement présenté comme durée du run
(`agregerTemps`, `scripts/lib/diagnosticHarness.ts:1905-1936`). `demiBuilds`
est le temps réel de la phase ; `demiBuildA` et `demiBuildB`, à côté, le coût
de chaque fil — paralléliser ne fait jamais mieux que la moitié la plus lourde.
Seules les phases qui ont tourné sont rendues, jamais à 0 ms. La fenêtre
`preparation` enclot l'observateur du harnais, absent en production ; son coût,
mesuré, est imprimé avec la série (`:1941-1968`). Bundling, faisabilité et
blocages restent hors des chronomètres (`tests/diagnostic-harness.test.ts:158-193`).

## Séries de temps et comparaison

Aucun temps n'est livré nu : chaque phase est une série de N répétitions
(`serie`, `scripts/lib/diagnosticHarness.ts:1847-1863`) — le MINIMUM (une
interférence ne peut qu'ajouter du temps), la médiane, la dispersion
`(max − min) / min`. Une mesure à une seule répétition porte « aucune
conclusion comparative permise » ; `--repetitions` règle N.

Toute sortie de temps porte l'avertissement de comparaison (`:1991-2000`) :
deux runs séparés puis soustraits forment un protocole en BLOCS, dont le biais
de position (échauffement, ramasse-miettes, fréquence) se reproduit et
ressemble à un résultat ; ne jamais conclure sur un écart plus petit que la
dispersion. Pour comparer deux conditions, entrelacer les répétitions (témoin,
A, B, témoin, A, B…), jamais les grouper : `scripts/perf-battery-compare.ts`
le fait sur la batterie de cas, `--differentiel` sur un profil synthétique.
Toute mesure suit le skill `optimizer-perf-testing`
(`tests/diagnostic-harness.test.ts:442-464`).

## Régime d'appariement : le seuil de la production

Le harnais ne choisit pas : une fois les moitiés construites,
`totalPairs = totalPairCount(prepared, bucketsA, bucketsB)`, puis le contrat
numérique du noyau, jugé SANS le traceur (que la production ne pose jamais :
suivre une cible ne change pas le régime) ; `regimeAppariement` rend
l'appariement parallèle à partir de `PARALLEL_PAIRING_THRESHOLD` (100 M de
paires, `src/workers/parallelPairing.ts`), contrat tenu, sur
`nombreDeTravailleurs(os.availableParallelism())` Workers, sinon le
séquentiel — la règle de `src/workers/runeBuildOptim.worker.ts`, alimentée
par la concurrence de la machine. Le régime s'affiche avec sa raison et le
nombre de Workers, « comme la production pour ce cas »
(`tests/diagnostic-harness.test.ts`). Avec une cible suivie, l'appariement
séquentiel passe par `pairBuckets`, qui remplit la trace : mêmes résultats,
plus lent ; en parallèle, le harnais apparie sans traceur.

**La construction est toujours parallèle.** La production lance ses deux Web
Workers de construction dans tous les cas ; le harnais aussi, sur deux
`worker_threads` qui appellent la vraie construction (`construireMoitie`,
`scripts/lib/build-half-worker.ts`), jamais selon la taille du cas. Ce
n'est pas qu'une question d'affichage : `maxMs` courant depuis `startedAt`, une
construction séquentielle volerait du budget à l'appariement et trouverait
moins de candidats sur un run tronqué par le temps
(`scripts/lib/buildHalvesNode.ts:5-12`).

**L'appariement parallèle est le code de production** :
`apparierRapideEnParallele` (mêmes morceaux à la demande et même fusion dans
l'ordre que le navigateur) reçoit le lanceur Node (`lancerTravailleurNode`,
`scripts/lib/appariementRapideNode.ts`), dont les fils exécutent
`scripts/lib/appariement-rapide-worker.ts`, coquille Node du même serveur
(`servirAppariement`, morceaux par tranches) que
`src/workers/appariementRapide.worker.ts` (`apparierEnParallele`,
`scripts/lib/diagnosticHarness.ts`). Des implémentations Node de
l'appariement parallèle, seule celle-là est le code de production :
`scripts/lib/pairing-worker.ts` est un prototype de débit brut sur
`pairBuckets`.

## Forcer un régime

Forcer un régime (`--regime=sequentiel|parallele`) est un override comme les
autres : la table l'annonce `OVERRIDE`, le drapeau de fidélité bascule
(`scripts/lib/diagnosticConfig.ts:207-212`), et l'explication dit « régime
FORCÉ — ne décrit la production que par coïncidence »
(`scripts/lib/diagnosticHarness.ts:371-374`). Deux usages légitimes : la
**reproductibilité** — les deux régimes collectent dans l'ordre séquentiel et
rendent le même résultat, non tronqué ou coupé par le plafond, mais sous une
troncature par le temps le parallèle garde ce que chaque morceau a trouvé
avant la coupe, qui dépend de l'ordonnancement des fils ; le séquentiel
donne un préfixe rejouable (`:256-260`) — et le **différentiel parallèle
contre séquentiel** sur le même cas, pour détecter une perte due à la
parallélisation. Hors de ces usages, un régime forcé produit
un chiffre qui ne décrit la production dans aucun cas.

## Pilotage : le harnais orchestre étage par étage

Le harnais n'appelle pas `runSearchToCompletion` (`scripts/lib/runSearch.ts`),
qui enchaîne les phases d'un bloc et TOUJOURS en séquentiel — il ne modélise
que ce régime et peut trouver moins de candidats que l'écran sur une grande
recherche tronquée (`scripts/lib/runSearch.ts:13-20`) —, alors que le régime
dépend de `totalPairCount`, connu après la construction ; piloter étage par
étage sert aussi aux points d'arrêt et aux temps. Chaque appel est celui de la
production (`scripts/lib/diagnosticHarness.ts:10-17`). Il n'utilise pas
`drivePairing`, boucle autour du générateur d'appariement dont la progression
par message, la main rendue et l'arrêt coopératif servent le navigateur
(`src/workers/pairingDriver.ts:40-80`) : en séquentiel, il vide
`apparier(prepared, bucketsA, bucketsB)` — le noyau, ou `pairBuckets` hors de
son contrat —, et en parallèle il appelle `apparierRapideEnParallele` avec le
lanceur Node (`scripts/lib/diagnosticHarness.ts:1013-1018`), appels nus qui
explorent ce que la production explore.

Passer un vrai `prepared` à `buildBuckets` ou `pairBuckets` n'est pas une
reconstruction : la production fait de même. La reconstruction, c'est rebâtir
le contexte à la main ; appeler une vraie fonction sur une entrée qu'elle ne
reçoit pas en production (`filterSlot` sur un pool qui n'a pas traversé les
étages précédents) est une infidélité plus subtile, que `--arret` évite. Un
script qui pilote un générateur et s'arrête plus tôt mesure une recherche
tronquée et doit le dire ; le harnais ne coupe jamais l'appariement en route,
et un arrêt avant l'appariement ne rend aucune complétude.

## Note de plateforme : Node et navigateur

Le navigateur rend la main pendant l'appariement : toutes les 50 ms en
séquentiel (`YIELD_THROTTLE_MS`, `src/workers/pairingDriver.ts:30`), entre
deux tranches de 100 ms dans chaque Worker du parallèle (`TRANCHE_MS`). La
cession passe par un message de canal (`cederLaMain`, `src/lib/cession.ts`),
que le navigateur ne bride pas ; seul le repli sans `MessageChannel` paie le
plafond de ~4 ms d'un `setTimeout(0)` enchaîné. L'écart entre Node et le
navigateur n'est pas mesuré, et il en reste d'autres sources (JIT, démarrage
des workers, sérialisation) : la direction de l'écart n'est pas établie, un
temps du harnais n'est ni un plancher ni un plafond pour le navigateur, et les
temps Node ne sont pas directement transposables. La note est imprimée avec
toute mesure de temps (`noteNavigateur`,
`scripts/lib/diagnosticConfig.ts:340-351`), et le test interdit qu'elle
affirme une direction (`tests/diagnostic-harness.test.ts:122-135`).

## Validation du harnais

1. **Parité avec l'ancienne reconstruction** —
   `diagnostic-harness-parite.ts [--cas=<index|nom|tous>]`
   (`scripts/diagnostic-harness-parite.ts:1-30`), sur les cas réels de
   `scripts/lib/perfShared.ts` (`CASES`, partagés avec `perf-battery`, qui
   exigent les exports de compte). L'ancienne reconstruction y est une copie
   littérale, à ne pas corriger. Attendus
   (`scripts/diagnostic-harness-parite.ts:224-249`) : `mainstat` et
   `dominance` IDENTIQUES ; en `feasibility`, le harnais garde AU MOINS autant
   de runes (l'ancien chemin ignore `guaranteedMin`, `artFlatMin` et les bornes
   d'inventaire) ; `filterslot` sans attente stricte. Une divergence inattendue
   fait sortir en erreur.
2. **Fidélité aux primitives** — par construction.
3. **Invariants**, dans `node tests/run.mjs` (registre `tests/index.ts:632-635`) :
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
(`src/lib/runeBuildOptim.ts:2509-2515`) ; les sous-arbres élagués n'y laissent
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
