// Compile le code de l'application de bureau (`bureau/`) vers `dist-bureau/`
// — chantier application-bureau, lots 1 et 1 bis.
//
// Electron charge du CommonJS : `main.cjs` et `preload.cjs`, chacun en UN
// fichier (esbuild, installé avec Vite et déjà utilisé par `tests/run.mjs`),
// `electron` laissé externe — il est fourni par l'exécutable, jamais embarqué.
//
// ⚠️ Les couleurs des deux thèmes sont LUES dans `src/index.css` (jetons
// `--bg`, `--bar`, `--ink` d'Atelier, `--forge-*` de Forge) et injectées dans
// le processus principal (`__COULEURS_THEMES__`) : la fenêtre s'habille avant
// que la page soit chargée, sans une couleur recopiée à la main.

import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const css = readFileSync('src/index.css', 'utf8');
function jeton(nom) {
  const m = css.match(new RegExp(`--${nom}:\\s*([0-9]+)\\s+([0-9]+)\\s+([0-9]+)\\s*;`));
  if (!m) throw new Error(`jeton --${nom} introuvable dans src/index.css`);
  return `#${m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}
const couleurs = {
  clair: { fond: jeton('bg'), barre: jeton('bar'), symboles: jeton('ink') },
  sombre: { fond: jeton('forge-bg'), barre: jeton('forge-bar'), symboles: jeton('forge-ink') },
};

await build({
  entryPoints: { main: 'bureau/main.ts', preload: 'bureau/preload.ts' },
  outdir: 'dist-bureau',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  define: { __COULEURS_THEMES__: JSON.stringify(couleurs) },
  logLevel: 'warning',
});
console.log(`bureau : dist-bureau/main.cjs et preload.cjs — couleurs ${JSON.stringify(couleurs)}`);
