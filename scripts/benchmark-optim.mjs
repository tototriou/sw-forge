// Lanceur du benchmark : bundle `scripts/benchmark-optim.ts` avec esbuild
// (déjà présent, dépendance de Vite), puis exécute le résultat avec Node.
// Même patron que tests/run.mjs — voir tests/README.md pour le pourquoi de
// esbuild plutôt qu'un framework.

import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dossier = mkdtempSync(join(tmpdir(), 'sw-forge-benchmark-'));
const sortie = join(dossier, 'benchmark.cjs');

try {
  await build({
    entryPoints: ['scripts/benchmark-optim.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: sortie,
    logLevel: 'error',
    define: { 'import.meta.url': JSON.stringify(new URL('benchmark-optim.ts', import.meta.url).href) },
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
