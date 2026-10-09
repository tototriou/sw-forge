// Le banc exécute la source de production, avec des cellules React simulées.
// Il observe les transitions synchrones ; ni rendu, ni effets, ni Worker.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as transitions from '../src/hooks/useOptimizerState';
import * as degats from '../src/lib/damage';
import * as transitionsDegats from '../src/lib/damageSetupTransition';
import type { OptimizerState } from '../src/hooks/useOptimizerState';

export function fonctionDeSource(fichier: string, nom: string, contexte: Record<string, unknown>) {
  const source = ts.createSourceFile(fichier, readFileSync(fichier, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fonction: ts.FunctionDeclaration | undefined;
  const visiter = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nom) fonction = n;
    else ts.forEachChild(n, visiter);
  };
  visiter(source);
  if (!fonction) throw new Error(`Fonction de production introuvable : ${nom}`);
  const code = ts.transpileModule(fonction.getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(contexte), `${code}\nreturn ${nom};`)(...Object.values(contexte)) as (...args: unknown[]) => void;
}

export async function bancOptimizer() {
  const fichier = 'src/hooks/useOptimizerState.ts';
  const code = ts.transpileModule(readFileSync(fichier, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const cellules: unknown[] = [];
  let curseur = 0;
  let effacements = 0;
  const search = { reset: () => { effacements++; }, result: { temoins: true }, progress: { temoins: true } };
  const modules: Record<string, unknown> = {
    // Les dépendances sont les vrais exports de production, importés
    // statiquement : le banc marche aussi dans le bundle du lanceur normal.
    '../lib/damage': degats,
    '../lib/damageSetupTransition': transitionsDegats,
    '../lib/criteresOptimizer': transitions,
    react: {
      useState(initial: unknown) {
        const i = curseur++;
        if (!(i in cellules)) cellules[i] = typeof initial === 'function' ? initial() : initial;
        return [cellules[i], (v: unknown) => {
          cellules[i] = typeof v === 'function' ? v(cellules[i]) : v;
        }];
      },
      useRef(initial: unknown) {
        const i = curseur++;
        if (!(i in cellules)) cellules[i] = { current: initial };
        return cellules[i];
      },
    },
    './useBuildOptimSearch': { useBuildOptimSearch: () => search },
  };
  for (const [, chemin] of code.matchAll(/require\("([^"]+)"\)/g)) {
    if (!(chemin in modules)) throw new Error(`Dépendance de production non instrumentée : ${chemin}`);
  }
  const exports: Record<string, unknown> = {};
  new Function('require', 'exports', code)((nom: string) => modules[nom], exports);
  const rendre = () => {
    curseur = 0;
    return (exports.useOptimizerState as () => OptimizerState)();
  };
  const etat = rendre();
  return { etat, rendre, effacements: () => effacements };
}
