// Option `--silencieux` du lanceur (tests/run.mjs) : seulement les échecs, les
// vérifications ignorées et le bilan. Un harnais construit ici appelle le
// moteur comme `main()` de tests/index.ts, dans un sous-processus (le moteur
// pose des écouteurs `exit` : jamais dans le processus de la suite) ; un
// second cas passe par le vrai lanceur, pour la transmission de l'option.

import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { egal, ok, titre } from './outils';

const racineDepot = resolve('.');
const versImport = (p: string) => JSON.stringify(p.split('\\').join('/'));

const HARNAIS = `
import { Execution } from ${versImport(join(racineDepot, 'tests', 'execution.ts'))};
import { bilan, debutVerification, ignore, ok, titre } from ${versImport(join(racineDepot, 'tests', 'outils.ts'))};
const ENTREES: Record<string, () => void> = {
  passe: () => { titre('TITRE-PASSE'); ok(true, 'LIGNE-OK-A'); ok(true, 'LIGNE-OK-B'); ignore('LIGNE-IGNOREE', 'absente'); },
  echoue: () => { titre('TITRE-ECHOUE'); ok(true, 'LIGNE-OK-C'); ok(false, 'ECHEC-EXPRES'); },
};
const { liste } = JSON.parse(process.argv[2]);
(async () => {
  const x = new Execution({ racine: ${JSON.stringify(racineDepot)}, manifeste: null, registre: Object.keys(ENTREES), bilan, debutVerification });
  x.fixer(liste, { mode: 'essai' });
  process.exit(await x.lancer(liste.map((n: string) => [n, ENTREES[n]])));
})().catch((e) => { console.error(e); process.exit(1); });
`;

// Séquences de couleur du lanceur, retirées pour comparer le texte.
const SANS_COULEUR = new RegExp(String.fromCharCode(27) + '\\[\\d+m', 'g');

function lancer(args: string[]): Promise<{ code: number | null; sortie: string }> {
  return new Promise((fini) => {
    const p = spawn(process.execPath, args, { cwd: racineDepot, stdio: ['ignore', 'pipe', 'pipe'] });
    let sortie = '';
    p.stdout.on('data', (d) => { sortie += d; });
    p.stderr.on('data', (d) => { sortie += d; });
    p.on('close', (code) => fini({ code, sortie: sortie.replace(SANS_COULEUR, '') }));
  });
}

export async function testRunSilencieux(): Promise<void> {
  titre('Lanceur — option --silencieux');
  const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-silencieux-'));
  try {
    const source = join(dossier, 'harnais.ts');
    const harnais = join(dossier, 'harnais.cjs');
    writeFileSync(source, HARNAIS);
    await build({
      absWorkingDir: racineDepot, entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', outfile: harnais, logLevel: 'error',
      define: { 'import.meta.url': JSON.stringify(pathToFileURL(join(racineDepot, 'tests', 'index.ts')).href) },
    });
    const liste = JSON.stringify({ liste: ['passe', 'echoue'] });
    const [bavard, calme, calmeVert, vrai] = await Promise.all([
      lancer([harnais, liste]),
      lancer([harnais, liste, '--silencieux']),
      lancer([harnais, JSON.stringify({ liste: ['passe'] }), '--silencieux']),
      lancer(['tests/run.mjs', '--silencieux', 'suivilecture']),
    ]);

    ok(bavard.sortie.includes('LIGNE-OK-A') && bavard.sortie.includes('TITRE-PASSE'),
      'sans l\'option : lignes « ok » et titres affichés, comme avant');
    egal(bavard.code, 1, 'sans l\'option : code 1 sur un échec');

    ok(calme.sortie.includes('ECHEC-EXPRES'), 'silencieux : l\'échec est présent');
    ok(/1 échec\(s\) sur 4 vérifications/.test(calme.sortie), 'silencieux : le bilan est présent');
    ok(calme.sortie.includes('LIGNE-IGNOREE'), 'silencieux : la vérification ignorée est présente, sur une ligne');
    ok(!/LIGNE-OK-[ABC]/.test(calme.sortie) && !calme.sortie.includes('TITRE-'), 'silencieux : aucune ligne « ok », aucun titre');
    egal(calme.code, bavard.code, 'silencieux : même code de sortie que sans l\'option (échec)');

    egal(calmeVert.code, 0, 'silencieux : code 0 quand tout passe');
    ok(/2 vérifications passées/.test(calmeVert.sortie) && !calmeVert.sortie.includes('LIGNE-OK-A'),
      'silencieux : bilan sans ligne « ok » quand tout passe');

    ok(vrai.code === 0 && /vérifications passées/.test(vrai.sortie) && !/ ok {3}/.test(vrai.sortie),
      `lanceur réel : l'option est transmise (code ${vrai.code}, aucune ligne « ok »)`);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}
