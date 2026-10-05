// Compile le code de l'application de bureau (`bureau/`) vers `dist-bureau/`
// — chantier application-bureau, lot 1.
//
// Electron charge du CommonJS : `main.cjs` et `preload.cjs`, chacun en UN
// fichier (esbuild, installé avec Vite et déjà utilisé par `tests/run.mjs`),
// `electron` laissé externe — il est fourni par l'exécutable, jamais embarqué.

import { build } from 'esbuild';

await build({
  entryPoints: { main: 'bureau/main.ts', preload: 'bureau/preload.ts' },
  outdir: 'dist-bureau',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  logLevel: 'warning',
});
console.log('bureau : dist-bureau/main.cjs et preload.cjs');
