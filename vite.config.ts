import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import pkg from './package.json';
import { NOM_APP } from './src/marque';
import { postcssVolets } from './scripts/lib/postcssVolets';

// Le nom de l'app dans `index.html` (titre de l'onglet, aperçus de partage) :
// `%NOM_APP%` y est remplacé par la constante de `src/marque.ts`, la même que
// lit l'app. Sans cela, le nom serait écrit deux fois, et les deux copies
// divergeraient au prochain changement.
function nomDansIndex(): Plugin {
  return {
    name: 'nom-dans-index',
    transformIndexHtml: (html) => html.replaceAll('%NOM_APP%', NOM_APP),
  };
}

// Servi à la racine du domaine (Vercel) -> base '/'.
export default defineConfig({
  plugins: [react(), nomDansIndex()],
  base: '/',
  // La version affichée dans l'app vient de package.json : UNE seule source,
  // celle que la release incrémente (voir README, « Versions & releases »).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // PostCSS déclaré ICI et non dans un `postcss.config.js` : le plugin de
  // l'écran partagé est écrit en TypeScript, que seule cette configuration
  // sait charger. ⚠️ `postcssVolets` APRÈS Tailwind : il dédouble les `@media`
  // que Tailwind vient d'émettre (voir scripts/lib/postcssVolets.ts).
  css: { postcss: { plugins: [tailwindcss(), autoprefixer(), postcssVolets()] } },
});
