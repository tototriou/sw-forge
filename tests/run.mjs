// Lanceur des vérifications : bundle `tests/index.ts` avec esbuild (déjà
// présent, c'est une dépendance de Vite), puis exécute le résultat avec Node.
//
// ⚠️ **Pas de framework de test, et c'est un choix.** Ce qui est vérifié ici,
// ce sont des fonctions pures et une base de données — des assertions suffisent.
// Vitest ou Jest apporteraient une configuration, des versions à suivre et une
// couche de magie (mocks, transformations) pour un bénéfice nul à cette échelle.
// Le jour où il faudra tester des composants React, la question se reposera.

import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const dossier = mkdtempSync(join(tmpdir(), 'sw-forge-tests-'));
const sortie = join(dossier, 'tests.cjs');

try {
  await build({
    entryPoints: ['tests/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: sortie,
    logLevel: 'error',
    // `import.meta.url` sert à retrouver la racine du dépôt depuis les tests.
    define: { 'import.meta.url': JSON.stringify(new URL('index.ts', import.meta.url).href) },
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
