// Vérifications de la sélection par fichiers modifiés (tests/selection.ts) :
// sur l'inventaire réel du dépôt, et sur de petits dépôts d'essai construits
// dans le dossier temporaire (renommage, fusion, non suivis…).

import { build } from 'esbuild';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { egal, ok, titre } from './outils';
import {
  CHARGEURS, comparerIndex, decisionTailwind, inventaire, optionsConstruction, PREREQUIS, RefusSelection, selectionDepuisGit, selectionner,
  type Inventaire, type Selection,
} from './selection';

const racineDepot = resolve('.');
let inventaireReel: Inventaire | null = null;
async function reel(): Promise<Inventaire> {
  inventaireReel ??= await inventaire(racineDepot);
  return inventaireReel;
}

const retenu = (s: Selection, nom: string) => s.retenues.find((r) => r.nom === nom || r.identifiant === nom);
const raisons = (s: Selection, nom: string) => retenu(s, nom)?.raisons.join(' ; ') ?? '';
const statut = (s: Selection, chemin: string) => s.fichiers.find((f) => f.chemin === chemin)?.statut ?? 'absent';

/* --------------------------------------------------------------------------
 * Inventaire réel
 * ----------------------------------------------------------------------- */

export async function testSelectionFichiersInventaire(): Promise<void> {
  titre('Sélection par fichiers modifiés — inventaire recalculé');
  const inv = await reel();
  egal(inv.incoherences, [], 'aucune incohérence sur le dépôt');
  ok(inv.entrees.length > 0 && inv.entrees.every((e) => e.fichierTest !== null), 'chaque entrée du registre est rattachée à son fichier de test');
  ok(inv.entrees.some((e) => e.genre === 'etalement') && inv.entrees.some((e) => e.genre === 'lambda'), 'étalements et lambdas rattachés');
  // Les 14 racines secondaires relevées.
  const racines = new Set([...inv.fichiersTest.values()].flatMap((i) => i.racines.map((r) => r.racine)));
  const attendues = [
    'tests/rendu/optimizer-memoire-banc.tsx', 'tests/rendu/optimizer-import-banc.tsx', 'tests/rendu/optimizer-dialogue-banc.tsx',
    'tests/rendu/rta-reco-export-banc.tsx', 'tests/rendu/speed-tune-export-banc.tsx', 'tests/rendu/speed-tune-export-app-banc.tsx',
    'tests/rendu/siege-export-banc.tsx', 'scripts/lib/pair-slice-worker.ts', 'scripts/lib/build-half-worker.ts',
    'scripts/lib/pairing-quota-worker.ts', 'scripts/installer-hooks.mjs', '.githooks/pre-commit',
    '.githooks/commit-msg', 'scripts/relic-differentiel.ts',
  ];
  egal(attendues.filter((r) => !racines.has(r)), [], 'les 14 racines secondaires connues sont retrouvées');
  const erreurs = [...inv.fichiersTest.values()].flatMap((i) => i.racines.filter((r) => r.erreur).map((r) => r.racine));
  egal([...new Set(erreurs)], [], 'chaque racine secondaire se construit');
  const bandes = inv.fichiersTest.get('tests/rendu/optimizer-bandes.test.ts');
  ok(!!bandes && ['src/**/*.{ts,tsx}', 'index.html'].every((x) => bandes.motifs.some((m) => m.tailwind && m.motif === x)) && bandes.fichiers.has('tailwind.config.js'),
    'Tailwind : motifs src/**/*.{ts,tsx} et index.html attachés aux tests de rendu, configuration en cible');
  // La construction autonome (`--racine`, paquets externes) voit les mêmes
  // fichiers du dépôt que celle de tests/run.mjs.
  const complete = await build({ ...optionsConstruction(racineDepot, join(racineDepot, 'selection-essai.cjs')), write: false, metafile: true });
  const autonome = await build({ ...optionsConstruction(racineDepot, join(racineDepot, 'selection-essai.cjs')), write: false, metafile: true, packages: 'external' });
  // Les fichiers que Git liste : `node_modules` peut être une jonction (worktree
  // de mesure), dont esbuild écrit les chemins réels hors du dépôt.
  const listes = new Set(git(racineDepot, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0'));
  const duDepot = (m: Record<string, unknown>) => Object.keys(m).filter((f) => listes.has(f)).sort();
  egal(duDepot(autonome.metafile.inputs), duDepot(complete.metafile.inputs), 'métafichier autonome = métafichier de tests/run.mjs, fichiers du dépôt');
  ok(inv.dureeMs < 15000, `inventaire recalculé en ${inv.dureeMs} ms`);
}

// Le graphe d'un banc (racine secondaire construite par esbuild) contient tout
// ce que le chargeur maison charge vraiment : relevé à l'exécution, dans un
// processus à part où le navigateur et Tailwind sont remplacés.
export async function testSelectionFichiersChargeur(): Promise<void> {
  titre('Sélection par fichiers modifiés — graphe des bancs contre le chargeur maison');
  const inv = await reel();
  const bancs = new Map<string, Set<string>>();
  for (const i of inv.fichiersTest.values()) for (const r of i.racines) if (r.type === 'chargeur-maison') bancs.set(r.racine, new Set(r.fichiers));
  ok(bancs.size >= 7, `${bancs.size} bancs du chargeur maison`);
  const dossier = mkdtempSync(join(racineDepot, 'node_modules', 'swblacksmith-tests-selection-'));
  try {
    const chargeur = join(dossier, 'chargeur.cjs');
    await build({
      absWorkingDir: racineDepot, entryPoints: [CHARGEURS[0].fichier], bundle: true, platform: 'node', format: 'cjs', outfile: chargeur,
      logLevel: 'error', packages: 'external',
    });
    const harnais = join(dossier, 'harnais.cjs');
    writeFileSync(harnais, [
      "const Module = require('module'); const fs = require('fs');",
      'let actif = false; let journal = [];',
      'const charger = Module._load;',
      'Module._load = function (requete) {',
      "  if (requete === 'playwright') return { chromium: { launch: async () => { throw new Error('RELEVE_FINI'); } } };",
      "  if (requete === 'postcss') return () => ({ process: async () => { actif = true; return { css: '' }; } });",
      "  if (requete === 'tailwindcss') return () => ({});",
      '  return charger.apply(this, arguments);',
      '};',
      'const lire = fs.readFileSync;',
      "fs.readFileSync = function (p, ...r) { if (actif && typeof p === 'string') journal.push(p); return lire.call(this, p, ...r); };",
      `const { ${CHARGEURS[0].fonction} } = require(${JSON.stringify(chargeur)});`,
      '(async () => {',
      '  const sortie = {};',
      '  for (const banc of JSON.parse(process.argv[2])) {',
      '    journal = [];',
      `    try { await ${CHARGEURS[0].fonction}(false, banc); sortie[banc] = { erreur: 'lancement non intercepté' }; }`,
      "    catch (e) { sortie[banc] = e.message === 'RELEVE_FINI' ? { charges: journal } : { erreur: String(e.stack) }; }",
      '  }',
      '  process.stdout.write(JSON.stringify(sortie));',
      '})();',
    ].join('\n'));
    // Un processus par banc, en parallèle : chacun transpile ses modules.
    const releve: Record<string, { charges?: string[]; erreur?: string }> = {};
    await Promise.all([...bancs.keys()].map((banc) => new Promise<void>((fini) => {
      const p = spawn(process.execPath, [harnais, JSON.stringify([banc])], { cwd: racineDepot, stdio: ['ignore', 'pipe', 'pipe'] });
      let sortie = '', erreurs = '';
      p.stdout.on('data', (d) => { sortie += d; });
      p.stderr.on('data', (d) => { erreurs += d; });
      p.on('close', () => {
        try { Object.assign(releve, JSON.parse(sortie)); } catch { releve[banc] = { erreur: `relevé illisible : ${erreurs.slice(0, 300)}` }; }
        fini();
      });
    })));
    for (const [banc, graphe] of bancs) {
      const rel = releve[banc];
      if (!rel?.charges) { ok(false, `${banc} : relevé impossible (${rel?.erreur?.slice(0, 200)})`); continue; }
      const charges = [...new Set(rel.charges.map((p) => relative(racineDepot, p).split('\\').join('/')).filter((p) => !p.startsWith('node_modules/') && !p.startsWith('..')))];
      const hors = charges.filter((p) => !graphe.has(p));
      ok(charges.length > 0 && hors.length === 0, `${banc} : ${charges.length} fichiers chargés, tous dans le graphe (${graphe.size})` + (hors.length ? ` — hors graphe : ${hors.slice(0, 5).join(', ')}` : ''));
    }
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

export async function testSelectionFichiersCasReels(): Promise<void> {
  titre('Sélection par fichiers modifiés — cas sur l\'inventaire réel');
  const inv = await reel();
  const sel = (fichiers: string[]) => selectionner(inv, fichiers, inv.sourceIndex, 'essai');

  // Racine secondaire : un composant de l'écran, une aide des bancs.
  let s = sel(['src/components/outils/OptimizerSection.tsx']);
  ok(!s.complet && /racine secondaire tests\/rendu\/optimizer-memoire-banc\.tsx/.test(raisons(s, 'testRenduOptimizerBandesEquipesClair')),
    'composant de l\'écran → tests de rendu retenus par le graphe du banc');
  s = sel(['tests/rendu/optimizer-bandes-preuves.ts']);
  ok(!s.complet && ['testRenduOptimizerBandesEquipesClair', 'testRenduTelephoneOptimizerBandesEquipesSombre'].every((n) => /racine secondaire/.test(raisons(s, n))),
    'optimizer-bandes-preuves.ts → testRenduOptimizerBandes* retenus (graphe du banc seulement)');
  egal(statut(s, 'tests/rendu/optimizer-bandes-preuves.ts'), 'couvert', '… et le fichier est couvert');

  // Worker : la racine et un module transitif.
  const avecWorker = [...inv.fichiersTest.entries()].find(([, i]) => i.racines.some((r) => r.racine === 'scripts/lib/pair-slice-worker.ts'));
  const grapheWorker = avecWorker?.[1].racines.find((r) => r.racine === 'scripts/lib/pair-slice-worker.ts')?.fichiers ?? [];
  const transitif = grapheWorker.find((f) => f !== 'scripts/lib/pair-slice-worker.ts' && f.startsWith('src/'));
  s = sel(['scripts/lib/pair-slice-worker.ts']);
  ok(!s.complet && statut(s, 'scripts/lib/pair-slice-worker.ts') === 'couvert', 'pair-slice-worker.ts (hors de tout graphe principal) → couvert par sa racine');
  s = sel([transitif ?? 'absent']);
  const fichierWorker = avecWorker?.[0] ?? '';
  const entreeWorker = inv.entrees.find((e) => e.fichierTest === fichierWorker);
  ok(!!transitif && !s.complet && /racine secondaire scripts\/lib\/pair-slice-worker\.ts/.test(raisons(s, entreeWorker?.nom ?? entreeWorker?.identifiant ?? '')),
    `module transitif du worker (${transitif}) → ${entreeWorker?.nom} retenue par la racine du worker`);

  // Chemin construit et dossier cité.
  s = sel(['public/data/skills/1000.json']);
  ok(!s.complet && statut(s, 'public/data/skills/1000.json') === 'couvert' && /dossier public\/data\/skills lu \(.*chemin construit public\/data\/skills\/\*/.test(raisons(s, 'testDegats')),
    'public/data/skills/<id>.json (chemin construit) → testDegats retenue');
  s = sel(['.claude/skills/algo-verify/SKILL.md']);
  ok(!s.complet && /dossier \.claude\/skills lu/.test(raisons(s, 'testSkillAdapters')), 'dossier cité (.claude/skills) → testSkillAdapters retenue');

  // Opaque : retenue pour tout fichier, docs/ compris (une lecture opaque peut
  // viser n'importe quoi).
  s = sel(['src/ui/Bouton.tsx']);
  ok(!s.complet && /(^| ; )opaque/.test(raisons(s, 'testAurasRecette')), 'opaque retenue pour un fichier de src/');
  s = sel(['docs/README.md']);
  ok(!s.complet && /^opaque/.test(raisons(s, 'testAurasRecette')), 'opaque retenue pour un fichier de docs/');
  // Sur docs/, seules les transversales (depot, opaque) sont retenues.
  ok(statut(s, 'docs/README.md') === 'sans effet' && s.transversalesSeulement && s.retenues.length > 0 && s.retenues.every((r) => /^(depot|opaque)/.test(r.raisons[0])) && !!retenu(s, 'testRenvois'),
    'docs/README.md : sans effet, seules les vérifications depot et opaque retenues, et la sortie le dit');

  // Fichiers sans effet sous les racines : la documentation, le banc d'affichage
  // (sauf ses deux modules importés par banc-selection.test.ts).
  s = sel(['tests/README.md']);
  ok(!s.complet && statut(s, 'tests/README.md') === 'sans effet', 'tests/README.md → sans effet');
  s = sel(['src/lib/notes-essai.md']);
  // Un lien spécifique prime sur la liste : des tests parcourent le dossier src/.
  ok(!s.complet && statut(s, 'src/lib/notes-essai.md') === 'couvert' && s.retenues.some((r) => r.raisons.some((x) => /^dossier src lu/.test(x))),
    '*.md sous src/ → couvert par les tests qui parcourent src/, jamais la suite complète');
  s = sel(['bureau/notes-essai.md']);
  ok(!s.complet && statut(s, 'bureau/notes-essai.md') === 'sans effet', '*.md sous une racine, sans lien spécifique → sans effet');
  s = sel(['tests/banc/run.mjs']);
  ok(!s.complet && statut(s, 'tests/banc/run.mjs') === 'sans effet', 'tests/banc/run.mjs → sans effet');
  s = sel(['tests/banc/selection.ts']);
  ok(!s.complet && statut(s, 'tests/banc/selection.ts') === 'couvert' && /module de son graphe/.test(raisons(s, 'testBancSelection')), 'tests/banc/selection.ts → couvert par le graphe de banc-selection.test.ts');
  s = sel(['bureau/fichier-inconnu.ts']);
  ok(s.complet && s.fichiers[0]?.detail === 'aucun lien spécifique', 'bureau/ est une racine : un fichier sans lien → non couvert, suite complète');

  // Non couvert → complet, même quand une transversale est déjà retenue :
  // celle-ci ne garantit pas la couverture du fichier inconnu.
  s = sel(['tests/fichier-inconnu.txt']);
  ok(s.complet && statut(s, 'tests/fichier-inconnu.txt') === 'non couvert', 'fichier de tests/ sans lien spécifique → suite complète');
  s = sel(['src/components/outils/OptimizerSection.tsx', 'tests/fichier-inconnu.txt']);
  ok(s.complet && s.causes.some((c) => c.startsWith('tests/fichier-inconnu.txt')), 'non couvert alors que des transversales sont retenues → suite complète');
  s = sel(['outil-inconnu.cfg']);
  ok(s.complet && statut(s, 'outil-inconnu.cfg') === 'non couvert', 'fichier hors racines non listé → suite complète');

  // Infrastructure.
  for (const f of ['tests/outils.ts', 'tests/run.mjs', 'tests/selection.ts', 'package.json', 'tsconfig.json']) {
    s = sel([f]);
    ok(s.complet && statut(s, f) === 'infrastructure', `${f} → infrastructure, suite complète`);
  }

  // Prérequis d'ordre : retenir une vérification du bloc « APRÈS » entraîne
  // testPersistance, qui entraîne testStockage ; l'ordre du registre est gardé.
  const apres = Object.keys(PREREQUIS).find((n) => PREREQUIS[n].includes('testPersistance'))!;
  const fichierApres = inv.entrees.find((e) => e.nom === apres)!.fichierTest!;
  s = sel([fichierApres]);
  ok(!s.complet && /prérequis d'ordre de/.test(raisons(s, 'testPersistance')) && /prérequis d'ordre de testPersistance/.test(raisons(s, 'testStockage')),
    `${fichierApres} → testPersistance et testStockage entraînées`);
  const ordre = s.retenues.map((r) => r.index);
  egal(ordre, [...ordre].sort((a, b) => a - b), 'retenues dans l\'ordre du registre');

  // tests/index.ts : entrée ajoutée, déplacée, import modifié, autre changement.
  const source = inv.sourceIndex.split('\r\n').join('\n');
  const ligne = source.split('\n').find((l) => l.startsWith("  ['testRenvois',"))!;
  s = selectionner(inv, ['tests/index.ts'], source.replace(ligne + '\n', ''), 'essai');
  ok(!s.complet && s.retenues.length === 1 && s.retenues[0].nom === 'testRenvois' && /entrée ajoutée/.test(s.retenues[0].raisons[0]), 'registre : une entrée ajoutée retient elle seule');
  const premiere = source.split('\n').find((l) => l.startsWith("  ['testRenduOptimizerCreationObligatoire',"))!;
  const deplace = source.replace(premiere + '\n', '').replace(ligne + '\n', ligne + '\n' + premiere + '\n');
  s = selectionner(inv, ['tests/index.ts'], deplace, 'essai');
  ok(!s.complet && !!retenu(s, 'testRenduOptimizerCreationObligatoire') && /déplacée/.test(raisons(s, 'testRenduOptimizerCreationObligatoire')) && s.retenues.length <= 2,
    'registre : une entrée déplacée est retenue');
  s = selectionner(inv, ['tests/index.ts'], source.replace("from './renvois.test'", "from './ailleurs.test'"), 'essai');
  ok(!s.complet && /import de testRenvois modifié/.test(raisons(s, 'testRenvois')), 'registre : un import modifié retient ses entrées');
  s = selectionner(inv, ['tests/index.ts'], source.replace('async function main() {', 'async function main() {\n  void 0;'), 'essai');
  ok(s.complet && statut(s, 'tests/index.ts') === 'infrastructure', 'tests/index.ts modifié hors registre et imports → suite complète');
  egal(comparerIndex(source, source).retenus.size, 0, 'tests/index.ts identique : rien de retenu');
}

/* --------------------------------------------------------------------------
 * Dépôts d'essai
 * ----------------------------------------------------------------------- */

const BASE: Record<string, string> = {
  'tests/outils.ts': 'export function debutVerification(nom: string): void { void nom; }\n',
  'tests/index.ts': [
    "import { debutVerification } from './outils';",
    "import { testA } from './a.test';",
    "import testB from './b.test';",
    "import { verificationsC } from './c.test';",
    "import { testD } from './d.test';",
    '',
    'const VERIFICATIONS: [string, () => void | Promise<void>][] = [',
    "  ['testA', testA],",
    "  ['testB', async () => { await testB(); }],",
    '  ...verificationsC,',
    "  ['testD', testD],",
    "  ['testE', () => { debutVerification('e'); }],",
    '];',
    '',
    'async function main() { for (const [nom, fn] of VERIFICATIONS) { debutVerification(nom); await fn(); } }',
    'void main();',
    '',
  ].join('\n'),
  'tests/a.test.ts': "import { aide } from './aide';\nexport function testA(): void { aide(); }\n",
  'tests/aide.ts': "import { lib } from '../src/lib';\nexport function aide(): number { return lib(); }\n",
  'src/lib.ts': "import { profond } from './profond';\nexport function lib(): number { return profond(); }\n",
  'src/profond.ts': 'export function profond(): number { return 1; }\n',
  'src/config.txt': 'v1\n',
  'tests/b.test.ts': "import { existsSync, readFileSync } from 'node:fs';\nexport default function testB(): void { readFileSync('public/donnees avec espace.json', 'utf8'); existsSync('public/futur.json'); }\n",
  'public/donnees avec espace.json': '{}\n',
  'public/nouvelle.json': '{}\n',
  'tests/c.test.ts': "export const verificationsC: [string, () => void][] = [['testC1', () => {}], ['testC2', () => {}]];\n",
  'tests/d.test.ts': "import { build } from 'esbuild';\nexport async function testD(): Promise<void> { await build({ entryPoints: ['scripts/w.ts'], bundle: true, write: false }); }\n",
  'scripts/w.ts': "import { x } from './w-dep';\nconsole.log(x);\n",
  'scripts/w-dep.ts': 'export const x = 1;\n',
  'scripts/w2.ts': "import { y } from './w2-dep';\nconsole.log(y);\n",
  'scripts/w2-dep.ts': 'export const y = 2;\n',
  'docs/a.md': '# a\n',
};

function git(racine: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function ecrire(racine: string, chemin: string, contenu: string): void {
  mkdirSync(dirname(join(racine, chemin)), { recursive: true });
  writeFileSync(join(racine, chemin), contenu);
}
function commit(racine: string, message: string): void {
  git(racine, 'add', '-A');
  git(racine, 'commit', '-q', '-m', message);
}
async function depotEssai(corps: (racine: string) => Promise<void>): Promise<void> {
  const racine = mkdtempSync(join(tmpdir(), 'swblacksmith-selection-'));
  try {
    git(racine, 'init', '-q', '-b', 'main');
    git(racine, 'config', 'user.email', 'essai@local');
    git(racine, 'config', 'user.name', 'essai');
    git(racine, 'config', 'core.autocrlf', 'false');
    for (const [c, t] of Object.entries(BASE)) ecrire(racine, c, t);
    commit(racine, 'base');
    await corps(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}
const depuisHead = async (racine: string) => (await selectionDepuisGit({ racine, depuis: 'HEAD' })).selection;

// Le motif Tailwind ne retient que si la feuille produite peut changer : les
// contenus « avant » et « après » sont fournis, le dépôt n'est pas modifié.
export async function testSelectionFichiersTailwind(): Promise<void> {
  titre('Sélection par fichiers modifiés — motif Tailwind, feuille produite');
  const inv = await reel();
  const F = 'src/components/outils/OptimizerSection.tsx';
  const texte = (p: string) => readFileSync(join(racineDepot, p), 'utf8');
  const decider = (fichiers: string[], avant: Record<string, string | null>, apres: Record<string, string | null>) =>
    decisionTailwind(inv, fichiers, (p) => (p in avant ? avant[p] : texte(p)), (p) => (p in apres ? apres[p] : texte(p)));
  const base = selectionner(inv, [F], inv.sourceIndex, 'essai'); // sans décision : le motif retient
  const parMotifSeul = base.retenues.filter((r) => r.raisons.every((x) => /^motif Tailwind/.test(x))).map((r) => r.nom ?? r.identifiant);
  ok(parMotifSeul.length > 0, `sans décision, ${parMotifSeul.length} entrées de rendu retenues par le seul motif Tailwind`);

  // Logique changée, sans classe : feuille identique ; seuls les importeurs restent.
  let d = await decider([F], {}, { [F]: texte(F).replace('export default', 'const _essaiLogique = 1 + 2;\nexport default') });
  let s = selectionner(inv, [F], inv.sourceIndex, 'essai', [], d);
  ok(d?.etat === 'feuille inchangée (produite)' && parMotifSeul.every((n) => !retenu(s, n!)) && /racine secondaire/.test(raisons(s, 'testRenduOptimizerBandesEquipesClair')),
    `logique sans classe → ${d?.etat} ; rendu non retenu sauf les importeurs`);
  ok(/motif Tailwind : feuille inchangée \(produite\)/.test(s.fichiers[0].detail) && /feuille inchangée/.test(s.fichiers.map((f) => f.detail).join(' ')), 'la sortie dit « feuille inchangée (produite) »');

  // Mêmes candidats (deux lignes permutées) : la feuille n'a pas à être produite.
  const lignes = texte(F).split('\n');
  const i = lignes.findIndex((l) => l.startsWith('import '));
  [lignes[i], lignes[i + 1]] = [lignes[i + 1], lignes[i]];
  d = await decider([F], {}, { [F]: lignes.join('\n') });
  ok(d?.etat === 'feuille inchangée (candidats)', `lignes permutées → ${d?.etat}`);

  // Classe ajoutée : feuille changée, rendu retenu par le motif.
  d = await decider([F], {}, { [F]: texte(F) + '\nconst _essaiClasse = "bg-[#123456]";\n' });
  s = selectionner(inv, [F], inv.sourceIndex, 'essai', [], d);
  ok(d?.etat === 'feuille changée' && parMotifSeul.every((n) => /feuille changée/.test(raisons(s, n!))), `classe ajoutée → ${d?.etat}, rendu retenu`);

  // Classe retirée mais employée ailleurs : candidats différents, feuille identique.
  const autre = texte(F);
  const ailleurs = texte('src/ui/Bouton.tsx') + texte('src/ui/BarreActions.tsx') + texte('src/ui/BoutonGroupe.tsx');
  const commune = ['shrink-0', 'truncate', 'whitespace-nowrap', 'pointer-events-none', 'select-none', 'tabular-nums', 'uppercase', 'inline-flex', 'justify-center']
    .find((c) => !autre.includes(c) && new RegExp(`["'\\s]${c}["'\\s]`).test(ailleurs));
  const avecCommune = autre + `\nconst _essaiRetiree = "${commune ?? 'flex'} _essaiMarqueur";\n`;
  d = await decider([F], { [F]: avecCommune }, { [F]: autre + '\nconst _essaiRetiree = "_essaiMarqueur";\n' });
  ok(!!commune && d?.etat === 'feuille inchangée (produite)', `classe ${commune} retirée mais employée ailleurs → ${d?.etat}`);
  // … et retirée sans autre emploi : feuille changée (aucun reste d'une production à l'autre).
  d = await decider([F], { [F]: autre + '\nconst _essaiRetiree = "bg-[#654321]";\n' }, { [F]: autre });
  ok(d?.etat === 'feuille changée', `classe unique retirée → ${d?.etat}`);

  // Configuration changée : le lien reste.
  d = await decider([F, 'tailwind.config.js'], {}, {});
  ok(d?.etat === 'feuille changée' && /configuration/.test(d.detail), `tailwind.config.js modifié → ${d?.etat}`);
  for (const c of ['src/index.css', 'postcss.config.js']) {
    d = await decider([F, c], {}, {});
    ok(d?.etat === 'feuille changée', `${c} modifié → ${d?.etat}`);
  }

  // Fichier ajouté sans classe.
  const nouveau = 'src/lib/essai-sans-classe.ts';
  d = await decider([nouveau], { [nouveau]: null }, { [nouveau]: 'export const essaiSansClasse = 1;\n' });
  s = selectionner(inv, [nouveau], inv.sourceIndex, 'essai', [], d);
  ok(d?.etat === 'feuille inchangée (produite)' && !s.complet && parMotifSeul.every((n) => !retenu(s, n!)), `fichier ajouté sans classe → ${d?.etat}, rendu non retenu`);

  // Production impossible (dépôt d'essai sans Tailwind installé) : le lien reste.
  await depotEssai(async (r) => {
    ecrire(r, 'tailwind.config.js', "export default { content: ['./src/**/*.{ts,tsx}'] };\n");
    ecrire(r, 'tests/rendu.test.ts', "export function testRendu(): void { if (process.env.JAMAIS) require('tailwindcss'); }\n");
    ecrire(r, 'tests/index.ts', BASE['tests/index.ts']
      .replace("import { testD } from './d.test';", "import { testD } from './d.test';\nimport { testRendu } from './rendu.test';")
      .replace("  ['testD', testD],", "  ['testD', testD],\n  ['testRendu', testRendu],"));
    commit(r, 'rendu');
    ecrire(r, 'src/profond.ts', 'export function profond(): number { return 7; }\n');
    const t = (await selectionDepuisGit({ racine: r, depuis: 'HEAD' })).selection;
    ok(t.tailwind?.etat === 'feuille changée' && /production impossible/.test(t.tailwind.detail) && /motif Tailwind/.test(raisons(t, 'testRendu')),
      `production impossible → ${t.tailwind?.etat}, testRendu retenue`);
  });
}

export async function testSelectionFichiersGit(): Promise<void> {
  titre('Sélection par fichiers modifiés — dépôts d\'essai');
  await depotEssai(async (r) => {
    let s = await depuisHead(r);
    ok(!s.complet && s.fichiers.length === 0 && s.retenues.length === 1 && /non rattachable/.test(raisons(s, 'testE')),
      'arbre propre : aucun fichier, seule la non rattachable est retenue');

    ecrire(r, 'src/profond.ts', 'export function profond(): number { return 2; }\n');
    s = await depuisHead(r);
    ok(!s.complet && /module de son graphe : src\/profond\.ts/.test(raisons(s, 'testA')) && !retenu(s, 'testB') && !retenu(s, 'testD'),
      'import transitif (src/profond.ts) → testA seule');
    git(r, 'checkout', '-q', '--', 'src/profond.ts');

    ecrire(r, 'public/donnees avec espace.json', '{"a":1}\n');
    s = await depuisHead(r);
    ok(!s.complet && statut(s, 'public/donnees avec espace.json') === 'couvert' && /cible lue/.test(raisons(s, 'testB')) && !retenu(s, 'testA'),
      'chemin à espace → couvert, testB retenue');
    git(r, 'checkout', '-q', '--', 'public/donnees avec espace.json');

    ecrire(r, 'public/futur.json', '{}\n');
    s = await depuisHead(r);
    ok(!s.complet && statut(s, 'public/futur.json') === 'couvert' && !!retenu(s, 'testB'), 'non suivi (public/futur.json, lu par existsSync) → testB retenue');
    rmSync(join(r, 'public/futur.json'));

    ecrire(r, 'tests/notes.txt', 'x\n');
    s = await depuisHead(r);
    ok(s.complet && statut(s, 'tests/notes.txt') === 'non couvert', 'non suivi sans lien sous tests/ → suite complète');
    rmSync(join(r, 'tests/notes.txt'));

    ecrire(r, 'scripts/w-dep.ts', 'export const x = 3;\n');
    s = await depuisHead(r);
    ok(!s.complet && /racine secondaire scripts\/w\.ts/.test(raisons(s, 'testD')), 'worker (entryPoints esbuild) : module transitif → testD retenue');
    git(r, 'checkout', '-q', '--', 'scripts/w-dep.ts');

    ecrire(r, 'tests/c.test.ts', "export const verificationsC: [string, () => void][] = [['testC1', () => {}]];\n");
    s = await depuisHead(r);
    egal(s.execution.groupes, [{ avant: 'testB', apres: 'testD', etalements: ['verificationsC'] }], 'étalement retenu : groupe borné par testB et testD');
    git(r, 'checkout', '-q', '--', 'tests/c.test.ts');

    ecrire(r, 'outil.cfg', 'x\n');
    ecrire(r, 'docs/b.md', '# b\n');
    s = await depuisHead(r);
    ok(s.complet && statut(s, 'outil.cfg') === 'non couvert' && statut(s, 'docs/b.md') === 'sans effet', 'hors racines : listé → sans effet, non listé → suite complète');
    rmSync(join(r, 'outil.cfg')); rmSync(join(r, 'docs/b.md'));

    ecrire(r, 'tests/outils.ts', BASE['tests/outils.ts'] + '// modifié\n');
    s = await depuisHead(r);
    ok(s.complet && statut(s, 'tests/outils.ts') === 'infrastructure', 'tests/outils.ts → infrastructure, suite complète');
    git(r, 'checkout', '-q', '--', 'tests/outils.ts');

    s = (await selectionDepuisGit({ racine: r, depuis: 'reference-inexistante' })).selection;
    ok(s.complet && s.causes.some((c) => /lecture de Git a échoué/.test(c)), 'référence inconnue : la lecture de Git échoue → suite complète');
  });

  // Renommage et suppression.
  await depotEssai(async (r) => {
    git(r, 'mv', 'src/profond.ts', 'src/profond2.ts');
    ecrire(r, 'src/lib.ts', "import { profond } from './profond2';\nexport function lib(): number { return profond(); }\n");
    git(r, 'add', '-A');
    let s = await depuisHead(r);
    ok(statut(s, 'src/profond2.ts') === 'couvert' && statut(s, 'src/profond.ts') === 'non couvert' && s.complet,
      'renommage : ancien et nouveau chemin lus ; l\'ancien, hors de tout graphe, est non couvert');
    git(r, 'reset', '-q', '--hard');
    git(r, 'rm', '-q', 'docs/a.md');
    s = await depuisHead(r);
    ok(!s.complet && statut(s, 'docs/a.md') === 'sans effet' && s.transversalesSeulement, 'suppression : l\'ancien chemin est lu et classé');
  });

  // tests/index.ts : registre et imports, par Git.
  await depotEssai(async (r) => {
    ecrire(r, 'tests/f.test.ts', 'export function testF(): void {}\n');
    ecrire(r, 'tests/index.ts', BASE['tests/index.ts']
      .replace("import { testD } from './d.test';", "import { testD } from './d.test';\nimport { testF } from './f.test';")
      .replace("  ['testD', testD],", "  ['testD', testD],\n  ['testF', testF],"));
    let s = await depuisHead(r);
    ok(!s.complet && statut(s, 'tests/index.ts') === 'couvert' && !!retenu(s, 'testF') && !retenu(s, 'testA') && !retenu(s, 'testD'),
      'test ajouté au registre (entrée et import) → lui seul');
    ecrire(r, 'tests/index.ts', BASE['tests/index.ts'].replace('void main();', 'void main().then(() => {});'));
    s = await depuisHead(r);
    ok(s.complet && statut(s, 'tests/index.ts') === 'infrastructure', 'tests/index.ts : main modifiée → suite complète');
  });

  // Classement maintenu : une lecture ajoutée dans une aide, un worker nouveau,
  // une cible littérale nouvelle entrent d'eux-mêmes ; une lecture non résolue
  // rend opaque, une lecture du dépôt entier rend depot.
  await depotEssai(async (r) => {
    const essai = async (fichier: string, contenu: string) => { ecrire(r, fichier, contenu); const s = await depuisHead(r); git(r, 'checkout', '-q', '--', fichier); return s; };
    let s = await essai('src/config.txt', 'v2\n');
    ok(s.complet, 'avant : src/config.txt non lu → suite complète');
    ecrire(r, 'tests/aide.ts', "import { readFileSync } from 'node:fs';\nimport { lib } from '../src/lib';\nexport function aide(): number { readFileSync('src/config.txt', 'utf8'); return lib(); }\n");
    commit(r, 'aide lit config');
    s = await essai('src/config.txt', 'v2\n');
    ok(!s.complet && /cible lue \(tests\/aide\.ts:3\)/.test(raisons(s, 'testA')), 'lecture ajoutée dans une aide → testA retenue');

    s = await essai('scripts/w2-dep.ts', 'export const y = 3;\n');
    ok(s.complet, 'avant : scripts/w2-dep.ts hors de tout graphe → suite complète');
    ecrire(r, 'tests/d.test.ts', "import { build } from 'esbuild';\nexport async function testD(): Promise<void> { await build({ entryPoints: ['scripts/w.ts'], bundle: true, write: false }); await build({ entryPoints: ['scripts/w2.ts'], bundle: true, write: false }); }\n");
    commit(r, 'worker nouveau');
    s = await essai('scripts/w2-dep.ts', 'export const y = 3;\n');
    ok(!s.complet && /racine secondaire scripts\/w2\.ts/.test(raisons(s, 'testD')), 'worker nouveau → testD retenue par sa racine');

    s = await essai('public/nouvelle.json', '{"b":2}\n');
    ok(s.complet, 'avant : public/nouvelle.json non lu → suite complète');
    ecrire(r, 'tests/b.test.ts', "import { existsSync, readFileSync } from 'node:fs';\nexport default function testB(): void { readFileSync('public/donnees avec espace.json', 'utf8'); existsSync('public/futur.json'); readFileSync('public/nouvelle.json', 'utf8'); }\n");
    commit(r, 'cible nouvelle');
    s = await essai('public/nouvelle.json', '{"b":2}\n');
    ok(!s.complet && /cible lue/.test(raisons(s, 'testB')), 'cible littérale nouvelle → testB retenue');

    ecrire(r, 'tests/c.test.ts', "import { readFileSync } from 'node:fs';\nexport const verificationsC: [string, () => void][] = [['testC1', () => { readFileSync(process.argv[2]); }]];\n");
    commit(r, 'lecture non résolue');
    s = await essai('src/profond.ts', 'export function profond(): number { return 5; }\n');
    ok(!s.complet && /^opaque/.test(raisons(s, 'verificationsC')), 'lecture non résolue → opaque, retenue pour un fichier de src/');
    s = await essai('docs/a.md', '# a modifié\n');
    ok(!s.complet && /^opaque/.test(raisons(s, 'verificationsC')) && s.transversalesSeulement, '… et pour docs/ (sans effet : seules les transversales)');
    ecrire(r, 'tests/c.test.ts', "import { execFileSync } from 'node:child_process';\nexport const verificationsC: [string, () => void][] = [['testC1', () => { execFileSync('git', ['ls-files']); }]];\n");
    commit(r, 'lecture du dépôt');
    s = await essai('docs/a.md', '# a modifié\n');
    ok(!s.complet && /^depot/.test(raisons(s, 'verificationsC')) && s.transversalesSeulement, 'git ls-files → depot, retenue pour docs/');
  });

  // --plage : commit de fusion contre son premier parent ; arbre lu contrôlé.
  await depotEssai(async (r) => {
    const c0 = git(r, 'rev-parse', 'HEAD');
    git(r, 'switch', '-q', '-c', 'branche');
    ecrire(r, 'src/profond.ts', 'export function profond(): number { return 9; }\n');
    commit(r, 'branche');
    const c1 = git(r, 'rev-parse', 'HEAD');
    git(r, 'switch', '-q', 'main');
    ecrire(r, 'public/donnees avec espace.json', '{"m":1}\n');
    commit(r, 'principale');
    git(r, 'merge', '-q', '--no-ff', '--no-edit', 'branche');
    const s = (await selectionDepuisGit({ racine: r, plage: 'HEAD^..HEAD' })).selection;
    egal(s.fichiers.map((f) => f.chemin), git(r, 'diff', '--name-only', 'HEAD^1', 'HEAD').split('\n'), '--plage M^..M : fichiers de la fusion contre son premier parent');
    ok(!s.complet && !!retenu(s, 'testA') && !retenu(s, 'testB'), '… src/profond.ts seul, testA retenue');
    let refus = '';
    try { await selectionDepuisGit({ racine: r, plage: `${c0}..${c1}` }); } catch (e) { refus = e instanceof RefusSelection ? e.message : 'autre : ' + String(e); }
    ok(/n'est pas celui de/.test(refus), '--plage dont b n\'est pas l\'arbre lu → refus');
  });
}
