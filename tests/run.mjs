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
import { join } from 'path';

// ⚠️ Sous `node_modules/`, PAS `os.tmpdir()` — `require('esbuild')` (voir
// `external` plus bas) doit pouvoir se résoudre normalement à l'exécution
// depuis l'emplacement du bundle : la résolution CommonJS de Node remonte
// les `node_modules` ANCÊTRES du fichier qui appelle `require`, ce qui
// n'inclut jamais un dossier temporaire hors du dépôt. `node_modules/`
// est déjà gitignoré et déjà l'ancêtre direct de `node_modules/esbuild`.
const dossier = mkdtempSync(join('node_modules', 'sw-forge-tests-'));
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
    // ⚠️ esbuild ne peut PAS être bundlé lui-même (son API a besoin d'un
    // exécutable externe, localisé via un chemin RELATIF à son propre
    // package sur disque — un chemin qui devient faux une fois inliné dans
    // un autre fichier). Nécessaire depuis que rune-optim-parallel-pairing.test.ts
    // bundle lui-même un worker (`scripts/lib/pairing-quota-worker.ts`, VRAIS
    // `worker_threads` concurrents) — `require('esbuild')` reste un require
    // normal, résolu à l'exécution depuis node_modules, jamais inliné.
    external: ['esbuild'],
  });
} catch {
  process.exit(1); // esbuild a déjà tout dit
}

const code = await new Promise((resolve) => {
  // Les arguments sont transmis au bundle : ils servent à ne lancer QUE les
  // vérifications qui touchent la zone modifiée (voir tests/index.ts et
  // CLAUDE.md). Sans argument, tout tourne.
  const p = spawn(process.execPath, [sortie, ...process.argv.slice(2)], { stdio: 'inherit' });
  p.on('close', resolve);
});

rmSync(dossier, { recursive: true, force: true });
process.exit(code ?? 1);
