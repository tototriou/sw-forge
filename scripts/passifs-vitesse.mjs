// Lanceur de l'inventaire des passifs de vitesse : bundle
// `scripts/passifs-vitesse.ts` avec esbuild (déjà présent, dépendance de
// Vite), puis exécute le résultat avec Node. Même patron que
// scripts/benchmark-optim.mjs. La logique vit dans le .ts, jamais ici.
//
//   node scripts/passifs-vitesse.mjs   → spec/outils/passifs-vitesse.md
//
// À relancer après chaque mise à jour de `public/data/skills`.

import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-passifs-vitesse-'));
const sortie = join(dossier, 'passifs-vitesse.cjs');

try {
  await build({
    entryPoints: ['scripts/passifs-vitesse.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: sortie,
    logLevel: 'error',
    // Le script résout ses chemins depuis son propre emplacement.
    define: { 'import.meta.url': JSON.stringify(new URL('passifs-vitesse.ts', import.meta.url).href) },
  });
} catch {
  process.exit(1); // esbuild a déjà tout dit
}

const code = await new Promise((resolve) => {
  const p = spawn(process.execPath, [sortie], { stdio: 'inherit' });
  p.on('close', resolve);
});

rmSync(dossier, { recursive: true, force: true });
process.exit(code ?? 1);
