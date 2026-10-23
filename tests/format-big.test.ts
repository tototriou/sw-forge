// `formatBig` (src/lib/formatBig.ts) : les grands nombres de l'Optimizer
// (pool de runes après pré-filtrage), tels que l'écran les affiche.

import { formatBig } from '../src/lib/formatBig';
import { egal, titre } from './outils';

// Groupement fr-FR : espace insécable étroite (U+202F) entre les milliers.
const fr = (n: number) => n.toLocaleString('fr-FR');

export function testOptimizerFormatBig() {
  titre('Optimizer — grands nombres affichés (formatBig)');
  egal(formatBig(0), '0', 'zéro');
  egal(formatBig(1234.6), fr(1235), 'arrondi à l’unité, groupé à la française');
  egal(formatBig(999_999_999), fr(999_999_999), 'sous le milliard : en clair');
  egal(formatBig(1_000_000_000), '1.0e+9', 'à partir du milliard : notation exponentielle, un chiffre après la virgule');
  egal(formatBig(1.26e12), '1.3e+12', 'au-delà : arrondi de la mantisse');
  egal(formatBig(Infinity), '—', 'infini : tiret');
  egal(formatBig(Number.NaN), '—', 'non numérique : tiret');
}
