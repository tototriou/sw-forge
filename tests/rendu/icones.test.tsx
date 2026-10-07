// Tests de rendu — une convention d'icônes (spec/shared/design.md,
// « Exporter ↑, importer ↓ »).
//
// ⚠️ L'inversion importer / exporter est revenue plusieurs fois : chaque
// endroit de l'accueil et de la palette qui l'a portée est gardé ici.

import HomePage from '../../src/pages/HomePage';
import { ok, titre } from '../outils';
import { rendre } from './outils-rendu';

// L'icône lucide la plus proche AVANT `texte` dans le HTML (`lucide-upload`…).
function iconeAvant(html: string, texte: string): string | null {
  const fin = html.indexOf(texte);
  if (fin < 0) return null;
  const noms = [...html.slice(0, fin).matchAll(/class="lucide lucide-([a-z0-9-]+)/g)];
  return noms.length ? noms[noms.length - 1][1] : null;
}

export function testRenduIcones() {
  titre('rendu · icônes — exporter ↑, importer ↓ (accueil)');
  const accueil = rendre(<HomePage stats={{ rta: 0, defense: 0, offense: 0, recos: 0 }} onImport={() => {}} />);
  ok(iconeAvant(accueil, 'Importer mon compte') === 'download', '« Importer mon compte » : flèche vers le bas');
  ok(iconeAvant(accueil, 'Dépose ton fichier .json ici') === 'download', 'zone de dépôt : flèche vers le bas');
  ok(iconeAvant(accueil, 'Exporte ton compte') === 'upload', 'étape 01 « Exporte ton compte » : flèche vers le haut');
  ok(iconeAvant(accueil, 'Dépose le fichier') === 'download', 'étape 02 « Dépose le fichier » : flèche vers le bas');
}
