// Lanceur des vérifications : bundle `tests/index.ts` avec esbuild (déjà
// présent, c'est une dépendance de Vite), puis exécute le résultat avec Node.
//
// Pas de framework de test : assertions de `tests/outils.ts`, une seule
// exécution dans l'ordre de `tests/index.ts`. Ce que la suite couvre, et ce
// qu'elle ne couvre pas : tests/README.md.
//
// `--depuis <ref>` / `--plage <a>..<b>` : ne lancer que les vérifications que
// touchent les fichiers modifiés (tests/selection.ts), en plus des filtres par nom.
// `--silencieux` : n'affiche que les échecs, les vérifications ignorées et le
// bilan (et, avec `--depuis`, le nombre d'entrées retenues). Le code de sortie
// ne change pas ; sans l'option, la sortie est celle que lit `npm run test:suivi`.

import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { formater, optionsConstruction, RefusSelection, selectionDepuisGit } from './selection.ts';

// ⚠️ Sous `node_modules/`, PAS `os.tmpdir()` — `require('esbuild')` (voir
// `external` dans `optionsConstruction`) doit pouvoir se résoudre normalement
// à l'exécution depuis l'emplacement du bundle : la résolution CommonJS de Node
// remonte les `node_modules` ANCÊTRES du fichier qui appelle `require`, ce qui
// n'inclut jamais un dossier temporaire hors du dépôt. `node_modules/`
// est déjà gitignoré et déjà l'ancêtre direct de `node_modules/esbuild`.
const dossier = mkdtempSync(join('node_modules', 'swblacksmith-tests-'));
const sortie = join(dossier, 'tests.cjs');
const racine = fileURLToPath(new URL('..', import.meta.url));

// Les options de sélection sont lues ici ; le reste (filtres par nom) est
// transmis au bundle.
const args = process.argv.slice(2);
const options = {};
const transmis = [];
// `--silencieux` : seulement les échecs, les ignorées et le bilan. Transmis au
// bundle, qui le lit lui aussi (tests/outils.ts, tests/index.ts).
let silencieux = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--depuis' || args[i] === '--plage') { options[args[i].slice(2)] = args[i + 1]; i++; continue; }
  if (args[i] === '--silencieux') silencieux = true;
  transmis.push(args[i]);
}
const avecSelection = options.depuis !== undefined || options.plage !== undefined;
const fin = (code) => { rmSync(dossier, { recursive: true, force: true }); process.exit(code); };

let resultat;
const debutConstruction = Date.now();
try {
  resultat = await build({ ...optionsConstruction(racine, sortie), metafile: avecSelection });
} catch {
  fin(1); // esbuild a déjà tout dit
}
const dureeConstruction = Date.now() - debutConstruction;

if (avecSelection) {
  const fichierSelection = join(dossier, 'selection.json');
  const debut = Date.now();
  try {
    const { selection, inventaire } = await selectionDepuisGit({ racine, depuis: options.depuis, plage: options.plage, metafichier: resultat.metafile });
    // En silence : le nombre d'entrées retenues, sans la liste des fichiers ni des entrées.
    console.log(silencieux && !selection.complet
      ? `Sélection par fichiers modifiés : ${selection.fichiers.length} fichier(s) modifié(s), ${selection.retenues.length}/${inventaire.entrees.length} entrées retenues`
      : formater(selection, inventaire.entrees.length));
    writeFileSync(fichierSelection, JSON.stringify(selection));
  } catch (e) {
    if (e instanceof RefusSelection) { console.error(`\x1b[31mRefus :\x1b[0m ${e.message}`); fin(2); }
    // Jamais moins sans le dire : une sélection impossible lance tout.
    console.error('\x1b[31mSélection impossible, suite complète :\x1b[0m', e);
    writeFileSync(fichierSelection, JSON.stringify({ execution: { complet: true, noms: [], groupes: [] } }));
  }
  console.log(`(construction ${dureeConstruction} ms, sélection ${Date.now() - debut} ms)\n`);
  transmis.push('--selection', fichierSelection);
}

const code = await new Promise((resolve) => {
  // Les arguments sont transmis au bundle : ils servent à ne lancer QUE les
  // vérifications qui touchent la zone modifiée (voir tests/index.ts et
  // CLAUDE.md). Sans argument, tout tourne.
  const p = spawn(process.execPath, [sortie, ...transmis], { stdio: 'inherit' });
  p.on('close', resolve);
});

fin(code ?? 1);
