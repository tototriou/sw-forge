# Optimizer — le moteur

Le moteur de recherche de l'Optimizer tel que le code l'exécute, un document par étape ou par
dimension. Avant d'y toucher : [../invariants.md](../invariants.md), en entier ; les contrôles qui
le couvrent sont dans [../verification.md](../verification.md).

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `src/workers/runeBuildOptim.worker.ts`, `src/workers/prepareForSearch.ts`, `src/hooks/useBuildOptimSearch.ts`, l'enchaînement d'une recherche | [pipeline.md](pipeline.md) |
| l'énumération, les élagages, le pré-filtrage, les bornes de `src/lib/runeBuildOptim.ts` | [elagages.md](elagages.md) |
| `src/workers/parallelPairing.ts`, `src/workers/pairSliceBody.ts`, `src/workers/pairSlice.worker.ts`, `src/workers/resolutionBody.ts`, `src/workers/resolutionDistante.ts` | [parallelisation.md](parallelisation.md) |
| `diagnoseFeasibility`, `rankBlockingConditions`, le « 0 résultat » | [diagnostics.md](diagnostics.md) |
| `src/lib/artifactQueue.ts`, `src/lib/artifactFiche.ts`, `src/lib/artifactEvaluation.ts`, la paire d'artéfacts d'un build | [artefacts.md](artefacts.md) |
| `src/lib/artifactOptim.ts`, l'éligibilité ou l'effet d'une ligne d'artéfact | [optimiseur-artefacts.md](optimiseur-artefacts.md) |
| `src/lib/relicOptim.ts`, `src/lib/relicQueue.ts`, `src/lib/relicExclusive.ts` | [reliques.md](reliques.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [pipeline.md](pipeline.md) | Le chemin d'une recherche de runes dans le code, de l'écran au résultat : préparation, moitiés, appariement, résolution de l'équipement, file, interruption. |
| [elagages.md](elagages.md) | La recherche des runes dans `runeBuildOptim.ts` : meet-in-the-middle, élagages sûrs, pré-filtrage, compartiments et bornes. |
| [parallelisation.md](parallelisation.md) | L'appariement parallèle en tranches, au navigateur et en Node, et le Worker de résolution de l'équipement d'un build. |
| [diagnostics.md](diagnostics.md) | Les diagnostics du moteur : preuve d'impossibilité par stat, conditions bloquantes du pré-filtrage, quasi-succès à l'appariement. |
| [artefacts.md](artefacts.md) | La paire d'artéfacts non figée : paire supposée qui note la recherche, bornes de faisabilité, test conjoint exact, vraie paire de chaque build. |
| [optimiseur-artefacts.md](optimiseur-artefacts.md) | L'optimiseur d'artéfacts `artifactOptim.ts` : éligibilité, effet de chaque ligne, focus élémentaire, script CLI. |
| [reliques.md](reliques.md) | La relique dans le moteur : lecture d'une pièce, bornes relâchées, résolution exacte par build, score de l'effet unique, oracle. |
