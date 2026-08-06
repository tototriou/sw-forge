import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' -> chemins relatifs, fonctionne tel quel sur GitHub Pages
// (que ce soit servi depuis la racine d'un domaine perso ou depuis /nom-du-repo/)
export default defineConfig({
  plugins: [react()],
  base: './',
});
