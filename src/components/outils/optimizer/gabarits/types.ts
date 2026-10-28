import type { ReactNode } from 'react';
import type { OptimizerState } from '../../../../hooks/useOptimizerState';
import type { UseOptimizerLists } from '../../../../hooks/useOptimizerLists';
import type { BoxItem } from '../../../../lib/applyAccount';
import type { ExclusionSourceData } from '../../../../lib/optimizerExclusion';
import type { ArtifactDetail, Monster, RelicDetail, RuneDetail } from '../../../../types';

// Ce que la vue des gabarits reçoit de l'app : l'état réel de l'Optimizer et le
// compte importé, tels qu'`OutilsPage` les passe à `OptimizerSection`.
export interface ContexteGabarits {
  optimizer: OptimizerState;
  lists: UseOptimizerLists;
  box: BoxItem[];
  runes: RuneDetail[];
  artifacts: ArtifactDetail[];
  relics: RelicDetail[];
  allMonsters: Monster[];
  exclusionData: ExclusionSourceData;
}

// Un état d'une boîte (« liste vide », « sets choisis »…). `rendu` rend un élément : un état qui a besoin d'un
// état local le porte dans son propre composant.
export interface EtatGabarit {
  id: string;
  nom: string;
  rendu: (ctx: ContexteGabarits) => ReactNode;
  // Boîte élastique : la largeur à laquelle CET état est montré (px), au-dessus
  // de la largeur minimale déclarée par le gabarit. La mesure s'y compare.
  largeur?: number;
}

// Une boîte de la refonte du bureau, vue seule.
export interface Gabarit {
  id: string;
  nom: string;
  // Largeur déclarée par la direction (px) ; la vue mesure la largeur réelle.
  // Boîte élastique : sa largeur MINIMALE, chaque état pouvant être montré
  // plus large (`EtatGabarit.largeur`).
  largeur: number;
  elastique?: boolean;
  // Hauteur estimée par la direction (px), pour la comparer à la mesure.
  hauteurEstimee: number;
  // Le composant de bureau, et ce qu'il partage avec le téléphone.
  composant: string;
  telephone: string;
  // L'encadré « Ce qui change de comportement » : une ligne par changement.
  changements: string[];
  etats: EtatGabarit[];
}
