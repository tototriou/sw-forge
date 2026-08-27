// Lanceur : bundle `scripts/passifs-vitesse.ts` avec esbuild, puis l'exécute.
// Même patron que benchmark-optim.mjs et tests/run.mjs — c'est ce qui permet au
// script d'importer la LIB de lecture des passifs plutôt que d'en recopier les
// règles (elles avaient déjà divergé une fois).

import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dossier = mkdtempSync(join(tmpdir(), 'sw-forge-passifs-'));
const sortie = join(dossier, 'passifs.cjs');

try {
  await build({
    entryPoints: ['scripts/passifs-vitesse.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: sortie,
    logLevel: 'error',
    define: { 'import.meta.url': JSON.stringify(new URL('passifs-vitesse.ts', import.meta.url).href) },
  });
} catch {
  rmSync(dossier, { recursive: true, force: true });
  process.exit(1);
}

const p = spawn(process.execPath, [sortie], { stdio: 'inherit' });
p.on('exit', (code) => {
  rmSync(dossier, { recursive: true, force: true });
  process.exit(code ?? 0);
});
