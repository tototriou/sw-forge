// « Sauvegardé il y a … » — la durée écoulée, en mots (refonte graphique,
// lot 13, décision 29 ; spec/rta/sauvegarde-partage.md).

import { depuis } from '../src/components/rta/IndicateurSauvegarde';
import { egal, titre } from './outils';

export function testIndicateurSauvegarde() {
  titre('« Sauvegardé il y a … » — la durée en mots');
  egal(depuis(0), "à l'instant", 'tout de suite : « à l\'instant »');
  egal(depuis(59_000), "à l'instant", 'moins d\'une minute : « à l\'instant »');
  egal(depuis(60_000), 'il y a 1 min', 'une minute');
  egal(depuis(59 * 60_000), 'il y a 59 min', 'jusqu\'à 59 minutes');
  egal(depuis(60 * 60_000), 'il y a 1 h', 'une heure');
  egal(depuis(23 * 3_600_000 + 59 * 60_000), 'il y a 23 h', 'jusqu\'à 23 heures');
  egal(depuis(24 * 3_600_000), 'il y a 1 j', 'un jour');
}
