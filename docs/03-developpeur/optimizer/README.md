# Optimizer — moteur et vérification

**Statut :** ÉTAT ACTUEL — index des documents du moteur de l'Optimizer ; ne décrit rien lui-même
**Lire si :** on cherche quel document du moteur ouvrir
**Ne pas lire si :** on cherche le comportement de l'écran : ../../02-app/optimizer/
**Voir aussi :** ../../02-app/optimizer/ (routage-par-tache.md), invariants.md

Le moteur de recherche de l'Optimizer, côté code ; le comportement de l'écran vit dans
[02-app/optimizer/](../../02-app/optimizer/README.md), et
[routage-par-tache.md](../../02-app/optimizer/routage-par-tache.md) dit quelles sections lire
selon ce qu'on touche. Avant un chantier Optimizer : [invariants.md](invariants.md), en entier.

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
