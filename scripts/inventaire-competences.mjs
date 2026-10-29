// Lanceur de l'inventaire des compétences : bundle
// `scripts/inventaire-competences.ts` avec esbuild (déjà présent, dépendance
// de Vite), puis exécute le résultat avec Node. Même patron que
// scripts/passifs-vitesse.mjs. La logique vit dans le .ts, jamais ici.
//
//   node scripts/inventaire-competences.mjs --aide

import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-inventaire-competences-'));
const sortie = join(dossier, 'inventaire-competences.cjs');

try {
  await build({
    entryPoints: [fileURLToPath(new URL('inventaire-competences.ts', import.meta.url))],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: sortie,
    logLevel: 'error',
    // Le script résout la racine du dépôt depuis son propre emplacement.
    define: { 'import.meta.url': JSON.stringify(new URL('inventaire-competences.ts', import.meta.url).href) },
  });
} catch {
  process.exit(1); // esbuild a déjà tout dit
}

const code = await new Promise((resolve) => {
  const p = spawn(process.execPath, [sortie, ...process.argv.slice(2)], { stdio: 'inherit' });
  p.on('close', resolve);
});

rmSync(dossier, { recursive: true, force: true });
process.exit(code ?? 1);
