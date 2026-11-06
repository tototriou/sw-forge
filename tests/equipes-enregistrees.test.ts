import { egal, ok, titre } from './outils';
import type { ArtifactDetail, GearSet, Monster, RelicDetail, RuneDetail } from '../src/types';
import type { BoxItem } from '../src/lib/applyAccount';
import {
  ajouterMonstre, comparerPiece, compteParOnglet, creerEquipe, deplacerMonstre, designerLeader, dupliquerEquipe,
  equipesFiltrees, gesteSurBrouillon, etatExemplaire, etatPiece, indexerInventaire, lireEquipeEnregistree, modifierTextes,
  nomEquipeLibre, resumeEcarts, retirerMonstre, retirerRelique, type EquipeEnregistree, type MonstreEnregistre,
} from '../src/lib/equipesEnregistrees';

const T0 = new Date('2026-11-05T10:00:00Z');
const T1 = new Date('2026-11-05T11:00:00Z');

export function runeEx(id: number, slot: number, valeur = 10): RuneDetail {
  return { id, slot, set: 'swift', rank: 6, rarity: 5, level: 15, main: { code: 8, value: 42 },
    subs: [{ code: 2, value: valeur, grind: 0 }, { code: 9, value: 6 }] };
}
export function artefactEx(id: number, kind: 'element' | 'archetype'): ArtifactDetail {
  return { id, kind, ...(kind === 'element' ? { element: 'fire' as const } : { archetype: 'attack' as const }),
    level: 15, rarity: 5, main: { code: 100, value: 160 }, subs: [{ code: 200, value: 5 }] };
}
export const reliqueEx = (id: number): RelicDetail => ({ id, upgrade: 15, main: { code: 100, value: 20 } });
export function equipementEx(premiereRune = 1): GearSet {
  return { base: { hp: 10000, atk: 700, def: 600, spd: 101, cr: 15, cd: 50, res: 15, acc: 0 },
    runes: [1, 2, 3, 4, 5, 6].map((s) => runeEx(premiereRune + s - 1, s)),
    artifacts: [artefactEx(premiereRune * 10, 'element'), artefactEx(premiereRune * 10 + 1, 'archetype')], relic: reliqueEx(premiereRune * 100) };
}
export function monstreEx(uid: string, com2usId: number, unitId: number | null, eq: GearSet | null = equipementEx()): MonstreEnregistre {
  return { uid, com2usId, unitId, provenance: eq ? 'porte' : 'aucun', equipement: eq };
}
function monstreJeu(com2usId: number, jumeauCollab?: number): Monster {
  return { id: com2usId, com2usId, name: `M${com2usId}`, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 1, attack: 1, defense: 1, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
    leaderSkill: null, ...(jumeauCollab ? { jumeauCollab } : {}) } as Monster;
}

function testEquipesEnregistreesRelecture() {
  titre('Mes équipes — relecture d’une équipe enregistrée');
  const base = creerEquipe('e1', 'siege-defense', 'Équipe 1', T0);
  const e: EquipeEnregistree = { ...base, monstres: [monstreEx('a', 1, 11), monstreEx('b', 2, null, null)], leader: 'a' };
  const lu = lireEquipeEnregistree(JSON.parse(JSON.stringify(e)));
  egal(lu?.equipe, e, 'une équipe valide se relit à l’identique');
  egal(lu?.signalements, [], 'sans signalement');
  for (const n of [0, 1]) ok(lireEquipeEnregistree({ ...e, monstres: e.monstres.slice(0, n) }) === null, `${n} monstre : illisible, une équipe en a au moins deux`);
  ok(lireEquipeEnregistree({ ...e, onglet: 'inconnu' }) === null, 'un onglet inconnu rend l’équipe illisible');
  ok(lireEquipeEnregistree({ ...e, monstres: [1, 2, 3, 4, 5, 6, 7].map((i) => monstreEx(`u${i}`, i, null)) }) === null, 'plus de 6 monstres : illisible');
  ok(lireEquipeEnregistree({ ...e, monstres: [monstreEx('a', 1, 11), monstreEx('a', 2, 12)] }) === null, 'deux uid identiques : illisible');
  const mauvaisLeader = lireEquipeEnregistree({ ...e, leader: 'zz' });
  egal([mauvaisLeader?.equipe.leader, mauvaisLeader?.signalements], [null, ['leaderRetire']], 'un leader absent est retiré et signalé');
  const st = lireEquipeEnregistree({ ...e, speedTune: { plan: { version: 99 }, liens: [
    { uid: 'l1', monstre: 'a', attache: true, repli: { vitesseMin: 200, effet206: 0 } },
    { uid: 'l2', monstre: 'inconnu', attache: true, repli: { vitesseMin: null, effet206: 0 } },
  ] } });
  ok(st !== null, 'un speed tune malformé ne rejette jamais l’équipe');
  egal(st?.equipe.speedTune?.plan, null, 'le plan illisible devient null');
  egal(st?.equipe.speedTune?.liens.map((l) => l.uid), ['l1'], 'le lien vers un monstre absent est retiré');
  egal(st?.signalements, ['speedTuneIncomplet'], 'et la dégradation est signalée');
  const lien = lireEquipeEnregistree({ ...e, lienOptimizer: { listId: 'L', equipeId: 'E', correspondance: [{ uid: 'a', selecteur: { source: 'box', unitKey: '11' } }] } });
  egal(lien?.equipe.lienOptimizer?.correspondance.length, 1, 'un lien valide se relit');
  const sansEquipe = lireEquipeEnregistree({ ...e, lienOptimizer: { listId: 'L', equipeId: null, correspondance: [] } });
  egal([sansEquipe?.equipe.lienOptimizer, sansEquipe?.signalements], [undefined, ['lienOptimizerRetire']], 'un lien sans équipe de l’Optimizer est retiré et signalé');
  egal(lireEquipeEnregistree({ ...e, lienOptimizer: { listId: 'L' } })?.signalements, ['lienOptimizerRetire'], 'un lien malformé est retiré et signalé');
}

function testEquipesEnregistreesComparaison() {
  titre('Mes équipes — comparaison des pièces au compte');
  const r = runeEx(1, 1);
  ok(comparerPiece(r, { ...r, marker: 3 }), 'le marqueur posé en jeu n’entre pas dans la comparaison');
  ok(!comparerPiece(r, { ...r, level: 12 }), 'un niveau différent : modifiée');
  ok(!comparerPiece(r, { ...r, subs: [{ code: 2, value: 10, grind: 4 }, r.subs[1]] }), 'une meule différente : modifiée');
  ok(!comparerPiece(r, { ...r, subs: [r.subs[1], r.subs[0]] }), 'l’ordre des lignes compte');
  ok(!comparerPiece(r, { ...r, nouveauChamp: 1 }), 'un champ ajouté au type est comparé');
  ok(!comparerPiece({ ...r, nouveauChamp: 1 }, r), 'dans les deux sens : un champ absent de la pièce actuelle compte aussi');
  ok(!comparerPiece({ ...r, innate: { code: 4, value: 3 } }, r), 'une innée perdue : modifiée');
  const inv = indexerInventaire([r, { ...runeEx(2, 2), level: 9 }], [artefactEx(10, 'element')], [reliqueEx(100)]);
  egal(etatPiece('rune', r, inv), 'identique', 'pièce identique');
  egal(etatPiece('rune', runeEx(2, 2), inv), 'modifiee', 'pièce modifiée');
  egal(etatPiece('rune', runeEx(3, 3), inv), 'disparue', 'pièce disparue');
  egal(etatPiece('artefact', artefactEx(0, 'element'), inv), 'hors-compte', 'une pièce synthétique n’est jamais comparée');
  const e = { ...creerEquipe('e', 'rta', 'E', T0), monstres: [monstreEx('a', 1, 11)] };
  egal(resumeEcarts(e, inv), { modifiees: 1, disparues: 4 + 1 }, 'résumé : 1 modifiée, 4 runes et 1 artéfact disparus');
  const box: BoxItem[] = [{ key: '11', monster: monstreJeu(1), stars: 6, level: 40, gear: equipementEx() }];
  egal(etatExemplaire(monstreEx('a', 1, 11), box), 'equipe-ainsi', 'l’exemplaire porte exactement l’enregistré');
  egal(etatExemplaire(monstreEx('a', 1, 11, equipementEx(2)), box), 'equipe-autrement', 'il porte autre chose');
  egal(etatExemplaire(monstreEx('a', 1, 99), box), 'absent', 'exemplaire absent de la Box');
  egal(etatExemplaire(monstreEx('a', 1, null), box), null, 'unitId inconnu : aucune ligne');
  egal(etatExemplaire(monstreEx('a', 1, 11, null), box), null, 'sans équipement : aucune ligne');
}

function testEquipesEnregistreesOperations() {
  titre('Mes équipes — composition, leader, speed tune, duplication');
  // « Nouvelle équipe » : brouillon jusqu'au deuxième monstre, puis équipe à enregistrer.
  const b0 = creerEquipe('n', 'pve', 'N', T0);
  const b1 = gesteSurBrouillon(b0, (x, n) => ajouterMonstre(x, monstreEx('a', 1, null), n)!, T1);
  egal([b1.brouillon?.monstres.length, b1.aEnregistrer], [1, null], 'un monstre : encore un brouillon, rien à enregistrer');
  const b2 = gesteSurBrouillon(b1.brouillon!, (x, n) => ajouterMonstre(x, monstreEx('b', 2, null), n)!, T1);
  egal([b2.brouillon, b2.aEnregistrer?.monstres.length], [null, 2], 'deux monstres : l’équipe s’enregistre');
  let e = creerEquipe('e', 'pve', 'E', T0);
  for (const [uid, id] of [['a', 1], ['b', 2], ['c', 3]] as const) e = ajouterMonstre(e, monstreEx(uid, id, null), T1)!;
  e = designerLeader(e, 'b', T1);
  e = { ...e, speedTune: { plan: null, liens: [
    { uid: 'l1', monstre: 'b', attache: true, repli: { vitesseMin: 200, effet206: 0 } },
    { uid: 'l2', monstre: 'c', attache: false, repli: { vitesseMin: null, effet206: 12 } },
  ] } };
  const reordonnee = deplacerMonstre(e, 'c', 0, T1);
  egal(reordonnee.monstres.map((m) => m.uid), ['c', 'a', 'b'], 'réordonner déplace le monstre');
  egal([reordonnee.leader, reordonnee.speedTune?.liens.map((l) => l.monstre)], ['b', ['b', 'c']], 'et ne change aucune désignation');
  const sansB = retirerMonstre(e, 'b', T1);
  egal([sansB.leader, sansB.speedTune?.liens.map((l) => l.uid)], [null, ['l2']], 'retirer le leader remet le leader à null et retire ses liens');
  const sansRelique = retirerRelique(e, e.monstres[0].uid, T1);
  ok(sansRelique.monstres[0].equipement !== null && sansRelique.monstres[0].equipement.relic === undefined
    && sansRelique.monstres[0].equipement.runes.length === e.monstres[0].equipement!.runes.length, 'retirer la relique ne retire qu’elle');
  ok(e.monstres[0].equipement?.relic !== undefined, 'sans toucher à l’équipe d’origine');
  ok(ajouterMonstre({ ...e, monstres: [1, 2, 3, 4, 5, 6].map((i) => monstreEx(`u${i}`, i, null)) }, monstreEx('z', 9, null), T1) === null, 'pas de 7ᵉ monstre');
  egal(modifierTextes(e, { nom: '  Nouvelle  ', note: ' n ' }, T1).nom, 'Nouvelle', 'le nom est trimé');
  egal(modifierTextes(e, { nom: '   ' }, T1).nom, 'E', 'un nom vide garde l’ancien');
  let n = 0;
  const lie = { ...e, lienOptimizer: { listId: 'L', equipeId: 'T', correspondance: [] } };
  const copie = dupliquerEquipe(lie, 'e2', 'E (2)', () => `n${++n}`, T1);
  egal(copie.monstres.map((m) => m.uid), ['n1', 'n2', 'n3'], 'la copie a de nouveaux uid');
  egal([copie.leader, copie.speedTune?.liens.map((l) => [l.uid, l.monstre])], ['n2', [['l1', 'n2'], ['l2', 'n3']]], 'leader et liens suivent la correspondance ; les lignes gardent leur uid');
  ok(copie.lienOptimizer === undefined, 'la copie n’a pas de lien vers l’Optimizer');
  copie.monstres[0].equipement!.runes[0].level = 1;
  egal(e.monstres[0].equipement!.runes[0].level, 15, 'la copie est détachée de l’original');
  egal(nomEquipeLibre([e, { ...e, nom: 'Équipe 1' }], (k) => `Équipe ${k}`), 'Équipe 2', 'nom libre');
}

function testEquipesEnregistreesRecherche() {
  titre('Mes équipes — recherche par monstre dans l’onglet ouvert');
  const gojo = monstreJeu(2001, 1001);
  const werner = monstreJeu(1001, 2001);
  const index = new Map([[1, monstreJeu(1)], [2, monstreJeu(2)], [1001, werner], [2001, gojo]]);
  const eq = (id: string, onglet: 'rta' | 'pve', ids: number[], quand: string): EquipeEnregistree =>
    ({ ...creerEquipe(id, onglet, id, new Date(quand)), monstres: ids.map((c, i) => monstreEx(`${id}${i}`, c, null)) });
  const toutes = [eq('a', 'rta', [1, 2], '2026-01-01'), eq('b', 'rta', [1, 1001], '2026-02-01'), eq('c', 'pve', [1, 2], '2026-03-01')];
  egal(equipesFiltrees(toutes, 'rta', [], index).map((e) => e.id), ['b', 'a'], 'sans recherche : l’onglet, dernière modifiée en premier');
  egal(equipesFiltrees(toutes, 'rta', [monstreJeu(1), monstreJeu(2)], index).map((e) => e.id), ['a'], 'tous les monstres recherchés sont exigés');
  egal(equipesFiltrees(toutes, 'rta', [gojo], index).map((e) => e.id), ['b'], 'une collaboration et sa version SW comptent pour la même espèce');
  egal(compteParOnglet(toutes).rta, 2, 'compte par onglet');
}

export const verificationsEquipesEnregistrees: [string, () => void][] = [
  testEquipesEnregistreesRelecture, testEquipesEnregistreesComparaison, testEquipesEnregistreesOperations, testEquipesEnregistreesRecherche,
].map((f) => [f.name, f]);
