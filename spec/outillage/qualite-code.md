# Qualité du code — lint et message de commit

**Statut :** ÉTAT ACTUEL — décrit le lint du code (ESLint) : périmètre, ce qui bloque et ce qui avertit, où il tourne, dont le lint au commit ; la forme imposée au message de commit ; l'installation automatique des hooks et leur reprise en CI
**Lire si :** on modifie `eslint.config.js`, les scripts `lint` ou `prepare` de `package.json`, le mode `--automatique` de `scripts/installer-hooks.mjs`, l'étape « Lint » de `.github/workflows/tests.yml`, l'étape ESLint ou le mode `--commit` de `.githooks/pre-commit`, `.githooks/commit-msg`, `scripts/verifier-commits.mjs` ou l'étape « Garde-fous de commit » ; une règle refuse un code ou un message qu'on juge correct
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
chaque pull request vers `main` ou `release/**` ; au commit, par le hook
`pre-commit` (ci-dessous).

## Lint au commit

Le hook `pre-commit` (`.githooks/pre-commit`, installé par
`node scripts/installer-hooks.mjs`) lance l'ESLint du dépôt sur les fichiers
de code indexés — ajoutés, copiés, modifiés ou renommés, d'extension `.ts`,
`.tsx`, `.js`, `.mjs` ou `.cjs` —, avec `--quiet` : **une erreur refuse le
commit**, un avertissement ne s'affiche pas. Les fichiers passent par paquets
de 100, sous la limite de longueur d'une ligne de commande Windows.

- Pas de `eslint.config.js` à la racine (branche antérieure au lint) : pas de
  lint.
- ESLint absent de `node_modules` (clone sans `npm install`) : lint sauté,
  avec un avertissement. Le hook n'est jamais requis.
- **Limite assumée** : ESLint lit l'**arbre de travail**, pas la version
  indexée ; un fichier corrigé sur le disque mais pas réindexé passe, un
  fichier propre dans l'index mais fautif sur le disque est refusé.

Test : `node tests/run.mjs precommit`.

## Installation automatique

`npm install` et `npm ci` installent les hooks : le script `prepare` de
`package.json` lance `node scripts/installer-hooks.mjs --automatique`, qui
copie et câble comme l'installation manuelle (`spec/outillage/spec.md`
§ Installation des garde-fous), avec quatre différences :

- **Jamais d'échec** : hors d'un dépôt Git, source absente, argument inconnu
  ou erreur inattendue donnent un avertissement et le code 0 ;
  l'installation des dépendances continue.
- **Rien en CI** (variable `CI` présente) : les vérifications y passent par
  le workflow.
- **Jamais de retour en arrière** : une installation existante n'est
  remplacée que si la tête courante contient son `commitSource`. Un
  `npm install` sur une branche plus ancienne ou divergente garde
  l'installation, qui sert tous les worktrees du dépôt ; l'installation
  manuelle remplace toujours.
- Un câblage tiers reste signalé, jamais écrasé, comme à la main.

Test : `node tests/run.mjs installationautomatique`.

## Message de commit

Le hook `commit-msg` (`.githooks/commit-msg`, même installation que
`pre-commit`, jamais requis, contournable par `--no-verify`) lit le message
sans ses lignes de commentaire `#` ni ce qui suit la ligne de ciseaux de
`git commit -v`, lignes vides de tête retirées. Il refuse :

- un **sujet** (première ligne) hors de la forme
  `type(portée): description` — type parmi `feat`, `fix`, `docs`, `style`,
  `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert` ; portée
  facultative, non vide ; `!` facultatif avant les deux-points pour un
  changement incompatible ; une espace puis une description non vide ;
- une **deuxième ligne non vide** : le corps commence après une ligne vide ;
- une **marque d'ordre d'octets** (BOM) en tête, signe d'un here-string
  PowerShell passé par un tube : le refus nomme la cause.

Passent tels quels les messages qu'écrit Git — sujet commençant par
`Merge `, `Revert "`, `fixup! `, `squash! ` ou `amend! ` — et un message vide,
que Git abandonne lui-même. **Aucune limite de longueur** : le hook n'impose
que ce que l'historique respecte déjà, et des sujets légitimes dépassent
100 caractères. La langue du message n'est pas vérifiée.

Test : `node tests/run.mjs commitmsg`.

## Garde-fous rejoués en CI

`--no-verify` reste possible en local, pas dans la CI : l'étape « Garde-fous
de commit » de `.github/workflows/tests.yml`, sur chaque pull request, lance
`node scripts/verifier-commits.mjs <base> <tête>` avant l'installation des
dépendances. Pour **chaque commit** de `<base>..<tête>` :

- son message passe par `.githooks/commit-msg` ;
- hors fusion, son contenu passe par `.githooks/pre-commit --commit <sha>` :
  les refus de chemin privé et de fichier de plus de 5 Mo, sur les
  fichiers ajoutés, copiés, modifiés ou renommés par ce
  commit, lus dans le commit au lieu de l'index. Le contrôle de branche,
  spec-lint et ESLint n'y tournent pas : la CI vérifie l'état final par
  `npm test` et `npm run lint`.

Chaque commit compte, pas seulement l'état final : l'historique d'un dépôt
public l'est aussi, et un fichier ajouté puis retiré dans la même pull
request y reste. Une fusion n'apporte pas de contenu à elle : seuls ses
parents sont lus. Un refus cite chaque commit fautif et ses diagnostics, et
fait échouer l'étape ; on corrige l'historique de la branche.

Limite assumée : les hooks rejoués sont ceux de la pull request elle-même ;
une pull request qui affaiblit un hook se juge en revue.

Test : `node tests/run.mjs verifiercommits`.
