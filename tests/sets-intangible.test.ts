// activeSets() — règle du jeu pour la rune Intangible (joker). Un set annoncé
// actif à tort serait une stat affichée fausse (RTA/Siège/Optimizer/Compte),
// pas un simple détail cosmétique — voir spec/compte/calcul-runes.md §5.2 et
// la capture qui a motivé ce correctif (un set « Swift » annoncé actif alors
// qu'un second set, non demandé par l'utilisateur, était lui aussi incomplet
// parmi les runes réellement portées).

import { activeSets } from '../src/lib/effects';
import { egal, titre } from './outils';

export default function testSetsIntangible() {
  titre('Sets actifs · règle du joker Intangible');

  egal(
    activeSets(['violent', 'violent', 'violent', 'intangible']),
    ['violent'],
    'un seul set incomplet (manque 1 pièce) + 1 joker → complété'
  );

  egal(
    activeSets(['swift', 'swift', 'swift', 'blade', 'intangible']),
    [],
    'deux sets incomplets à la fois + 1 joker → aucun des deux complété'
  );

  egal(
    activeSets(['violent', 'violent', 'violent', 'will', 'shield', 'intangible']),
    [],
    'trois sets incomplets à la fois + 1 joker → toujours aucun complété'
  );

  egal(
    activeSets(['swift', 'swift', 'swift', 'swift', 'intangible']),
    ['swift'],
    'set déjà complet par les vraies runes + joker surnuméraire → actif normalement, joker inutile'
  );

  egal(
    activeSets(['violent', 'violent', 'intangible']),
    [],
    'set manquant 2 pièces (sur 4) + 1 seul joker → reste incomplet, le joker n’en comble qu’une'
  );

  egal(
    activeSets(['will', 'intangible', 'intangible']),
    ['will'],
    'deux jokers reçus → un seul compte jamais (le jeu n’en autorise qu’une par monstre)'
  );

  egal(
    activeSets(['fight', 'fight', 'fight', 'fight', 'fight', 'fight']),
    ['fight', 'fight', 'fight'],
    'régression : 6 runes Fight (2 pièces) → toujours 3 activations, sans joker en jeu'
  );
}
