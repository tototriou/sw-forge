// La règle des RÉFÉRENCES TEXTUELLES à `src/` dans `tests/` : relevé et
// comparaison à la liste. Une seule source, appelée par la vérification
// (tests/lecture-source.test.ts, sur tout `tests/`) et par le hook
// `pre-commit` (sur les seuls fichiers indexés). Contrat : tests/README.md,
// « Garde des références à `src/` ».
//
// ⚠️ Le hook charge ce fichier par `node`, SANS compilation (effacement des
// types de Node ≥ 22.6) : n'y écrire que de la syntaxe effaçable — ni `enum`,
// ni `namespace`, ni propriété de paramètre — et n'importer un type que par
// `import type`.
//
// Comment : l'API du compilateur TypeScript relève, dans un fichier, les
// chaînes littérales, les gabarits et les assemblages de littéraux (`join`,
// `resolve`, `dirname`, `fileURLToPath`, `new URL(…, import.meta.url)`,
// `[…].join('/')`, `+`) dont la valeur reconstituée est `src` ou `src/…`.
// Résolution : relative à la racine du dépôt ; une valeur qui commence par
// `./` ou `../` se résout depuis le dossier du fichier analysé ;
// `import.meta.url` vaut le fichier analysé lui-même (le lanceur le remplace à
// la construction, voir tests/run.mjs : le cas « import.meta.url » de la
// vérification le prouve sur la valeur reconstituée, pas sur l'exécution).
// Une partie inconnue (paramètre, variable non constante) vaut `*`.
//
// Identité d'un usage : (fichier, cible normalisée), avec sa multiplicité.
// La liste (tests/fixtures/lecture-source-toleree.json) porte une entrée par
// identité, statut `stock` (figé sur 54f8c6d6) ou `exception` (justification
// obligatoire). Un usage absent de la liste, un nombre d'occurrences trop
// petit OU trop grand, une entrée qui ne correspond plus : écart.
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
// - seuls les fichiers de code sont analysés (`EXTENSIONS` : .ts .tsx .mts
//   .cts .js .mjs .cjs).

import { posix } from 'path';
import ts from 'typescript';

export const LISTE = 'tests/fixtures/lecture-source-toleree.json';
export const EXTENSIONS = /\.(?:[cm]?[jt]s|tsx)$/;

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
