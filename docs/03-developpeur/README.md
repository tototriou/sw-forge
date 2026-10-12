# Développeur

Travailler sur le dépôt : conventions, qualité du code et hooks, tests, interface, deep-dives
techniques. Les fichiers de code, par écran : [ARCHITECTURE.md](../../ARCHITECTURE.md). Les
instructions destinées à l'agent Claude Code (déclencheurs de skills, pièges d'environnement,
vérifications) vivent dans [CLAUDE.md](../../CLAUDE.md), chargé à chaque session — pas ici.

| Document | Contenu |
| --- | --- |
| [conventions.md](conventions.md) | Les règles valables pour toutes les pages : règle de cadre, conventions communes (saisie, persistance, réglages, champs numériques…), shell applicatif. |
| [interface/](interface/README.md) | Dessiner un écran : deux formats de premier rang, système visuel (thèmes, tokens), composants partagés de `src/ui/`. |
| [optimizer/](optimizer/README.md) | Le moteur de l'Optimizer : recherche des runes, artéfacts, reliques, parallélisation, diagnostics, harnais et vérification. |
| [qualite-code.md](qualite-code.md) | Le lint du code (ESLint) : règles bloquantes et avertissements, où il tourne ; forme du message de commit (hook `commit-msg`) ; installation des hooks à `npm install` ; garde-fous rejoués sur chaque commit en CI. |
| [renvois.md](renvois.md) | Le garde-fou des renvois : formes relevées, résolution dans les fichiers suivis, exemptions, liste tolérée. |
| [outillage-docs.md](outillage-docs.md) | L'outillage de la documentation : natures et en-têtes des documents, `spec-markdown`, `spec-toc`, contrat de `spec-lint`, critère des invariants, niveaux d'application et installation des garde-fous (hook `pre-commit`). |
