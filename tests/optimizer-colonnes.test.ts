// Les colonnes repliables de l'Optimizer au bureau et leur contrôle à onglets
// (src/lib/optimizerColonnes.ts).

import {
  AUCUNE_COLONNE, COLONNE_DROITE_OBJECTIF_A_COTE, attenteResultats, LARGEURS_BUREAU, SEUILS_BUREAU, agencementBureau, basculerColonne, colonnesAffichees,
  colonnesParDefaut, deuxColonnesTiennent, formeObjectifBureau, largeurColonneDroite, ouvrirColonne, type ColonnesOuvertes,
} from '../src/lib/optimizerColonnes';
import { LARGEUR_OBJECTIF_ETROIT } from '../src/components/outils/optimizer/bureau/ObjectifEtRechercherBureau';
import { LARGEUR_ESSENTIELS } from '../src/components/outils/optimizer/bureau/ListeDeTravailBureau';
import { LARGEUR_ARTEFACTS } from '../src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau';
import { LARGEUR_COMPLEMENTS } from '../src/components/outils/optimizer/bureau/SetsAuraBureau';
import { LARGEUR_EXEMPLAIRE, LARGEUR_EXEMPLAIRE_MIN } from '../src/components/outils/optimizer/bureau/ExemplaireBureau';
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
  egal({ ...SEUILS_BUREAU }, { a2: 904, a3: 952, artefactsInseree: 1496, complementsInseree: 1496, deuxInserees: 1832 },
    'seuils : 548 + 16 + 340 ; 548 + 16 + 388 (fiche repliée) ; une colonne de 320 + 16 insérée, fiche dépliée (596) ; les deux');
  egal([LARGEUR_ESSENTIELS, LARGEUR_ARTEFACTS, LARGEUR_COMPLEMENTS, LARGEUR_EXEMPLAIRE, LARGEUR_EXEMPLAIRE_MIN],
    [LARGEURS_BUREAU.essentiels, LARGEURS_BUREAU.artefacts, LARGEURS_BUREAU.complements, LARGEURS_BUREAU.exemplaire, LARGEURS_BUREAU.exemplaireMin],
    'les composants de bureau déclarent les largeurs d\'où viennent les seuils');
  egal([728, 903, 904, 951, 952, 2254].map(agencementBureau), ['A1', 'A1', 'A2', 'A2', 'A3', 'A3'], 'A1 [728, 904[, A2 [904, 952[, A3 dès 952');
  egal([1831, 1832, null].map(deuxColonnesTiennent), [false, true, false], 'les deux colonnes ensemble dès 1832 seulement');

  const ouverte = { artefacts: true, complements: false, derniere: 'artefacts' };
  egal(colonnesParDefaut(758), ouverte, 'défaut en A1 (758) : « Artéfacts et relique » ouverte');
  egal(colonnesParDefaut(930), ouverte, 'défaut en A2 (930) : ouverte');
  egal(colonnesParDefaut(1078), AUCUNE_COLONNE, 'défaut en A3 sous 1496 (1078) : aucune, pas de panneau superposé ouvert d\'office');
  egal(colonnesParDefaut(1495), AUCUNE_COLONNE, 'défaut à 1495 : aucune');
  egal(colonnesParDefaut(1496), ouverte, 'défaut dès 1496 : ouverte, insérée');
  egal(colonnesParDefaut(null), ouverte, 'défaut sans largeur (rendu serveur) : ouverte');

  // Le guidage vers l'interrupteur des auras RES/PRE ouvre sans refermer.
  const aux = ouvrirColonne(ouverte as ColonnesOuvertes, 'complements');
  egal(affichees(aux, false), { artefacts: false, complements: true }, 'ouvrir « Aura… » là où une seule tient : elle seule');
  egal(affichees(aux, true), { artefacts: true, complements: true }, 'ouvrir « Aura… » là où les deux tiennent : elle s\'ajoute');
  egal(affichees(ouvrirColonne(aux, 'complements'), false), { artefacts: false, complements: true }, 'ouvrir une colonne déjà ouverte ne la referme pas');
}

// La forme du bloc « Objectif et Rechercher » : étroite à côté d'« Exemplaire »
// quand la colonne de droite fait au moins 596 + 16 + 340, large dessous sinon,
// étroite en A2, large en A1. Seules la largeur et les colonnes affichées la
// décident (rien de la recherche n'y entre : elle ne change pas au lancement).
export function testOptimizerFormeObjectifBureau() {
  titre('Optimizer · forme du bloc « Objectif et Rechercher » au bureau');
  const aucune = { artefacts: false, complements: false };
  const art = { artefacts: true, complements: false };
  const aux = { artefacts: false, complements: true };
  const deux = { artefacts: true, complements: true };
  egal(COLONNE_DROITE_OBJECTIF_A_COTE, 952, 'à côté d\'« Exemplaire » : 596 (fiche dépliée) + 16 + 340');
  egal(LARGEUR_OBJECTIF_ETROIT, LARGEURS_BUREAU.objectifEtroit, 'le bloc déclare la largeur d\'où vient le seuil');
  egal([758, 903].map((l) => formeObjectifBureau(l, art)), ['large', 'large'], 'A1 : large');
  egal([904, 930, 951].map((l) => formeObjectifBureau(l, art)), ['etroite', 'etroite', 'etroite'], 'A2 : étroite, à droite des essentiels');
  egal(formeObjectifBureau(null, art), 'large', 'largeur inconnue : large');

  // A3 : la colonne de droite décide, et seules les colonnes INSÉRÉES comptent.
  egal(largeurColonneDroite(952, aucune), 388, 'au seuil de A3, la colonne de droite a sa largeur minimale (fiche repliée)');
  egal(formeObjectifBureau(952, aucune), 'large', '952 : colonne de droite de 388, large');
  egal(largeurColonneDroite(1230, art), 666, '1230, « Artéfacts » superposée : elle ne prend aucune place');
  egal(formeObjectifBureau(1230, art), 'large', '1230 : colonne de droite de 666, large');
  egal([1515, 1516].map((l) => formeObjectifBureau(l, aucune)), ['large', 'etroite'], 'sans colonne insérée : étroite dès 1516 (952 de colonne)');
  egal(largeurColonneDroite(1614, art), 714, '1614, « Artéfacts » insérée : 1614 − 564 − 336');
  egal([formeObjectifBureau(1614, art), formeObjectifBureau(1614, aucune)], ['large', 'etroite'], '1614 : large avec « Artéfacts » insérée, étroite sans');
  egal(formeObjectifBureau(1614, aux), 'large', '1614 : « Aura… » insérée (336), large');
  egal([1851, 1852].map((l) => formeObjectifBureau(l, art)), ['large', 'etroite'], '« Artéfacts » insérée : étroite dès 1852');
  egal([1851, 1852].map((l) => formeObjectifBureau(l, aux)), ['large', 'etroite'], '« Aura… » insérée : étroite dès 1852 (même largeur)');
  egal(largeurColonneDroite(2254, deux), 1018, '2254, les deux insérées : 2254 − 564 − 336 − 336');
  egal(formeObjectifBureau(2254, deux), 'etroite', '2254 : étroite, les deux colonnes insérées');
}

// La place d'attente des résultats : sa phrase ne dit jamais « aucune
// recherche lancée » pendant (ou après) une recherche encore sans carte.
export function testOptimizerAttenteResultats() {
  titre('Optimizer · place d\'attente des résultats au bureau');
  egal(attenteResultats(false, false, 'idle'), 'sans-monstre', 'aucun monstre');
  egal(attenteResultats(false, true, 'done'), 'sans-monstre', 'aucun monstre, même avec des résultats d\'avant');
  egal(attenteResultats(true, false, 'idle'), 'sans-recherche', 'un monstre, aucune recherche');
  egal((['running', 'done', 'error', 'refused'] as const).map((s) => attenteResultats(true, false, s)),
    ['sans-carte', 'sans-carte', 'sans-carte', 'sans-carte'], 'recherche lancée sans carte (en cours, finie, erreur, refus) : le cadre seul');
  egal(attenteResultats(true, true, 'running'), null, 'des cartes : les résultats');
}
