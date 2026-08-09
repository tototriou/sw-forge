import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

// Servi à la racine du domaine (Vercel) -> base '/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
  // La version affichée dans l'app vient de package.json : UNE seule source,
  // celle que la release incrémente (voir README, « Versions & releases »).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
});
