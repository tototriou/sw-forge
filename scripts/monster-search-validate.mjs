// Lanceur — même patron que tests/run.mjs / benchmark-optim.mjs.
import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dossier = mkdtempSync(join(tmpdir(), 'sw-forge-monster-validate-'));
const sortie = join(dossier, 'validate.cjs');

try {
  await build({
    entryPoints: ['scripts/monster-search-validate.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: sortie,
    logLevel: 'error',
    define: { 'import.meta.url': JSON.stringify(new URL('monster-search-validate.ts', import.meta.url).href) },
  });
} catch {
  process.exit(1);
}

const code = await new Promise((resolve) => {
  const p = spawn(process.execPath, [sortie, ...process.argv.slice(2)], { stdio: 'inherit' });
  p.on('close', resolve);
});

rmSync(dossier, { recursive: true, force: true });
process.exit(code ?? 1);
