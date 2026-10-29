// Les configurations et onglets du bureau (src/lib/optimizerColonnes.ts).
import { attenteResultats, configurationBureau, ongletOuvert, LARGEURS_BUREAU, RETRAIT_PANNEAU, SEUILS_BUREAU } from '../src/lib/optimizerColonnes';
import { LARGEUR_MONSTRE } from '../src/components/outils/optimizer/bureau/ListeDeTravailBureau';
import { LARGEUR_ARTEFACTS } from '../src/components/outils/optimizer/bureau/ArtefactsEtReliqueBureau';
import { LARGEUR_COMPLEMENTS } from '../src/components/outils/optimizer/bureau/SetsAuraBureau';
import { colonnesCoffre } from '../src/lib/coffreSets';
import { egal, ok, titre } from './outils';

// La grille des sets dans son coffre : 3 + 4 colonnes, puis le principal à
// 2, puis le secondaire à 3 et à 2, puis le principal à 1, et le secondaire
// à 1 en dernier recours (boutons de 32 px, écarts de 4, 9 px entre les
// groupes : 4 de marge de chaque côté du trait).
export function testOptimizerColonnesCoffreSets() {
  titre('Optimizer · colonnes de la grille des sets selon la largeur du coffre');
  const cas: [number, number, number][] = [
    [400, 3, 4], [253, 3, 4], [252, 2, 4], [217, 2, 4], [216, 2, 3], [181, 2, 3], [180, 2, 2], [145, 2, 2],
    [144, 1, 2], [109, 1, 2], [108, 1, 1], [60, 1, 1],
  ];
  for (const [largeur, principal, secondaire] of cas) {
    egal(colonnesCoffre(largeur), { principal, secondaire }, `${largeur} px : ${principal} + ${secondaire} colonnes`);
  }
}

export function testOptimizerColonnes() {
  titre('Optimizer · configuration des colonnes selon la largeur');
  egal(LARGEURS_BUREAU, { monstre: 384, reglage: 320, resultats: 360, gouttiere: 16 }, 'places de la spec');
  egal([LARGEUR_MONSTRE, LARGEUR_ARTEFACTS, LARGEUR_COMPLEMENTS], [384, 320, 320], 'les composants déclarent les mêmes places');
  egal(RETRAIT_PANNEAU, 8, '16 + 8 = 24 entre panneaux');
  egal(SEUILS_BUREAU, { groupe: 1096, criteresEtGroupe: 1432, colonnes: 1768 }, 'seuils calculés sur les places');
  const cas = [
    [751, 'deux-piles'], [752, 'deux-piles'], [753, 'deux-piles'],
    [1095, 'deux-piles'], [1096, 'groupe'], [1097, 'groupe'],
    [1431, 'groupe'], [1432, 'criteres-et-groupe'], [1433, 'criteres-et-groupe'],
    [1767, 'criteres-et-groupe'], [1768, 'colonnes'], [1769, 'colonnes'],
  ] as const;
  for (const [largeur, configuration] of cas) egal(configurationBureau(largeur).configuration, configuration, `${largeur} px : ${configuration}`);
  egal(configurationBureau(752), { configuration: 'deux-piles', colonnes: [], groupe: ['criteres', 'artefacts', 'complements'], deuxPiles: true }, 'minimum de bureau : deux piles et groupe de trois');
  egal(752 - LARGEURS_BUREAU.monstre - LARGEURS_BUREAU.gouttiere, 352, 'la pile de droite reçoit 352 px au minimum');
  egal(configurationBureau(1096), { configuration: 'groupe', colonnes: [], groupe: ['criteres', 'artefacts', 'complements'], deuxPiles: false }, 'groupe de trois à côté des résultats');
  egal(configurationBureau(1432), { configuration: 'criteres-et-groupe', colonnes: ['criteres'], groupe: ['artefacts', 'complements'], deuxPiles: false }, 'Critères puis groupe de deux');
  egal(configurationBureau(1768), { configuration: 'colonnes', colonnes: ['criteres', 'artefacts', 'complements'], groupe: [], deuxPiles: false }, 'les cinq colonnes, aucun onglet');
  for (const [largeur] of cas) {
    const d = configurationBureau(largeur);
    ok(d.groupe.length !== 1, `${largeur} : jamais de groupe à un seul onglet`);
    egal([...d.colonnes, ...d.groupe], ['criteres', 'artefacts', 'complements'], 'chaque réglage apparaît une seule fois, dans son ordre');
  }
}

export function testOptimizerColonnesOnglet() {
  titre('Optimizer · onglet gardé ou remplacé au redimensionnement');
  const trois = configurationBureau(1264).groupe, deux = configurationBureau(1648).groupe;
  egal(ongletOuvert(trois, null), 'criteres', 'premier onglet au départ');
  egal(ongletOuvert(deux, null), 'artefacts', 'premier du groupe de deux au départ');
  egal(ongletOuvert(trois, 'complements'), 'complements', 'onglet précédent gardé');
  egal(ongletOuvert(deux, 'criteres'), 'artefacts', 'Critères devenu colonne : premier du groupe');
  egal(ongletOuvert(deux, 'complements'), 'complements', 'Options reste dans le groupe');
  egal(ongletOuvert(trois, 'artefacts'), 'artefacts', 'le groupe agrandi conserve Artéfacts');
  egal(ongletOuvert([], 'complements'), null, 'aucun groupe : aucun onglet');
  egal(ongletOuvert(trois, ongletOuvert([], 'complements')), 'criteres', 'au retour du groupe : premier onglet');
  egal(ongletOuvert(configurationBureau(792).groupe, 'complements'), 'complements', 'passer en deux piles garde Options');
  for (const largeur of [792, 1112, 1264, 1648, 2288]) {
    const groupe = configurationBureau(largeur).groupe;
    const avant = ongletOuvert(groupe, 'complements');
    egal(ongletOuvert(groupe, avant), avant, 'une recherche ne fournit aucun changement de groupe ni guidage');
  }
}

export function testOptimizerColonnesGuidages() {
  titre('Optimizer · guidages vers les réglages rangés');
  const trois = configurationBureau(1264).groupe, deux = configurationBureau(1648).groupe;
  egal(ongletOuvert(trois, 'artefacts', 'criteres'), 'criteres', 'Rechercher sans set ouvre Critères');
  egal(ongletOuvert(trois, 'criteres', 'complements'), 'complements', 'auras RES/PRE : Options');
  egal(ongletOuvert(deux, 'artefacts', 'complements'), 'complements', 'guidage Options dans le groupe de deux');
  egal(ongletOuvert(deux, 'complements', 'criteres'), 'complements', 'Critères déjà en colonne : aucun changement du groupe');
  egal(ongletOuvert([], null, 'complements'), null, 'Options déjà en colonne : aucun onglet créé');
  egal(ongletOuvert(trois, 'complements', 'complements'), 'complements', 'un guidage ne referme jamais sa cible');
  egal(ongletOuvert(configurationBureau(752).groupe, 'complements', 'criteres'), 'criteres', 'guidage vers le set aussi dans la pile');
}

export function testOptimizerColonnesAttenteResultats() {
  titre("Optimizer · place d'attente des résultats au bureau");
  egal(attenteResultats(false, false, 'idle'), 'sans-monstre', 'aucun monstre');
  egal(attenteResultats(false, true, 'done'), 'sans-monstre', 'aucun monstre, même avec des résultats');
  egal(attenteResultats(true, false, 'idle'), 'sans-recherche', 'un monstre, aucune recherche');
  egal((['running', 'done', 'error', 'refused'] as const).map(s => attenteResultats(true, false, s)), ['sans-carte', 'sans-carte', 'sans-carte', 'sans-carte'], 'recherche sans carte : cadre seul');
  egal(attenteResultats(true, true, 'running'), null, 'des cartes : les résultats');
}
