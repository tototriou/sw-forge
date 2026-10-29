# Vérification — Parallélisation

Voir aussi : [index](README.md).

## Les contrôles, par nom de registre

| Nom dans `tests/index.ts` | Fichier | Ce qu'il contrôle |
| --- | --- | --- |
| `testRuneOptimScaleMonotonicity` | `tests/rune-optim-scale-monotonicity.test.ts` | à l'échelle d'un compte réel, élargir le pré-filtrage ne perd pas les demi-builds déjà retenus |
| `testAppariementRapide` | `tests/appariement-rapide.test.ts` | le noyau d'appariement sur tableaux typés : seuils aux frontières, oracle paire par paire (aucune paire sautée ne passe `quickOk`), différentiel contre `pairBuckets`, scènes à relique portée et paire d'artéfacts figée comprises ; expiration du filet de temps pendant une ligne entièrement sautée en séquentiel, coupure au point suivant et borne de 499 paires |
| `testAppariementHorloge` | `tests/appariement-rapide.test.ts` | horloge simulée : cadence par paires traitées, borne de 499 paires supplémentaires sous `maxMs` court, résultat complet inchangé, points globaux d'un morceau décalé |
| `testFluxCandidatsCompactOrdre`, `testFluxCandidatsCoupe`, `testFluxCandidatsCredits`, `testFluxCandidatsApercuFinal`, `testFluxCandidatsPageLente`, `testFluxCandidatsReceptionOrdre` | `tests/flux-candidats.test.ts` | oracle objet contre colonnes, champs et ordre ; arrêts aux frontières des blocs, horloge logique après `suite`, arrêt parallèle comparé à la référence de chaque morceau reçu ; panne avec seize blocs non acquittés et publication suivante bloquée, attente réelle du scellement, crédits de réception indépendants de la fusion, transferts et drainage |
| `testFluxCandidatsRefusRecevoir`, `testFluxCandidatsRefusSceller`, `testFluxCandidatsRefusResultat` | `tests/flux-candidats.test.ts` | hook réel avec cellules React synchrones et Worker simulé : statut `error`, terminaison, réponses tardives et arrêt après relance ; coquille de recherche réelle importée par une entrée esbuild et exécutée dans un contexte isolé : rejet de publication finale converti en message `error`. Aucun rendu DOM ni ordonnancement de navigateur prouvé |
| `testFluxCandidatsLanceurCommun` | `tests/flux-candidats.test.ts` | instrumente `lancerAppariement` sans modifier son corps, exécute les vrais consommateurs CLI et harnais sur `quota-parallele`, vérifie les deux appels et leurs résultats entiers. La projection `apparierObjetPourTest` des différentiels reste dans ce fichier de tests, sans distribution propre |
| `testAppariementParallele`, `testAppariementParalleleWorkers`, `testAppariementParalleleCoupeWorkers`, `testAppariementParalleleBranchement` | `tests/appariement-parallele.test.ts` | le nombre de Workers et le régime ; le coordinateur parallèle contre le séquentiel (Workers simulés, puis vrais `worker_threads`) : plafond global, progression, arrêt manuel, filet de temps, panne ; un morceau coupé avant un morceau suivant achevé ; la tranche d'un Worker d'un morceau au suivant ; sur vrais `worker_threads`, des morceaux coupés en cours par le temps et par l'arrêt ; le branchement du chemin de production |
| `testClassementSelectionExhaustiveBorne`, `testClassementSelectionExhaustiveTransitions`, `testClassementSelectionExhaustiveDifferee` | `tests/classement-selection-exhaustive.test.ts` | compte les visites numériques de construction, page et maillons (sauts compris), sans chrono ; borne de sélection exhaustive, oracle linéaire de groupes/page, non-consommation en vol, rejets et doublons, journal discontinu, bascule de K, nouvelle vue/cache et aperçu vers résultat final ; vrai corps différé du banc de publication, cache commis pendant tâche, réponse retenue, ACK initial retardé et pompage final |
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

L'appariement parallèle rend le résultat du séquentiel, plafond de
candidats compris : sa vérification est donc une égalité, jamais un seuil.

- `testAppariementParallele` (`tests/appariement-parallele.test.ts`) fait
  rendre leurs morceaux dans le désordre à des Workers simulés dans le
  processus : la fusion ne dépend que de l'ordre des morceaux, que la
  simulation exerce, et le résultat doit être identique au séquentiel, non
  tronqué comme sous petit plafond. Il vérifie aussi la progression,
  l'arrêt manuel, le filet de temps déjà dépassé, la panne d'un Worker et le
  refus hors contrat ; rien de ce qu'il vérifie ne lit l'horloge en cours de
  route.
- `testAppariementParalleleWorkers` rejoue l'égalité sur de vrais
  `worker_threads` concurrents, par le lanceur Node de production.
- Sous une troncature par le TEMPS ou par l'arrêt manuel, le parallèle peut
  rendre davantage que le séquentiel (il a parcouru plus dans le même
  délai) : aucune égalité n'y est attendue. Les tests y vérifient une
  sous-suite des candidats du séquentiel non tronqué, qui en est le préfixe
  exact jusqu'au premier morceau coupé, sur un morceau réellement coupé
  avant un morceau suivant achevé, et sur de vrais `worker_threads` dont
  les morceaux sont coupés en cours (`testAppariementParalleleCoupeWorkers`).
- Aux volumes réels, hors `npm test`, `scripts/banc-appariement-rapide.ts`
  compare le chemin de production, séquentiel et parallèle, à
  `pairBuckets`, sur les cas de `CASES` et sur une recette et un export.
