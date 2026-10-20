# Optimizer — le harnais de diagnostic

L'outil qui rejoue une recherche de l'Optimizer hors de l'écran pour l'observer : une rune, un
demi-build, un « 0 résultat », une configuration, un temps. Les contrôles de l'algorithme sont dans
[../verification.md](../verification.md) ; les pièges de mesure dans le skill
`optimizer-perf-testing`.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| `scripts/lib/diagnosticHarness.ts`, `scripts/diagnostic-harness.ts`, lancer le harnais sur un cas | [mode-d-emploi.md](mode-d-emploi.md) |
| une extension du harnais : build cible, instant de découverte, dispersion, différentiel et ses profils | [extensions.md](extensions.md) |
| un script de diagnostic de `scripts/`, le harnais sur les cas réels connus (`--cas`) | [scripts.md](scripts.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [mode-d-emploi.md](mode-d-emploi.md) | Le mode d'emploi du harnais de diagnostic et ce qu'il garantit, avec le code qui porte chaque garantie. |
| [extensions.md](extensions.md) | Ce que le harnais fait au-delà de son mode d'emploi de base : niveaux de coût d'une extension, configuration, observation de la construction, build cible, instant de découverte, différentiel et ses profils. |
| [scripts.md](scripts.md) | Le harnais sur les cas réels connus (`--cas`), et les scripts de diagnostic qui restent à côté de lui : ce que chacun produit seul, ce que le harnais en couvre, comment décider d'en garder ou d'en retirer un. |
