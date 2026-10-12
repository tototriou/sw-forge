# Développeur

Travailler sur le dépôt : conventions, qualité du code et hooks, tests, interface, deep-dives
techniques. Les fichiers de code, par écran : [ARCHITECTURE.md](../../ARCHITECTURE.md). Le guide
des agents et contributeurs (stack, commandes, règles de travail, doc à lire selon le code touché)
est [AGENTS.md](../../AGENTS.md) ; ce qui ne vaut que pour Claude Code (skills, pièges d'outil) est
dans [CLAUDE.md](../../CLAUDE.md), qui importe AGENTS.md — pas ici.

## Le changement touche…

| Le changement touche… | Lire |
| --- | --- |
| du code, quel qu'il soit | [conventions.md](conventions.md), [qualite-code.md](qualite-code.md) |
| `src/ui/`, `src/index.css`, `tailwind.config.js`, un écran ou un composant | [interface/](interface/README.md) |
| le moteur de l'Optimizer : `src/lib/runeBuildOptim.ts`, `src/lib/artifactOptim.ts`, les `relic…` de `src/lib/`, `src/workers/`, le harnais de `scripts/` | [optimizer/](optimizer/README.md) |
| `eslint.config.js`, `.githooks/`, `scripts/installer-hooks.mjs`, `scripts/verifier-commits.mjs`, `.github/workflows/tests.yml` | [qualite-code.md](qualite-code.md) |
| `tests/renvois.test.ts`, `tests/fixtures/renvois-toleres.json`, un fichier déplacé ou renommé | [renvois.md](renvois.md) |
| `docs/` | [documentation.md](documentation.md) |

## Documents

| Document | Contenu |
| --- | --- |
| [conventions.md](conventions.md) | Les règles valables pour toutes les pages : règle de cadre, conventions communes (saisie, persistance, réglages, champs numériques…), shell applicatif. |
| [interface/](interface/README.md) | Dessiner un écran : deux formats de premier rang, système visuel (thèmes, tokens), composants partagés de `src/ui/`. |
| [optimizer/](optimizer/README.md) | Le moteur de l'Optimizer : recherche des runes, artéfacts, reliques, parallélisation, diagnostics, harnais et vérification. |
| [qualite-code.md](qualite-code.md) | Le lint du code (ESLint) : règles bloquantes et avertissements, où il tourne ; forme du message de commit (hook `commit-msg`) ; niveaux d'application, refus du `pre-commit`, installation des hooks (à la main et à `npm install`) ; garde-fous rejoués sur chaque commit en CI. |
| [renvois.md](renvois.md) | Le garde-fou des renvois : formes relevées, résolution dans les fichiers suivis, exemptions, liste tolérée. |
| [documentation.md](documentation.md) | Les bonnes pratiques pour écrire la documentation : avant d'écrire, un document, les titres, les liens, découper ou regrouper, déplacer ou renommer, relire. |
