// Garde-fou des renvois — aucun texte suivi ne renvoie à un fichier que le
// dépôt n'a pas : ni aux notes privées de l'Optimizer, ni à un chemin mort.
// Contrat : spec/outillage/renvois.md.
//
// Lit chaque fichier texte suivi (`git ls-files`), relève les renvois sous
// cinq formes, les résout dans la liste des fichiers suivis — jamais sur le
// disque : un fichier ignoré présent localement ne résout pas — et compare les
// renvois morts à la liste tolérée, occurrence pour occurrence.
//
// ⚠️ Ce fichier et sa liste citent des chemins privés à dessein : ils sont
// exemptés de leur propre contrôle (FICHIERS_EXEMPTES).

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, posix } from 'path';
import { fileURLToPath } from 'url';
import { egal, ignore, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LISTE = 'tests/fixtures/renvois-toleres.json';
const O = 'spec/outils/optimizer';

// Notes de l'Optimizer dont le nom seul, sans chemin, ne désigne rien de
// public. Un nom quitte le contrôle dès qu'un fichier suivi le porte.
const NOMS_DE_NOTES = [
  'algorithme', 'algorithme-relique', 'harnais-diagnostic', 'harnais-diagnostic-extensions',
  'invariants', 'limites-connues', 'near-miss-appariement', 'parallelisation-partagee',
  'pistes', 'reliques', 'reliques-architecture', 'attaques-conjointes-piste',
  'cadrage-rangement-historique', 'cadrage-score-artefacts-ehp', 'ecran-exemplaire-et-listes',
  'exclusion-de-runes', 'plan-reliquat-degats-2026-10', 'reste-a-faire-degats-2026-10',
  'synthese-decisionnelle-harnais', 'vitesse-finale',
].map((n) => n + '.md');

// Fichiers lus, renvois non contrôlés : garde-fous qui citent un chemin privé
// à dessein, tests qui montent des arborescences jetables aux chemins factices.
export const FICHIERS_EXEMPTES = [
  '.githooks/pre-commit',
  '.gitignore',
  'scripts/installer-hooks.mjs',
  'tests/pre-commit.test.ts',
  'tests/installer-hooks.test.ts',
  'tests/skill-adapters.test.ts',
  'tests/renvois.test.ts',
  // Un cadrage décrit les chemins qu'il va créer.
  'docs/05-decisions/cadrages/refonte-documentation.md',
  LISTE,
];

// Cibles volontairement non suivies. Chacune doit être ignorée par Git
// (vérifié plus bas), sauf `.git`, le dossier de Git lui-même.
export const CIBLES_EXEMPTEES: { chemin: string; dossier: boolean }[] = [
  { chemin: '.claude/settings.json', dossier: false },
  { chemin: '.claude/settings.local.json', dossier: false },
  { chemin: '.claude/agents', dossier: true },
  { chemin: '.claude/skills/run-swblacksmith/screenshots', dossier: true },
  { chemin: '.history', dossier: true },
  { chemin: '.vscode', dossier: true },
  { chemin: 'node_modules', dossier: true },
  { chemin: 'dist', dossier: true },
  { chemin: '.git', dossier: true },
];

// a-publier : renvoi vers les notes de l'Optimizer (une note, ou leur
// dossier), pas encore publiées ; l'entrée disparaît à la publication, ou
// quand le renvoi est corrigé.
// a-corriger : renvoi mort déjà pris en charge, à corriger ; aucune entrée nouvelle.
// refonte : chantiers de refonte graphique et de rebranding.
// hors-perimetre : renvoi mort connu, sans correction prévue ; qui touche le
// fichier le corrige et retire l'entrée.
const PROPRIETAIRES = ['a-publier', 'a-corriger', 'refonte', 'hors-perimetre'];

const RACINES = ['spec', 'src', 'scripts', 'tests', '.claude', '.agents'];
// Caractères d'un chemin : lettres et marques combinantes (accent décomposé),
// chiffres, `_ . - / @ +`.
const C = '\\p{L}\\p{M}\\p{N}_.\\-/@+';
const RE_NU = new RegExp(`(?<![${C}\\\\~])(?:${RACINES.map((r) => r.replace('.', '\\.')).join('|')})/[${C}<>*{}$]*`, 'gu');
const RE_REL = new RegExp(`(?<![${C}\\\\])\\.\\./[${C}<>*{}$]*`, 'gu');
// Destination entre chevrons (espaces admis) ou nue, sans espace et qui ne
// commence pas comme un titre ; titre entre "…", '…' ou (…). Une destination
// nue qui contient `(` n'est pas vérifiée.
const RE_LIEN = /!?\[[^\]]*\]\(\s*(?:<([^>\n]*)>|([^)\s"'(][^)\s]*))?(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
const RE_CLOTURE = /^\s{0,3}(`{3,}|~{3,})/;
const RE_DEF = /^\s{0,3}\[[^\]]+\]:\s*(?:<([^>\n]*)>|(\S+))/;
const RE_BACK = /`([^`\n]+)`/g;
const RE_SUITE = new RegExp(`^[${C}]+`, 'u');
const RE_TOUT_CHEMIN = new RegExp(`^[${C}<>*{}$#§]+$`, 'u');
// Spécificateurs de module : `tsc` les vérifie déjà.
const RE_MODULE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|\bvi\.mock\s*\(\s*)(['"`])[^'"`]*\2/g;
const RE_SCHEMA = /^[a-z][a-z0-9+.-]*:/i;
const EXTENSIONS = new Set(['css', 'gitignore', 'html', 'js', 'json', 'md', 'mjs', 'mts', 'nvmrc', 'patch', 'png', 'svg', 'ts', 'tsx', 'txt', 'yml', 'cjs', 'jsx', 'cts']);

export type Occurrence = {
  fichier: string;
  ligne: number;
  forme: 'lien Markdown' | 'backticks' | 'chemin nu' | 'relatif' | 'nom seul';
  renvoi: string;
  statut: 'fichier' | 'dossier' | 'mort' | 'non verifie' | 'exempte';
  candidats: string[];
  recolle?: boolean;
};

// Un texte entre backticks a la forme d'un chemin : extension connue, `/`
// final, racine du dépôt ou `../` `./` en tête. Écarte `release/x.y.z`,
// `/api/v2/`, un nom d'hôte, une liste de classes CSS. Pas pour les liens :
// une destination Markdown relative est toujours un renvoi.
function formeDeChemin(c: string): boolean {
  if (c.startsWith('/') || !/[\p{L}\p{N}]/u.test(c)) return false;
  if (/^[^.].*\./.test(c.split('/')[0]) && c.includes('/')) return false;
  const ext = c.match(/\.([A-Za-z0-9]+)$/);
  return /\/$/.test(c) || (!!ext && EXTENSIONS.has(ext[1].toLowerCase())) || /^\.\.?\//.test(c)
    || RACINES.some((r) => c.startsWith(r + '/'));
}

function typeDe(fichier: string, premiereLigne: string | undefined): 'markdown' | 'code' | 'autre' {
  if (/\.(?:md|mdx|txt)$/.test(fichier)) return 'markdown';
  if (/\.(?:[cm]?[jt]sx?|mts|cts|css|scss|sh|ps1|py|ya?ml)$/.test(fichier)) return 'code';
  if (/^#!.*\b(?:node|sh|bash)\b/.test(premiereLigne ?? '')) return 'code';
  return 'autre';
}

// Plages de commentaire [début, fin) d'une ligne de code ; `etat.bloc` porte
// un `/* … */` ouvert d'une ligne à l'autre.
function plagesCommentaire(L: string, etat: { bloc: boolean }, diese: boolean): [number, number][] {
  const plages: [number, number][] = [];
  let i = 0;
  let debut = etat.bloc ? 0 : -1;
  let quote: string | null = null;
  while (i < L.length) {
    if (etat.bloc) {
      const f = L.indexOf('*/', i);
      if (f < 0) { plages.push([debut, L.length]); return plages; }
      plages.push([debut, f + 2]);
      etat.bloc = false; i = f + 2; continue;
    }
    const c = L[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '/' && L[i + 1] === '/') { plages.push([i, L.length]); return plages; }
    if (diese && c === '#') { plages.push([i, L.length]); return plages; }
    if (c === '/' && L[i + 1] === '*') { etat.bloc = true; debut = i; i += 2; continue; }
    i++;
  }
  return plages;
}

// `#ancre`, `?requête`, `:ligne` retirés, puis la ponctuation finale qui suit
// un caractère de nom : `.` et `..` restent des composants du chemin.
const nettoyer = (brut: string) => brut.replace(/[#?].*$/, '').replace(/:\d[\d\-–]*$/, '')
  .replace(/(?<=[\p{L}\p{M}\p{N}_\-@+])[.,;:]+$/u, '');

const estExempte = (c: string) => CIBLES_EXEMPTEES.some((e) => c === e.chemin || (e.dossier && c.startsWith(e.chemin + '/')));

// Cibles exemptées qui désignent pourtant un fichier suivi : l'exemption
// masquerait un vrai renvoi.
export function ciblesExempteesSuivies(suivis: string[]): string[] {
  return CIBLES_EXEMPTEES.filter((e) => suivis.some((f) => f === e.chemin || (e.dossier && f.startsWith(e.chemin + '/')))).map((e) => e.chemin);
}

export function construireResolveur(suivis: string[]) {
  const fichiers = new Set(suivis);
  const dossiers = new Set<string>(['.']);
  for (const f of suivis) {
    let d = posix.dirname(f);
    while (d !== '.' && !dossiers.has(d)) { dossiers.add(d); d = posix.dirname(d); }
  }
  const sousO = (c: string) => c === O || c.startsWith(O + '/');
  // Trois bases, dans l'ordre de `spec-lint` : le dossier du fichier, la
  // racine, `spec/`. Le premier candidat qui existe gagne.
  return function resoudre(fichier: string, ref: string): { statut: Occurrence['statut']; candidats: string[] } {
    let r = ref;
    try { r = decodeURI(r); } catch { /* garde le texte brut */ }
    const absolu = r.startsWith('/');
    if (absolu) r = r.replace(/^\/+/, '');
    const bases = absolu ? [''] : [posix.dirname(fichier), '', 'spec'];
    const candidats: string[] = [];
    for (const b of bases) {
      const n = posix.normalize(b ? b + '/' + r : r).replace(/\/+$/, '') || '.';
      if (n === '..' || n.startsWith('../')) continue;
      if (!candidats.includes(n)) candidats.push(n);
    }
    for (const c of candidats) {
      if (estExempte(c)) return { statut: 'exempte', candidats };
      if (fichiers.has(c)) return { statut: 'fichier', candidats };
      // Un dossier résout s'il contient des fichiers suivis, sauf dans le
      // dossier de l'Optimizer, où un renvoi doit nommer un fichier.
      if (dossiers.has(c)) return { statut: sousO(c) ? 'mort' : 'dossier', candidats };
    }
    return { statut: 'mort', candidats };
  };
}

export type NomCompile = { nom: string; re: RegExp };
export const compilerNoms = (noms: string[]): NomCompile[] =>
  noms.map((nom) => ({ nom, re: new RegExp(`(?<![\\p{L}\\p{N}_\\-])${nom.replace(/\./g, '\\.')}(?![\\p{L}\\p{N}_\\-])`, 'gu') }));

export function releverFichier(
  fichier: string,
  lignes: string[],
  resoudre: ReturnType<typeof construireResolveur>,
  nomsSansHomonyme: string[] | NomCompile[],
): Occurrence[] {
  const noms: NomCompile[] = nomsSansHomonyme.length && typeof nomsSansHomonyme[0] === 'string'
    ? compilerNoms(nomsSansHomonyme as string[]) : nomsSansHomonyme as NomCompile[];
  const occ: Occurrence[] = [];
  const type = typeDe(fichier, lignes[0]);
  const diese = /\.(?:sh|py|ya?ml|ps1)$/.test(fichier);
  const nomSeulIci = /^(?:src|scripts|tests|\.claude)\//.test(fichier);
  const etat = { bloc: false };
  const commentaires = lignes.map((L) => (type === 'code' ? plagesCommentaire(L, etat, diese) : []));
  const dansComm = (n: number, a: number) => commentaires[n].some(([d, f]) => a >= d && a < f);
  const texteOuComm = (n: number, a: number) => type === 'markdown' || (type === 'code' && dansComm(n, a));
  const ligneDeComm = (n: number) => type === 'code' && commentaires[n].length > 0
    && lignes[n].slice(0, commentaires[n][0][0]).trim() === '';

  const ajouter = (n: number, a: number, forme: Occurrence['forme'], brut: string) => {
    const renvoi = nettoyer(brut);
    if (!renvoi) return;
    if (/[<*{$]/.test(renvoi)) { occ.push({ fichier, ligne: n + 1, forme, renvoi, statut: 'non verifie', candidats: [] }); return; }
    // Une ligne de commentaire qui finit par `/` ou `-` n'est recollée à la
    // suivante que si le recollage résout.
    if (forme !== 'lien Markdown' && /[/-]$/.test(renvoi) && ligneDeComm(n)
      && a + brut.length >= lignes[n].trimEnd().length && n + 1 < lignes.length) {
      const suite = lignes[n + 1].replace(/^\s*(?:\/\/+|\/?\*+|#+)?\s*/, '').match(RE_SUITE);
      if (suite) {
        const recolle = nettoyer(renvoi + suite[0]);
        const r2 = resoudre(fichier, recolle);
        if (r2.statut === 'fichier' || r2.statut === 'dossier') {
          occ.push({ fichier, ligne: n + 1, forme, renvoi: recolle, statut: r2.statut, candidats: r2.candidats, recolle: true });
          return;
        }
      }
    }
    const res = resoudre(fichier, renvoi);
    occ.push({ fichier, ligne: n + 1, forme, renvoi, statut: res.statut, candidats: res.candidats });
  };

  let fence: string | null = null;
  for (let n = 0; n < lignes.length; n++) {
    // Spécificateurs de module masqués hors des commentaires seulement.
    const L = type === 'code'
      ? lignes[n].replace(RE_MODULE, (m: string, _a: string, _b: string, debut: number) => (dansComm(n, debut) ? m : ' '.repeat(m.length)))
      : lignes[n];
    const couverts: [number, number][] = [];
    const couvert = (a: number, b: number) => couverts.some(([x, y]) => a < y && b > x);
    // Bloc de code clôturé (Markdown) : ni lien ni définition de lien.
    const cloture = type === 'markdown' ? L.match(RE_CLOTURE) : null;
    if (cloture) {
      if (!fence) fence = cloture[1];
      else if (cloture[1][0] === fence[0] && cloture[1].length >= fence.length) fence = null;
    }
    const dansBloc = !!cloture || fence !== null;
    // Code en ligne : un lien écrit entre backticks est un exemple, pas un lien.
    const codeEnLigne = [...L.matchAll(RE_BACK)].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
    const dansCodeEnLigne = (a: number) => codeEnLigne.some(([d, f]) => a > d && a < f);
    const exclue = (cible: string) => !cible || RE_SCHEMA.test(cible) || cible.startsWith('//') || cible.startsWith('#');
    // 1. lien Markdown relatif, toujours relevé hors schéma, URL en `//`, ancre
    // seule et destination vide ; définition de lien par référence, Markdown seulement
    for (const m of dansBloc ? [] : [...L.matchAll(RE_LIEN)]) {
      if (!texteOuComm(n, m.index!) || dansCodeEnLigne(m.index!)) continue;
      const cible = (m[1] ?? m[2] ?? '').trim();
      couverts.push([m.index!, m.index! + m[0].length]);
      if (exclue(cible)) continue;
      if (m[2] !== undefined && cible.includes('(')) {
        occ.push({ fichier, ligne: n + 1, forme: 'lien Markdown', renvoi: cible, statut: 'non verifie', candidats: [] });
        continue;
      }
      ajouter(n, m.index!, 'lien Markdown', cible);
    }
    const def = dansBloc ? null : L.match(RE_DEF);
    if (def && type === 'markdown') {
      couverts.push([0, L.length]);
      const cible = (def[1] ?? def[2] ?? '').trim();
      if (!exclue(cible)) ajouter(n, 0, 'lien Markdown', cible);
    }
    // 2. chemin entre backticks, nettoyé avant ses filtres
    for (const m of L.matchAll(RE_BACK)) {
      if (!texteOuComm(n, m.index!) || couvert(m.index!, m.index! + m[0].length)) continue;
      const c = nettoyer(m[1].trim());
      if (!c || /\s/.test(c) || !c.includes('/') || RE_SCHEMA.test(c) || /^[-@]/.test(c) || !RE_TOUT_CHEMIN.test(c)) continue;
      if (!formeDeChemin(c)) continue;
      couverts.push([m.index!, m.index! + m[0].length]);
      ajouter(n, m.index! + 1, 'backticks', c);
    }
    // 3. chemin nu depuis la racine : texte, commentaires et chaînes
    for (const m of L.matchAll(RE_NU)) {
      if (couvert(m.index!, m.index! + m[0].length)) continue;
      couverts.push([m.index!, m.index! + m[0].length]);
      ajouter(n, m.index!, 'chemin nu', m[0]);
    }
    // 4. forme relative `../`, Markdown et commentaires seulement
    for (const m of L.matchAll(RE_REL)) {
      if (!texteOuComm(n, m.index!) || couvert(m.index!, m.index! + m[0].length)) continue;
      couverts.push([m.index!, m.index! + m[0].length]);
      ajouter(n, m.index!, 'relatif', m[0]);
    }
    // 5. nom seul d'une note sans homonyme public
    if (nomSeulIci) {
      for (const { nom, re } of noms) {
        for (const m of L.matchAll(re)) {
          if (couvert(m.index!, m.index! + m[0].length)) continue;
          occ.push({ fichier, ligne: n + 1, forme: 'nom seul', renvoi: nom, statut: 'mort', candidats: [] });
        }
      }
    }
  }
  return occ;
}

// Faux sans `.git` (fichier ou dossier) à la racine ; sinon Git doit
// répondre, et toute erreur est levée : elle ne doit pas désactiver le
// garde-fou.
export function depotGit(racine: string): boolean {
  if (!existsSync(join(racine, '.git'))) return false;
  execFileSync('git', ['-C', racine, 'rev-parse', '--git-dir'], { stdio: ['ignore', 'pipe', 'pipe'] });
  return true;
}

// Toutes les occurrences des fichiers lus, exemptés compris (`exempt`), et
// les fichiers suivis illisibles, qui font échouer le test.
export function releverRenvois(racine: string): { occurrences: (Occurrence & { exempt: boolean })[]; suivis: string[]; illisibles: string[] } {
  const suivis = execFileSync('git', ['-C', racine, 'ls-files', '-z'], { maxBuffer: 1 << 28 })
    .toString().split('\0').filter(Boolean);
  const resoudre = construireResolveur(suivis);
  const bases = new Set(suivis.map((p) => posix.basename(p)));
  const noms = compilerNoms(NOMS_DE_NOTES.filter((n) => !bases.has(n)));
  const occurrences: (Occurrence & { exempt: boolean })[] = [];
  const illisibles: string[] = [];
  for (const f of suivis) {
    let buf: Buffer;
    try { buf = readFileSync(join(racine, f)); } catch { illisibles.push(f); continue; }
    if (buf.subarray(0, 8000).includes(0)) continue; // binaire
    const exempt = FICHIERS_EXEMPTES.includes(f);
    for (const o of releverFichier(f, buf.toString('utf8').split(/\r?\n/), resoudre, noms)) occurrences.push({ ...o, exempt });
  }
  return { occurrences, suivis, illisibles };
}

type Entree = { fichier: string; renvoi: string; occurrences: number; proprietaire: string };

export function testRenvoisFormes() {
  titre('renvois · formes détectées, résolution dans les fichiers suivis');
  const suivis = ['spec/a.md', 'spec/outils/b.md', 'src/lib/x.ts', 'src/lib/y.ts', `${O}/publie.md`, 'tests/z.test.ts'];
  const resoudre = construireResolveur(suivis);
  const noms = ['pistes.md'];
  const relever = (fichier: string, texte: string) => releverFichier(fichier, texte.split('\n'), resoudre, noms);
  const morts = (fichier: string, texte: string) => relever(fichier, texte).filter((o) => o.statut === 'mort').map((o) => `${o.forme}:${o.renvoi}`);

  egal(morts('spec/c.md', '[a](a.md) [b](outils/b.md#titre) [x](../src/lib/x.ts:12) [m](mort.md)'), ['lien Markdown:mort.md'],
    'lien Markdown : trois bases, ancre et ligne retirées, lien mort relevé');
  egal(morts('spec/c.md', '[r][n]\n\n[n]: archive/h.md'), ['lien Markdown:archive/h.md'], 'définition de lien par référence morte');
  egal(morts('spec/c.md', 'Voir `src/lib/x.ts`, `outils/b.md`, `decisions/d.md`, `release/x.y.z`, `/api/v2/`, `a b/c.md`.'),
    ['backticks:decisions/d.md'], 'backticks : chemin mort relevé ; version, adresse et commande ignorées');
  egal(morts('src/lib/x.ts', '// voir spec/outils/c.md\nconst p = "src/lib/w.ts";'), ['chemin nu:spec/outils/c.md', 'chemin nu:src/lib/w.ts'],
    'chemin nu : commentaire et chaîne');
  egal(morts('src/lib/x.ts', "import { a } from 'src/lib/w';\nconst b = await import('scripts/w.mjs');\nrequire('tests/w');\nvi.mock('src/w');"), [],
    'spécificateurs de module ignorés');
  egal(morts('src/lib/x.ts', '// voir ../../spec/mort.md\nconst p = "../../spec/mort.md";'), ['relatif:../../spec/mort.md'],
    'forme `../` : commentaire relevé, chaîne de code ignorée');
  egal(morts('spec/c.md', `Dossiers : spec/outils/, ${O}/, ${O}/archive/ ; fin.`), [`chemin nu:${O}/`, `chemin nu:${O}/archive/`],
    'dossier admis s’il porte des fichiers suivis, jamais dans le dossier de l’Optimizer');
  egal(morts('spec/c.md', `Publié : ${O}/publie.md.`), [], 'fichier publié du dossier de l’Optimizer : résolu');
  egal(morts('spec/c.md', 'Modèles : spec/<nom>.md, src/**/x.ts, spec/{a,b}.md, src/${x}.ts.'), [], 'chemin à <, *, { : non vérifié');
  egal(morts('spec/c.md', 'Hors dépôt : ../../../ailleurs/x.md.'), ['relatif:../../../ailleurs/x.md'], 'chemin qui sort du dépôt : mort');
  egal(morts('spec/c.md', 'Voir `.claude/settings.json`, `.claude/agents/x.md`, `node_modules/`.'), [], 'cibles volontairement non suivies : exemptées');
  egal(morts('src/lib/x.ts', '// voir pistes.md et spec/pistes.md'), ['chemin nu:spec/pistes.md', 'nom seul:pistes.md'],
    'nom seul d’une note relevé, une seule fois par mention');
  egal(morts('spec/c.md', 'Voir pistes.md.'), [], 'nom seul : pas contrôlé hors de src/, scripts/, tests/, .claude/');
  egal(morts('src/lib/x.ts', '// voir spec/outils/\n// b.md, puis spec/\n// outils/mort.md'), [],
    'ligne de commentaire coupée sur `/` : recollée quand le recollage résout, sinon prise seule (`spec/` résout)');
  egal(morts('src/lib/x.ts', '// voir spec/outils/mort-\n// suite.md'), ['chemin nu:spec/outils/mort-'],
    'coupure sur `-` qui ne résout pas : la ligne est prise seule');
  const seul = construireResolveur(['src/lib/x.ts']);
  egal(releverFichier('spec/c.md', ['Voir `src/lib/ignore.ts`.'], seul, []).map((o) => o.statut), ['mort'],
    'fichier absent de la liste des suivis : mort, même s’il existe sur le disque');

  // Une exception (fonction absente, Git en erreur) est un échec, pas un arrêt.
  const cas = (libelle: string, calcul: () => unknown, attendu: unknown) => {
    let recu: unknown;
    try { recu = calcul(); } catch (e) { ok(false, `${libelle} — exception : ${String(e).split('\n')[0]}`); return; }
    egal(recu, attendu, libelle);
  };
  cas('lien Markdown relatif relevé quelle que soit son extension ou son premier dossier',
    () => morts('spec/c.md', '[g](guide) [a](archive/absent.pdf) [n](archive.v2/absent.md)'),
    ['lien Markdown:guide', 'lien Markdown:archive/absent.pdf', 'lien Markdown:archive.v2/absent.md']);
  cas('lien : `:ligne` et `#ancre` retirés avant tout test, ancre à gabarit comprise',
    () => morts('spec/c.md', '[n](archive/absent.md:12) [m](archive/absent.md#<titre>) [o](outils/b.md:12#titre)'),
    ['lien Markdown:archive/absent.md', 'lien Markdown:archive/absent.md']);
  cas('lien : destination entre chevrons avec espaces, titre entre apostrophes ou parenthèses',
    () => morts('spec/c.md', "[n](<archive/note absente.md>) [m](archive/absent.md 'Titre') [p](archive/autre.md (Titre))"),
    ['lien Markdown:archive/note absente.md', 'lien Markdown:archive/absent.md', 'lien Markdown:archive/autre.md']);
  cas('« from » dans un commentaire n’est pas un spécificateur de module',
    () => morts('src/lib/x.ts', '// copié from "spec/absent.md"'), ['chemin nu:spec/absent.md']);
  const unicode = construireResolveur([...suivis, 'src/x+y.ts', 'src/café.ts']);
  cas('chemin à @, + ou accent décomposé : pris entier',
    () => releverFichier('spec/c.md', ['Voir src/@absent.ts, src/x+y.ts et src/café.ts.'], unicode, [])
      .filter((o) => o.statut === 'mort').map((o) => o.renvoi),
    ['src/@absent.ts']);
  cas('cible exemptée comme fichier : ses descendants ne le sont pas ; cible exemptée suivie : signalée',
    () => [morts('spec/c.md', 'Voir `.claude/settings.json/absent.md`.'),
      ciblesExempteesSuivies(['src/a.ts', '.claude/agents/x.md', '.claude/settings.json'])],
    [['backticks:.claude/settings.json/absent.md'], ['.claude/settings.json', '.claude/agents']]);
  const ordre = construireResolveur([`${O}/publie.md`, 'optimizer/public.txt']);
  cas('trois bases dans l’ordre : le dossier de l’Optimizer gagne, et il est refusé',
    () => releverFichier('spec/outils/optimizer.md', ['[o](optimizer/)'], ordre, []).map((o) => o.statut), ['mort']);
  cas('`.` et `..` préservés, la racine est un dossier',
    () => morts('spec/probe.md', `Voir ../ et ${O}/..`), []);
  cas('backticks : `:ligne`, `#ancre` et `?requête` retirés avant les filtres',
    () => morts('spec/c.md', 'Voir `archive/absent.md:12#titre` et `archive/absent.md?raw=1`.'),
    ['backticks:archive/absent.md', 'backticks:archive/absent.md']);
  cas('lien vers une URL en `//` : exclu comme un schéma',
    () => morts('spec/c.md', '[CDN](//example.org/image.svg)'), []);
  cas('lien à destination vide suivie d’un titre : exclu',
    () => morts('spec/c.md', `[a]( "Titre") [b]( 'Titre') [c]( (Titre))`), []);
  const parentheses = construireResolveur([...suivis, 'spec/archive/note(1).md']);
  cas('destination nue avec `(` : non vérifiée ; entre chevrons : résolue',
    () => releverFichier('spec/c.md', ['[n](archive/note(1).md) [m](<archive/note(1).md>)'], parentheses, []).map((o) => o.statut),
    ['non verifie', 'fichier']);
  cas('lien dans du code en ligne ou un bloc clôturé : un exemple, pas un lien',
    () => [morts('spec/c.md', 'Exemple : `[texte](url)`.\n```\n[x](absent.md)\n```\n~~~md\n[y](autre.md)\n~~~\n[z](mort.md)'),
      morts('src/lib/x.ts', '// un lien `[t](archive/absent.md)` en exemple')],
    [['lien Markdown:mort.md'], []]);
  cas('fichier suivi illisible relevé ; seule l’absence de `.git` est « pas de dépôt », un `.git` invalide lève', () => {
    const bac = mkdtempSync(join(tmpdir(), 'swblacksmith-renvois-'));
    try {
      const depot = join(bac, 'depot');
      mkdirSync(depot);
      execFileSync('git', ['-C', depot, 'init', '-q'], { stdio: 'ignore' });
      writeFileSync(join(depot, 'a.md'), 'x\n');
      writeFileSync(join(depot, 'b.md'), 'Voir [a](a.md).\n');
      execFileSync('git', ['-C', depot, '-c', 'core.autocrlf=false', 'add', '--', 'a.md', 'b.md'], { stdio: 'ignore' });
      rmSync(join(depot, 'a.md'));
      mkdirSync(join(depot, 'a.md'));
      const casse = join(bac, 'casse');
      mkdirSync(casse);
      writeFileSync(join(casse, '.git'), 'gitdir: nulle-part\n');
      let erreur = 'aucune';
      try { depotGit(casse); } catch { erreur = 'levée'; }
      return [releverRenvois(depot).illisibles, depotGit(depot), depotGit(bac), erreur];
    } finally {
      // bac provient exclusivement de mkdtempSync sous tmpdir.
      rmSync(bac, { recursive: true, force: true });
    }
  }, [['a.md'], true, false, 'levée']);
}

export function testRenvois() {
  titre('renvois · aucun renvoi mort hors de la liste tolérée');
  let depot: boolean;
  try {
    depot = depotGit(RACINE);
  } catch (e) {
    ok(false, `Git en erreur, garde-fou non exécuté — ${String(e).split('\n')[0]}`);
    return;
  }
  if (!depot) {
    ignore('renvois', 'pas de dépôt Git');
    return;
  }
  const { occurrences, suivis, illisibles } = releverRenvois(RACINE);
  egal(illisibles, [], 'chaque fichier suivi est lisible');
  const liste = JSON.parse(readFileSync(join(RACINE, LISTE), 'utf8')) as { entrees: Entree[] };
  const entrees = liste.entrees;

  const malFormees = entrees.filter((e) => typeof e.fichier !== 'string' || typeof e.renvoi !== 'string'
    || !Number.isInteger(e.occurrences) || e.occurrences < 1 || !PROPRIETAIRES.includes(e.proprietaire));
  ok(malFormees.length === 0, `liste tolérée bien formée${malFormees.length ? ' — ' + JSON.stringify(malFormees.slice(0, 5)) : ''}`);
  const cle = (f: string, r: string) => `${f}\u0000${r}`;
  const doublons = entrees.map((e) => cle(e.fichier, e.renvoi)).filter((k, i, t) => t.indexOf(k) !== i);
  ok(doublons.length === 0, `liste tolérée sans doublon${doublons.length ? ' — ' + doublons.map((d) => d.replace('\u0000', ' → ')).join(', ') : ''}`);

  // Renvois morts, regroupés par (fichier, renvoi).
  const morts = new Map<string, { fichier: string; renvoi: string; lignes: number[] }>();
  for (const o of occurrences) {
    if (o.exempt || o.statut !== 'mort') continue;
    const k = cle(o.fichier, o.renvoi);
    if (!morts.has(k)) morts.set(k, { fichier: o.fichier, renvoi: o.renvoi, lignes: [] });
    morts.get(k)!.lignes.push(o.ligne);
  }
  const toleres = new Map(entrees.map((e) => [cle(e.fichier, e.renvoi), e]));

  const nonToleres = [...morts.values()].filter((m) => (toleres.get(cle(m.fichier, m.renvoi))?.occurrences ?? 0) < m.lignes.length);
  ok(nonToleres.length === 0, nonToleres.length === 0
    ? `aucun renvoi mort hors de la liste (${[...morts.values()].reduce((s, m) => s + m.lignes.length, 0)} tolérés)`
    : `renvoi mort non toléré :\n${nonToleres.map((m) => `         ${m.fichier}:${m.lignes.join(',')} → ${m.renvoi}`
      + ` (${m.lignes.length}, liste : ${toleres.get(cle(m.fichier, m.renvoi))?.occurrences ?? 0})`).join('\n')}`);

  const perimees = entrees.filter((e) => (morts.get(cle(e.fichier, e.renvoi))?.lignes.length ?? 0) < e.occurrences);
  ok(perimees.length === 0, perimees.length === 0
    ? 'aucune entrée tolérée périmée'
    : `entrée tolérée qui ne fait plus échouer (à retirer ou décompter) :\n${perimees.map((e) => `         ${e.fichier} → ${e.renvoi}`
      + ` (liste : ${e.occurrences}, relevé : ${morts.get(cle(e.fichier, e.renvoi))?.lignes.length ?? 0})`).join('\n')}`);

  const suivisSet = new Set(suivis);
  egal(FICHIERS_EXEMPTES.filter((f) => !suivisSet.has(f)), [],
    'chaque fichier exempté est suivi');
  egal(ciblesExempteesSuivies(suivis), [], 'aucune cible exemptée n’est suivie');
  // `.git` n'est pas soumis à check-ignore : c'est le dossier de Git lui-même.
  const nonIgnorees = CIBLES_EXEMPTEES.filter((e) => e.chemin !== '.git').filter((e) => {
    try {
      execFileSync('git', ['-C', RACINE, 'check-ignore', '-q', '--no-index', e.dossier ? `${e.chemin}/x` : e.chemin], { stdio: 'ignore' });
      return false;
    } catch {
      return true;
    }
  }).map((e) => e.chemin);
  egal(nonIgnorees, [], 'chaque cible exemptée est ignorée par Git');
}
