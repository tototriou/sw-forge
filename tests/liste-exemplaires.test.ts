// Lot EX de degats-et-aura — plusieurs exemplaires Box d'une même espèce dans
// une liste de travail.
//
// Les membres d'une liste sont repérés par EXEMPLAIRE (`exclusionSelectorKey`,
// Box = `box:<unitKey>`) depuis le lot 3 ; ce qui manquait, c'est le chemin à
// l'écran. Choisir l'espèce prend le premier exemplaire Box (`pickSpecies`),
// le bouton affichait alors « Déjà dans « … » », désactivé, et rien ne disait
// qu'un autre exemplaire existait.
//
// La décision est pure (`etatAjoutListe`, `exemplaireBoxHorsListe`,
// `libellePuceSource`, optimizerExclusion.ts) ; l'écran ne fait que la
// brancher, ce que vérifient les contrôles de source plus bas (pas de test de
// rendu, ARCHITECTURE.md § 9).

import { readFileSync } from 'node:fs';
import { egal, ok, titre } from './outils';
import type { GearSet, Monster } from '../src/types';
import {
  etatAjoutListe,
  exclusionSelectorKey,
  exemplaireBoxHorsListe,
  libellePuceSource,
  type ExclusionCandidate,
  type ExclusionSelector,
  type OptimizerListMember,
} from '../src/lib/optimizerExclusion';

const lireSansCommentaires = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
// Le texte de `debut` (inclus) jusqu'à `fin` (exclu), cherché après `debut` ; vide si l'un manque.
const entre = (source: string, debut: string, fin: string) => {
  const i = source.indexOf(debut);
  const j = i >= 0 ? source.indexOf(fin, i + debut.length) : -1;
  return i >= 0 && j >= 0 ? source.slice(i, j) : '';
};

const LUSHEN: Monster = {
  id: 14104,
  com2usId: 14104,
  name: 'Lushen',
  element: 'wind',
  stars: 6,
  naturalStars: 4,
  secondAwaken: false,
  image: null,
  stats: { hp: 0, attack: 0, defense: 0, speed: 0, critRate: 0, critDamage: 0, resistance: 0, accuracy: 0 },
  leaderSkill: null,
};
const NU: GearSet = { runes: [], artifacts: [] } as unknown as GearSet;
const box = (unitKey: string): ExclusionCandidate => ({ selector: { source: 'box', unitKey }, monster: LUSHEN, gear: NU });
const membre = (listId: string, selector: ExclusionSelector): OptimizerListMember => ({ listId, selector });

export function testListeExemplaires() {
  titre('Liste de travail · un autre exemplaire Box de la même espèce : le bouton enchaîne, la puce dit le nombre (lot EX)');

  const [a, b, c] = [box('u-a'), box('u-b'), box('u-c')];
  const candidats = [a, b, c];

  // ── Exemplaire suivant : premier Box, dans l'ordre de la zone D, absent de la liste.
  egal(exemplaireBoxHorsListe(candidats, [membre('L', a.selector)]), b, 'A membre : le suivant est B');
  egal(exemplaireBoxHorsListe(candidats, [membre('L', c.selector), membre('L', a.selector)]), b,
    'A et C membres (C ajouté avant A) : B, l’ordre est celui de la zone D, pas celui des membres');
  egal(exemplaireBoxHorsListe(candidats, [membre('L', a.selector), membre('L', b.selector)]), c, 'A et B membres : C');
  egal(exemplaireBoxHorsListe(candidats, candidats.map((x) => membre('L', x.selector))), null, 'tous membres : aucun');
  egal(exemplaireBoxHorsListe([], []), null, 'aucun exemplaire Box : aucun');

  // ── État du bouton.
  const base = {
    monstre: 'Lushen',
    selecteur: a.selector as ExclusionSelector | null,
    listeActiveId: 'L' as string | null,
    nomListe: 'GB12',
    membres: [membre('L', a.selector)],
    candidatsBox: candidats,
  };

  const enchaine = etatAjoutListe(base);
  egal(enchaine.libelle, 'Ajouter un autre exemplaire de Lushen à « GB12 »', 'affiché membre, un autre Box absent : libellé du contrat A');
  ok(enchaine.actif, '… et le bouton est actif');
  egal(enchaine.exemplaireSuivant, b, '… et un clic vise B, jamais A déjà membre');
  ok(enchaine.exemplaireSuivant !== null
    && exclusionSelectorKey(enchaine.exemplaireSuivant.selector) !== exclusionSelectorKey(base.selecteur!),
  'mutation gardée : le clic ne reprend jamais l’exemplaire déjà membre');

  const tous = etatAjoutListe({ ...base, membres: candidats.map((x) => membre('L', x.selector)) });
  egal(tous.libelle, 'Déjà dans « GB12 »', 'tous les exemplaires Box membres : « Déjà dans »');
  ok(!tous.actif && tous.exemplaireSuivant === null, '… désactivé, comme avant');

  const autreListe = etatAjoutListe({ ...base, membres: [membre('L', a.selector), membre('M', b.selector), membre('M', c.selector)] });
  egal(autreListe.exemplaireSuivant, b, 'les membres d’une AUTRE liste ne comptent pas');

  const rtaMembre = etatAjoutListe({ ...base, membres: [membre('L', a.selector), membre('L', { source: 'rta', monsterId: '77' })] });
  egal(rtaMembre.exemplaireSuivant, b, 'un membre RTA de la même espèce n’occupe aucun exemplaire Box');

  // Lot EX2 : « un autre exemplaire » seulement si l'exemplaire AFFICHÉ vient de la Box.
  // Venu de RTA ou du siège, l'exemplaire Box proposé pouvait être le même monstre physique.
  const rta: ExclusionSelector = { source: 'rta', monsterId: '77' };
  const rtaAffiche = etatAjoutListe({ ...base, selecteur: rta, membres: [membre('L', rta)] });
  egal(rtaAffiche.libelle, 'Déjà dans « GB12 »', 'affiché RTA et membre, un Box absent : « Déjà dans » (lot EX2)');
  ok(!rtaAffiche.actif && rtaAffiche.exemplaireSuivant === null, '… désactivé, aucun exemplaire suivant');
  const siege: ExclusionSelector = { source: 'siege-defense', teamId: 't1', slotIndex: 0 };
  const siegeAffiche = etatAjoutListe({ ...base, selecteur: siege, membres: [membre('L', siege)] });
  egal(siegeAffiche.libelle, 'Déjà dans « GB12 »', 'affiché siège et membre, un Box absent : « Déjà dans » (lot EX2)');
  ok(!siegeAffiche.actif && siegeAffiche.exemplaireSuivant === null, '… désactivé, aucun exemplaire suivant');

  const nonMembre = etatAjoutListe({ ...base, selecteur: b.selector, membres: [membre('L', a.selector)] });
  egal(nonMembre.libelle, 'Ajouter Lushen à « GB12 »', 'affiché non membre : libellé inchangé');
  ok(nonMembre.actif && nonMembre.exemplaireSuivant === null, '… actif, et le clic ajoute l’exemplaire affiché');

  const sansListe = etatAjoutListe({ ...base, listeActiveId: null, nomListe: '' });
  egal(sansListe.libelle, 'Créer une liste et y ajouter Lushen', 'sans liste active : libellé inchangé');
  ok(sansListe.actif && sansListe.exemplaireSuivant === null, '… actif, aucun changement d’exemplaire');

  const rien = etatAjoutListe({ ...base, monstre: null, selecteur: null });
  egal(rien.libelle, 'Ajouter à la liste', 'aucun monstre choisi : « Ajouter à la liste »');
  ok(!rien.actif, '… désactivé');
  const nonResolu = etatAjoutListe({ ...base, selecteur: null });
  ok(!nonResolu.actif && nonResolu.libelle === 'Ajouter à la liste', 'exemplaire pas encore désambiguïsé (zone D) : désactivé');

  const unowned: ExclusionSelector = { source: 'unowned', monsterId: '14104' };
  const nonPossede = etatAjoutListe({ ...base, selecteur: unowned, membres: [], candidatsBox: [] });
  egal(nonPossede.libelle, 'Ajouter Lushen (non possédé) à « GB12 »', 'non possédé : suffixe inchangé');
  egal(etatAjoutListe({ ...base, selecteur: unowned, listeActiveId: null, membres: [], candidatsBox: [] }).libelle,
    'Créer une liste et y ajouter Lushen (non possédé)', 'non possédé sans liste : inchangé');
  const nonPossedeMembre = etatAjoutListe({ ...base, selecteur: unowned, membres: [membre('L', unowned)], candidatsBox: [] });
  ok(nonPossedeMembre.libelle === 'Déjà dans « GB12 »' && !nonPossedeMembre.actif, 'non possédé déjà membre : « Déjà dans », désactivé');

  // ── Puce de source : `{source} · {n}` à deux exemplaires ou plus.
  egal(libellePuceSource('Box', 0), 'Box', 'zéro exemplaire : libellé gardé');
  egal(libellePuceSource('Box', 1), 'Box', 'un exemplaire : libellé gardé');
  egal(libellePuceSource('Box', 2), 'Box · 2', 'deux exemplaires : « Box · 2 »');
  egal(libellePuceSource('Défenses siège', 3), 'Défenses siège · 3', 'même règle pour les autres sources');

  // ── Branchement à l'écran.
  const ecran = lireSansCommentaires('src/components/outils/OptimizerSection.tsx');
  ok(/const sourceOptions = SOURCE_OPTIONS\.map\(\(o\) => \(\{[^;]*label: libellePuceSource\(o\.label, candidatesBySource\[o\.key\]\.length\)/.test(ecran),
    'source : les quatre puces passent par libellePuceSource, sur le compte de leur source');
  ok(/const ajoutListe = etatAjoutListe\(\{[\s\S]{0,400}?candidatsBox: candidatesBySource\.box,/.test(ecran),
    'source : l’état du bouton vient de etatAjoutListe, sur les exemplaires Box de la zone D');
  ok(/libelle=\{ajoutListe\.libelle\}/.test(ecran) && /disabled=\{!ajoutListe\.actif\}/.test(ecran),
    'source : libellé et désactivation du bouton viennent de cet état');
  const ajout = entre(ecran, 'function handleAddToList(', 'const displayedRuneIds');
  ok(/const suivant = ajoutListe\.exemplaireSuivant;/.test(ajout)
    && /choisirExemplaire\(suivant\.selector, suivant\.monster\);\s*lists\.addMember\(lists\.activeListId, suivant\.selector\);/.test(ajout),
  'source : le clic change d’exemplaire PUIS ajoute l’exemplaire suivant, jamais celui déjà membre');
  ok(ajout.length > 0 && !/doitRappeler|setRappelAuras/.test(ajout), 'source : le bouton ne rappelle pas les auras externes');

  // Un seul chemin de changement d'exemplaire (6bis-b19), partagé avec la zone C.
  const chemin = entre(ecran, 'function choisirExemplaire(', 'function handleAddToList(');
  ok(/if \(id !== selectedId\) resetSearch\(\);\s*else if \(key !== ownSelectorKey\) effacerResultats\(\);/.test(chemin)
    && chemin.includes('setSourceSelector(selector);') && chemin.includes('setZoneDOpen(false);'),
  'source : choisirExemplaire porte les règles de 6bis-b19 (résultats effacés, critères gardés)');
  ok(chemin.length > 0 && !/doitRappeler|setRappelAuras/.test(chemin), 'source : ce chemin ne rappelle rien par lui-même');
  const zoneC = ecran.slice(Math.max(0, ecran.indexOf('const zoneCContent = (')));
  const clic = entre(zoneC, 'onClick={() => {', 'className="flex min-w-0 flex-1 items-center gap-2 text-left"');
  ok(/choisirExemplaire\(m\.selector, resolved\.monster\);/.test(clic), 'source : la zone C passe par le même chemin');
  egal(ecran.match(/effacerResultats\(\)/g)?.length ?? 0, 1, 'source : effacerResultats n’est appelé qu’à un endroit (pas de seconde écriture)');
}
