import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
import { NOM_APP } from './src/marque';

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
});
