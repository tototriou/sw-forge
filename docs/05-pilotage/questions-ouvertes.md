# Questions ouvertes

Une question par ligne : ce qui est à trancher, où le cas se pose, depuis quand. Une question
tranchée quitte ce registre ; sa réponse vit dans la documentation ou dans un ADR.

| Question | Où | Depuis |
| --- | --- | --- |
| Quel cadre de tests adopter (Vitest, tests de bout en bout, couverture) en plus du lanceur `tests/run.mjs` ? | [tests/README.md](../../tests/README.md) | 2026-10-08 |
| Quelle est la taille du tick en RTA ? Le mainteneur la donne à 7 % ; la source citée par la fiche (Ellia's Wiki) donne 7 % « in most areas », 4,5 % en raid et 1,5 % en RTA. À citer ou à mesurer en jeu avant de toucher au texte de la page Mécaniques ou à la fiche. | [feat-formule.md](../02-app/speed-tuning/feat-formule.md), « Mode RTA » ; [mecaniques/](../02-app/mecaniques/README.md) | 2026-10-13 |
| Le workflow de données pousse sur une branche fixe, `forge/donnees-swarfarm` : la renommer selon la convention `<type>/<sujet>` (`chore/donnees-swarfarm`), au prix d'une branche neuve et de l'ancienne laissée de côté ? | `.github/workflows/update-data.yml` | 2026-10-12 |
