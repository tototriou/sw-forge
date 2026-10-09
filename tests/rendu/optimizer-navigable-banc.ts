// Compilation TypeScript de sources réelles pour un rendu React au navigateur.
// Aucun serveur de l'application, ni moteur de recherche, n'est lancé.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import type { Browser, Page } from 'playwright';

let cssConstruit: string | undefined;

export async function navigateurOptimizer(telephone = false, entreeBanc = 'tests/rendu/optimizer-memoire-banc.tsx'): Promise<{ browser: Browser; page: Page }> {
  const requireLocal = createRequire(resolve('package.json'));
  const { chromium } = requireLocal('playwright') as typeof import('playwright');
  if (cssConstruit === undefined) {
    const postcss = requireLocal('postcss') as typeof import('postcss').default;
    const tailwind = requireLocal('tailwindcss') as (options: { config: string }) => import('postcss').Plugin;
    cssConstruit = (await postcss([tailwind({ config: resolve('tailwind.config.js') })])
      .process(readFileSync('src/index.css', 'utf8'), { from: resolve('src/index.css') })).css;
  }
  const modules: { code: string; liens: Record<string, number> }[] = [];
  const ids = new Map<string, number>();
  function ajouter(fichier: string): number {
    const connu = ids.get(fichier);
    if (connu !== undefined) return connu;
    const id = modules.length;
    ids.set(fichier, id); modules.push({ code: '', liens: {} });
    const source = readFileSync(fichier, 'utf8')
      .replace(/import\.meta\.env/g, '({ BASE_URL: "/", MODE: "test", DEV: false, PROD: true })')
      .replace(/import\.meta\.url/g, JSON.stringify(`http://localhost/${id}.js`));
    const code = fichier.endsWith('.json') ? `module.exports = ${source};` :
      ts.transpileModule(source, { fileName: fichier, compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        allowJs: true,
      } }).outputText;
    if (/import\.meta/.test(code.replace(/\/\/[^\n]*/g, ''))) throw new Error(`import.meta restant dans ${fichier}`);
    const liens: Record<string, number> = {};
    for (const [, nom] of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
      const chemin = resolve(dirname(fichier), nom);
      const local = nom.startsWith('.') && [chemin, ...['.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js'].map(e => chemin + e)].find(p => existsSync(p) && /\.(ts|tsx|js|json)$/.test(p));
      let cible: string;
      try { cible = local || createRequire(fichier).resolve(nom); }
      catch (erreur) {
        // Dépendance facultative de framer-motion, également absente en
        // production : son propre try/catch traite le refus de require.
        if (nom === '@emotion/is-prop-valid') continue;
        throw erreur;
      }
      if (!existsSync(cible)) throw new Error(`Module du navigateur non résolu : ${nom}`);
      liens[nom] = ajouter(cible);
    }
    modules[id] = { code, liens };
    return id;
  }
  const entree = ajouter(resolve(entreeBanc));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: telephone ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: telephone, hasTouch: telephone });
    const erreurs: string[] = [];
    page.on('pageerror', erreur => erreurs.push(erreur.stack ?? erreur.message));
    await page.route('http://optimizer.test/**', route => route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="racine"></div>' }));
    await page.goto('http://optimizer.test/');
    await page.addStyleTag({ content: cssConstruit });
    await page.addScriptTag({ content: `
      globalThis.process = { env: { NODE_ENV: 'development' } };
      globalThis.__APP_VERSION__ = 'test';
      const modules = ${JSON.stringify(modules)}, cache = {};
      function charger(id) {
        if (id === undefined) throw new Error('Module facultatif absent');
        if (cache[id]) return cache[id].exports;
        const module = cache[id] = { exports: {} };
        new Function('module', 'exports', 'require', modules[id].code)(module, module.exports, nom => charger(modules[id].liens[nom]));
        return module.exports;
      }
      globalThis.bancOptimizer = charger(${entree});
    ` });
    if (erreurs.length) throw new Error(erreurs.join('\n'));
    page.on('pageerror', erreur => { throw erreur; });
    return { browser, page };
  } catch (erreur) { await browser.close(); throw erreur; }
}
