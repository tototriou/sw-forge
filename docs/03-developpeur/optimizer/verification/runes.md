# Vérification — Runes

Voir aussi : [index](README.md).

## Les contrôles, par nom de registre

| Nom dans `tests/index.ts` | Fichier | Ce qu'il contrôle |
| --- | --- | --- |
| `testRuneOptimDifferential` | `tests/rune-optim-differential.test.ts` | le moteur contre une référence naïve et exhaustive sur des pools tirés ; runes imposées tirées ; un bonus de set non demandé et une seconde activation d'un set demandé |
| `testRuneOptim` | `tests/rune-optim.test.ts` | cas écrits à la main : statistique principale imposée, conditions maximum, chaque élagage sûr isolé, runes imposées, joker, diagnostics |
| `testRuneOptimDeadHalfPruning` | `tests/rune-optim-dead-half-pruning.test.ts` | l'élagage exact des demi-builds sans aucune pièce d'un set demandé à plus de 3 pièces |
| `testFilterSlotTopK` | `tests/rune-optim-filterslot-topk.test.ts` | le top-K de `filterSlot` par le vrai tas (`heapPush`) contre un tri complet |
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
