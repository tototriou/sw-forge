// Les colonnes repliables de l'Optimizer au bureau et leur contrôle à onglets
// (src/lib/optimizerColonnes.ts).

import {
  AUCUNE_COLONNE, LARGEURS_BUREAU, SEUILS_BUREAU, agencementBureau, basculerColonne, colonnesAffichees, colonnesParDefaut,
  deuxColonnesTiennent, ouvrirColonne, type ColonnesOuvertes,
} from '../src/lib/optimizerColonnes';
import { LARGEUR_ESSENTIELS } from '../src/components/outils/optimizer/bureau/ListeDeTravailBureau';
import { LARGEUR_ARTEFACTS } from '../src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau';
import { LARGEUR_COMPLEMENTS } from '../src/components/outils/optimizer/bureau/SetsAuraBureau';
import { LARGEUR_EXEMPLAIRE } from '../src/components/outils/optimizer/bureau/ExemplaireBureau';
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

// Les agencements du bureau et leurs seuils : chacun se calcule sur les
// largeurs déclarées des boîtes, que les composants de bureau déclarent aussi.
export function testOptimizerAgencementsBureau() {
  titre('Optimizer · agencements du bureau, seuils et état de départ des colonnes');
  egal({ ...SEUILS_BUREAU }, { a2: 904, a3: 1180, artefactsInseree: 1516, complementsInseree: 1536, deuxInserees: 1872 },
    'seuils : 548 + 16 + 340 ; 548 + 16 + 616 ; avec « Artéfacts » 320 + 16 ; avec « Aura… » 340 + 16 ; les deux');
  egal([LARGEUR_ESSENTIELS, LARGEUR_ARTEFACTS, LARGEUR_COMPLEMENTS, LARGEUR_EXEMPLAIRE],
    [LARGEURS_BUREAU.essentiels, LARGEURS_BUREAU.artefacts, LARGEURS_BUREAU.complements, LARGEURS_BUREAU.exemplaire],
    'les composants de bureau déclarent les largeurs d\'où viennent les seuils');
  egal([728, 903, 904, 1179, 1180, 2254].map(agencementBureau), ['A1', 'A1', 'A2', 'A2', 'A3', 'A3'], 'A1 [728, 904[, A2 [904, 1180[, A3 dès 1180');
  egal([1871, 1872, null].map(deuxColonnesTiennent), [false, true, false], 'les deux colonnes ensemble dès 1872 seulement');

  const ouverte = { artefacts: true, complements: false, derniere: 'artefacts' };
  egal(colonnesParDefaut(758), ouverte, 'défaut en A1 (758) : « Artéfacts et relique » ouverte');
  egal(colonnesParDefaut(1078), ouverte, 'défaut en A2 (1078) : ouverte');
  egal(colonnesParDefaut(1230), AUCUNE_COLONNE, 'défaut en A3 sous 1516 (1230) : aucune, pas de panneau superposé ouvert d\'office');
  egal(colonnesParDefaut(1515), AUCUNE_COLONNE, 'défaut à 1515 : aucune');
  egal(colonnesParDefaut(1516), ouverte, 'défaut dès 1516 : ouverte, insérée');
  egal(colonnesParDefaut(null), ouverte, 'défaut sans largeur (rendu serveur) : ouverte');

  // Le guidage vers l'interrupteur des auras RES/PRE ouvre sans refermer.
  const aux = ouvrirColonne(ouverte as ColonnesOuvertes, 'complements');
  egal(affichees(aux, false), { artefacts: false, complements: true }, 'ouvrir « Aura… » là où une seule tient : elle seule');
  egal(affichees(aux, true), { artefacts: true, complements: true }, 'ouvrir « Aura… » là où les deux tiennent : elle s\'ajoute');
  egal(affichees(ouvrirColonne(aux, 'complements'), false), { artefacts: false, complements: true }, 'ouvrir une colonne déjà ouverte ne la referme pas');
}
