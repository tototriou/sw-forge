import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Servi à la racine du domaine (Vercel) -> base '/'.
export default defineConfig({
  plugins: [react()],
  base: '/',
});
