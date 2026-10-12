# Optimizer — moteur et vérification

Le moteur de recherche de l'Optimizer, côté code ; le comportement de l'écran vit dans
[02-app/optimizer/](../../02-app/optimizer/README.md), et
[routage-par-tache.md](../../02-app/optimizer/routage-par-tache.md) dit quelles sections lire
selon ce qu'on touche. Avant un chantier Optimizer : [invariants.md](invariants.md), en entier.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| quoi que ce soit du moteur | [invariants.md](invariants.md), en entier, d'abord |
| `src/workers/runeBuildOptim.worker.ts`, `src/workers/prepareForSearch.ts`, `src/hooks/useBuildOptimSearch.ts`, l'enchaînement d'une recherche | [moteur-pipeline.md](moteur-pipeline.md) |
| l'énumération, les élagages, le pré-filtrage, les bornes de `src/lib/runeBuildOptim.ts` | [moteur-elagages.md](moteur-elagages.md) |
| `src/workers/parallelPairing.ts`, `src/workers/pairSliceBody.ts`, `src/workers/pairSlice.worker.ts`, `src/workers/resolutionBody.ts`, `src/workers/resolutionDistante.ts` | [moteur-parallelisation.md](moteur-parallelisation.md) |
| `diagnoseFeasibility`, `rankBlockingConditions`, le « 0 résultat » | [moteur-diagnostics.md](moteur-diagnostics.md) |
| `src/lib/artifactQueue.ts`, `src/lib/artifactFiche.ts`, `src/lib/artifactEvaluation.ts`, la paire d'artéfacts d'un build | [moteur-artefacts.md](moteur-artefacts.md) |
| `src/lib/artifactOptim.ts`, l'éligibilité ou l'effet d'une ligne d'artéfact | [moteur-optimiseur-artefacts.md](moteur-optimiseur-artefacts.md) |
| `src/lib/relicOptim.ts`, `src/lib/relicQueue.ts`, `src/lib/relicExclusive.ts` | [moteur-reliques.md](moteur-reliques.md) |
| un contrôle de l'algorithme : oracle, différentiel, benchmark | [verification.md](verification.md) |
| `scripts/lib/diagnosticHarness.ts`, `scripts/diagnostic-harness.ts` | [harnais.md](harnais.md), [harnais-extensions.md](harnais-extensions.md) |
| un script de diagnostic de `scripts/`, le harnais sur les cas réels (`--cas`) | [harnais-scripts.md](harnais-scripts.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [invariants.md](invariants.md) | Les contraintes critiques de l'Optimizer, chacune avec sa source. Se lit en entier. |
| [moteur-pipeline.md](moteur-pipeline.md) | Le chemin d'une recherche de runes dans le code, de l'écran au résultat : préparation, moitiés, appariement, résolution de l'équipement, file, interruption. |
| [moteur-elagages.md](moteur-elagages.md) | La recherche des runes dans `runeBuildOptim.ts` : meet-in-the-middle, élagages sûrs, pré-filtrage, compartiments et bornes. |
| [moteur-parallelisation.md](moteur-parallelisation.md) | L'appariement parallèle en tranches, au navigateur et en Node, et le Worker de résolution de l'équipement d'un build. |
| [moteur-diagnostics.md](moteur-diagnostics.md) | Les diagnostics du moteur : preuve d'impossibilité par stat, conditions bloquantes du pré-filtrage, quasi-succès à l'appariement. |
| [moteur-artefacts.md](moteur-artefacts.md) | La paire d'artéfacts non figée : paire supposée qui note la recherche, bornes de faisabilité, test conjoint exact, vraie paire de chaque build. |
| [moteur-optimiseur-artefacts.md](moteur-optimiseur-artefacts.md) | L'optimiseur d'artéfacts `artifactOptim.ts` : éligibilité, effet de chaque ligne, focus élémentaire, script CLI. |
| [moteur-reliques.md](moteur-reliques.md) | La relique dans le moteur : lecture d'une pièce, bornes relâchées, résolution exacte par build, score de l'effet unique, oracle. |
| [verification.md](verification.md) | Les contrôles qui couvrent l'algorithme de recherche : référence exhaustive, oracles, différentiels, benchmarks, validation sur un compte réel. |
| [harnais.md](harnais.md) | Le mode d'emploi du harnais de diagnostic (une rune, un demi-build, un « 0 résultat », un temps) et ce qu'il garantit. |
| [harnais-extensions.md](harnais-extensions.md) | Les extensions du harnais : niveaux de coût, build cible, instant de découverte, dispersion par tranche, différentiel et ses profils. |
| [harnais-scripts.md](harnais-scripts.md) | Le harnais sur les cas réels connus (`--cas`), et les scripts de diagnostic qui restent à côté de lui. |

## Tenir `invariants.md`

### Statut du fichier

[invariants.md](invariants.md) est un **index de contraintes critiques**,
pas une source normative. Chaque entrée : une contrainte, impérative ou
descriptive, qui dit ce qui doit rester vrai, suivie de
**`Source : fichier § section`** (référence durable ; un `fichier:ligne`
ne sert qu'au contrôle ponctuel). Le fichier est groupé par sujet et **se
lit en entier au démarrage d'un chantier Optimizer** : c'est le seul
fichier pour lequel cette lecture intégrale est assumée. Il est tenu
compact pour ça ; sa longueur est un objectif de compacité, **jamais une
consigne de coupe** : une règle qui répond au critère y figure, quitte à en
resserrer la formulation.

Maintenance : **une règle normative modifiée se modifie dans sa source ET
dans `invariants.md`, dans le même commit**. Aucun outil ne vérifie qu'une
`Source : fichier § section` vise encore un titre existant : qui renomme ou
déplace une section cherche son ancien intitulé dans `invariants.md`
([../documentation.md](../documentation.md), « Renommer un titre »).

### Critère des invariants

Entre dans `invariants.md` une règle qu'**un chantier qui l'ignore casse**,
y compris une règle de méthode dont l'oubli fausse une conclusion (mesure,
harnais) ; pas un résumé de ce qui est vrai, pas une raison. Une relecture
des sections d'état actuel cherche explicitement trois familles, souvent
formulées en description, sans en faire une liste fermée :

- **dérivé de** : une valeur se déduit d'autre chose, jamais saisie ni
  listée à la main ;
- **ordre fixe** : une séquence d'étapes dont l'ordre change le résultat ;
- **constante** : un seuil ou une valeur qui ne découle d'aucune règle plus
  générale et casserait silencieusement si on la changeait ailleurs.

Conduite :

- Se lisent **toutes** les sections d'état actuel touchées, pas seulement
  celles qui semblent candidates : un invariant est souvent une phrase
  perdue dans une description.
- **Aucun fichier d'un dossier `decisions`** n'est une source d'invariants : une
  décision se cite, elle ne se réextrait pas.
- Une règle connue d'un agent (mémoire, habitude) ne **prouve** jamais un
  invariant : elle n'entre que si elle est retrouvée dans une source
  normative du dépôt, avec son `Source : fichier § section`.
- Une règle ajoutée se compare à `invariants.md` existant, pour n'écrire
  que les absentes.
