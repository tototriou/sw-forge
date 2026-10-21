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

// --lister et --max-entrees sont résolus sur le registre développé, dans index.ts.
import { build } from 'esbuild';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { lireArguments, RefusArguments } from './arguments.ts';
import { formater, optionsConstruction, RefusSelection, selectionDepuisGit } from './selection.ts';

// Refus des arguments avant même la construction du registre.
const args = process.argv.slice(2);
let options;
try { options = lireArguments(args); } catch (e) {
  if (!(e instanceof RefusArguments)) throw e;
  console.error('Refus : ' + e.message);
  process.exit(2);
}
// Sous node_modules : les dépendances externes du bundle restent résolubles.
const dossier = mkdtempSync(join('node_modules', 'swblacksmith-tests-'));
const sortie = join(dossier, 'tests.cjs');
const racine = fileURLToPath(new URL('..', import.meta.url));
const transmis = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--depuis' || args[i] === '--plage') { i++; continue; }
  transmis.push(args[i]);
}
const silencieux = options.silencieux && !options.lister;
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
