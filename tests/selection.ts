// Sélection des vérifications par fichiers modifiés.
//
//   node tests/run.mjs --depuis <ref>        fichiers modifiés depuis la base de
//                                            fusion de <ref> et HEAD, index,
//                                            arbre de travail et non suivis compris
//   node tests/run.mjs --plage <a>..<b>      fichiers modifiés entre a et b
//
// Utilisable seul (mesure du rappel sur un worktree d'une autre révision) :
//   node tests/selection.ts --racine <dossier> (--depuis <ref> | --plage <a>..<b>) [--json <fichier>]
//
// ⚠️ Invariant : ne jamais sélectionner moins sans le dire. Un fichier modifié
// sans lien spécifique, une incohérence de l'inventaire, une lecture de Git qui
// échoue : suite complète, cause écrite en sortie. Une retenue générale
// (`depot`, `opaque`) ne couvre jamais un fichier.
//
// L'inventaire (rattachement des entrées du registre, graphes esbuild,
// racines secondaires, lectures à l'exécution) est recalculé à chaque appel.
// Seules trois tables sont écrites à la main, chacune justifiée : les
// prérequis d'ordre (mesurés), les fichiers sans effet, le chargeur maison.

import { build, type BuildOptions, type Metafile, type Plugin } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, resolve as resoudreChemin } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type ts from 'typescript';

/* --------------------------------------------------------------------------
 * Tables écrites à la main
 * ----------------------------------------------------------------------- */

// Racines des sources : un fichier modifié ici sans lien spécifique, et absent
// de la liste des fichiers sans effet, déclenche la suite complète.
export const RACINES_SOURCES = ['src/', 'scripts/', 'public/', 'tests/', '.githooks/', 'bureau/'];

// Infrastructure des tests : toute modification relance tout. `tests/index.ts`
// a son propre traitement (registre et imports), plus bas.
export const INFRASTRUCTURE = ['tests/run.mjs', 'tests/arguments.ts', 'tests/outils.ts', 'tests/selection.ts', 'tests/execution.ts', 'package.json', 'package-lock.json'];
const RE_TSCONFIG = /^tsconfig[^/]*\.json$/;

// Fichiers qu'aucune vérification ne lit par un lien spécifique sans qu'il soit
// relevé, où qu'ils soient. Un fichier listé qui a un lien spécifique reste
// « couvert » ; sinon il est « sans effet » et ne retient que les vérifications
// `depot` et `opaque`, retenues pour tout fichier.
export const SANS_EFFET: { motif: string; sauf?: string[]; justification: string }[] = [
  {
    motif: '**/*.md',
    justification: 'documentation, jamais importée : lue par des vérifications `depot` (git ls-files, parcours de la racine) ou `opaque`, toujours retenues, ou par une cible relevée, qui la couvre alors',
  },
  {
    motif: 'tests/banc/**',
    sauf: ['tests/banc/selection.ts', 'tests/banc/ecrans.ts'],
    justification: 'le banc d\'affichage ne tourne pas dans la suite (son lanceur est tests/banc/run.mjs) ; tsc et ESLint le couvrent. Ses deux modules importés par banc-selection.test.ts en sont exclus : le graphe les couvre',
  },
  {
    motif: '.gitignore',
    justification: 'jamais importé ni lu par une vérification ciblée : il ne change que ce que Git suit, donc ce que lisent les vérifications `depot` (git ls-files, parcours de la racine), toujours retenues',
  },
];

// Prérequis d'ordre relevés
// (`ORDRE=…`, registre inversé, balayage des 137 vérifications placées après
// `testPersistance`). Ce sont des contraintes d'ORDRE : « A doit passer avant B ».
// Une vérification retenue entraîne celles qui doivent la précéder, et le
// registre fixe l'ordre : une sélection qui déplace l'une d'elles la voit échouer.
// Une contrainte apparue depuis demande une nouvelle mesure.
const APRES_PERSISTANCE = [
  'testOptimizerCreationNomParDefaut', 'testOptimizerPointMemoireMemeGeste', 'testOptimizerPointSessionIllisibleConserve',
  'testOptimizerPointRepriseRattachement', 'testOptimizerPointSuppressionConservation', 'testMemoireOptimizerLecteurListes',
  'testMemoireOptimizerListesIllisibles', 'testMemoireOptimizerMalformed', 'testMemoireOptimizerConservationSession',
  'testMemoireOptimizerEffacement', 'testMemoireOptimizerReimport', 'testMemoireOptimizerSuppressionExplicite',
  'testMemoireOptimizerReimportBrutPreserve', 'testMemoireOptimizerRejetsConserves', 'testOptimizerContenuListeJsonEtAncienStockage',
  'testOptimizerContenuListeRejetsConserves', 'testOptimizerContenuListeSuppressionEtSession',
  'testOptimizerContenuListeCreationEtModification', 'testOptimizerEquipesHookModificationAvecOrpheline',
];
export const PREREQUIS: Record<string, string[]> = {
  // `testPersistance` met `indexedDB` à null : `testStockage` échoue après elle.
  testPersistance: ['testStockage'],
  // Elles modifient l'état du module `usePersistence` : avant `testPersistance`,
  // elles la font échouer.
  ...Object.fromEntries(APRES_PERSISTANCE.map((n) => [n, ['testPersistance']])),
};

// Chargeur maison des tests de rendu : `navigateurOptimizer(telephone, entreeBanc)`
// transpile le banc et tout ce qu'il importe. Les lectures de sa fonction de
// chargement sont le graphe du banc, construit comme une racine secondaire
// (identique au relevé à l'exécution : vérification `testSelectionFichiersChargeur`).
export const CHARGEURS = [
  { fichier: 'tests/rendu/optimizer-navigable-banc.ts', fonction: 'navigateurOptimizer', parametre: 'entreeBanc', chargement: 'ajouter' },
];

/* --------------------------------------------------------------------------
 * Types
 * ----------------------------------------------------------------------- */

export type Statut = 'couvert' | 'sans effet' | 'non couvert' | 'infrastructure';

export interface Entree {
  index: number;
  ligne: number;
  genre: 'direct' | 'lambda' | 'etalement' | 'inconnu';
  nom: string | null;
  identifiant: string | null;
  fichierTest: string | null;
  texte: string;
}

interface Racine { racine: string; type: string; via: string; fichiers: string[]; erreur: string | null }

interface InfoFichierTest {
  graphe: Set<string>;
  racines: Racine[];
  ensemble: Set<string>;
  fichiers: Map<string, string[]>; // cible -> sites
  dossiers: Map<string, string[]>; // préfixe -> sites
  motifs: { motif: string; re: RegExp; site: string; tailwind: boolean }[];
  depot: string[];
  opaque: string[];
}

export interface Inventaire {
  racine: string;
  entrees: Entree[];
  fichiersTest: Map<string, InfoFichierTest>;
  incoherences: string[];
  // Ce que l'inventaire n'a pas pu suivre sans que la sélection change :
  // aujourd'hui, les `new Worker(…)` à cible non résolue. Dit en sortie.
  avertissements: string[];
  sourceIndex: string;
  // Configuration Tailwind lue (`content`), ou null si illisible ou absente.
  tailwind: { fichier: string; motifs: string[] } | null;
  dureeMs: number;
}

// Ce que le motif Tailwind décide pour un ensemble de fichiers modifiés.
export interface DecisionTailwind {
  etat: 'feuille inchangée (candidats)' | 'feuille inchangée (produite)' | 'feuille changée';
  detail: string;
  fichiers: string[]; // fichiers modifiés sous le motif
}

export interface FichierModifie { chemin: string; statut: Statut; detail: string }

export interface Retenue { index: number; nom: string | null; identifiant: string | null; genre: Entree['genre']; raisons: string[] }

export interface Selection {
  base: string;
  fichiers: FichierModifie[];
  complet: boolean;
  causes: string[];
  // Les avertissements de l'inventaire (`Inventaire.avertissements`).
  avertissements: string[];
  retenues: Retenue[];
  transversalesSeulement: boolean;
  // Décision du motif Tailwind pour ces fichiers ; null : sans objet, ou pas
  // de décision (le motif retient alors).
  tailwind: DecisionTailwind | null;
  // Ce que le point d'entrée exécute : des noms, et pour chaque groupe
  // d'étalements retenu, les noms d'entrées qui le bornent dans le registre.
  execution: { complet: boolean; noms: string[]; groupes: { avant: string | null; apres: string | null; etalements: string[] }[] };
  dureeMs: number;
}

/* --------------------------------------------------------------------------
 * Construction principale (mêmes options que `tests/run.mjs`)
 * ----------------------------------------------------------------------- */

export function optionsConstruction(racine: string, sortie: string): BuildOptions {
  return {
    absWorkingDir: racine,
    entryPoints: ['tests/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: sortie,
    logLevel: 'error',
    // `import.meta.url` sert à retrouver la racine du dépôt depuis les tests.
    //
    // `import.meta.env` : ce que Vite fournit à l'app. Les tests de RENDU
    // (tests/rendu/) affichent de vrais composants, dont une vingtaine lisent
    // `import.meta.env.BASE_URL` pour le chemin des images.
    define: {
      'import.meta.url': JSON.stringify(pathToFileURL(join(racine, 'tests', 'index.ts')).href),
      'import.meta.env': JSON.stringify({ BASE_URL: '/', MODE: 'test', DEV: false, PROD: true }),
      // Injecté par `vite.config.ts` (numéro de version affiché au pied de page).
      __APP_VERSION__: JSON.stringify('test'),
    },
    // ⚠️ esbuild ne peut PAS être bundlé lui-même (son API a besoin d'un
    // exécutable externe, localisé via un chemin RELATIF à son propre
    // package sur disque — un chemin qui devient faux une fois inliné dans
    // un autre fichier). Nécessaire dès qu'un test bundle lui-même un worker
    // (`scripts/lib/appariement-rapide-worker.ts`, VRAIS `worker_threads`
    // concurrents) — `require('esbuild')` reste un require normal, résolu à
    // l'exécution depuis node_modules, jamais inliné.
    external: ['esbuild'],
  };
}

/* --------------------------------------------------------------------------
 * Outils
 * ----------------------------------------------------------------------- */

const INCONNU = '\u2400';
const SANS_APPELANT = '\u2402';
const JETON = '\u2401';
const RE_PARAM = /\u2401P:(.+?):(\d+)\u2401/;
const jetonParam = (id: string, i: number) => `${JETON}P:${id}:${i}${JETON}`;
const norm = (p: string) => p.split('\\').join('/');
const sousRacines = (f: string) => RACINES_SOURCES.some((r) => f.startsWith(r));
const estInfrastructure = (f: string) => INFRASTRUCTURE.includes(f) || RE_TSCONFIG.test(f);

function git(racine: string, args: string[]): string {
  return execFileSync('git', args, { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
}

// Glob → expression régulière : `**/`, `**`, `*`, `?`, `{a,b}`.
export function globVersRegex(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const fin = glob.indexOf('}', i);
      if (fin < 0) { re += '\\{'; continue; }
      re += '(?:' + glob.slice(i + 1, fin).split(',').map((x) => x.replace(/[.+^${}()|[\]\\]/g, '\\$&')).join('|') + ')';
      i = fin;
    } else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
const SANS_EFFET_RE = SANS_EFFET.map((s) => ({ ...s, re: globVersRegex(s.motif) }));

type TsModule = typeof ts;
let T: TsModule;
async function chargerTs(): Promise<TsModule> {
  if (!T) { const m: any = await import('typescript'); T = m.default ?? m; }
  return T;
}

/* --------------------------------------------------------------------------
 * Relevé des sites de lecture, par l'API du compilateur TypeScript
 * ----------------------------------------------------------------------- */

// `cibleNavigateur` (Worker seulement) : la cible quand le module tourne dans le
// navigateur (chargeur maison des bancs), où `import.meta.url` est sa propre URL.
// `code` (Worker seulement) : `{ eval: true }`, le premier argument est du code.
interface Site { file: string; ligne: number; fn: string; genre: string; appel: string; cible: string[] | null; argv?: string[][]; chargement?: boolean; cibleNavigateur?: string[] | null; code?: boolean }
// Les arguments d'un appel ne s'évaluent qu'à la demande : la plupart des
// appels ne servent jamais à résoudre un paramètre.
interface Appel { file: string; nom: string; noeuds: ts.Expression[]; valeurs: (string[] | undefined)[] }
interface Fn { id: string; file: string; nom: string | null; ligne: number; params: string[]; defauts: (string[] | null)[] }

const FS_LECTURE = new Set(['readFileSync', 'readFile', 'readdirSync', 'readdir', 'existsSync', 'statSync', 'lstatSync', 'accessSync', 'opendirSync', 'createReadStream', 'readlinkSync', 'realpathSync', 'copyFileSync', 'cpSync', 'openSync', 'stat', 'lstat', 'access', 'opendir', 'exists']);
const SPAWN = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork']);

class Analyseur {
  readonly fichiers: Set<string>;
  readonly dossiers = new Set<string>();
  readonly principal: Set<string>;
  private readonly sources = new Map<string, ts.SourceFile>();
  private readonly releves = new Map<string, Site[]>();
  readonly appelsParNom = new Map<string, Appel[]>();
  readonly fns = new Map<string, Fn>();
  private readonly racine: string;
  // Vrai pendant l'évaluation d'une cible vue du navigateur (`cibleNavigateur`).
  private urlPropre = false;

  constructor(racine: string, fichiers: Set<string>, principal: Set<string>) {
    this.racine = racine;
    this.fichiers = fichiers;
    this.principal = principal;
    for (const f of fichiers) { let d = posix.dirname(f); while (d !== '.' && !this.dossiers.has(d)) { this.dossiers.add(d); d = posix.dirname(d); } }
  }

  sf(file: string): ts.SourceFile {
    let s = this.sources.get(file);
    if (!s) {
      const kind = /\.tsx$/.test(file) ? T.ScriptKind.TSX : /\.(mjs|js|cjs|jsx)$/.test(file) || !/\.[a-z]+$/.test(posix.basename(file)) ? T.ScriptKind.JS : T.ScriptKind.TS;
      s = T.createSourceFile(file, readFileSync(join(this.racine, file), 'utf8'), T.ScriptTarget.ES2022, true, kind);
      this.sources.set(file, s);
    }
    return s;
  }

  private resoudreModule(depuis: string, spec: string): string | null {
    if (!spec.startsWith('.')) return null;
    const base = posix.normalize(posix.join(posix.dirname(depuis), spec));
    for (const c of [base, ...['.ts', '.tsx', '.mts', '.mjs', '.js'].map((e) => base + e), base + '/index.ts', base + '/index.tsx'])
      if (this.fichiers.has(c)) return c;
    return null;
  }

  private ligne(n: ts.Node): number { return n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1; }

  private fnDe(node: ts.Node): ts.SignatureDeclaration | null {
    let n = node.parent;
    while (n) {
      if (T.isFunctionDeclaration(n) || T.isFunctionExpression(n) || T.isArrowFunction(n) || T.isMethodDeclaration(n) || T.isConstructorDeclaration(n)) return n;
      n = n.parent;
    }
    return null;
  }

  private nomFn(fn: ts.SignatureDeclaration): string | null {
    if (fn.name && T.isIdentifier(fn.name)) return fn.name.text;
    const p = fn.parent;
    if (p && T.isVariableDeclaration(p) && T.isIdentifier(p.name)) return p.name.text;
    if (p && T.isPropertyAssignment(p)) return p.name.getText();
    return null;
  }

  private idFn(fn: ts.SignatureDeclaration, file: string): string {
    const nom = this.nomFn(fn);
    const id = `${file}#${nom ?? '(anonyme)'}@${this.ligne(fn)}`;
    if (!this.fns.has(id)) {
      const e: Fn = { id, file, nom, ligne: this.ligne(fn), params: fn.parameters.map((p) => p.name.getText()), defauts: [] };
      this.fns.set(id, e);
      e.defauts = fn.parameters.map((p) => (p.initializer ? this.eval(p.initializer, file, 6) : null));
    }
    return id;
  }

  // Fonction nommée d'un fichier (déclaration ou constante), pour lire ses paramètres.
  fnParNom(file: string, nom: string): Fn | null {
    let trouvee: ts.SignatureDeclaration | null = null;
    const visite = (n: ts.Node) => {
      if (trouvee) return;
      if ((T.isFunctionDeclaration(n) || T.isFunctionExpression(n) || T.isArrowFunction(n)) && this.nomFn(n) === nom) { trouvee = n; return; }
      T.forEachChild(n, visite);
    };
    visite(this.sf(file));
    return trouvee ? this.fns.get(this.idFn(trouvee, file)) ?? null : null;
  }

  private produit(a: string[], b: string[], f: (x: string, y: string) => string): string[] {
    const out: string[] = [];
    for (const x of a) for (const y of b) out.push(f(x, y));
    return out.slice(0, 64);
  }

  private chercherDeclaration(id: ts.Node, name: string, file: string, prof: number): string[] | null {
    let n: ts.Node | undefined = id.parent;
    let prev: ts.Node = id;
    while (n) {
      if (T.isFunctionLike(n) && (n as ts.SignatureDeclaration).parameters) {
        const params = (n as ts.SignatureDeclaration).parameters;
        const i = params.findIndex((p) => T.isIdentifier(p.name) && p.name.text === name);
        if (i >= 0) return [jetonParam(this.idFn(n as ts.SignatureDeclaration, file), i)];
        if (params.some((p) => !T.isIdentifier(p.name) && p.name.getText().includes(name))) return [INCONNU];
      }
      if (T.isForOfStatement(n) && n.initializer && T.isVariableDeclarationList(n.initializer) && n.initializer.declarations[0].name.getText() === name && prev === n.statement) {
        return this.elements(n.expression, file, prof) ?? [INCONNU];
      }
      if (T.isBlock(n) || T.isSourceFile(n) || T.isModuleBlock(n) || T.isCaseClause(n)) {
        for (const st of n.statements) {
          if (T.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
            if (T.isIdentifier(d.name) && d.name.text === name) {
              const constante = (st.declarationList.flags & T.NodeFlags.Const) !== 0;
              if (constante && d.initializer) return this.eval(d.initializer, file, prof + 1);
              return this.valeursLet(name, d, file, prof);
            }
            if (!T.isIdentifier(d.name) && d.name.getText().includes(name)) return [INCONNU];
          }
          if (T.isFunctionDeclaration(st) && st.name?.text === name) return [INCONNU];
        }
      }
      prev = n; n = n.parent;
    }
    const s = this.sf(file);
    for (const st of s.statements) if (T.isImportDeclaration(st) && st.importClause && T.isStringLiteral(st.moduleSpecifier)) {
      const c = st.importClause;
      let imp: string | null = null;
      if (c.name?.text === name) imp = 'default';
      if (c.namedBindings && T.isNamedImports(c.namedBindings)) for (const el of c.namedBindings.elements) if (el.name.text === name) imp = (el.propertyName ?? el.name).text;
      if (imp) {
        const cible = this.resoudreModule(file, st.moduleSpecifier.text);
        if (!cible || prof > 6) return [INCONNU];
        for (const st2 of this.sf(cible).statements) if (T.isVariableStatement(st2)) for (const d of st2.declarationList.declarations)
          if (T.isIdentifier(d.name) && d.name.text === imp && d.initializer) return this.eval(d.initializer, cible, prof + 1);
        return [INCONNU];
      }
    }
    return null;
  }

  private valeursLet(name: string, d: ts.VariableDeclaration, file: string, prof: number): string[] {
    const out: string[] = [];
    if (d.initializer && !(T.isIdentifier(d.initializer) && d.initializer.text === 'undefined') && d.initializer.kind !== T.SyntaxKind.NullKeyword) out.push(...this.eval(d.initializer, file, prof + 1));
    const visite = (n: ts.Node) => {
      if (T.isBinaryExpression(n) && n.operatorToken.kind === T.SyntaxKind.EqualsToken && T.isIdentifier(n.left) && n.left.text === name) out.push(...this.eval(n.right, file, prof + 1));
      T.forEachChild(n, visite);
    };
    visite(this.sf(file));
    return out.length ? out : [INCONNU];
  }

  private elements(it: ts.Expression, file: string, prof: number): string[] | null {
    if (T.isAsExpression(it) || T.isParenthesizedExpression(it) || T.isSatisfiesExpression(it)) return this.elements(it.expression, file, prof);
    if (T.isArrayLiteralExpression(it)) { const out: string[] = []; for (const e of it.elements) out.push(...this.eval(e, file, prof + 1)); return out; }
    if (T.isIdentifier(it)) {
      let n: ts.Node | undefined = it.parent;
      while (n) {
        if (T.isSourceFile(n) || T.isBlock(n)) for (const st of n.statements) if (T.isVariableStatement(st)) for (const d of st.declarationList.declarations)
          if (T.isIdentifier(d.name) && d.name.text === it.text && d.initializer) return this.elements(d.initializer, file, prof + 1);
        n = n.parent;
      }
    }
    return null;
  }

  // Valeurs possibles d'une expression de chemin : une alternative par chaîne ;
  // INCONNU marque une partie non évaluée, un jeton un paramètre de fonction.
  eval(node: ts.Node, file: string, prof = 0): string[] {
    if (prof > 24) return [INCONNU];
    if (T.isParenthesizedExpression(node) || T.isAsExpression(node) || T.isNonNullExpression(node) || T.isTypeAssertionExpression(node) || T.isSatisfiesExpression(node)) return this.eval(node.expression, file, prof);
    if (T.isStringLiteral(node) || T.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (T.isTemplateExpression(node)) {
      let acc = [node.head.text];
      for (const sp of node.templateSpans) acc = this.produit(this.produit(acc, this.eval(sp.expression, file, prof + 1), (a, b) => a + b), [sp.literal.text], (a, b) => a + b);
      return acc;
    }
    if (T.isBinaryExpression(node) && node.operatorToken.kind === T.SyntaxKind.PlusToken) return this.produit(this.eval(node.left, file, prof + 1), this.eval(node.right, file, prof + 1), (a, b) => a + b);
    if (T.isConditionalExpression(node)) return [...this.eval(node.whenTrue, file, prof + 1), ...this.eval(node.whenFalse, file, prof + 1)];
    if (T.isBinaryExpression(node) && (node.operatorToken.kind === T.SyntaxKind.BarBarToken || node.operatorToken.kind === T.SyntaxKind.QuestionQuestionToken)) return [...this.eval(node.left, file, prof + 1), ...this.eval(node.right, file, prof + 1)];
    if (T.isIdentifier(node)) {
      if (node.text === '__dirname') return [posix.dirname(file)];
      return this.chercherDeclaration(node, node.text, file, prof) ?? [INCONNU];
    }
    if (T.isPropertyAccessExpression(node)) {
      const p = node.name.text;
      if (p === 'pathname' || p === 'href') return this.eval(node.expression, file, prof + 1);
      // La construction principale définit `import.meta.url` comme `tests/index.ts` ;
      // le navigateur, comme l'URL du module.
      if (node.expression.getText() === 'import.meta' && p === 'url') return [this.principal.has(file) && !this.urlPropre ? 'tests/index.ts' : file];
      if (node.expression.getText() === 'process' && p === 'execPath') return ['<node>'];
      return [INCONNU];
    }
    if (T.isNewExpression(node) && node.expression.getText() === 'URL' && node.arguments?.length) {
      const a = this.eval(node.arguments[0], file, prof + 1);
      if (node.arguments.length < 2) return a;
      const base = this.eval(node.arguments[1], file, prof + 1);
      return this.produit(a, base, (x, b) => {
        if (x.includes(INCONNU) || x.includes(JETON) || b.includes(INCONNU)) return INCONNU;
        return posix.normalize(posix.join(posix.dirname(b.replace('file:///', '')), x));
      });
    }
    if (T.isCallExpression(node)) {
      const callee = node.expression;
      const nom = T.isIdentifier(callee) ? callee.text : T.isPropertyAccessExpression(callee) ? callee.name.text : null;
      if (nom === 'join' || nom === 'resolve') {
        let acc = [''];
        for (const a of node.arguments) acc = this.produit(acc, this.eval(a, file, prof + 1), (x, y) => (x === '' ? y : (y.startsWith('/') && nom === 'resolve' ? y : x + '/' + y)));
        return acc.map((x) => (x.includes(INCONNU) || x.includes(JETON)) ? x.split('/').reduce((s, seg) => (s ? s + '/' + seg : seg), '') : (x === '' ? '' : posix.normalize(x)));
      }
      if (nom === 'dirname') return this.eval(node.arguments[0], file, prof + 1).map((x) => ((x.includes(INCONNU) || x.includes(JETON)) ? INCONNU : posix.dirname(x)));
      if (nom === 'cwd') return [''];
      if (nom === 'tmpdir' || nom === 'mkdtempSync' || nom === 'mkdtemp') return ['<TMP>'];
      if (nom === 'fileURLToPath' || nom === 'normalize' || nom === 'String' || nom === 'toString')
        return node.arguments.length ? this.eval(node.arguments[0], file, prof + 1) : (T.isPropertyAccessExpression(callee) ? this.eval(callee.expression, file, prof + 1) : [INCONNU]);
      // `tests/outils.ts` retire le préfixe `/C:` d'un chemin d'URL.
      if (nom === 'replace' && T.isPropertyAccessExpression(callee)) return this.eval(callee.expression, file, prof + 1);
      return [INCONNU];
    }
    if (T.isSpreadElement(node)) return this.elements(node.expression, file, prof + 1) ?? [INCONNU];
    return [INCONNU];
  }

  private importeDe(s: ts.SourceFile, nom: string, module: string): boolean {
    for (const st of s.statements) if (T.isImportDeclaration(st) && T.isStringLiteral(st.moduleSpecifier) && st.moduleSpecifier.text.replace('node:', '') === module && st.importClause?.namedBindings && T.isNamedImports(st.importClause.namedBindings))
      for (const el of st.importClause.namedBindings.elements) if ((el.propertyName ?? el.name).text === nom) return true;
    return false;
  }

  // Sites de lecture d'un fichier, et appels de fonctions nommées (pour la
  // résolution des paramètres). Une seule fois par fichier.
  sites(file: string): Site[] {
    const connu = this.releves.get(file);
    if (connu) return connu;
    const s = this.sf(file);
    const sites: Site[] = [];
    this.releves.set(file, sites);
    const alias: Record<string, string> = {};
    for (const st of s.statements) if (T.isImportDeclaration(st) && st.importClause?.namedBindings && T.isNamedImports(st.importClause.namedBindings))
      for (const el of st.importClause.namedBindings.elements) alias[el.name.text] = (el.propertyName ?? el.name).text;
    const chargeur = CHARGEURS.find((c) => c.fichier === file);
    const enclosant = (n: ts.Node) => { const f = this.fnDe(n); return f ? (this.nomFn(f) ?? '(anonyme)') : '(module)'; };
    const dansChargement = (n: ts.Node) => {
      if (!chargeur) return false;
      for (let p: ts.Node | undefined = n.parent; p; p = p.parent)
        if ((T.isFunctionDeclaration(p) || T.isFunctionExpression(p) || T.isArrowFunction(p)) && this.nomFn(p) === chargeur.chargement) return true;
      return false;
    };
    const visite = (n: ts.Node) => {
      const site = (genre: string, appel: string, cible: string[] | null, extra: Partial<Site> = {}) =>
        sites.push({ file, ligne: this.ligne(n), fn: enclosant(n), genre, appel, cible, chargement: dansChargement(n), ...extra });
      if (T.isImportDeclaration(n) && T.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === 'tailwindcss') site('tailwind', 'import tailwindcss', null);
      if (T.isCallExpression(n)) {
        const c = n.expression;
        const nom = T.isIdentifier(c) ? c.text : T.isPropertyAccessExpression(c) ? c.name.text : null;
        const recv = T.isPropertyAccessExpression(c) ? c.expression.getText() : null;
        const arg = (i: number) => (n.arguments[i] ? this.eval(n.arguments[i], file) : null);
        if (n.arguments.some((a) => T.isStringLiteral(a) && a.text === 'tailwindcss')) site('tailwind', 'require tailwindcss', null);
        if (nom) {
          const appel: Appel = { file, nom: T.isIdentifier(c) ? (alias[nom] ?? nom) : nom, noeuds: [...n.arguments], valeurs: [] };
          const liste = this.appelsParNom.get(appel.nom) ?? [];
          liste.push(appel);
          this.appelsParNom.set(appel.nom, liste);
          const estFs = recv ? /fs|promises/i.test(recv) : (this.importeDe(s, nom, 'fs') || this.importeDe(s, nom, 'fs/promises'));
          if (FS_LECTURE.has(nom) && estFs) site('fs-lecture', nom, arg(0));
          else if (SPAWN.has(nom) && (recv ? /child|cp|process/i.test(recv) : this.importeDe(s, nom, 'child_process'))) {
            const a1 = n.arguments[1];
            const argv = a1 && T.isArrayLiteralExpression(a1) ? a1.elements.map((e) => this.eval(e, file)) : (a1 ? [[INCONNU]] : []);
            site('spawn', nom, arg(0), { argv });
          } else if ((nom === 'build' || nom === 'buildSync' || nom === 'context') && n.arguments[0] && T.isObjectLiteralExpression(n.arguments[0])) {
            const ep = n.arguments[0].properties.find((p) => p.name?.getText() === 'entryPoints');
            let cible: string[] | null = null;
            if (ep && T.isPropertyAssignment(ep)) cible = T.isArrayLiteralExpression(ep.initializer) ? ep.initializer.elements.flatMap((e) => this.eval(e, file)) : this.eval(ep.initializer, file);
            site('esbuild-build', nom, cible);
          } else if ((nom === 'require' || nom === 'createRequire') && n.arguments[0] && !T.isStringLiteral(n.arguments[0])) {
            site(nom === 'require' ? 'require-dynamique' : 'createRequire', nom, arg(0));
          }
        } else if (c.kind === T.SyntaxKind.ImportKeyword && n.arguments[0] && !T.isStringLiteral(n.arguments[0])) {
          site('import-dynamique', 'import()', this.eval(n.arguments[0], file));
        }
      } else if (T.isNewExpression(n)) {
        const nom = n.expression.getText();
        if (nom === 'Worker' || nom.endsWith('.Worker')) {
          const a0 = n.arguments?.[0];
          let cibleNavigateur: string[] | null;
          this.urlPropre = true;
          try { cibleNavigateur = a0 ? this.eval(a0, file) : null; } finally { this.urlPropre = false; }
          // `{ eval: true }` (worker_threads) : le premier argument est du code, pas une cible.
          const o1 = n.arguments?.[1];
          const code = !!o1 && T.isObjectLiteralExpression(o1) && o1.properties.some((p) => T.isPropertyAssignment(p) && p.name.getText() === 'eval' && p.initializer.kind === T.SyntaxKind.TrueKeyword);
          site('worker', 'new Worker', a0 ? this.eval(a0, file) : null, { cibleNavigateur, code });
        }
      } else if ((T.isStringLiteral(n) || T.isNoSubstitutionTemplateLiteral(n)) && /ls-files/.test(n.text)) {
        site('ls-files', 'git ls-files', [n.text]);
      }
      T.forEachChild(n, visite);
    };
    visite(s);
    return sites;
  }

  // Remplace les paramètres par les valeurs passées par les appelants de S.
  resoudre(alts: string[], S: Set<string>, pile: string[] = [], prof = 0): string[] {
    const sortie: string[] = [];
    for (const a of alts) {
      const m = a.match(RE_PARAM);
      if (!m) { sortie.push(a); continue; }
      if (prof > 10) { sortie.push(a.replace(m[0], INCONNU)); continue; }
      const fn = this.fns.get(m[1]);
      const idx = +m[2];
      const cle = m[1] + ':' + idx;
      if (pile.includes(cle)) continue; // appel récursif : mêmes racines
      if (!fn || !fn.nom) { sortie.push(a.replace(m[0], INCONNU)); continue; }
      const appelants = (this.appelsParNom.get(fn.nom) ?? []).filter((c) => S.has(c.file));
      let nb = 0;
      const sub: string[] = [];
      for (const c of appelants) {
        if (c.noeuds[idx] && c.valeurs[idx] === undefined) c.valeurs[idx] = this.eval(c.noeuds[idx], c.file);
        const valeurs = c.valeurs[idx] ?? fn.defauts[idx] ?? null;
        if (!valeurs) continue;
        nb++;
        sub.push(...valeurs);
      }
      if (nb === 0) { sortie.push(SANS_APPELANT); continue; }
      for (const r of this.resoudre([...new Set(sub)].slice(0, 80), S, [...pile, cle], prof + 1)) if (r !== SANS_APPELANT) sortie.push(a.replace(m[0], r));
    }
    const avecJeton = sortie.filter((x) => x.includes(JETON));
    if (avecJeton.length && prof < 12) return [...new Set([...sortie.filter((x) => !x.includes(JETON)), ...this.resoudre(avecJeton, S, pile, prof + 1)])].slice(0, 200);
    return [...new Set(sortie)].slice(0, 200);
  }

  estDossier(p: string): boolean {
    if (p === '' || p === '.') return true;
    if (this.dossiers.has(p)) return true;
    try { return statSync(join(this.racine, p)).isDirectory(); } catch { return false; }
  }
}

/* --------------------------------------------------------------------------
 * Classement d'une valeur de chemin
 * ----------------------------------------------------------------------- */

type Classee =
  | { kind: 'fichier' | 'dossier'; valeur: string }
  | { kind: 'construit'; valeur: string; prefixe: string }
  | { kind: 'racine' | 'depot' }
  | { kind: 'opaque'; cause: string }
  | { kind: 'ignore' };

function classerValeur(an: Analyseur, v0: string): Classee {
  let v = v0;
  if (v === SANS_APPELANT || v.includes('<TMP>') || v.startsWith('<node>') || /^https?:/.test(v)) return { kind: 'ignore' };
  if (v.includes(JETON)) return { kind: 'opaque', cause: 'paramètre non résolu' };
  const iu = v.indexOf(INCONNU);
  if (iu >= 0) {
    const avant = v.slice(0, iu);
    const dossier = avant.endsWith('/') ? avant.slice(0, -1) : posix.dirname(avant);
    if (avant === '' || dossier === '.' || dossier === '') return { kind: 'opaque', cause: 'aucun préfixe littéral : ' + v.split(INCONNU).join('*') };
    const n = posix.normalize(dossier);
    if (n === '.' || n.startsWith('..')) return { kind: 'opaque', cause: 'préfixe hors du dépôt : ' + v.split(INCONNU).join('*') };
    return { kind: 'construit', valeur: v.split(INCONNU).join('*'), prefixe: n };
  }
  v = posix.normalize(v);
  if (v.startsWith('/') || /^[A-Za-z]:/.test(v) || v.startsWith('..') || v.startsWith('node_modules')) return { kind: 'ignore' };
  if (v === '.' || v === '') return { kind: 'racine' };
  if (an.estDossier(v)) return { kind: 'dossier', valeur: v };
  return { kind: 'fichier', valeur: v };
}

/* --------------------------------------------------------------------------
 * Rattachement des entrées du registre
 * ----------------------------------------------------------------------- */

interface Registre {
  entrees: Entree[];
  imports: Map<string, { cible: string | null; nom: string; spec: string }>;
  tableau: ts.ArrayLiteralExpression | null;
  source: ts.SourceFile;
}

function resoudreFichier(fichiers: Set<string>, depuis: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = posix.normalize(posix.join(posix.dirname(depuis), spec));
  for (const c of [base, ...['.ts', '.tsx', '.mts', '.js', '.mjs'].map((e) => base + e), base + '/index.ts', base + '/index.tsx']) if (fichiers.has(c)) return c;
  return null;
}

function lireRegistre(an: Analyseur, fichierIndex = 'tests/index.ts', source?: string): Registre {
  const s = source !== undefined
    ? T.createSourceFile(fichierIndex, source, T.ScriptTarget.ES2022, true, T.ScriptKind.TS)
    : an.sf(fichierIndex);
  const imports = new Map<string, { cible: string | null; nom: string; spec: string }>();
  for (const st of s.statements) if (T.isImportDeclaration(st) && st.importClause && T.isStringLiteral(st.moduleSpecifier)) {
    const cible = resoudreFichier(an.fichiers, fichierIndex, st.moduleSpecifier.text);
    const c = st.importClause;
    if (c.name) imports.set(c.name.text, { cible, nom: 'default', spec: st.moduleSpecifier.text });
    if (c.namedBindings && T.isNamedImports(c.namedBindings)) for (const el of c.namedBindings.elements) imports.set(el.name.text, { cible, nom: (el.propertyName ?? el.name).text, spec: st.moduleSpecifier.text });
  }
  let tableau: ts.ArrayLiteralExpression | null = null;
  for (const st of s.statements) if (T.isVariableStatement(st)) for (const d of st.declarationList.declarations)
    if (d.name.getText() === 'VERIFICATIONS' && d.initializer && T.isArrayLiteralExpression(d.initializer)) tableau = d.initializer;
  const entrees: Entree[] = [];
  const exportDe = (fichier: string, nom: string, prof = 0): string | null => {
    if (prof > 5 || !an.fichiers.has(fichier)) return null;
    const sf = an.sf(fichier);
    const etoiles: string[] = [];
    for (const st of sf.statements) {
      if (T.isExportDeclaration(st)) {
        const cible = st.moduleSpecifier && T.isStringLiteral(st.moduleSpecifier) ? resoudreFichier(an.fichiers, fichier, st.moduleSpecifier.text) : null;
        if (st.moduleSpecifier) {
          if (!st.exportClause) { if (cible) etoiles.push(cible); continue; }
          if (T.isNamedExports(st.exportClause)) for (const el of st.exportClause.elements) if (el.name.text === nom) return cible ? exportDe(cible, (el.propertyName ?? el.name).text, prof + 1) : null;
        } else if (st.exportClause && T.isNamedExports(st.exportClause)) {
          for (const el of st.exportClause.elements) if (el.name.text === nom) return fichier;
        }
        continue;
      }
      const mods = T.canHaveModifiers(st) ? (T.getModifiers(st) ?? []) : [];
      if (!mods.some((m) => m.kind === T.SyntaxKind.ExportKeyword)) continue;
      if (nom === 'default' && mods.some((m) => m.kind === T.SyntaxKind.DefaultKeyword)) return fichier;
      if (T.isFunctionDeclaration(st) && st.name?.text === nom) return fichier;
      if (T.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (d.name.getText() === nom) return fichier;
    }
    for (const c of etoiles) { const r = exportDe(c, nom, prof + 1); if (r) return r; }
    if (nom === 'default') for (const st of sf.statements) if (T.isExportAssignment(st)) return fichier;
    return null;
  };
  tableau?.elements.forEach((el, index) => {
    const ligne = s.getLineAndCharacterOfPosition(el.getStart()).line + 1;
    const texte = el.getText().replace(/\s+/g, ' ');
    const rattacher = (identifiant: string | null) => {
      const im = identifiant ? imports.get(identifiant) : undefined;
      return im?.cible ? exportDe(im.cible, im.nom) : null;
    };
    if (T.isSpreadElement(el)) {
      const identifiant = T.isIdentifier(el.expression) ? el.expression.text : null;
      entrees.push({ index, ligne, genre: 'etalement', nom: null, identifiant, fichierTest: rattacher(identifiant), texte });
      return;
    }
    if (!T.isArrayLiteralExpression(el) || el.elements.length !== 2 || !T.isStringLiteral(el.elements[0])) {
      entrees.push({ index, ligne, genre: 'inconnu', nom: null, identifiant: null, fichierTest: null, texte });
      return;
    }
    const nom = el.elements[0].text;
    const f = el.elements[1];
    let identifiant: string | null = null;
    let genre: Entree['genre'] = 'direct';
    if (T.isIdentifier(f)) identifiant = f.text;
    else if (T.isArrowFunction(f) || T.isFunctionExpression(f)) {
      genre = 'lambda';
      const m = f.body.getText().match(/^\{\s*await\s+(\w+)\(\)\s*;?\s*\}$/);
      identifiant = m ? m[1] : null;
    }
    entrees.push({ index, ligne, genre, nom, identifiant, fichierTest: rattacher(identifiant), texte });
  });
  return { entrees, imports, tableau, source: s };
}

/* --------------------------------------------------------------------------
 * Configuration Tailwind : motifs `content`
 * ----------------------------------------------------------------------- */

function motifsTailwind(an: Analyseur): { fichier: string; motifs: string[] } | null {
  const fichier = ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs'].find((f) => an.fichiers.has(f));
  if (!fichier) return null;
  let motifs: string[] | null = null;
  const visite = (n: ts.Node) => {
    if (T.isPropertyAssignment(n) && n.name.getText() === 'content') {
      if (T.isArrayLiteralExpression(n.initializer) && n.initializer.elements.every((e) => T.isStringLiteral(e)))
        motifs = n.initializer.elements.map((e) => (e as ts.StringLiteral).text.replace(/^\.\//, ''));
      else motifs = null;
      return;
    }
    T.forEachChild(n, visite);
  };
  visite(an.sf(fichier));
  return motifs ? { fichier, motifs } : null;
}

/* --------------------------------------------------------------------------
 * Inventaire
 * ----------------------------------------------------------------------- */

const plugHooks: Plugin = {
  name: 'hooks-sans-extension',
  setup(b) {
    b.onLoad({ filter: /[\\/]\.githooks[\\/][^\\/.]+$/ }, (a) => ({ contents: readFileSync(a.path, 'utf8').replace(/^#!.*\n/, '\n'), loader: 'js' }));
  },
};

async function grapheRacine(racine: string, entree: string): Promise<{ fichiers: string[]; erreur: string | null }> {
  try {
    const r = await build({
      absWorkingDir: racine, entryPoints: [entree], bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, outfile: 'graphe.mjs',
      logLevel: 'silent', packages: 'external', plugins: [plugHooks],
      loader: { '.json': 'json', '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl' },
      define: { 'import.meta.env': JSON.stringify({ BASE_URL: '/', MODE: 'test', DEV: false, PROD: true }), __APP_VERSION__: '"test"' },
    });
    return { fichiers: [...fermeture(r.metafile, entree)], erreur: null };
  } catch (e) {
    return { fichiers: [entree], erreur: String((e as Error).message).split('\n')[0].slice(0, 200) };
  }
}

// Arêtes du métafichier : on ne suit jamais une arête `external` (un import de
// types effacé par esbuild y figure ainsi, sous son chemin non résolu).
function fermeture(meta: Metafile, depart: string): Set<string> {
  const vu = new Set([depart]);
  const pile = [depart];
  while (pile.length) {
    const f = pile.pop()!;
    for (const i of meta.inputs[f]?.imports ?? []) if (!i.external && meta.inputs[i.path] && !vu.has(i.path)) { vu.add(i.path); pile.push(i.path); }
  }
  return vu;
}

function listerFichiers(racine: string): Set<string> {
  const sortie = git(racine, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  return new Set(sortie.split('\0').filter((f) => f && existsSync(join(racine, f))));
}

export async function inventaire(racine0: string, metafichier?: Metafile): Promise<Inventaire> {
  const debut = Date.now();
  await chargerTs();
  const racine = norm(resoudreChemin(racine0));
  const incoherences: string[] = [];
  const fichiers = listerFichiers(racine);
  let meta = metafichier;
  if (!meta) {
    const r = await build({ ...optionsConstruction(racine, join(racine, 'selection-inventaire.cjs')), write: false, metafile: true, packages: 'external' });
    meta = r.metafile;
  }
  const principal = new Set(Object.keys(meta.inputs).filter((f) => fichiers.has(f)));
  const an = new Analyseur(racine, fichiers, principal);
  const reg = lireRegistre(an);
  if (!reg.tableau) incoherences.push('tests/index.ts : registre VERIFICATIONS introuvable');
  for (const [id, im] of reg.imports) {
    if (!im.cible) { if (im.spec.startsWith('.')) incoherences.push(`tests/index.ts : import ${id} de ${im.spec} non résolu`); continue; }
    if (!meta.inputs[im.cible]) incoherences.push(`tests/index.ts : ${im.cible} importé mais absent du métafichier`);
  }
  for (const e of reg.entrees) if (e.genre === 'inconnu') incoherences.push(`tests/index.ts : entrée ${e.index} (l. ${e.ligne}) ni [nom, fonction] ni étalement`);
  for (const g of groupesEtalements(reg.entrees)) {
    const [i, k] = [g.indices[0], g.indices[g.indices.length - 1]];
    if ((i > 0 && !g.avant) || (k + 1 < reg.entrees.length && !g.apres)) incoherences.push(`tests/index.ts : étalement l. ${reg.entrees[i].ligne} sans entrée nommée voisine`);
  }
  const noms = new Set(reg.entrees.map((e) => e.nom).filter(Boolean));
  // Un registre qui n'a aucune des vérifications des prérequis (dépôt d'essai)
  // n'est pas concerné ; un registre qui en a une partie a renommé ou retiré
  // l'une d'elles, et l'inventaire des prérequis est à refaire.
  const nomsPrerequis = [...new Set(Object.entries(PREREQUIS).flatMap(([n, avant]) => [n, ...avant]))];
  const absents = nomsPrerequis.filter((n) => !noms.has(n));
  if (absents.length > 0 && absents.length < nomsPrerequis.length) incoherences.push(`prérequis : ${absents.join(', ')} absent(s) du registre (inventaire des prérequis à refaire)`);
  const tailwind = motifsTailwind(an);

  const fichiersTest = [...new Set(reg.entrees.map((e) => e.fichierTest).filter((f): f is string => !!f))];
  const graphes = new Map<string, Set<string>>();
  for (const ft of fichiersTest) {
    if (!meta.inputs[ft]) { incoherences.push(`${ft} : fichier de test absent du métafichier`); graphes.set(ft, new Set([ft])); continue; }
    graphes.set(ft, new Set([...fermeture(meta, ft)].filter((f) => fichiers.has(f))));
  }
  // Tous les modules du graphe principal sont relevés d'abord : les appelants
  // d'une fonction peuvent être n'importe où dans un ensemble.
  for (const f of principal) an.sites(f);

  // Racines secondaires : itération jusqu'au point fixe, constructions en parallèle.
  const graphesRacines = new Map<string, Promise<{ fichiers: string[]; erreur: string | null }>>();
  const racinesDe = new Map<string, Racine[]>();
  const ensembles = new Map<string, Set<string>>();
  // Les `new Worker(…)` dont la cible ne se résout pas, par fichier de test :
  // le module démarré n'entre dans aucun ensemble par ce site. Un
  // avertissement de l'inventaire, jamais une écartée silencieuse ; la
  // retenue ne change pas (le code démarré est souvent un paquet construit
  // par un site `esbuild-build`, suivi à part).
  const workersNonResolus = new Map<string, Set<string>>();
  let aFaire = fichiersTest;
  for (let tour = 0; ; tour++) {
    if (tour === 8) { incoherences.push('racines secondaires : pas de point fixe en 8 tours'); break; }
    const demandes: { ft: string; racine: string; type: string; via: string }[] = [];
    for (const ft of aFaire) {
      const S = new Set(graphes.get(ft));
      const racines: Racine[] = [];
      const vus = new Set<string>();
      const nonResolus = new Set<string>();
      workersNonResolus.set(ft, nonResolus);
      // Les modules que le navigateur charge : un banc du chargeur maison, et
      // les Workers que ces modules démarrent. Leurs `new Worker(new URL(…,
      // import.meta.url))` se résolvent depuis le module lui-même.
      const navigateur = new Set<string>();
      const ajouter = async (r: string, type: string, via: string, dansNavigateur = false) => {
        if (vus.has(r) || !fichiers.has(r)) return;
        vus.add(r);
        const p = graphesRacines.get(r);
        if (!p) { demandes.push({ ft, racine: r, type, via }); return; }
        const g = await p;
        racines.push({ racine: r, type, via, fichiers: g.fichiers, erreur: g.erreur });
        for (const f of g.fichiers) if (fichiers.has(f)) { S.add(f); an.sites(f); if (dansNavigateur) navigateur.add(f); }
      };
      for (let passe = 0; passe < 6; passe++) {
        const avant = vus.size;
        // Relevé sur l'ensemble de cette passe : une cible paramétrée se résout
        // parfois une fois les appelants ajoutés.
        nonResolus.clear();
        for (const ch of CHARGEURS) {
          if (!S.has(ch.fichier)) continue;
          const fn = an.fnParNom(ch.fichier, ch.fonction);
          const idx = fn ? fn.params.indexOf(ch.parametre) : -1;
          if (!fn || idx < 0 || !an.fnParNom(ch.fichier, ch.chargement)) { incoherences.push(`chargeur ${ch.fichier} : ${ch.fonction}(…${ch.parametre}) ou ${ch.chargement} introuvable`); continue; }
          for (const v of an.resoudre([jetonParam(fn.id, idx)], S)) if (!v.includes(INCONNU) && !v.includes(JETON) && v !== SANS_APPELANT) await ajouter(posix.normalize(v), 'chargeur-maison', ch.fichier, true);
        }
        for (const f of [...S]) for (const s of an.sites(f)) {
          const vueNavigateur = s.genre === 'worker' && navigateur.has(f);
          const brutes = vueNavigateur ? [...(s.cible ?? []), ...(s.cibleNavigateur ?? [])] : s.cible ?? [];
          const cibles = an.resoudre(brutes, S).filter((x) => x !== SANS_APPELANT && !x.includes(INCONNU) && !x.includes(JETON));
          const via = `${s.file}:${s.ligne}`;
          if (s.genre === 'worker' && !s.code) {
            const valeurs = brutes.length ? an.resoudre(brutes, S) : [INCONNU];
            const inconnues = valeurs.filter((x) => x.includes(INCONNU) || x.includes(JETON));
            if (inconnues.length) nonResolus.add(`${via} new Worker : cible non résolue (${inconnues.map((x) => x.split(INCONNU).join('*').split(JETON).join('?')).join(', ')})`);
          }
          if (s.genre === 'esbuild-build') for (const c of cibles) await ajouter(posix.normalize(c), 'esbuild-entryPoints', via);
          if (s.genre === 'worker' || s.genre === 'import-dynamique') for (const c of cibles) await ajouter(posix.normalize(c), s.genre, via, vueNavigateur);
          if (s.genre === 'spawn') {
            const toutes = [...cibles];
            for (const a of s.argv ?? []) toutes.push(...an.resoudre(a, S).filter((x) => x !== SANS_APPELANT && !x.includes(INCONNU) && !x.includes(JETON)));
            for (const c of toutes) {
              const n = posix.normalize(c);
              if (!c.includes('<TMP>') && (/\.(mjs|js|cjs|ts)$/.test(n) || n.startsWith('.githooks/'))) await ajouter(n, 'spawn-script', via);
            }
          }
        }
        if (vus.size === avant) break;
      }
      racinesDe.set(ft, racines);
      ensembles.set(ft, S);
    }
    if (demandes.length === 0) break;
    aFaire = [...new Set(demandes.map((d) => d.ft))];
    for (const d of demandes) if (!graphesRacines.has(d.racine)) graphesRacines.set(d.racine, grapheRacine(racine, d.racine));
    await Promise.all(graphesRacines.values());
  }

  const infos = new Map<string, InfoFichierTest>();
  for (const ft of fichiersTest) {
    const S = ensembles.get(ft)!;
    const info: InfoFichierTest = { graphe: graphes.get(ft)!, racines: racinesDe.get(ft)!, ensemble: S, fichiers: new Map(), dossiers: new Map(), motifs: [], depot: [], opaque: [] };
    const noter = (m: Map<string, string[]>, cle: string, site: string) => { const l = m.get(cle) ?? []; if (!l.includes(site)) l.push(site); m.set(cle, l); };
    for (const r of info.racines) if (r.erreur) info.opaque.push(`graphe de la racine ${r.racine} non construit : ${r.erreur}`);
    for (const f of S) for (const s of an.sites(f)) {
      const site = `${s.file}:${s.ligne}`;
      if (s.chargement) continue; // lectures du chargeur maison : le graphe du banc, suivi comme racine
      let valeurs: Classee[] = [];
      if (s.genre === 'ls-files') valeurs = [{ kind: 'depot' }];
      else if (s.genre === 'tailwind') {
        if (!tailwind) valeurs = [{ kind: 'depot' }];
        else {
          // La configuration est une cible ; chaque entrée `content` est un motif
          // Tailwind, qui ne retient que si la feuille produite peut changer.
          noter(info.fichiers, tailwind.fichier, site);
          for (const m of tailwind.motifs) info.motifs.push({ motif: m, re: globVersRegex(posix.normalize(m)), site, tailwind: true });
          continue;
        }
      } else if (s.genre === 'spawn') {
        const cmd = an.resoudre(s.cible ?? [], S);
        const aplatis = (s.argv ?? []).flatMap((a) => an.resoudre(a, S));
        if (aplatis.includes('ls-files')) continue; // déjà relevé comme littéral
        for (const a of aplatis) {
          if (a === SANS_APPELANT || a.startsWith('-') || a === INCONNU || a.includes('<TMP>')) continue;
          const c = classerValeur(an, a.replace(/^.*?:(?=public|src|docs|tests|scripts)/, ''));
          if (c.kind === 'dossier' || c.kind === 'construit' || (c.kind === 'fichier' && fichiers.has(c.valeur))) valeurs.push(c);
        }
        if (cmd.some((c) => c.includes(INCONNU) || c.includes(JETON))) valeurs.push({ kind: 'opaque', cause: 'commande non résolue' });
      } else if (['fs-lecture', 'createRequire', 'import-dynamique', 'require-dynamique'].includes(s.genre)) {
        valeurs = an.resoudre(s.cible ?? [INCONNU], S).map((v) => classerValeur(an, v));
      } else continue;
      for (const v of valeurs) {
        if (v.kind === 'fichier') noter(info.fichiers, v.valeur, site);
        else if (v.kind === 'dossier') noter(info.dossiers, v.valeur, site);
        else if (v.kind === 'construit') noter(info.dossiers, v.prefixe, `${site}, chemin construit ${v.valeur}`);
        else if (v.kind === 'racine') info.depot.push(`${site} lit la racine du dépôt (${s.appel})`);
        else if (v.kind === 'depot') info.depot.push(`${site} ${s.genre === 'tailwind' ? 'Tailwind sans configuration lisible' : 'git ls-files (dépôt entier)'}`);
        else if (v.kind === 'opaque') info.opaque.push(`${site} ${s.appel} : ${v.cause}`);
      }
    }
    info.depot = [...new Set(info.depot)];
    info.opaque = [...new Set(info.opaque)];
    infos.set(ft, info);
  }
  const avertissements = [...new Set([...workersNonResolus.values()].flatMap((s) => [...s]))].sort();
  return { racine, entrees: reg.entrees, fichiersTest: infos, incoherences: [...new Set(incoherences)], avertissements, sourceIndex: reg.source.text, tailwind: tailwind ?? null, dureeMs: Date.now() - debut };
}

export function classement(info: InfoFichierTest): 'depot' | 'opaque' | 'dossier' | 'statique' {
  return info.depot.length ? 'depot' : info.opaque.length ? 'opaque' : (info.dossiers.size || info.motifs.length) ? 'dossier' : 'statique';
}

/* --------------------------------------------------------------------------
 * `tests/index.ts` : registre et imports
 * ----------------------------------------------------------------------- */

interface DiffIndex { complet: string | null; retenus: Map<number, string[]>; detail: string }

// Plus longue sous-suite commune (indices de b conservés).
function communs(a: string[], b: string[]): Set<number> {
  const n = a.length, m = b.length;
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const garde = new Set<number>();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { garde.add(j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return garde;
}

export function comparerIndex(avant: string | null, apres: string): DiffIndex {
  const complet = (cause: string): DiffIndex => ({ complet: cause, retenus: new Map(), detail: cause });
  if (avant === null) return complet('tests/index.ts absent de la base : changement hors registre');
  const lire = (texte: string) => {
    const s = T.createSourceFile('tests/index.ts', texte.split('\r\n').join('\n'), T.ScriptTarget.ES2022, true, T.ScriptKind.TS);
    const decls: { cle: string; liens: Map<string, string>; debut: number; fin: number }[] = [];
    let tableau: ts.ArrayLiteralExpression | null = null;
    for (const st of s.statements) {
      if (T.isImportDeclaration(st) && T.isStringLiteral(st.moduleSpecifier)) {
        const liens = new Map<string, string>();
        const c = st.importClause;
        const spec = st.moduleSpecifier.text;
        if (c?.name) liens.set(c.name.text, `${spec}#default${c.isTypeOnly ? ':type' : ''}`);
        if (c?.namedBindings && T.isNamedImports(c.namedBindings)) for (const el of c.namedBindings.elements) liens.set(el.name.text, `${spec}#${(el.propertyName ?? el.name).text}${c.isTypeOnly || el.isTypeOnly ? ':type' : ''}`);
        if (c?.namedBindings && T.isNamespaceImport(c.namedBindings)) liens.set(c.namedBindings.name.text, `${spec}#*`);
        // Un import retiré emporte sa ligne : les sauts de ligne entre imports
        // ne font pas partie du « reste ».
        let debut = st.getStart(), fin = st.getEnd();
        while (debut > 0 && /[ \t]/.test(s.text[debut - 1])) debut--;
        while (fin < s.text.length && /[ \t]/.test(s.text[fin])) fin++;
        if (s.text[fin] === '\n' && (debut === 0 || s.text[debut - 1] === '\n')) fin++;
        decls.push({ cle: spec, liens, debut, fin });
      }
      if (T.isVariableStatement(st)) for (const d of st.declarationList.declarations)
        if (d.name.getText() === 'VERIFICATIONS' && d.initializer && T.isArrayLiteralExpression(d.initializer)) tableau = d.initializer;
    }
    if (!tableau) return null;
    const trous = [...decls.map((d) => [d.debut, d.fin]), [tableau.getStart(), tableau.getEnd()]].sort((x, y) => x[0] - y[0]);
    let reste = '';
    let pos = 0;
    for (const [d, f] of trous) { reste += s.text.slice(pos, d); pos = f; }
    reste += s.text.slice(pos);
    const elements = tableau.elements.map((e) => {
      const texte = e.getText().replace(/\s+/g, ' ');
      let id: string | null = null;
      if (T.isSpreadElement(e) && T.isIdentifier(e.expression)) id = e.expression.text;
      else if (T.isArrayLiteralExpression(e) && e.elements[1]) {
        const f = e.elements[1];
        if (T.isIdentifier(f)) id = f.text;
        else { const m = f.getText().match(/await\s+(\w+)\(\)/); id = m ? m[1] : null; }
      }
      return { texte, id };
    });
    return { decls, reste, elements };
  };
  const A = lire(avant), B = lire(apres);
  if (!A || !B) return complet('tests/index.ts : registre VERIFICATIONS introuvable');
  if (A.reste !== B.reste) return complet('tests/index.ts modifié hors du registre et des imports');
  if (A.decls.some((d) => d.liens.size === 0) || B.decls.some((d) => d.liens.size === 0)) {
    const effets = (x: typeof A) => x.decls.filter((d) => d.liens.size === 0).map((d) => d.cle).join('|');
    if (effets(A) !== effets(B)) return complet('tests/index.ts : import à effet de bord ajouté, retiré ou déplacé');
  }
  // Identifiants dont la provenance change (import ajouté, retiré, modifié ou déplacé).
  const changes = new Set<string>();
  const lienA = new Map<string, string>(), lienB = new Map<string, string>();
  for (const d of A.decls) for (const [k, v] of d.liens) lienA.set(k, v);
  for (const d of B.decls) for (const [k, v] of d.liens) lienB.set(k, v);
  for (const k of new Set([...lienA.keys(), ...lienB.keys()])) if (lienA.get(k) !== lienB.get(k)) changes.add(k);
  const gardesDecl = communs(A.decls.map((d) => d.cle), B.decls.map((d) => d.cle));
  B.decls.forEach((d, j) => { if (!gardesDecl.has(j)) for (const k of d.liens.keys()) changes.add(k); });
  // Un identifiant changé et employé hors du registre (dans `main`…) : tout.
  const motsReste = new Set(B.reste.match(/[A-Za-z_$][\w$]*/g) ?? []);
  for (const k of changes) if (motsReste.has(k)) return complet(`tests/index.ts : import ${k} employé hors du registre`);
  const retenus = new Map<number, string[]>();
  const noter = (j: number, r: string) => { const l = retenus.get(j) ?? []; l.push(r); retenus.set(j, l); };
  const textesA = A.elements.map((e) => e.texte);
  const gardesElt = communs(textesA, B.elements.map((e) => e.texte));
  const restantsA = new Map<string, number>();
  for (const t of textesA) restantsA.set(t, (restantsA.get(t) ?? 0) + 1);
  B.elements.forEach((e, j) => { if (gardesElt.has(j)) restantsA.set(e.texte, (restantsA.get(e.texte) ?? 0) - 1); });
  B.elements.forEach((e, j) => {
    if (!gardesElt.has(j)) {
      const n = restantsA.get(e.texte) ?? 0;
      if (n > 0) { restantsA.set(e.texte, n - 1); noter(j, 'tests/index.ts : entrée déplacée dans le registre'); } else noter(j, 'tests/index.ts : entrée ajoutée ou modifiée dans le registre');
    }
    if (e.id && changes.has(e.id)) noter(j, `tests/index.ts : import de ${e.id} modifié`);
  });
  const deplaces = [...retenus.values()].filter((r) => r.some((x) => x.includes('déplacée'))).length;
  const retires = A.elements.length - gardesElt.size - deplaces;
  const detail = `registre et imports : ${retenus.size} entrée(s) concernée(s)` + (retires > 0 ? `, ${retires} retirée(s)` : '');
  return { complet: null, retenus, detail };
}

/* --------------------------------------------------------------------------
 * Sélection
 * ----------------------------------------------------------------------- */

// `feuilleInchangee` : la décision Tailwind a montré que la feuille produite ne
// change pas ; le motif Tailwind ne retient alors rien (les autres liens restent).
function liensSpecifiques(ft: string, info: InfoFichierTest, f: string, feuilleInchangee = false): string[] {
  const r: string[] = [];
  if (f === ft) r.push(`fichier de test modifié : ${f}`);
  else if (info.graphe.has(f)) r.push(`module de son graphe : ${f}`);
  for (const ra of info.racines) if (ra.fichiers.includes(f)) r.push(`module de la racine secondaire ${ra.racine} : ${f}`);
  const cites = info.fichiers.get(f);
  if (cites) r.push(`cible lue (${cites[0]}) : ${f}`);
  for (const [d, sites] of info.dossiers) if (f === d || f.startsWith(d + '/')) { r.push(`dossier ${d} lu (${sites.slice(0, 3).join(' | ')}) : ${f}`); break; }
  for (const m of info.motifs) {
    if (!m.re.test(f) || (m.tailwind && feuilleInchangee)) continue;
    r.push(m.tailwind ? `motif Tailwind ${m.motif} (${m.site}), feuille changée : ${f}` : `motif ${m.motif} (${m.site}) : ${f}`);
    break;
  }
  return r;
}

// Sans décision Tailwind (appel direct), le motif retient : lecture prudente.
export function selectionner(inv: Inventaire, modifies: string[], indexAvant: string | null, base: string, causesInitiales: string[] = [], tailwind: DecisionTailwind | null = null): Selection {
  const feuilleInchangee = !!tailwind && tailwind.etat !== 'feuille changée';
  const sousMotifTailwind = (f: string) => [...inv.fichiersTest.values()].some((i) => i.motifs.some((m) => m.tailwind && m.re.test(f)));
  const debut = Date.now();
  const causes = [...causesInitiales, ...inv.incoherences.map((i) => 'incohérence de l\'inventaire : ' + i)];
  const fichiers: FichierModifie[] = [];
  const parFichierTest = new Map<string, string[]>();
  const parEntree = new Map<number, string[]>();
  const noter = <K,>(m: Map<K, string[]>, k: K, r: string) => { const l = m.get(k) ?? []; if (!l.includes(r)) l.push(r); m.set(k, l); };
  for (const f of [...new Set(modifies.map(norm))].sort()) {
    if (estInfrastructure(f)) { fichiers.push({ chemin: f, statut: 'infrastructure', detail: 'infrastructure des tests' }); causes.push(`${f} : infrastructure des tests`); continue; }
    if (f === 'tests/index.ts') {
      const d = comparerIndex(indexAvant, inv.sourceIndex);
      if (d.complet) { fichiers.push({ chemin: f, statut: 'infrastructure', detail: d.complet }); causes.push(d.complet); continue; }
      fichiers.push({ chemin: f, statut: 'couvert', detail: d.detail });
      for (const [j, rs] of d.retenus) for (const r of rs) noter(parEntree, j, r);
      continue;
    }
    let specifiques = 0;
    for (const [ft, info] of inv.fichiersTest) {
      const liens = liensSpecifiques(ft, info, f, feuilleInchangee);
      if (liens.length) { specifiques++; for (const l of liens) noter(parFichierTest, ft, l); }
      if (info.depot.length) noter(parFichierTest, ft, `depot (${info.depot[0]}) : ${f}`);
      // Une lecture opaque peut viser n'importe quel fichier, docs/ et la racine compris.
      else if (info.opaque.length) noter(parFichierTest, ft, `opaque (${info.opaque[0]}) : ${f}`);
    }
    const noteTailwind = feuilleInchangee && sousMotifTailwind(f) ? ` ; motif Tailwind : ${tailwind!.etat}` : '';
    if (specifiques > 0) { fichiers.push({ chemin: f, statut: 'couvert', detail: `${specifiques} fichier(s) de test par un lien spécifique${noteTailwind}` }); continue; }
    // Le motif Tailwind a été examiné : la feuille ne change pas, c'était sa seule
    // dépendance. Le fichier est classé, rien n'est retenu par lui.
    if (noteTailwind) { fichiers.push({ chemin: f, statut: 'couvert', detail: `aucun lien hors du motif Tailwind${noteTailwind}` }); continue; }
    const se = SANS_EFFET_RE.find((s) => s.re.test(f) && !s.sauf?.includes(f));
    if (se) { fichiers.push({ chemin: f, statut: 'sans effet', detail: `${se.motif} : ${se.justification}` }); continue; }
    if (sousRacines(f)) { fichiers.push({ chemin: f, statut: 'non couvert', detail: 'aucun lien spécifique' }); causes.push(`${f} : non couvert (aucun lien spécifique ; une retenue depot ou opaque ne couvre pas)`); continue; }
    fichiers.push({ chemin: f, statut: 'non couvert', detail: 'hors des racines des sources, absent de la liste des fichiers sans effet' });
    causes.push(`${f} : hors des racines des sources, absent de la liste des fichiers sans effet`);
  }
  const complet = causes.length > 0;
  // Entrées retenues.
  for (const e of inv.entrees) {
    if (!e.fichierTest) { noter(parEntree, e.index, 'non rattachable : toujours retenue'); continue; }
    for (const r of parFichierTest.get(e.fichierTest) ?? []) noter(parEntree, e.index, r);
  }
  // Fermeture sur les prérequis d'ordre.
  const parNom = new Map(inv.entrees.filter((e) => e.nom).map((e) => [e.nom!, e]));
  const pile = [...parEntree.keys()];
  while (pile.length) {
    const e = inv.entrees[pile.pop()!];
    for (const p of (e?.nom && PREREQUIS[e.nom]) || []) {
      const ep = parNom.get(p);
      if (!ep) continue;
      if (!parEntree.has(ep.index)) pile.push(ep.index);
      noter(parEntree, ep.index, `prérequis d'ordre de ${e.nom}`);
    }
  }
  // Groupes d'étalements : les noms qu'un étalement produit ne se lisent qu'à
  // l'exécution ; le point d'entrée les retrouve entre les entrées nommées qui
  // bornent le groupe d'étalements contigus, lancé en entier.
  const noms: string[] = [];
  const groupes: Selection['execution']['groupes'] = [];
  for (const g of groupesEtalements(inv.entrees)) {
    const pris = g.indices.filter((i) => parEntree.has(i));
    if (!pris.length) continue;
    for (const i of g.indices) if (!parEntree.has(i)) noter(parEntree, i, `même groupe d'étalements que ${inv.entrees[pris[0]].identifiant}`);
    groupes.push({ avant: g.avant, apres: g.apres, etalements: g.indices.map((i) => inv.entrees[i].identifiant ?? `#${i}`) });
  }
  const indices = complet ? inv.entrees.map((e) => e.index) : [...parEntree.keys()].sort((a, b) => a - b);
  const retenues: Retenue[] = indices.map((i) => {
    const e = inv.entrees[i];
    if (e.genre !== 'etalement' && e.nom) noms.push(e.nom);
    return { index: i, nom: e.nom, identifiant: e.identifiant, genre: e.genre, raisons: complet ? ['suite complète'] : parEntree.get(i) ?? [] };
  });
  const transversalesSeulement = !complet && fichiers.length > 0 && fichiers.every((f) => f.statut === 'sans effet');
  return {
    base, fichiers, complet, causes, avertissements: [...(inv.avertissements ?? [])], retenues, transversalesSeulement, tailwind,
    execution: complet ? { complet: true, noms: [], groupes: [] } : { complet: false, noms, groupes },
    dureeMs: Date.now() - debut,
  };
}

export function groupesEtalements(entrees: Entree[]): { indices: number[]; avant: string | null; apres: string | null }[] {
  const out: { indices: number[]; avant: string | null; apres: string | null }[] = [];
  for (let i = 0; i < entrees.length; i++) {
    if (entrees[i].genre !== 'etalement') continue;
    let k = i;
    while (k + 1 < entrees.length && entrees[k + 1].genre === 'etalement') k++;
    out.push({ indices: Array.from({ length: k - i + 1 }, (_, x) => i + x), avant: i > 0 ? entrees[i - 1].nom : null, apres: k + 1 < entrees.length ? entrees[k + 1].nom : null });
    i = k;
  }
  return out;
}

/* --------------------------------------------------------------------------
 * Motif Tailwind : la feuille produite peut-elle changer ?
 * ----------------------------------------------------------------------- */

// Modifier l'un d'eux peut changer la feuille quel que soit le contenu :
// le motif Tailwind retient (package.json reste en plus de l'infrastructure).
const CONFIGURATION_FEUILLE = (f: string) =>
  /^tailwind\.config\.[cm]?[jt]s$/.test(f) || f === 'src/index.css' || /^postcss\.config\.[^/]+$/.test(f) || f === 'package.json' || f === 'package-lock.json';

// Contenu d'un fichier à une révision : null s'il n'y existe pas ; une autre
// erreur de Git est levée (la décision tombe alors sur « feuille changée »).
export function lireBlob(racine: string, commit: string, chemin: string): string | null {
  try { return git(racine, ['show', `${commit}:${chemin}`]); } catch (e) {
    if (git(racine, ['ls-tree', '--name-only', commit, '--', chemin]).trim() === '') return null;
    throw e;
  }
}

// Tailwind et PostCSS du dépôt lu, résolus depuis sa racine : jamais ceux d'un
// autre arbre.
function outilsTailwind(racine: string) {
  const exiger = createRequire(join(racine, 'package.json'));
  return {
    tailwindcss: exiger('tailwindcss') as (config: unknown) => unknown,
    postcss: exiger('postcss') as (plugins: unknown[]) => { process: (css: string, o: { from: string }) => Promise<{ css: string }> },
    resoudreConfig: exiger('tailwindcss/resolveConfig') as (config: unknown) => any,
    // Le chargeur de configuration de Tailwind, celui qu'emploie `tailwind({ config })`.
    chargerConfig: exiger('tailwindcss/loadConfig') as (chemin: string) => any,
    extracteurParDefaut: (exiger('tailwindcss/lib/lib/defaultExtractor') as { defaultExtractor: (contexte: unknown) => (ligne: string) => string[] }).defaultExtractor,
  };
}

// Candidats de classes d'un contenu, comme Tailwind les relève
// (`expandTailwindAtRules` : extracteur et transformateur de l'extension, ligne
// par ligne, `!*` écarté).
function candidats(config: any, extracteurDefaut: (ligne: string) => string[], chemin: string, contenu: string | null): Set<string> {
  const sortie = new Set<string>();
  if (contenu === null) return sortie;
  const ext = posix.extname(chemin).slice(1);
  const extraire = config.content?.extract?.[ext] ?? config.content?.extract?.DEFAULT ?? extracteurDefaut;
  const transformer = config.content?.transform?.[ext] ?? config.content?.transform?.DEFAULT ?? ((x: string) => x);
  for (const ligne of String(transformer(contenu)).split('\n')) for (const c of extraire(ligne.trim())) if (c !== '!*') sortie.add(c);
  return sortie;
}

export async function decisionTailwind(inv: Inventaire, modifies: string[], lireAvant: (chemin: string) => string | null,
  lireApres: (chemin: string) => string | null = (c) => (existsSync(join(inv.racine, c)) ? readFileSync(join(inv.racine, c), 'utf8') : null)): Promise<DecisionTailwind | null> {
  if (!inv.tailwind) return null;
  const motifs = inv.tailwind.motifs.map((m) => globVersRegex(posix.normalize(m)));
  const tous = [...new Set(modifies.map(norm))];
  const sous = tous.filter((f) => motifs.some((re) => re.test(f))).sort();
  const changee = (detail: string): DecisionTailwind => ({ etat: 'feuille changée', detail, fichiers: sous });
  const configuration = tous.filter((f) => CONFIGURATION_FEUILLE(f) || f === inv.tailwind!.fichier);
  if (configuration.length) return changee(`configuration de la feuille modifiée : ${configuration.join(', ')}`);
  if (!sous.length) return null;
  try {
    const outils = outilsTailwind(inv.racine);
    const module: any = outils.chargerConfig(join(inv.racine, inv.tailwind.fichier));
    const brute = module.default ?? module;
    const config = outils.resoudreConfig(brute);
    const extracteur = outils.extracteurParDefaut({ tailwindConfig: config });
    const avant = new Map(sous.map((f) => [f, lireAvant(f)]));
    const apres = new Map(sous.map((f) => [f, lireApres(f)]));
    const egaux = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));
    const differents = sous.filter((f) => !egaux(candidats(config, extracteur, f, avant.get(f)!), candidats(config, extracteur, f, apres.get(f)!)));
    if (differents.length === 0) return { etat: 'feuille inchangée (candidats)', detail: `${sous.length} fichier(s) sous le motif, mêmes candidats de classes`, fichiers: sous };
    // Étape 2 : la feuille, produite de chaque côté, sur le contenu brut de
    // chaque fichier du motif. La configuration et src/index.css sont
    // inchangées (sinon « feuille changée » plus haut) : les mêmes des deux côtés.
    const arbre = [...listerFichiers(inv.racine)].filter((f) => motifs.some((re) => re.test(f)));
    const cote = (lire: Map<string, string | null>) => {
      const entrees: { raw: string; extension: string }[] = [];
      for (const f of new Set([...arbre, ...sous])) {
        const contenu = lire.has(f) ? lire.get(f)! : readFileSync(join(inv.racine, f), 'utf8');
        if (contenu !== null) entrees.push({ raw: contenu, extension: posix.extname(f).slice(1) });
      }
      return entrees;
    };
    const css = readFileSync(join(inv.racine, 'src/index.css'), 'utf8');
    const produire = async (entrees: { raw: string; extension: string }[]) =>
      (await outils.postcss([outils.tailwindcss({ ...brute, content: entrees })]).process(css, { from: join(inv.racine, 'src/index.css') })).css;
    const [feuilleAvant, feuilleApres] = [await produire(cote(avant)), await produire(cote(apres))];
    const liste = differents.slice(0, 3).join(', ') + (differents.length > 3 ? '…' : '');
    if (feuilleAvant === feuilleApres) return { etat: 'feuille inchangée (produite)', detail: `candidats changés (${liste}), feuille produite identique`, fichiers: sous };
    return changee(`feuille produite différente (candidats changés : ${liste})`);
  } catch (e) {
    return changee(`production impossible : ${String((e as Error).message).split('\n')[0].slice(0, 200)}`);
  }
}

/* --------------------------------------------------------------------------
 * Lecture de Git
 * ----------------------------------------------------------------------- */

export function lireNameStatus(sortie: string): string[] {
  const morceaux = sortie.split('\0');
  const chemins: string[] = [];
  for (let i = 0; i < morceaux.length;) {
    const st = morceaux[i++];
    if (!st) continue;
    if (/^[RC]/.test(st)) { chemins.push(morceaux[i++], morceaux[i++]); } else chemins.push(morceaux[i++]);
  }
  return chemins.filter(Boolean);
}

export class RefusSelection extends Error {}

export interface OptionsSelection { racine: string; depuis?: string; plage?: string; metafichier?: Metafile }

export async function selectionDepuisGit(o: OptionsSelection): Promise<{ selection: Selection; inventaire: Inventaire }> {
  const debut = Date.now();
  if (!!o.depuis === !!o.plage) throw new RefusSelection('une et une seule option parmi --depuis <ref> et --plage <a>..<b>');
  let racine = norm(resoudreChemin(o.racine));
  const causes: string[] = [];
  let modifies: string[] = [];
  let indexAvant: string | null = null;
  let commitAvant: string | null = null;
  let base = '';
  try {
    racine = norm(git(racine, ['rev-parse', '--show-toplevel']).trim());
    if (o.plage) {
      const m = o.plage.match(/^(.+?)\.\.(.+)$/);
      if (!m || m[1].includes('..') || m[2].startsWith('.')) throw new RefusSelection(`--plage attend <a>..<b> : ${o.plage}`);
      const [a, b] = [git(racine, ['rev-parse', '--verify', m[1] + '^{commit}']).trim(), git(racine, ['rev-parse', '--verify', m[2] + '^{commit}']).trim()];
      // Le graphe se calcule sur l'arbre lu : il doit être celui de b.
      const arbreB = git(racine, ['rev-parse', b + '^{tree}']).trim();
      const arbreLu = git(racine, ['rev-parse', 'HEAD^{tree}']).trim();
      const sale = git(racine, ['status', '--porcelain', '--untracked-files=normal']).trim();
      if (arbreB !== arbreLu || sale) throw new RefusSelection(`--plage ${o.plage} : l'arbre lu (${racine}) n'est pas celui de ${m[2]}${sale ? ' (arbre de travail modifié)' : ''} — lancer depuis un worktree de ${m[2]}, ou --racine vers lui`);
      base = `${m[1]} (${a.slice(0, 8)})..${m[2]} (${b.slice(0, 8)})`;
      modifies = lireNameStatus(git(racine, ['diff', '-z', '--name-status', '-M', a, b]));
      try { indexAvant = git(racine, ['show', `${a}:tests/index.ts`]); } catch { indexAvant = null; }
      commitAvant = a;
    } else {
      const mb = git(racine, ['merge-base', o.depuis!, 'HEAD']).trim();
      base = `base de fusion de ${o.depuis} et HEAD (${mb.slice(0, 8)}), index, arbre de travail et non suivis`;
      modifies = [
        ...lireNameStatus(git(racine, ['diff', '-z', '--name-status', '-M', mb])),
        ...lireNameStatus(git(racine, ['diff', '-z', '--name-status', '-M', '--cached', mb])),
        ...git(racine, ['ls-files', '-z', '--others', '--exclude-standard']).split('\0').filter(Boolean),
      ];
      try { indexAvant = git(racine, ['show', `${mb}:tests/index.ts`]); } catch { indexAvant = null; }
      commitAvant = mb;
    }
  } catch (e) {
    if (e instanceof RefusSelection) throw e;
    causes.push(`la lecture de Git a échoué : ${String((e as Error).message).split('\n')[0]}`);
  }
  const inv = await inventaire(racine, o.metafichier);
  const tw = commitAvant && !causes.length ? await decisionTailwind(inv, modifies, (p) => lireBlob(racine, commitAvant!, p)) : null;
  const selection = selectionner(inv, modifies, indexAvant, base, causes, tw);
  selection.dureeMs = Date.now() - debut;
  return { selection, inventaire: inv };
}

/* --------------------------------------------------------------------------
 * Sortie
 * ----------------------------------------------------------------------- */

export function formater(sel: Selection, total: number): string {
  const l: string[] = [];
  l.push(`Sélection par fichiers modifiés — base : ${sel.base}`);
  l.push(`Fichiers modifiés (${sel.fichiers.length}) :`);
  for (const f of sel.fichiers) l.push(`  [${f.statut}] ${f.chemin} — ${f.detail}`);
  if (sel.tailwind) l.push(`Motif Tailwind : ${sel.tailwind.etat} — ${sel.tailwind.detail}`);
  if (sel.avertissements.length) {
    l.push(`Avertissements (${sel.avertissements.length}) — module démarré non suivi par ce site, sélection inchangée :`);
    for (const a of sel.avertissements) l.push(`  ! ${a}`);
  }
  if (sel.complet) {
    l.push(`SUITE COMPLÈTE (${total} entrées du registre), parce que :`);
    for (const c of sel.causes) l.push(`  - ${c}`);
    return l.join('\n');
  }
  if (sel.transversalesSeulement) l.push('Tous les fichiers sont sans effet : la sélection ne contient que les vérifications `depot` et `opaque`, retenues pour tout fichier modifié.');
  if (sel.fichiers.length === 0) l.push('Aucun fichier modifié : sélection vide.');
  l.push(`Entrées retenues (${sel.retenues.length}/${total}) :`);
  for (const r of sel.retenues) l.push(`  ${r.nom ?? '...' + r.identifiant} — ${r.raisons.join(' ; ')}`);
  return l.join('\n');
}

/* --------------------------------------------------------------------------
 * Ligne de commande
 * ----------------------------------------------------------------------- */

function lireOption(args: string[], nom: string): string | undefined {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
}

async function ligneDeCommande(): Promise<void> {
  const args = process.argv.slice(2);
  const racine = lireOption(args, '--racine') ?? process.cwd();
  const json = lireOption(args, '--json');
  try {
    const { selection, inventaire: inv } = await selectionDepuisGit({ racine, depuis: lireOption(args, '--depuis'), plage: lireOption(args, '--plage') });
    console.log(formater(selection, inv.entrees.length));
    console.log(`(inventaire ${inv.dureeMs} ms, sélection ${selection.dureeMs} ms au total)`);
    if (json) writeFileSync(json, JSON.stringify(selection, null, 1));
  } catch (e) {
    if (e instanceof RefusSelection) { console.error('Refus : ' + e.message); process.exit(2); }
    throw e;
  }
}

if (process.argv[1] && norm(resoudreChemin(process.argv[1])) === norm(fileURLToPath(import.meta.url))) {
  ligneDeCommande().catch((e) => { console.error(e); process.exit(1); });
}
