# Qualité du code — lint

**Statut :** ÉTAT ACTUEL — décrit le lint du code (ESLint) : périmètre, ce qui bloque et ce qui avertit, où il tourne
**Lire si :** on modifie `eslint.config.js`, le script `lint` de `package.json` ou l'étape « Lint » de `.github/workflows/tests.yml` ; une règle refuse un code qu'on juge correct
**Voir aussi :** `spec/outillage/spec.md` § Niveaux d'application et garde-fous

## Lint

`npm run lint` lance ESLint sur tout le dépôt, configuré dans
`eslint.config.js` : les règles recommandées de JavaScript et de
`typescript-eslint`, et, sous `src/`, les deux règles historiques de
`eslint-plugin-react-hooks` (`rules-of-hooks` en erreur, `exhaustive-deps` en
avertissement). Ignorés : les sorties de build et de paquet, les dépendances,
les données publiques, l'historique de l'éditeur et les rapports de
couverture (liste exacte dans `ignores`).

**Une erreur bloque, un avertissement s'affiche.** Une règle n'est en erreur
que si le dépôt entier la respecte déjà : `npm run lint` sort en code 0 sur la
branche principale. Une règle que le code enfreint encore est en
avertissement jusqu'à ce que le dépôt soit propre, puis passe en erreur.

En avertissement, avec la raison :

| Règle | Raison |
| --- | --- |
| `@typescript-eslint/no-unused-vars`, `no-useless-assignment` | code mort existant ; repasse en erreur une fois retiré. Un nom commençant par `_` est un inutilisé assumé |
| `@typescript-eslint/no-explicit-any` | se remplace au fil des modifications ; coupée dans `tests/` |
| `react-hooks/exhaustive-deps` | chaque cas se juge ; une exclusion voulue porte `eslint-disable-next-line` et sa raison |

Choix assumés :

- `no-unused-expressions` accepte le ternaire et le court-circuit :
  `ensemble.has(x) ? ensemble.delete(x) : ensemble.add(x)` est l'idiome de
  bascule de l'interface.
- Les autres règles de `eslint-plugin-react-hooks` v7 (`refs`,
  `set-state-in-effect`, `immutability`…) ne sont pas activées : elles servent
  le React Compiler, que l'app n'utilise pas.
- Les `eslint-disable` sans effet ne sont pas signalés : ceux du dépôt
  documentent une dépendance d'effet exclue volontairement.
- Globales : navigateur sous `src/`, Node pour `bureau/`, `scripts/`,
  `tests/`, `.claude/` et la racine, les deux pour les pilotes Playwright
  (`.claude/skills/**`, `scripts/preuve-session-site.mjs`), dont une partie du
  code s'exécute dans la page.
- Dans `tests/`, les règles sur les expressions régulières littérales, `any`,
  `require` et `?.…!` sont coupées : les tests comparent du texte source et
  manipulent des objets partiels.

**Où il tourne** : en local par `npm run lint` ; en CI, étape « Lint » de
`.github/workflows/tests.yml`, entre les types et la suite complète, sur
chaque pull request vers `main` ou `release/**`.
