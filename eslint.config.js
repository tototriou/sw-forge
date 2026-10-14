// Lint du dépôt — `npm run lint`. Contrat : docs/03-developpeur/ (qualité du code).
//
// ⚠️ Une ERREUR bloque le commit (hook `pre-commit`) et la CI ; un
// AVERTISSEMENT s'affiche sans bloquer. Le code actuel passe sans erreur :
// une règle n'est en erreur que si le dépôt la respecte déjà.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-bureau/**', 'paquets/**', 'public/**', 'node_modules/**', '.history/**', 'coverage/**'],
  },
  {
    // Les `eslint-disable` existants documentent des dépendances d'effet
    // exclues volontairement, chacun avec sa raison au-dessus : on les garde
    // même quand la version actuelle du plugin ne signale plus rien.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Avertissement tant que le code mort existant n'est pas retiré ; repasse
      // en erreur une fois le dépôt propre. `_` en tête = inutilisé assumé.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-useless-assignment': 'warn',
      // Signalé, pas bloquant : un `any` se remplace au fil des modifications.
      '@typescript-eslint/no-explicit-any': 'warn',
      // `ensemble.has(x) ? ensemble.delete(x) : ensemble.add(x)` est l'idiome
      // de bascule de l'interface.
      '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true, allowShortCircuit: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    // Les deux règles historiques seulement. Les autres règles de la v7
    // (`refs`, `set-state-in-effect`, `immutability`…) servent le React
    // Compiler, que l'app n'utilise pas.
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Conventions d'AGENTS.md que le texte du code suffit à vérifier.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'Aucune boîte native : une confirmation passe par src/ui/Dialogs.tsx.' },
        { name: 'prompt', message: 'Aucune boîte native : une saisie passe par src/ui/Dialogs.tsx.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='window'][callee.property.name=/^(confirm|prompt)$/]",
          message: 'Aucune boîte native : une confirmation ou une saisie passe par src/ui/Dialogs.tsx.',
        },
        {
          selector: "JSXAttribute[name.name='type'][value.value='number']",
          message: 'Un champ numérique est un NumberField (src/ui/), jamais un type="number".',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'localStorage',
          property: 'setItem',
          message: 'Une donnée s\'écrit par saveLocal (src/hooks/usePersistence.ts) : un refus de conservation vaut pour toute l\'app.',
        },
      ],
    },
  },
  {
    // `saveLocal` lui-même, et les clés de réglage, conservées même sans
    // l'accord de conservation (docs/02-app/transverse/feat-import-compte/persistance.md).
    files: [
      'src/hooks/usePersistence.ts',
      'src/hooks/useTheme.ts',
      'src/hooks/useOvercapDisplay.ts',
      'src/hooks/useRuneMetric.ts',
      'src/hooks/useAdversaireReference.ts',
    ],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['bureau/**/*.ts', 'scripts/**/*.{ts,mjs,js}', 'tests/**/*.{ts,tsx,mjs}', '.claude/**/*.mjs', '*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // Pilotes Playwright : une partie de leur code s'exécute DANS la page.
    files: ['.claude/skills/**/*.mjs', 'scripts/preuve-session-site.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    // Les tests comparent du texte source avec des expressions régulières
    // littérales (espaces typographiques, échappements recopiés tels quels)
    // et manipulent des objets partiels.
    files: ['tests/**/*.{ts,tsx,mjs}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'off',
      // `tests/rendu/outils-rendu.tsx` modifie l'objet module CommonJS de React.
      '@typescript-eslint/no-require-imports': 'off',
      'no-regex-spaces': 'off',
      'no-control-regex': 'off',
      'no-irregular-whitespace': 'off',
      'no-useless-escape': 'off',
    },
  },
);
