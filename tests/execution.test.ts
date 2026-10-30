// Vérifications de l'exécution prouvée (tests/execution.ts) : chaque défaut
// d'exécution est provoqué dans un sous-processus — un harnais construit ici,
// qui appelle le moteur comme `main()` de tests/index.ts — puis le point
// d'entrée réel est lancé par tests/run.mjs (refus d'emplacement, manifeste).
//
// ⚠️ Jamais d'`Execution` dans le processus de la suite : son constructeur
// pose des écouteurs `exit` et de signaux sur le processus qui l'appelle.

import { build } from 'esbuild';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emplacementManifeste, etatContenu, RefusManifeste } from './execution';
import { egal, ok, titre } from './outils';

const racineDepot = resolve('.');
// Chemins factices sous tests/, qui n'existent jamais : construits par
// morceaux, ce ne sont pas des renvois (tests/renvois.test.ts).
const factice = (...morceaux: string[]) => ['tests', ...morceaux].join('/');
const versImport = (p: string) => JSON.stringify(p.split('\\').join('/'));

// Les entrées du faux registre : une par comportement à provoquer.
const HARNAIS = `
import { Execution } from ${versImport(join(racineDepot, 'tests', 'execution.ts'))};
import { bilan, debutVerification, ignore, ok } from ${versImport(join(racineDepot, 'tests', 'outils.ts'))};
const ENTREES: Record<string, () => void | Promise<void>> = {
  a: () => ok(true, 'a'),
  b: async () => { await new Promise((r) => setTimeout(r, 5)); ok(true, 'b'); },
  ignoree: () => ignore('ignoree', 'fichier absent'),
  vide: () => {},
  leve: () => { throw new Error('boum'); },
  sort: () => { process.exit(0); },
  pend: () => new Promise<void>(() => {}),
  bloque: () => { console.log('BLOQUEE'); return new Promise<void>(() => { setInterval(() => {}, 1000); }); },
};
const { attendues, liste, manifeste, racine } = JSON.parse(process.argv[2]);
(async () => {
  const x = new Execution({ racine, manifeste, registre: Object.keys(ENTREES), bilan, debutVerification });
  x.fixer(attendues, { mode: 'essai' });
  process.exit(await x.lancer(liste.map((n: string) => [n, ENTREES[n]])));
})().catch((e) => { console.error(e); process.exit(1); });
`;

interface Issue { code: number | null; signal: string | null; sortie: string; manifeste: any }

function lancerProcessus(args: string[], tuer = false): Promise<{ code: number | null; signal: string | null; sortie: string }> {
  return new Promise((fini) => {
    const p = spawn(process.execPath, args, { cwd: racineDepot, stdio: ['ignore', 'pipe', 'pipe'] });
    let sortie = '';
    const lire = (d: Buffer) => {
      sortie += d;
      // Au-delà de la période d'écriture du manifeste (250 ms), puis arrêt brutal.
      if (tuer && sortie.includes('BLOQUEE')) { tuer = false; setTimeout(() => p.kill('SIGTERM'), 700); }
    };
    p.stdout.on('data', lire);
    p.stderr.on('data', lire);
    p.on('close', (code, signal) => fini({ code, signal, sortie }));
  });
}

const lireManifeste = (chemin: string) => { try { return JSON.parse(readFileSync(chemin, 'utf8')); } catch { return null; } };

async function cas(harnais: string, manifeste: string, attendues: string[], liste: string[], tuer = false): Promise<Issue> {
  const r = await lancerProcessus([harnais, JSON.stringify({ attendues, liste, manifeste, racine: racineDepot })], tuer);
  return { ...r, manifeste: lireManifeste(manifeste) };
}

const entree = (i: Issue, id: string) => (i.manifeste?.entrees ?? []).find((e: { id: string }) => e.id === id);

export async function testExecutionProuveeCas(): Promise<void> {
  titre('Exécution prouvée — défauts d\'exécution provoqués en sous-processus');
  const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-execution-'));
  try {
    const source = join(dossier, 'harnais.ts');
    const harnais = join(dossier, 'harnais.cjs');
    writeFileSync(source, HARNAIS);
    await build({
      absWorkingDir: racineDepot, entryPoints: [source], bundle: true, platform: 'node', format: 'cjs', outfile: harnais, logLevel: 'error',
      define: { 'import.meta.url': JSON.stringify(pathToFileURL(join(racineDepot, 'tests', 'index.ts')).href) },
    });
    const m = (n: string) => join(dossier, `${n}.json`);
    const [temoin, sautee, exception, sortie, pendante, signal, vide] = await Promise.all([
      cas(harnais, m('temoin'), ['a', 'b', 'ignoree'], ['a', 'b', 'ignoree']),
      cas(harnais, m('sautee'), ['a', 'b'], ['a', 'ignoree']),
      cas(harnais, m('exception'), ['a', 'leve', 'b'], ['a', 'leve', 'b']),
      cas(harnais, m('sortie'), ['a', 'sort', 'b'], ['a', 'sort', 'b']),
      cas(harnais, m('pendante'), ['a', 'pend', 'b'], ['a', 'pend', 'b']),
      cas(harnais, m('signal'), ['a', 'bloque'], ['a', 'bloque'], true),
      cas(harnais, m('vide'), ['vide'], ['vide']),
    ]);

    ok(temoin.code === 0 && temoin.manifeste?.complet === true && temoin.manifeste.succes === true,
      `témoin : code 0, manifeste complet et réussi (code ${temoin.code}, ${temoin.manifeste?.etat})`);
    ok(temoin.sortie.includes('2 contrôlée(s), 1 entièrement ignorée(s) (ignoree)') && temoin.sortie.includes('3 exécutée(s)'),
      'témoin : exécutées, contrôlées et entièrement ignorées comptées à part en sortie');
    egal([entree(temoin, 'a')?.controles, entree(temoin, 'ignoree')?.controles, entree(temoin, 'ignoree')?.ignores], [1, 0, 1],
      'témoin : contrôles et ignorés journalisés par entrée');

    ok(sautee.code === 1 && sautee.sortie.includes('b — attendue, jamais invoquée') && sautee.sortie.includes('ignoree — exécutée sans être attendue'),
      `entrée sautée : échec, l'attendue non invoquée et l'inattendue nommées (code ${sautee.code})`);
    ok(sautee.manifeste?.complet === true && sautee.manifeste.succes === false && sautee.manifeste.echecs?.length === 2,
      'entrée sautée : manifeste complet, en échec, deux constats');

    ok(exception.code === 1 && exception.sortie.includes('leve — exception : boum') && !exception.sortie.includes('jamais invoquée'),
      `exception : échec nommé, la suite continue (code ${exception.code})`);
    egal([entree(exception, 'leve')?.etat, entree(exception, 'b')?.etat, entree(exception, 'b')?.controles], ['exception', 'rendue', 1],
      'exception : journalisée sur son entrée, la suivante exécutée et contrôlée');
    ok(exception.sortie.includes("Après l'exception de leve :") && exception.sortie.includes('1 entrée(s) ont tourné ensuite')
      && exception.manifeste?.premiereException === 'leve' && exception.manifeste.complet === true,
    'exception : le bilan et le manifeste nomment la première exception et ce qui a tourné après');
    ok(!temoin.sortie.includes("Après l'exception") && temoin.manifeste?.premiereException === null,
      'témoin : aucune mention d\'exception');

    ok(sortie.code === 1 && sortie.sortie.includes("sort — invoquée, n'a pas rendu la main") && sortie.sortie.includes('b — attendue, jamais invoquée'),
      `process.exit(0) anticipé : code 1, entrée en cours et suivantes nommées (code ${sortie.code})`);
    ok(sortie.manifeste?.complet === false && sortie.manifeste.etat === 'interrompue' && /code 0/.test(sortie.manifeste.cause ?? ''),
      `process.exit(0) anticipé : manifeste incomplet, interrompu (${sortie.manifeste?.cause})`);

    ok(pendante.code === 1 && pendante.sortie.includes("pend — invoquée, n'a pas rendu la main"),
      `aucune sortie finale (promesse jamais réglée) : code 1, entrée nommée (code ${pendante.code})`);
    ok(pendante.manifeste?.complet === false && /boucle d'événements vide/.test(pendante.manifeste.cause ?? ''),
      `aucune sortie finale : manifeste incomplet (${pendante.manifeste?.cause})`);

    ok(signal.code !== 0 && signal.manifeste?.complet === false,
      `signal : code non nul, manifeste incomplet (code ${signal.code}, signal ${signal.signal}, ${signal.manifeste?.etat})`);
    egal([entree(signal, 'a')?.etat, entree(signal, 'bloque')?.etat], ['rendue', 'invoquée'], 'signal : manifeste partiel, écrit au fil de l\'exécution');

    ok(vide.code === 1 && vide.sortie.includes('vide — aucun contrôle'), `entrée sans aucun contrôle : échec nommé (code ${vide.code})`);

    // Deux exécutions successives sur le même manifeste : chacune validée sur
    // ce qu'elle a fait ; une troisième interrompue ne laisse pas l'ancien « complet ».
    const p = m('successives');
    const un = await cas(harnais, p, ['a', 'b'], ['a', 'b']);
    const deux = await cas(harnais, p, ['ignoree'], ['ignoree']);
    const trois = await cas(harnais, p, ['a', 'sort'], ['a', 'sort']);
    ok(un.code === 0 && un.manifeste?.complet === true && JSON.stringify(un.manifeste.attendues) === '["a","b"]', 'successives : la première validée sur ses entrées');
    ok(deux.code === 0 && deux.manifeste?.complet === true && JSON.stringify(deux.manifeste.attendues) === '["ignoree"]'
      && deux.manifeste.entrees.length === 1 && deux.manifeste.debut > un.manifeste.debut,
    'successives : la seconde validée sur les siennes, rien de la première');
    ok(trois.code === 1 && trois.manifeste?.complet === false, 'successives : une troisième interrompue remplace le manifeste complet par un incomplet');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

export function testExecutionProuveeEmplacement(): void {
  titre('Exécution prouvée — emplacement du manifeste');
  const refuse = (chemin: string) => { try { emplacementManifeste(racineDepot, chemin); return false; } catch (e) { return e instanceof RefusManifeste; } };
  ok(refuse(factice('manifeste-essai.json')), 'dans un dossier suivi, non ignoré : refusé');
  ok(refuse('manifeste-essai.json'), 'à la racine du worktree : refusé');
  ok(refuse(factice('neuf', 'manifeste-essai.json')), 'dans un dossier inexistant sous un dossier non ignoré : refusé');
  ok(refuse('tests/outils.ts'), 'un fichier suivi : refusé');
  ok(refuse(factice('fixtures-export-essai.json')), 'un fichier ignoré par son nom, dans un dossier non ignoré : refusé');
  ok(!refuse('node_modules/swblacksmith-manifeste/essai.json'), 'dans un dossier ignoré (node_modules/) : accepté');
  ok(!refuse(join(tmpdir(), 'swblacksmith-manifeste', 'essai.json')), 'hors du worktree : accepté');
  // L'empreinte ne voit pas un fichier ignoré : le manifeste n'y entre jamais.
  const avant = etatContenu(racineDepot).empreinte;
  const dossier = mkdtempSync(join(racineDepot, 'node_modules', 'swblacksmith-manifeste-'));
  try {
    writeFileSync(join(dossier, 'manifeste.json'), '{}');
    egal(etatContenu(racineDepot).empreinte, avant, 'un fichier écrit dans node_modules/ ne change pas l\'empreinte du contenu');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

export async function testExecutionProuveePointEntree(): Promise<void> {
  titre('Exécution prouvée — point d\'entrée réel (tests/run.mjs)');
  const dossier = mkdtempSync(join(tmpdir(), 'swblacksmith-execution-'));
  const interdit = factice('manifeste-refuse-essai.json');
  try {
    const chemin = join(dossier, 'manifeste.json');
    const run = join(racineDepot, 'tests', 'run.mjs');
    // Une entrée courte et stable, qui ne relance pas celle-ci.
    const [refus, reussi] = await Promise.all([
      lancerProcessus([run, 'testCompteAffichable', '--manifeste', interdit]),
      lancerProcessus([run, 'testCompteAffichable', '--manifeste', chemin]),
    ]);
    ok(refus.code === 2 && refus.sortie.includes('Refus') && !existsSync(join(racineDepot, interdit)),
      `manifeste demandé dans l'arbre non ignoré : refus, code 2, rien d'écrit (code ${refus.code})`);
    const mf = lireManifeste(chemin);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: racineDepot, encoding: 'utf8' }).trim();
    ok(reussi.code === 0 && mf?.complet === true && mf.succes === true && mf.revision === head,
      `manifeste du point d'entrée : complet, réussi, révision HEAD (code ${reussi.code})`);
    egal([mf?.selection?.mode, mf?.attendues, mf?.entrees?.[0]?.etat], ['filtres', ['testCompteAffichable'], 'rendue'], 'manifeste : sélection par filtre, entrée rendue');
    ok(typeof mf?.contenu?.empreinte === 'string' && /^sha256:/.test(mf.registre?.empreinte ?? '') && mf.registre.entrees > 0 && typeof mf.arbrePropre === 'boolean',
      'manifeste : empreintes du contenu et du registre, état de l\'arbre');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
    rmSync(join(racineDepot, interdit), { force: true });
  }
}
