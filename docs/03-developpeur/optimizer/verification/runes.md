# Vérification — Runes

Voir aussi : [index](README.md).

## Les contrôles, par nom de registre

| Nom dans `tests/index.ts` | Fichier | Ce qu'il contrôle |
| --- | --- | --- |
| `testRuneOptimDifferential` | `tests/rune-optim-differential.test.ts` | le moteur contre une référence naïve et exhaustive sur des pools tirés ; runes imposées tirées ; un bonus de set non demandé et une seconde activation d'un set demandé |
| `testRuneOptim` | `tests/rune-optim.test.ts` | cas écrits à la main : statistique principale imposée, conditions maximum, chaque élagage sûr isolé, runes imposées, joker, diagnostics |
| `testRuneOptimDeadHalfPruning` | `tests/rune-optim-dead-half-pruning.test.ts` | l'élagage exact des demi-builds sans aucune pièce d'un set demandé à plus de 3 pièces |
| `testFilterSlotTopK` | `tests/rune-optim-filterslot-topk.test.ts` | le top-K de `filterSlot` par le vrai tas (`heapPush`) contre un tri complet |
| `testValidationRapide` | `tests/validation-rapide.test.ts` | la validation typée de l'appariement (`ValidationTypee`) contre `activeSets`, `computeStats` et le test conjoint de `pairBuckets` : cas écrits, paire par paire, collecteur contre collecteur, appariement entier, contrat tenu ou non |
| `testConstructionRapide` | `tests/construction-rapide.test.ts` | la construction des moitiés sur tableaux typés (`construireMoitieRapide`, et son découpage en tranches) contre `buildBuckets` : égalité profonde des compartiments, préréglages Bas à Extrême, chaque `combosOrderMode`, évictions forcées ; et `construireMoitie` sur son repli |
| `testConstructionColonnes` | `tests/construction-colonnes.test.ts` | construction et union en colonnes contre `buildBuckets` et union objet : mêmes demi-builds dans l'ordre, bornes et potentiel, quatre ordres, pools déterministes, évictions et crans emboîtés ; colonnes, candidats et quasi-succès comparés valeur par valeur avec `Object.is` ; `-0`, moitiés mixtes objet/typée ; transferts avec détachement, union dans le désordre, vrais Workers Node de construction et d'appariement ; capacités hors Int32, repli effectivement pris sur une base ATQ contrainte fractionnaire puis sur un demi-build fractionnaire en ATQ contrainte à base entière, mêmes résultats, ordre et comptes |
| `testSerieCoordinateur` | `tests/serie-coordinateur.test.ts` | la série du Worker principal après la construction contre les boucles qui relisaient chaque demi-build, gardées comme oracle : relevé des lignes égal à `totalPairCount`, plan découpé sur le relevé identique octet pour octet (six tailles de morceau, objets et colonnes), contrat et encodage en une lecture identiques (toutes les colonnes ; cinq motifs de repli : traceur, base fractionnaire, minimum non fini, demi-build fractionnaire, `W` hors Int32), appariement séquentiel identique avec l'espace analysé ; lectures de demi-build comptées : relevé plus une lecture par demi-build, aucune pour le plan |
| `testValidationParRune` | `tests/validation-par-rune.test.ts` | la validation typée construite en lisant chaque rune distincte une fois, contre la validation d'avant, qui relisait chaque occurrence, gardée comme oracle (`tests/oracle-validation-rapide.ts`) : tous les champs identiques élément par élément, efficience et score, aura RES/PRE comptée ou non, runes avec et sans innée ; même motif de repli sur une rune fractionnaire ; trois lectures des sous-stats par rune distincte au lieu de trois par occurrence |
| `testRetentionEmboitee` | `tests/retention-emboitee.test.ts` | les préréglages emboîtés : pool de chaque préréglage plus étroit inclus et égal à celui d'une recherche à ce préréglage (`cransEmboites`), emplacement par emplacement ; Bas ⊆ Moyen ⊆ Haut ⊆ Extrême en demi-builds, l'union égale au préréglage seul plus les manquants, compartiments, bornes, potentiel et ordre relatif inchangés, ajouts rangés ; progression en un compte ; traceur relu ; inclusion en builds valides sur le profil `complet-sensible` et sur des pools différents d'un préréglage à l'autre, ancien Moyen compris ; la construction en parallèle (`construireMoitiesEmboitees`, un fil par moitié et par préréglage, finis dans le désordre, et la coquille Node à 8 `worker_threads`) égale à la construction séparée, compartiment par compartiment et ordre compris, avec des ajouts de plusieurs préréglages à Haut et à Extrême, ordres `objective` et `potential` ; refus ; témoin qu'une seule passe dans l'ordre du pool large ne retient pas les mêmes demi-builds |
| `testPrioriteStatsRetiree` | `tests/priorite-stats-retiree.test.ts` | `adaptiveTrancheWeighting` retiré : recettes et sessions historiques à vrai ou faux lues sans erreur ni avertissement, mêmes `SearchParams` au CLI et même état restauré que sans le champ, réexport sans la clé ; Haut ou Extrême ne change que `slotFilterCap` |
| `testRuneOptimAurasCoupesMinimum`, `testRuneOptimAurasCoupesDiagnostics`, `testRuneOptimAurasCoupesRetention`, `testRuneOptimAurasCoupesBladeIntangible`, `testRuneOptimAurasCoupesDifferentiel`, `testRuneOptimAurasCoupesDominance` | `tests/rune-optim-auras-coupes.test.ts` | un oracle exhaustif indépendant des coupes sûres, auras propres au build comprises |

## Référence exhaustive : le test différentiel

`testRuneOptimDifferential` compare `searchBuilds` à `bruteForce`, une
référence qui énumère vraiment le produit des six emplacements, sans
pré-filtrage ni regroupement par compte de pièces, et ne partage avec le
moteur que `computeStats`, `activeSets`, `missingSets` et
`runeEfficiency` (`tests/rune-optim-differential.test.ts:19-22`,
`:37-82`). Comme le moteur, elle refuse deux runes Intangible dans un
même build (`:58-63`). Les pools font trois runes par emplacement, tirés par `randomPool` à graine fixe
(`mulberry32`) : assez petits pour la référence, et sous les plafonds de
pré-filtrage, si bien que le moteur voit tout le pool (`:91-99`).

Sur quinze scénarios tirés (sets demandés et minimums variés, `:89-110`) :

- même verdict de faisabilité ;
- aucun faux positif : chaque candidat rendu est recalculé et revérifié
  sans rien supposer de l'état du moteur ;
- même optimum d'efficience quand la recherche n'est pas tronquée ;
  tronquée, elle rend le meilleur trouvé, pas un optimum garanti, et
  l'optimum n'est pas comparé (`:121-132`) ;
- recherche non tronquée : `totalPairCount` vaut exactement `explored`, et
  `estimatePairBound` en reste un majorant. L'égalité tient parce que les
  deux appliquent les mêmes prédicats factorisés (`satisfiesSets`, joker,
  `bucketPairFeasibleMin`, `comboAFeasible`) et que `explored` s'incrémente
  avant `quickOk` : un filtre ajouté à l'un sans l'autre casse ici
  (`:159-213`).

Le moteur peut rendre moins de candidats que la référence avec le même
optimum : la dominance retire légitimement des combinaisons redondantes.
Ne pas comparer le nombre de candidats, qui diffère sans erreur ; le test
compare la faisabilité et l'optimum.

Les runes imposées (`requirement.lockedRunes`) ont leur balayage, dix
scénarios : la référence reçoit le même verrou appliqué au pool
(`applyLockToPool`), et chaque candidat doit porter la rune imposée sur son
emplacement (`:217-284`). Deux scénarios dédiés vérifient que
`guaranteedMin` anticipe dès `eliminateInfeasible` un bonus de set qu'aucun
combo ne garantit : Blade activé par les emplacements libres sans être
demandé, seul moyen d'atteindre un minimum de Taux Crit ; et une seconde
activation d'Energy, demandé une fois, seul moyen d'atteindre un minimum de
PV (`:286-416`).

## Cas écrits à la main

`testRuneOptim` (`tests/rune-optim.test.ts`) couvre :

- la statistique principale imposée des emplacements 2, 4 et 6 : une rune
  écartée quand sa principale ne correspond pas, une autre retenue
  (`:265-320`) ;
- les conditions maximum : rejet au-delà, acceptation en deçà, minimum égal
  au maximum égal à la valeur exacte accepté (`:322-357`) ;
- la dominance : une rune strictement dominée n'est jamais retenue
  (`:359-389`) ;
- la faisabilité d'un minimum à la frontière exacte : le meilleur cas
  possible passe, la rune incapable d'y arriver n'apparaît jamais
  (`:391-451`) ;
- le symétrique au maximum : une rune dont la seule contribution dépasse
  déjà le plafond est écartée, même si le reste du build resterait dessous
  (`:453-480`) ;
- l'efficacité de l'élagage, pas seulement sa sûreté : `explored` vaut
  exactement le nombre de candidats capables d'atteindre le minimum, pas la
  taille du pool (`:789-835`) ;
- les runes imposées : imposer la seule rune de son emplacement ne change
  rien, imposer un identifiant absent du pool ne donne aucun build, et une
  concurrente meilleure en efficience, même emplacement et même set, est
  écartée au profit de la rune imposée (`:85-133`). Ces cas gardent contre
  un verrou appliqué après la dominance ou le pré-filtrage, qui serait
  ignoré sans erreur.

Écueil des fixtures : deux runes qui ne diffèrent que sur la stat
contrainte se dominent, et la dominance les départage avant l'élagage de
faisabilité. Un cas qui vise la faisabilité donne à ses runes une stat
annexe, non contrainte, qui varie en sens opposé (`:400-404`, `:801-805`).

## Oracle exhaustif indépendant des coupes sûres

`testRuneOptimAurasCoupes…` (`tests/rune-optim-auras-coupes.test.ts`)
confronte `searchBuilds`, de bout en bout, à un oracle exhaustif sur le pool
avant préparation. L'oracle ne partage avec le moteur que `computeStats` et
`activeSets` ; il compte lui-même les activations d'aura, les +8 points
RES/PRE, le combo demandé et les conditions, sans appeler `prepareSearch` ni
aucune coupe (`:6-12`). Les heuristiques sont desserrées pour qu'une absence
soit imputable (`:185`).

À chaque run : aucun faux positif, même verdict de faisabilité, l'optimum
conservé sur chaque critère utile — l'efficience, les stats des conditions
et celles de l'objectif avec leurs auras de combat, toutes les stats en
« Efficience » ou sans objectif (`:121-131`) — et, pour chaque build valide
absent, sa première coupe lue dans le traceur : seules la dominance et les
étapes heuristiques (`HEURISTIQUES`) ont le droit d'en retirer, une coupe
sûre qui l'a rejeté fait échouer le test (`:209-262`).

Scénarios : un minimum RES ou PRE tenu par la seule aura propre, isolé
coupe par coupe (`eliminateInfeasible`, `bucketPairFeasibleMin`,
`comboAFeasible`, `quickOkMin`) ; maximum, et auras non comptées dans les
conditions (`compter: false`) ; diagnostics de faisabilité et quasi-succès ;
rétention sous `bucketCap` 1, qui distingue une perte heuristique d'un faux
rejet ; le témoin Blade non demandé et Intangible ; la dominance (auras,
Blade, joker, et la dominance générique qui reste là où elle est sûre) ; un
différentiel aléatoire sur soixante graines (6300 à 6359).

Limite : cet oracle ne note pas. Il compare un maximum par critère, sans
sort, sans artéfact ni relique : il est aveugle à l'effet unique de la
relique et aux lignes 218–221 (`:20-29`), que portent les [oracles notés](reliques-et-artefacts.md#vérification--oracle-noté-paire-tirée-et-différentiel-ciblé). Ne pas étendre `criteresUtiles` aux stats de l'effet
unique ou des lignes : il recopierait la règle de `contexteDominance` qu'il
contrôle, au lieu de la juger.
