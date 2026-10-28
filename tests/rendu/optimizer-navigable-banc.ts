// Compilation TypeScript de sources réelles pour un rendu React au navigateur.
// Aucun serveur de l'application, ni moteur de recherche, n'est lancé.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import type { Browser, Page } from 'playwright';

let cssConstruit: string | undefined;

/**
 * `recharger` : un vrai `page.reload()` (le document, ses Workers et tout l'état
 * JavaScript disparaissent, le stockage de l'origine reste), puis le banc
 * réinjecté comme au premier chargement.
 */
export async function navigateurOptimizer(telephone = false, entreeBanc = 'tests/rendu/optimizer-memoire-banc.tsx'): Promise<{ browser: Browser; page: Page; recharger: () => Promise<void> }> {
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
  const workers = new Map<string, number>();
  function ajouter(fichier: string): number {
    const connu = ids.get(fichier);
    if (connu !== undefined) return connu;
    const id = modules.length;
    ids.set(fichier, id); modules.push({ code: '', liens: {} });
    const sourceBrute = readFileSync(fichier, 'utf8');
    const urlModule = `http://optimizer.test/${id}.js`;
    const source = sourceBrute
      .replace(/import\.meta\.env/g, '({ BASE_URL: "/", MODE: "test", DEV: false, PROD: true })')
      .replace(/import\.meta\.url/g, JSON.stringify(urlModule));
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
    for (const [, , relatif] of sourceBrute.matchAll(/new URL\(\s*(['"])([^'"]+\.worker\.ts)\1\s*,\s*import\.meta\.url\s*\)/g)) {
      workers.set(new URL(relatif, urlModule).pathname, ajouter(resolve(dirname(fichier), relatif)));
    }
    return id;
  }
  function paquetWorker(entree: number): string {
    const retenus: Record<number, typeof modules[number]> = {};
    const visiter = (id: number) => {
      if (retenus[id]) return;
      retenus[id] = modules[id];
      Object.values(modules[id].liens).forEach(visiter);
    };
    visiter(entree);
    return `const modules=${JSON.stringify(retenus)},cache={};
      function charger(id){if(cache[id])return cache[id].exports;
        const module=cache[id]={exports:{}};
        new Function('module','exports','require',modules[id].code)(module,module.exports,nom=>charger(modules[id].liens[nom]));
        return module.exports;}
      charger(${entree});`;
  }
  const entree = ajouter(resolve(entreeBanc));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: telephone ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: telephone, hasTouch: telephone });
    const erreurs: string[] = [];
    page.on('pageerror', erreur => erreurs.push(erreur.stack ?? erreur.message));
    const publicRoot = resolve('public');
    await page.route('http://optimizer.test/**', route => {
      const chemin = new URL(route.request().url()).pathname;
      const worker = workers.get(chemin);
      if (worker !== undefined) return route.fulfill({ contentType: 'text/javascript', body: paquetWorker(worker) });
      // Au bureau, le contenu posé à 68 px du haut, comme dans l'app (barre fixe
      // de 48 px et marge de 20, App.tsx) : la page de bureau de l'Optimizer
      // colle ses essentiels à cette hauteur (`HAUT_PAGE`, PageBureau.tsx), et
      // un contenu posé plus haut serait poussé par le collage.
      if (chemin === '/') return route.fulfill({ contentType: 'text/html', body: `<meta name="viewport" content="width=device-width, initial-scale=1.0"><div id="racine"${telephone ? '' : ' style="padding-top:68px"'}></div>` });
      const fichier = resolve(publicRoot, `.${decodeURIComponent(chemin)}`);
      if (!fichier.startsWith(publicRoot + sep) || !existsSync(fichier)) return route.fulfill({ status: 404, body: '' });
      const contentType = fichier.endsWith('.svg') ? 'image/svg+xml' : fichier.endsWith('.png') ? 'image/png' :
        fichier.endsWith('.webp') ? 'image/webp' : fichier.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
      return route.fulfill({ contentType, body: readFileSync(fichier) });
    });
    await page.goto('http://optimizer.test/');
    await page.addStyleTag({ content: cssConstruit });
    const script = `
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
    `;
    await page.addScriptTag({ content: script });
    if (erreurs.length) throw new Error(erreurs.join('\n'));
    page.on('pageerror', erreur => { throw erreur; });
    const recharger = async () => {
      await page.reload();
      await page.addStyleTag({ content: cssConstruit });
      await page.addScriptTag({ content: script });
    };
    return { browser, page, recharger };
  } catch (erreur) { await browser.close(); throw erreur; }
}
