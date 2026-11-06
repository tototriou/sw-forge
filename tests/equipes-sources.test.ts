// Les sources de « Mes équipes » : l'équipement d'un monstre ajouté et les
// imports d'équipes (docs/02-app/compte/feat-equipes.md).
//
// ⚠️ Ce qui casserait sans bruit : une copie de la Box choisie à la place
// d'un preset qui n'en dit rien, un import qui modifie l'équipement source,
// une source vide qui crée une équipe vide au lieu de dire pourquoi.

import { egal, ok, titre } from './outils';
import type { Monster, SiegeTeam } from '../src/types';
import { fr } from '../src/i18n/fr';
import { indexerInventaire } from '../src/lib/equipesEnregistrees';
import { sourcesEquipementEspece, sourcesImportEquipes, type ContexteSourcesEquipes } from '../src/lib/sourcesEquipesEnregistrees';
import { equipementEx } from './equipes-enregistrees.test';

const T0 = new Date('2026-11-05T10:00:00Z');
function monstre(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 1, attack: 1, defense: 1, speed: 100, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 }, leaderSkill: null };
}
const deck = (id: string, ids: (string | null)[]): SiegeTeam => ({ id, lead: 0, tickAlertDismissed: false,
  slots: ids.map((m, i) => ({ monsterId: m, runeSpeed: null, tick: 0, gear: equipementEx(10 * (i + 1)) })) });
function contexte(): ContexteSourcesEquipes {
  const ms = [1, 2, 3].map(monstre);
  return {
    box: [{ key: '11', monster: ms[0], stars: 6, level: 40, gear: equipementEx(1) }, { key: '12', monster: ms[0], stars: 6, level: 35, gear: equipementEx(2) }],
    siegeDefenseTeams: [deck('d1', ['1', '2', '99'])], siegeOffenseTeams: [deck('o1', [null, null, null])],
    arenaDecks: [{ cle: 'defense', rang: 0, slots: [{ unitId: 11, com2usId: 1001, gear: equipementEx(4) }, { unitId: 21, com2usId: 1002, gear: equipementEx(5) }] }],
    compte: true,
    monsterById: new Map(ms.map((m) => [String(m.id), m])),
    monsterByCom2us: new Map(ms.map((m) => [m.com2usId as number, m])),
  };
}
const inv = indexerInventaire([], [], []);
let n = 0;
const uid = () => `u${++n}`;

function testEquipesSourcesEquipement() {
  titre('Mes équipes — l’équipement d’un monstre ajouté');
  const s = sourcesEquipementEspece(1001, contexte(), fr);
  egal(s.map((x) => [x.libelle, x.provenance, x.unitId]), [
    ['Équipement porté (niveau 40)', 'porte', 11], ['Équipement porté (niveau 35)', 'porte', 12],
['Défense de siège 1', 'siege-defense', null],
    ['Défense d’arène', 'arene-defense', 11], ['Sans équipement', 'aucun', null],
  ], 'chaque exemplaire de la Box, les decks ; un deck de siège sans unité garde unitId null');
  egal(sourcesEquipementEspece(1003, contexte(), fr).map((x) => x.provenance), ['aucun'], 'une espèce inconnue du compte : sans équipement seulement');
}

function testEquipesSourcesImports() {
  titre('Mes équipes — imports d’équipes');
  const ctx = contexte();
  const avant = structuredClone(ctx.siegeDefenseTeams);
  const sources = sourcesImportEquipes(ctx, null, inv, 'pve', fr);
  egal(sources.map((x) => [x.groupe, x.libelle, x.raison]), [
    ['Défenses de siège', 'Défense 1', null], ['Attaques de siège', 'Attaque 1', 'Aucun deck dans ton compte.'],
    ['Arène', 'Défense d’arène', null], ['Optimizer', 'Optimizer', 'Aucune liste dans l’Optimizer.'],
  ], 'une source par deck, une source vide dite avec sa raison');
  const cree = sources[0].creer('e1', uid, T0);
  ok(cree !== null, 'la défense crée une équipe');
  if (!cree) return;
  egal([cree.equipe.onglet, cree.equipe.nom, cree.equipe.monstres.map((m) => [m.com2usId, m.unitId, m.provenance])],
    ['siege-defense', 'Défense 1', [[1001, null, 'siege-defense'], [1002, null, 'siege-defense']]], 'dans son onglet, le preset copié, sans unité');
  egal(cree.ignores, 1, 'un monstre inconnu est compté');
  egal(cree.equipe.leader, cree.equipe.monstres[0].uid, 'le slot 0 est le leader');
  cree.equipe.monstres[0].equipement!.runes[0].level = 0;
  egal(ctx.siegeDefenseTeams, avant, 'la source n’est jamais modifiée');
  const sansTete = sourcesImportEquipes({ ...ctx, siegeDefenseTeams: [deck('d2', [null, '2', '1'])] }, null, inv, 'pve', fr)[0].creer('e3', uid, T0);
  egal(sansTete?.equipe.leader, null, 'un slot 0 vide laisse l’équipe sans leader, le slot 1 n’en devient pas un');
  const arene = sources[2].creer('e2', uid, T0);
  egal(arene && [arene.equipe.onglet, arene.equipe.monstres[0].unitId], ['arene-defense', 11], 'un deck d’arène garde l’unité');
  egal(sourcesImportEquipes({ ...ctx, arenaDecks: null }, null, inv, 'pve', fr).find((x) => x.groupe === 'Arène')?.raison,
    fr.equipes.imports.reimporter, 'compte conservé sans ses decks d’arène : réimporter');
  egal(sourcesImportEquipes({ ...ctx, compte: false }, null, inv, 'pve', fr).find((x) => x.groupe === 'Arène')?.raison,
    fr.equipes.imports.sansCompte, 'sans compte : la raison le dit');
  const seul = sourcesImportEquipes({ ...ctx, siegeDefenseTeams: [deck('d3', ['1', '99', null])] }, null, inv, 'pve', fr)[0];
  egal(seul.raison, fr.equipes.imports.moinsDeDeux, 'une seule espèce connue : pas importable, une équipe a au moins deux monstres');
}

export const verificationsEquipesSources: [string, () => void][] = [
  ['testEquipesSourcesEquipement', testEquipesSourcesEquipement],
  ['testEquipesSourcesImports', testEquipesSourcesImports],
];
