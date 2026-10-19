// Les colonnes repliables de l'Optimizer au bureau et leur contrôle à onglets
// (src/lib/optimizerColonnes.ts).

import { AUCUNE_COLONNE, basculerColonne, colonnesAffichees, type ColonnesOuvertes } from '../src/lib/optimizerColonnes';
import { egal, titre } from './outils';

const affichees = (e: ColonnesOuvertes, deux: boolean) => colonnesAffichees(e, deux);

export function testOptimizerColonnes() {
  titre('Optimizer · colonnes repliables et contrôle à onglets');

  // Là où une seule colonne tient.
  const art = basculerColonne(AUCUNE_COLONNE, 'artefacts', false);
  egal(affichees(art, false), { artefacts: true, complements: false }, 'une seule tient : cliquer un onglet ouvre sa colonne');
  const aux = basculerColonne(art, 'complements', false);
  egal(affichees(aux, false), { artefacts: false, complements: true }, 'une seule tient : cliquer l\'autre l\'ouvre et ferme la première');
  egal(affichees(basculerColonne(aux, 'complements', false), false), { artefacts: false, complements: false }, 'recliquer l\'onglet actif referme sa colonne : aucune');
  egal(affichees(aux, true), { artefacts: false, complements: true }, 'fermée là où une seule tenait, la première ne revient pas quand la largeur s\'élargit');

  // Là où les deux tiennent.
  const deux = basculerColonne(basculerColonne(AUCUNE_COLONNE, 'artefacts', true), 'complements', true);
  egal(affichees(deux, true), { artefacts: true, complements: true }, 'les deux tiennent : la seconde s\'ajoute à la première');
  egal(affichees(basculerColonne(deux, 'artefacts', true), true), { artefacts: false, complements: true }, 'les deux tiennent : recliquer l\'une ne ferme qu\'elle');

  // La largeur repasse sous le seuil des deux : la dernière ouverte reste seule.
  egal(affichees(deux, false), { artefacts: false, complements: true }, 'revenue là où une seule tient : la dernière ouverte reste seule');
  const inverse = basculerColonne(basculerColonne(AUCUNE_COLONNE, 'complements', true), 'artefacts', true);
  egal(affichees(inverse, false), { artefacts: true, complements: false }, 'la dernière ouverte, quelle qu\'elle soit');
  egal(affichees(basculerColonne(deux, 'complements', false), false), { artefacts: false, complements: false },
    'une seule tient : recliquer la colonne affichée referme tout, sans faire reparaître l\'autre');
  egal(affichees(basculerColonne(deux, 'artefacts', false), false), { artefacts: true, complements: false },
    'une seule tient : cliquer l\'onglet masqué l\'affiche seul');
}
