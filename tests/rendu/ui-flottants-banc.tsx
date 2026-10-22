// Banc navigateur de deux comportements de `src/ui/` que le rendu serveur ne
// voit pas : la liste ouverte du `Selecteur` (charte, clavier, doigt) et un
// `Flottant` posé dans une boîte qui défile seule. Monté par
// `navigateurOptimizer` (sources réelles compilées, Chromium) ; les gestes
// sont ceux de Playwright (clavier et pointeur réels), dans ui-flottants.test.ts.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Selecteur from '../../src/ui/Selecteur';
import Flottant from '../../src/ui/Flottant';

function BancSelecteur() {
  const [valeur, setValeur] = useState('b');
  return (
    <div style={{ padding: 40 }}>
      <Selecteur aria-label="Tri" value={valeur} onChange={(e) => setValeur(e.target.value)} pleineLargeur={false}>
        <option value="a">Alpha</option>
        <option value="b">Bêta</option>
        <option value="c" disabled>Gamma</option>
        <option value="d">Delta</option>
      </Selecteur>
      <button type="button">Après</button>
      <output data-valeur>{valeur}</output>
    </div>
  );
}

// Une boîte étroite qui défile seule (comme une colonne de l'Optimizer au
// bureau), un flottant plus large qu'elle ouvert sur une ancre près de son haut.
function BancBoite() {
  return (
    <div style={{ padding: 40 }}>
      <div data-boite style={{ height: 160, width: 200, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        <div style={{ height: 20 }} />
        <div data-ancre className="relative" style={{ width: 100, height: 24 }}>
          <Flottant largeur="" style={{ width: 260 }} aria-label="Surface">
            <div style={{ height: 200 }}>Contenu du flottant</div>
          </Flottant>
        </div>
        <div style={{ height: 600 }} />
      </div>
    </div>
  );
}

export function monter(nom: 'selecteur' | 'boite') {
  const racine = document.getElementById('racine')!;
  flushSync(() => createRoot(racine).render(nom === 'selecteur' ? <BancSelecteur /> : <BancBoite />));
}
