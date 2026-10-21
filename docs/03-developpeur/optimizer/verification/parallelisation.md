# Vérification — Parallélisation

Voir aussi : [index](README.md).

## Les contrôles, par nom de registre

| Nom dans `tests/index.ts` | Fichier | Ce qu'il contrôle |
| --- | --- | --- |
| `testRuneOptimScaleMonotonicity` | `tests/rune-optim-scale-monotonicity.test.ts` | à l'échelle d'un compte réel, élargir le pré-filtrage ne perd pas les demi-builds déjà retenus |
| `testRuneOptimParallelPairing` | `tests/rune-optim-parallel-pairing.test.ts` | l'appariement découpé en tranches contre l'appariement séquentiel |
| `testRuneOptimParallelTruncated` | `tests/rune-optim-parallel-truncated.test.ts` | la fusion des résultats des tranches (`combineParallelPairingResults`) : signal `truncated` et quasi-succès |
| `testRuneOptimNearMiss` | `tests/rune-optim-near-miss.test.ts` | le quasi-succès retenu à l'appariement, y compris après un arrêt manuel |

## Échelle réelle et appariement parallèle

Le différentiel, à trois runes par emplacement, ne peut pas voir une perte
de rétention, qui n'apparaît qu'à des centaines de runes par emplacement.
`testRuneOptimScaleMonotonicity` tire 300 runes par emplacement et vérifie
qu'en passant du préréglage « Bas » à « Extrême », les demi-builds retenus
au premier survivent au second au-dessus du seuil `MIN_SURVIVAL_RATE` ; il
n'appelle que `buildBuckets`, l'étage où la perte se produit
(`tests/rune-optim-scale-monotonicity.test.ts:7-15`, `:42-48`, `:108-120`). Un
renouvellement en queue de classement est normal : exiger la survie de
tous les demi-builds, ou ne suivre que les meilleurs en efficience, ne
discrimine pas (`:17-29`).

`testRuneOptimParallelPairing` a deux régimes
(`tests/rune-optim-parallel-pairing.test.ts:1-42`) :

- sans plafond de temps ni de collecte, découper `bucketsA` en 1, 2, 3 ou
  4 tranches et apparier chacune indépendamment rend les mêmes paires
  explorées et exactement le même ensemble de candidats que le séquentiel ;
  une simulation séquentielle y suffit, le résultat ne dépendant ni du
  temps ni de la concurrence (`:141-185`) ;
- tronqué par un `maxMs` réaliste (30 s, `:240`), sur de vrais
  `worker_threads` concurrents qui partagent le même temps et divisent le
  plafond de candidats comme `driveParallelPairing`
  (`src/workers/parallelPairing.ts:121`) : chaque tranche reste sous son
  plafond, et une tranche non tronquée retrouve exactement ce qu'une
  référence sans plafond trouve sur la même tranche ; au moins un scénario
  doit tronquer, sinon le régime n'a pas été exercé, et au moins une
  tranche doit être tronquée — par son plafond ou par le temps : le test
  lit `truncated`, qui ne distingue pas les deux
  (`tests/rune-optim-parallel-pairing.test.ts:186-351`). Une
  simulation séquentielle y serait trop généreuse : un chrono neuf par
  tranche et le plafond global non divisé masquent une perte par famine
  de quota (`:18-42`).
