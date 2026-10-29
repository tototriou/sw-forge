# Vérification — Harnais

Voir aussi : [index](README.md).

## Les contrôles, par nom de registre

| Nom dans `tests/index.ts` | Fichier | Ce qu'il contrôle |
| --- | --- | --- |
| `testRuneOptimOnStage` | `tests/rune-optim-onstage.test.ts` | l'observateur `onStage` ne change rien au résultat de `prepareSearch` (détail : ../harnais/mode-d-emploi.md § L'observateur onStage) |
| `testRandomPool` | `tests/random-pool.test.ts` | le pool synthétique partagé (`scripts/lib/randomPool.ts`) tire toujours la même séquence |
| `testDiagnosticHarness`, `testDiagnosticProfils`, `testDiagnosticDifferentiel`, `testDiagnosticDecouverte` | `tests/diagnostic-harness.test.ts` et voisins | le harnais de diagnostic (../harnais/mode-d-emploi.md § Harnais de diagnostic) |
