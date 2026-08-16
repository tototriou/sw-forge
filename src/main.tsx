import React from 'react';
import ReactDOM from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import Analytics from './components/Analytics';
import './index.css';
import { surveillerDebordement } from './lib/detecteurDebordement';

// ⚠️ En DÉVELOPPEMENT seulement (le module s'arrête de lui-même en production).
// `overflow-x: hidden` masque les débordements ; ce détecteur les NOMME, sinon
// on cherche à la main un coupable qui se manifeste sur une autre page que la
// sienne.
surveillerDebordement();

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
