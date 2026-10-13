// Garde des RÉFÉRENCES TEXTUELLES à `src/` dans les tests — pas seulement des
// lectures : toute chaîne qui désigne un chemin sous `src/` compte, qu'elle
// serve à `readFileSync`, à un `join`, à un `new URL` ou à rien d'autre.
//
// Pourquoi : un test qui lit un fichier de `src/` comme du texte n'importe pas
// ce module ; la sélection par fichiers modifiés (tests/selection.ts) ne le
// voit que par la lecture elle-même. Chaque nouvel usage doit donc être
// déclaré, et se retire dans le commit qui retire la lecture.
//
// Comment : l'API du compilateur TypeScript relève, dans chaque fichier de
// `tests/` (suivi, ou non suivi et non ignoré), les chaînes littérales, les
// gabarits et les assemblages de littéraux (`join`, `resolve`, `dirname`,
// `fileURLToPath`, `new URL(…, import.meta.url)`, `[…].join('/')`, `+`)
// dont la valeur reconstituée est `src` ou `src/…`. Résolution : relative à
// la racine du dépôt ; une valeur qui commence par `./` ou `../` se résout
// depuis le dossier du fichier analysé ; `import.meta.url` vaut le fichier
// analysé lui-même (le lanceur le remplace à la construction, voir
// tests/run.mjs : le cas « import.meta.url » ci-dessous le prouve sur la
// valeur reconstituée, pas sur l'exécution). Une partie inconnue (paramètre,
// variable non constante) vaut `*`.
//
// Identité d'un usage : (fichier, cible normalisée), avec sa multiplicité.
// La liste (tests/fixtures/lecture-source-toleree.json) porte une entrée par
// identité, statut `stock` (figé sur 54f8c6d6) ou `exception` (justification
// obligatoire). Un usage absent de la liste, un nombre d'occurrences trop
// petit OU trop grand, une entrée qui ne correspond plus : échec.
//
// ANGLES MORTS, assumés :
// - une chaîne à espace ou à saut de ligne n'est pas un chemin (une commande
//   `git add src/x.ts` n'est pas comptée) ;
// - une valeur dont le début est inconnu (`racine + '/src/x'` avec `racine`
//   importée ou passée en paramètre) vaut `*/src/x` et n'est PAS comptée ;
// - le seul `.replace(…)` suivi est le correctif de lettre de lecteur Windows
//   (regex contenant `[A-Za-z]:`) ; tout autre `.replace`/`.slice` rend la
//   valeur inconnue ;
// - une constante `let`, une propriété d'objet, un résultat d'appel de
//   fonction du dépôt ne sont pas suivis ;
// - un usage se compte une fois à sa construction, pas à chaque emploi de la
//   constante qui le porte ;
// - elle ne dit pas si la cible existe, ni ce que le test en fait ;
// - les fichiers hors `tests/` (scripts/, docs/) ne sont pas lus ;
// - seuls les fichiers de code sont analysés (.ts .tsx .mts .cts .js .mjs .cjs).

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, posix } from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';
import { egal, ok, titre } from './outils';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const LISTE = 'tests/fixtures/lecture-source-toleree.json';
const EXTENSIONS = /\.(?:[cm]?[jt]s|tsx)$/;

/* --------------------------------------------------------------------------
 * Relevé : fichier + texte → cibles
 * ----------------------------------------------------------------------- */

const FONCTIONS_CHEMIN = new Set(['join', 'resolve', 'normalize']);
const CHEMIN_SRC = /^src(\/\S*)?$/;

function scriptKind(fichier: string): ts.ScriptKind {
  if (fichier.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (/\.[cm]?js$/.test(fichier)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function nomAppele(appel: ts.CallExpression): string | undefined {
  const c = appel.expression;
  if (ts.isIdentifier(c)) return c.text;
  if (ts.isPropertyAccessExpression(c)) return c.name.text;
  return undefined;
}

/** `join`/`resolve`/`normalize` nus ou portés par `path`/`posix`/`win32`, pas `liste.join('/')`. */
function estAppelChemin(appel: ts.CallExpression): boolean {
  const c = appel.expression;
  if (ts.isIdentifier(c)) return true;
  return ts.isPropertyAccessExpression(c) && ts.isIdentifier(c.expression) && ['path', 'posix', 'win32'].includes(c.expression.text);
}

function appelTableauJoin(appel: ts.CallExpression): boolean {
  return ts.isPropertyAccessExpression(appel.expression) && appel.expression.name.text === 'join'
    && ts.isArrayLiteralExpression(appel.expression.expression);
}

function estImportDynamique(n: ts.Node): boolean {
  return ts.isCallExpression(n)
    && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'));
}

/** Cibles `src` d'un fichier, une par usage (doublons conservés), dans l'ordre. */
export function releverCibles(fichier: string, texte: string): string[] {
  const source = ts.createSourceFile(fichier, texte, ts.ScriptTarget.Latest, true, scriptKind(fichier));
  const dossier = posix.dirname(fichier);

  // Constantes `const x = …` du fichier, tous niveaux confondus (premier nom gagne).
  const constantes = new Map<string, ts.Expression>();
  const reperer = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer
      && ts.isVariableDeclarationList(n.parent) && (n.parent.flags & ts.NodeFlags.Const) && !constantes.has(n.name.text)) {
      constantes.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, reperer);
  };
  reperer(source);

  const enCours = new Set<string>();
  const unir = (parties: (string | undefined)[]) => posix.normalize(parties.map((p) => p ?? '*').join('/'));

  /** Valeur reconstituée, ou `undefined` si l'expression n'est pas évaluable. */
  const evaluer = (n: ts.Expression): string | undefined => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text.replace(/\\/g, '/');
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n) || ts.isSatisfiesExpression(n)) return evaluer(n.expression);
    if (ts.isTemplateExpression(n)) {
      return n.head.text + n.templateSpans.map((s) => (evaluer(s.expression) ?? '*') + s.literal.text).join('');
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const g = evaluer(n.left);
      const d = evaluer(n.right);
      return g === undefined && d === undefined ? undefined : (g ?? '*') + (d ?? '*');
    }
    if (ts.isIdentifier(n)) {
      if (n.text === '__dirname') return dossier;
      const init = constantes.get(n.text);
      if (!init || enCours.has(n.text)) return undefined;
      enCours.add(n.text);
      try { return evaluer(init); } finally { enCours.delete(n.text); }
    }
    if (ts.isPropertyAccessExpression(n)) {
      if (ts.isMetaProperty(n.expression) && n.name.text === 'url') return fichier;
      if (n.name.text === 'pathname' || n.name.text === 'href') return evaluer(n.expression);
      return undefined;
    }
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'URL' && n.arguments?.length === 2) {
      const relatif = evaluer(n.arguments[0]);
      const base = evaluer(n.arguments[1]);
      if (relatif === undefined) return undefined;
      return base === undefined ? '*' : unir([posix.dirname(base), relatif]);
    }
    if (ts.isCallExpression(n)) {
      const nom = nomAppele(n);
      if (appelTableauJoin(n)) return evaluerTableau(n);
      if (nom && FONCTIONS_CHEMIN.has(nom) && estAppelChemin(n)) return unir(n.arguments.map((a) => evaluer(a)));
      if (nom === 'dirname' && n.arguments.length === 1) {
        const v = evaluer(n.arguments[0]);
        return v === undefined ? undefined : posix.dirname(v);
      }
      if (nom === 'fileURLToPath' && n.arguments.length === 1) return evaluer(n.arguments[0]);
      // Correctif de lettre de lecteur Windows (`.replace(/^\/([A-Za-z]:)/, '$1')`) : le chemin reste le même.
      if (nom === 'replace' && ts.isPropertyAccessExpression(n.expression) && n.arguments.length === 2
        && ts.isRegularExpressionLiteral(n.arguments[0]) && n.arguments[0].text.includes('[A-Za-z]:')) {
        return evaluer(n.expression.expression);
      }
      if (nom === 'cwd' && n.arguments.length === 0) return '.';
    }
    return undefined;
  };

  // `[…].join('/')` : assemblage de littéraux par un tableau.
  const evaluerTableau = (n: ts.CallExpression): string | undefined => {
    if (!ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== 'join') return undefined;
    const tableau = n.expression.expression;
    if (!ts.isArrayLiteralExpression(tableau)) return undefined;
    const sep = n.arguments.length === 1 ? evaluer(n.arguments[0]) : ',';
    if (sep === undefined) return undefined;
    return tableau.elements.map((e) => evaluer(e) ?? '*').join(sep);
  };

  const cibles: string[] = [];
  const enregistrer = (valeur: string): void => {
    let v = valeur;
    if (v.startsWith('./') || v.startsWith('../')) v = posix.join(dossier, v);
    v = posix.normalize(v);
    if (CHEMIN_SRC.test(v)) cibles.push(v);
  };

  const visiter = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isImportEqualsDeclaration(n) || ts.isImportTypeNode(n) || estImportDynamique(n)) return;
    if (ts.isExportDeclaration(n)) return;
    if (ts.isExpression(n)) {
      let valeur: string | undefined;
      let chemin = false;
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
        valeur = evaluer(n);
        chemin = true;
      } else if (ts.isCallExpression(n)) {
        const nom = nomAppele(n);
        if (appelTableauJoin(n) || (nom && FONCTIONS_CHEMIN.has(nom) && estAppelChemin(n))) { valeur = evaluer(n); chemin = true; }
      } else if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'URL') {
        valeur = evaluer(n);
        chemin = valeur !== undefined;
      } else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        valeur = evaluer(n);
        chemin = valeur !== undefined;
      }
      if (chemin) {
        if (valeur !== undefined) enregistrer(valeur);
        return; // maximal : les littéraux internes ne se recomptent pas
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(source);
  return cibles;
}

/** Cibles regroupées : « fichier\0cible » → occurrences. */
const cle = (fichier: string, cible: string) => `${fichier}\u0000${cible}`;

export type Usage = { fichier: string; cible: string; occurrences: number };

export function regrouper(parFichier: Map<string, string[]>): Usage[] {
  const t = new Map<string, Usage>();
  for (const [fichier, cibles] of parFichier) {
    for (const cible of cibles) {
      const k = cle(fichier, cible);
      const u = t.get(k) ?? { fichier, cible, occurrences: 0 };
      u.occurrences++;
      t.set(k, u);
    }
  }
  return [...t.values()].sort((a, b) => (a.fichier + a.cible).localeCompare(b.fichier + b.cible));
}

/* --------------------------------------------------------------------------
 * Corpus : fichiers de code de tests/, suivis ou non suivis non ignorés
 * ----------------------------------------------------------------------- */

export function corpus(racine: string): string[] {
  const sortie = (args: string[]) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split('\u0000').filter(Boolean);
  const suivis = sortie(['ls-files', '-z', '--', 'tests']);
  const nonSuivis = sortie(['ls-files', '-z', '--others', '--exclude-standard', '--', 'tests']);
  return [...new Set([...suivis, ...nonSuivis])]
    .filter((f) => EXTENSIONS.test(f) && existsSync(join(racine, f)))
    .sort();
}

export function releverDepot(racine: string): Usage[] {
  const parFichier = new Map<string, string[]>();
  for (const f of corpus(racine)) {
    const c = releverCibles(f, readFileSync(join(racine, f), 'utf8'));
    if (c.length) parFichier.set(f, c);
  }
  return regrouper(parFichier);
}

/* --------------------------------------------------------------------------
 * Comparaison à la liste
 * ----------------------------------------------------------------------- */

export type Entree = { fichier: string; cible: string; occurrences: number; statut: 'stock' | 'exception'; justification?: string };

export type Ecarts = { nonListes: string[]; perimees: string[]; invalides: string[] };

export function comparer(usages: Usage[], entrees: Entree[]): Ecarts {
  const liste = new Map(entrees.map((e) => [cle(e.fichier, e.cible), e]));
  const releve = new Map(usages.map((u) => [cle(u.fichier, u.cible), u]));
  const nonListes: string[] = [];
  const perimees: string[] = [];
  const invalides: string[] = [];
  for (const u of usages) {
    const e = liste.get(cle(u.fichier, u.cible));
    // Plus OU moins que la liste : échec (on décompte dans le commit qui retire l'usage).
    if (!e) nonListes.push(`${u.fichier} → ${u.cible} (${u.occurrences}, absent de la liste)`);
    else if (u.occurrences > e.occurrences) nonListes.push(`${u.fichier} → ${u.cible} (${u.occurrences}, liste : ${e.occurrences})`);
  }
  for (const e of entrees) {
    const u = releve.get(cle(e.fichier, e.cible));
    if (!u) perimees.push(`${e.fichier} → ${e.cible} (liste : ${e.occurrences}, relevé : 0)`);
    else if (u.occurrences < e.occurrences) perimees.push(`${e.fichier} → ${e.cible} (liste : ${e.occurrences}, relevé : ${u.occurrences})`);
    if (e.statut !== 'stock' && e.statut !== 'exception') invalides.push(`${e.fichier} → ${e.cible} : statut « ${String(e.statut)} »`);
    if (e.statut === 'exception' && !(e.justification ?? '').trim()) invalides.push(`${e.fichier} → ${e.cible} : exception sans justification`);
    if (!Number.isInteger(e.occurrences) || e.occurrences < 1) invalides.push(`${e.fichier} → ${e.cible} : occurrences invalides`);
  }
  const doublons = entrees.map((e) => cle(e.fichier, e.cible)).filter((k, i, t) => t.indexOf(k) !== i);
  for (const d of new Set(doublons)) invalides.push(`doublon : ${d.replace('\u0000', ' → ')}`);
  return { nonListes, perimees, invalides };
}

/* --------------------------------------------------------------------------
 * Vérifications
 * ----------------------------------------------------------------------- */

function formes(): void {
  titre('lecture-source — formes reconnues (relevé par le compilateur)');
  const f = 'tests/exemple.test.ts';
  const r = (texte: string, fichier = f) => releverCibles(fichier, texte);

  egal(r(`readFileSync('src/lib/a.ts', 'utf8');`), ['src/lib/a.ts'], 'chaîne littérale');
  egal(r('const t = `src/lib/a.ts`;'), ['src/lib/a.ts'], 'gabarit sans interpolation');
  egal(r('const t = `src/lib/${nom}.ts`;'), ['src/lib/*.ts'], 'gabarit interpolé : partie inconnue = *');
  egal(r(`const t = 'src/lib/' + nom;`), ['src/lib/*'], 'concaténation : partie inconnue = *');
  egal(r(`join('src', 'lib', 'a.ts');`), ['src/lib/a.ts'], 'join de littéraux (compté une fois, pas par littéral)');
  egal(r(`resolve('src', 'lib', 'a.ts');`), ['src/lib/a.ts'], 'resolve de littéraux');
  egal(r(`posix.join('src', 'lib');`), ['src/lib'], 'join qualifié (posix.join)');
  egal(r(`const R = join(dirname(fileURLToPath(import.meta.url)), '..'); readFileSync(join(R, 'src', 'a.ts'));`),
    ['src/a.ts'], 'racine reconstituée depuis import.meta.url, constante suivie');
  egal(r(`new URL('../src/lib/a.ts', import.meta.url);`), ['src/lib/a.ts'], 'new URL(…, import.meta.url) depuis tests/');
  egal(r(`const racine = resolve(new URL('..', import.meta.url).pathname.replace(/^\\/([A-Za-z]:)/, '$1')); readFileSync(resolve(racine, 'src/lib/a.ts'));`),
    ['src/lib/a.ts'], 'racine par new URL(\'..\').pathname + correctif de lecteur Windows');
  egal(r(`new URL('../../src/lib/a.ts', import.meta.url);`, 'tests/rendu/x.ts'), ['src/lib/a.ts'], 'import.meta.url vaut le fichier analysé (sous-dossier)');
  egal(r(`new URL('../src/lib/a.ts', import.meta.url);`, 'tests/rendu/x.ts'), [], 'même URL depuis un sous-dossier : tests/src/…, pas src/');
  egal(r(`readFileSync(fileURLToPath(new URL('../src/a.ts', import.meta.url)));`), ['src/a.ts'], 'fileURLToPath(new URL(…))');
  egal(r(`const c = '../src/lib/a.ts';`), ['src/lib/a.ts'], 'littéral ../src résolu depuis le fichier');
  egal(r(`['src', 'lib', 'a.ts'].join('/');`), ['src/lib/a.ts'], 'assemblage par tableau.join');
  egal(r(`readdirSync('src');`), ['src'], 'dossier src seul');
  egal(r(`join(racine, 'src', 'a.ts');`), [], 'racine inconnue (paramètre) : non compté, angle mort déclaré');
  egal(r(`const a = 'tests/src/a.ts'; const b = 'srcs/a.ts'; const c = 'git add src/a.ts';`), [], 'préfixe voisin, dossier tests/src et chaîne à espace : non comptés');
  egal(r(`import x from '../src/lib/a';\nexport { y } from '../src/lib/b';\nimport('../src/lib/c');\nrequire('../src/lib/d');\ntype T = import('../src/lib/e').T;`),
    [], 'spécificateurs d’import (statique, réexport, dynamique, require, type) non comptés');
  egal(r(`// src/lib/a.ts\n/* '../src/lib/b.ts' */\nconst x = 1;`), [], 'commentaires non comptés');
  egal(r(`const a = 'src/a.ts'; const b = 'src/a.ts'; const c = 'src/b.ts';`), ['src/a.ts', 'src/a.ts', 'src/b.ts'], 'multiplicité conservée');
  egal(r(`const p = join(racine, 'src'); const q = 'src/z';`), ['src/z'], 'un join à début inconnu ne recompte pas son littéral interne');
  egal(r('const j = <a href="src/lib/a.ts" />;', 'tests/x.tsx'), ['src/lib/a.ts'], 'fichier .tsx analysé en TSX');
  egal(r(`const r = join(RACINE, 'src', 'a.ts');`, 'tests/y.ts'), [], 'constante importée non résolue : non comptée');
}

function comparaison(): void {
  titre('lecture-source — comparaison à la liste');
  const u = (fichier: string, cible: string, occurrences = 1): Usage => ({ fichier, cible, occurrences });
  const e = (fichier: string, cible: string, occurrences = 1, statut: Entree['statut'] = 'stock', justification?: string): Entree => ({
    fichier, cible, occurrences, statut, ...(justification ? { justification } : {}),
  });
  const vide: Ecarts = { nonListes: [], perimees: [], invalides: [] };

  egal(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts')]), vide, 'identique : aucun écart');
  const remplace = comparer([u('tests/a.ts', 'src/y.ts')], [e('tests/a.ts', 'src/x.ts')]);
  ok(remplace.nonListes.length === 1 && remplace.perimees.length === 1,
    'usage remplacé à nombre constant : nouvel usage non listé ET ancienne entrée périmée');
  const nouveau = comparer([u('tests/a.ts', 'src/x.ts', 2)], [e('tests/a.ts', 'src/x.ts', 1)]);
  ok(nouveau.nonListes.length === 1 && nouveau.perimees.length === 0, 'usage nouveau dans un fichier listé : échec');
  const retire = comparer([u('tests/a.ts', 'src/x.ts', 1)], [e('tests/a.ts', 'src/x.ts', 2)]);
  ok(retire.perimees.length === 1 && retire.nonListes.length === 0, 'usage retiré sans décompte : échec (entrée périmée)');
  const disparu = comparer([], [e('tests/a.ts', 'src/x.ts')]);
  ok(disparu.perimees.length === 1, 'entrée dont l’usage a disparu : échec');
  const fichierNeuf = comparer([u('tests/neuf.test.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts')]);
  ok(fichierNeuf.nonListes.length === 1, 'usage dans un fichier absent de la liste : échec');
  egal(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts', 1, 'exception', 'chemin factice')]), vide, 'exception justifiée : acceptée');
  ok(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts', 1, 'exception')]).invalides.length === 1, 'exception sans justification : refusée');
  ok(comparer([], [e('tests/a.ts', 'src/x.ts', 1, 'autre' as Entree['statut'])]).invalides.length === 1, 'statut inconnu : refusé');
  ok(comparer([u('tests/a.ts', 'src/x.ts')], [e('tests/a.ts', 'src/x.ts'), e('tests/a.ts', 'src/x.ts')]).invalides.length === 1, 'doublon dans la liste : refusé');
}

function corpusTemporaire(): void {
  titre('lecture-source — corpus (suivis, non suivis, ignorés) dans un dépôt jetable');
  const dossier = mkdtempSync(join(tmpdir(), 'lecture-source-'));
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dossier, stdio: 'pipe' });
    git('init', '-q');
    mkdirSync(join(dossier, 'tests'), { recursive: true });
    writeFileSync(join(dossier, '.gitignore'), 'tests/ignore.ts\n');
    writeFileSync(join(dossier, 'tests/suivi.ts'), `readFileSync('src/a.ts');\n`);
    git('add', '.gitignore', 'tests/suivi.ts');
    writeFileSync(join(dossier, 'tests/non-suivi.ts'), `readFileSync('src/b.ts');\nreadFileSync('src/b.ts');\n`);
    writeFileSync(join(dossier, 'tests/ignore.ts'), `readFileSync('src/c.ts');\n`);
    writeFileSync(join(dossier, 'tests/notes.md'), 'src/d.ts\n');
    egal(corpus(dossier), ['tests/non-suivi.ts', 'tests/suivi.ts'], 'fichier suivi et fichier non suivi retenus ; ignoré et non-code écartés');
    egal(releverDepot(dossier), [
      { fichier: 'tests/non-suivi.ts', cible: 'src/b.ts', occurrences: 2 },
      { fichier: 'tests/suivi.ts', cible: 'src/a.ts', occurrences: 1 },
    ], 'le fichier non suivi est compté, avec sa multiplicité');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

export async function testLectureSource() {
  formes();
  comparaison();
  corpusTemporaire();

  titre('lecture-source — références textuelles à src/ dans tests/');
  const liste = JSON.parse(readFileSync(join(RACINE, LISTE), 'utf8')) as { entrees: Entree[] };
  const usages = releverDepot(RACINE);
  const total = usages.reduce((s, x) => s + x.occurrences, 0);
  const { nonListes, perimees, invalides } = comparer(usages, liste.entrees);

  ok(invalides.length === 0, invalides.length === 0 ? 'liste bien formée (statuts, justifications, sans doublon)'
    : `liste mal formée :\n${invalides.map((i) => '         ' + i).join('\n')}`);
  ok(nonListes.length === 0, nonListes.length === 0
    ? `aucune référence à src/ hors de la liste (${total} usages, ${usages.length} identités)`
    : `référence à src/ non listée (la déclarer dans ${LISTE}, ou s’en passer) :\n${nonListes.map((i) => '         ' + i).join('\n')}`);
  ok(perimees.length === 0, perimees.length === 0
    ? 'aucune entrée périmée'
    : `entrée de la liste qui ne correspond plus (à retirer ou décompter) :\n${perimees.map((i) => '         ' + i).join('\n')}`);
}
