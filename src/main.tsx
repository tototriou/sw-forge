import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import Analytics from './components/Analytics';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ⚠️ `reducedMotion="user"` : Framer Motion ne respecte PAS
        `prefers-reduced-motion` par défaut. Sans cette ligne, chaque animation
        aurait dû le gérer une par une — et la première oubliée serait passée
        inaperçue, puisqu'on ne développe presque jamais avec le réglage activé.
        Posé ici, il vaut pour toute l'app.
        « user » et non « always » : ce sont les transformations (déplacement,
        échelle) qui sont neutralisées, pas les fondus d'opacité — un élément
        doit toujours pouvoir apparaître. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
    <Analytics />
  </React.StrictMode>
);
