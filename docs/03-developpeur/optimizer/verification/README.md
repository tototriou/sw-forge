# Vérification

Voir aussi : ../invariants.md, ../harnais/mode-d-emploi.md, ../moteur/elagages.md, ../../../02-app/optimizer/ (routage-par-tache.md).

Tout changement de `src/lib/runeBuildOptim.ts` suit la discipline du skill
`algo-verify` (`.claude/skills/algo-verify/SKILL.md`) : une référence de
contrôle indépendante, un test différentiel contre elle, et une mesure avant
de figer une constante. Les contrôles ci-dessous tournent dans `npm test`,
sauf les benchmarks et les scripts sur compte réel. Pendant le travail,
`node tests/run.mjs <filtre>` ne lance que les vérifications dont le nom
contient le filtre (registre : `tests/index.ts`), par exemple
`node tests/run.mjs rune-optim dominance`.

## Les contrôles, par nom de registre

Chaque fiche porte les contrôles de son domaine et leurs explications.

- [Runes](runes.md).
- [Reliques et artéfacts](reliques-et-artefacts.md).
- [Parallélisation](parallelisation.md).
- [Harnais](harnais.md).
- [Mesures et compte réel](mesures.md).
