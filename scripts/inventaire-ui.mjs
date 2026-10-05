// Inventaire des points d'entrée VISIBLES de l'interface — lot 0 de
// `spec/chantiers/refonte-graphique.md` (B.0).
//
// Pour chaque `src/**/*.tsx`, relève ce qu'un joueur lit ou touche :
//   texte:<t>           texte JSX, ou chaîne affichée comme enfant JSX
//   attr:<nom>:<v>      label, libelle, libelleCourt, title, titre,
//                       aria-label, placeholder, alt
//   prop:<nom>:<v>      mêmes noms (et texte, desc, kicker) dans un objet
//                       littéral : entrées de menu, onglets, options
//   message:<v>         chaîne passée à setX(…), alert, confirm
//   route:<#/…>         toute chaîne qui commence par « #/ »
//
// ⚠️ Lu par le VRAI analyseur TypeScript, pas par des expressions régulières :
// une chaîne dans un `className`, une comparaison (`route === 'home'`) ou un
// argument de fonction ordinaire ne s'affiche pas, et la compter ferait crier
// l'inventaire à chaque refactorisation sans rapport avec ce qu'on voit.
//
// Sortie déterministe : fichiers et entrées triés, doublons retirés — deux
// exécutions sur le même arbre donnent le même octet.
//
// Usage :
//   node scripts/inventaire-ui.mjs                    résumé
//   node scripts/inventaire-ui.mjs --json             inventaire complet (stdout)
//   node scripts/inventaire-ui.mjs --fichier <f.tsx>  inventaire d'un seul fichier (JSON)
//   node scripts/inventaire-ui.mjs --ecrire           fige la référence
//   node scripts/inventaire-ui.mjs --verifier [--json] compare à la référence
//                                                     (code 1 si une perte)

import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { comparer, decisionsRetrait } from './lib/inventaire-comparer.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const PREUVES = join(RACINE, 'spec/chantiers/refonte-graphique-preuves');
const REFERENCE = join(PREUVES, 'inventaire-reference.json');
const DEPLACEMENTS = join(PREUVES, 'deplacements.json');
const CADRAGE = join(RACINE, 'spec/chantiers/refonte-graphique.md');

const ATTRS = new Set(['label', 'libelle', 'libelleCourt', 'title', 'titre', 'aria-label', 'placeholder', 'alt']);
const PROPS = new Set([...ATTRS, 'texte', 'text', 'desc', 'kicker']);
const MESSAGE = /^(set[A-Z]\w*|alert|confirm)$/;

// Le texte JSX garde ses entités telles qu'écrites (`&apos;`) : on les décode
// pour que l'inventaire se lise comme l'écran.
const ENTITES = { apos: "'", quot: '"', amp: '&', lt: '<', gt: '>', nbsp: ' ' };
const decoder = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITES[e] ?? m
  );
const propre = (s) => decoder(s).replace(/\s+/g, ' ').trim();
const lisible = (s) => /\p{L}/u.test(s);

function nomAttribut(n) {
  return n.name.kind === ts.SyntaxKind.JsxNamespacedName ? `${n.name.namespace.text}:${n.name.name.text}` : n.name.text;
}

function nomPropriete(n) {
  const nom = n.name;
  if (!nom) return null;
  if (ts.isIdentifier(nom) || ts.isStringLiteral(nom)) return nom.text;
  return null;
}

// ⚠️ **Constantes de MARQUE** (`src/marque.ts`) : depuis le rebranding (R2),
// le nom de l'app n'est plus écrit dans les composants, qui lisent `NOM_APP`.
// L'inventaire relève ce qu'un joueur LIT : une constante de marque se lit par
// sa VALEUR, pas comme `{…}` — sinon le nom disparaîtrait de l'inventaire, et
// sa perte avec lui. Seules ces constantes-là, relues à chaque lancement : le
// fichier est un module de chaînes, lu par une expression régulière.
function lireConstantes(fichier) {
  try {
    const source = readFileSync(fichier, 'utf8');
    return Object.fromEntries([...source.matchAll(/^export const (\w+) = '([^']*)';/gm)].map((m) => [m[1], m[2]]));
  } catch {
    return {};
  }
}
const CONSTANTES = lireConstantes(join(RACINE, 'src/marque.ts'));
const valeurConstante = (n, constantes) =>
  ts.isIdentifier(n) && Object.hasOwn(constantes, n.text) ? constantes[n.text] : null;

// Texte d'un littéral chaîne ou gabarit ; `${…}` devient « {…} » pour garder
// la phrase lisible et stable quel que soit le nom de la variable, sans se
// confondre avec un « … » écrit en toutes lettres — sauf une constante de
// marque, remplacée par sa valeur.
function texteLitteral(n, constantes) {
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n))
    return n.head.text + n.templateSpans.map((s) => (valeurConstante(s.expression, constantes) ?? '{…}') + s.literal.text).join('');
  return null;
}

// Une chaîne compte comme AFFICHÉE si, en remontant vers la construction JSX la
// plus proche, on ne traverse que des branches d'expression (ternaire, &&, ||,
// ??, parenthèses) — jamais une comparaison, un appel, un accès, une clé.
function remonteVersAffichage(n) {
  let enfant = n;
  let p = n.parent;
  while (p) {
    if (ts.isParenthesizedExpression(p)) { enfant = p; p = p.parent; continue; }
    if (ts.isConditionalExpression(p)) {
      if (enfant === p.condition) return null;
      enfant = p; p = p.parent; continue;
    }
    if (ts.isBinaryExpression(p)) {
      const op = p.operatorToken.kind;
      const branche = op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.PlusToken;
      if (!branche) return null;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken && enfant === p.left) return null;
      enfant = p; p = p.parent; continue;
    }
    if (ts.isJsxExpression(p)) {
      const hote = p.parent;
      if (hote && ts.isJsxAttribute(hote)) {
        const nom = nomAttribut(hote);
        return ATTRS.has(nom) ? `attr:${nom}` : null;
      }
      if (hote && (ts.isJsxElement(hote) || ts.isJsxFragment(hote))) return 'texte';
      return null;
    }
    if (ts.isPropertyAssignment(p) && enfant === p.initializer) {
      const nom = nomPropriete(p);
      return nom && PROPS.has(nom) ? `prop:${nom}` : null;
    }
    if (ts.isCallExpression(p) && p.arguments.includes(enfant)) {
      const appele = ts.isIdentifier(p.expression) ? p.expression.text : null;
      return appele && MESSAGE.test(appele) ? 'message' : null;
    }
    return null;
  }
  return null;
}

export function extraireSource(source, nomFichier = 'x.tsx', constantes = CONSTANTES) {
  const sf = ts.createSourceFile(nomFichier, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const entrees = new Set();
  const visiter = (n) => {
    if (ts.isJsxText(n)) {
      const t = propre(n.text);
      if (t && lisible(t)) entrees.add(`texte:${t}`);
    } else if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const nom = nomAttribut(n);
      const v = propre(n.initializer.text);
      if (v.startsWith('#/')) entrees.add(`route:${v}`);
      else if (ATTRS.has(nom) && v && lisible(v)) entrees.add(`attr:${nom}:${v}`);
    } else if (valeurConstante(n, constantes) !== null) {
      // `{NOM_APP}` posé tel quel : même règle d'affichage qu'une chaîne.
      const genre = remonteVersAffichage(n);
      if (genre) entrees.add(`${genre}:${propre(valeurConstante(n, constantes))}`);
    } else {
      const t = texteLitteral(n, constantes);
      if (t !== null && !(n.parent && ts.isJsxAttribute(n.parent))) {
        const v = propre(t);
        if (v.startsWith('#/')) entrees.add(`route:${v}`);
        else if (v && lisible(v)) {
          const genre = remonteVersAffichage(n);
          if (genre) entrees.add(`${genre}:${v}`);
        }
      }
    }
    ts.forEachChild(n, visiter);
  };
  visiter(sf);
  return [...entrees].sort();
}

function fichiersTsx(dossier) {
  const out = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) out.push(...fichiersTsx(chemin));
    else if (nom.endsWith('.tsx')) out.push(chemin);
  }
  return out;
}

export function inventaire(racine = RACINE) {
  const resultat = {};
  for (const chemin of fichiersTsx(join(racine, 'src')).sort()) {
    const rel = relative(racine, chemin).split('\\').join('/');
    const entrees = extraireSource(readFileSync(chemin, 'utf8'), rel);
    if (entrees.length) resultat[rel] = entrees;
  }
  return resultat;
}

const lireJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const json = (x) => JSON.stringify(x, null, 2) + '\n';

function principal(args) {
  if (args.includes('--fichier')) {
    const f = resolve(args[args.indexOf('--fichier') + 1]);
    process.stdout.write(json(extraireSource(readFileSync(f, 'utf8'), f)));
    return 0;
  }
  const courant = inventaire();
  if (args.includes('--ecrire')) {
    writeFileSync(REFERENCE, json(courant));
    const n = Object.values(courant).reduce((s, e) => s + e.length, 0);
    console.log(`référence figée : ${Object.keys(courant).length} fichiers, ${n} entrées → ${relative(RACINE, REFERENCE)}`);
    return 0;
  }
  if (args.includes('--verifier')) {
    const r = comparer(lireJson(REFERENCE), courant, lireJson(DEPLACEMENTS), decisionsRetrait(readFileSync(CADRAGE, 'utf8')));
    if (args.includes('--json')) { process.stdout.write(json(r)); return r.ok ? 0 : 1; }
    if (r.ok) { console.log('inventaire : aucune perte (référence retrouvée, déplacements faits, retraits décidés)'); return 0; }
    for (const m of r.manquants) console.log(`PERDU      ${m.fichier} :: ${m.entree}`);
    for (const m of r.deplacementsNonFaits) console.log(`NON FAIT   ${m.fichier} :: ${m.entree} → ${m.vers}`);
    for (const m of r.retraitsNonDecides) console.log(`NON DÉCIDÉ ${m.fichier} :: ${m.entree} (${m.retrait})`);
    for (const k of r.orphelins) console.log(`ORPHELIN   ${k}`);
    return 1;
  }
  if (args.includes('--json')) { process.stdout.write(json(courant)); return 0; }
  const n = Object.values(courant).reduce((s, e) => s + e.length, 0);
  console.log(`${Object.keys(courant).length} fichiers, ${n} entrées visibles`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
