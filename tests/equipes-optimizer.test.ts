// L'aller-retour entre « Mes équipes » et l'Optimizer
// (docs/02-app/compte/feat-equipes.md, « Aller-retour avec l'Optimizer »).
//
// ⚠️ Ce qui casserait sans bruit : un retour qui crée de nouveaux monstres au
// lieu de retrouver les siens, une pièce absente de l'inventaire perdue alors
// qu'une copie est enregistrée, deux builds validés sur la même rune.

import { egal, ok, titre } from './outils';
import type { Monster } from '../src/types';
import type { BoxItem } from '../src/lib/applyAccount';
import type { ExclusionSourceData } from '../src/lib/optimizerExclusion';
import type { StockageOptimizer } from '../src/lib/optimizerMemberStorage';
import { consommerImportOptimizer } from '../src/lib/importEquipes';
import { creerEquipe, indexerInventaire, type EquipeEnregistree } from '../src/lib/equipesEnregistrees';
import { creerDepuisEquipeOptimizer, disponibiliteRetourOptimizer, equipeLieeA, lienApresExportOptimizer, preparerExportEquipeOptimizer, preparerRetourOptimizer } from '../src/lib/importEquipesEnregistrees';
import { sourcesImportEquipes } from '../src/lib/sourcesEquipesEnregistrees';
import { fr } from '../src/i18n/fr';
import { equipementEx, monstreEx, runeEx } from './equipes-enregistrees.test';

const T0 = new Date('2026-11-05T10:00:00Z');
const T1 = new Date('2026-11-05T12:00:00Z');

function monstre(id: number): Monster {
  return { id, com2usId: 1000 + id, name: `Monstre ${id}`, element: 'fire', stars: 5, naturalStars: 5, secondAwaken: false,
    image: null, stats: { hp: 10000, attack: 700, defense: 600, speed: 101, critRate: 15, critDamage: 50, resistance: 15, accuracy: 0 },
    leaderSkill: id === 1 ? { stat: 'Attack Speed', amount: 24, area: 'Guild', element: null } : null };
}
function sources(): ExclusionSourceData {
  const box: BoxItem[] = [{ key: '11', monster: monstre(1), stars: 6, level: 40, gear: equipementEx(1) }];
  return { box, rtaEntries: {}, siegeDefenseTeams: [], siegeOffenseTeams: [],
    monsterById: new Map([1, 2, 3].map((id) => [String(id), monstre(id)])) };
}
const vide = (): StockageOptimizer => ({ identities: new Map(), lists: [], members: [], validated: [], memories: new Map(),
  teams: [], listContents: new Map(), rejets: { listContents: [], memories: [], teams: [] } });
// L'inventaire : les pièces du monstre 1, la rune 3 améliorée depuis.
const inventaire = () => {
  const eq = equipementEx(1);
  return indexerInventaire(eq.runes.map((r) => (r.id === 3 ? runeEx(3, 3, 99) : r)), eq.artifacts, [eq.relic!]);
};
function equipe(): EquipeEnregistree {
  return { ...creerEquipe('e1', 'siege-defense', 'Défense GW', T0),
    monstres: [monstreEx('a', 1001, 11), monstreEx('b', 1002, null, equipementEx(20)), monstreEx('c', 1001, 11)], leader: 'a' };
}

function testEquipesOptimizerExport() {
  titre('Mes équipes — export vers l’Optimizer');
  const { proposition: p, correspondance } = preparerExportEquipeOptimizer(equipe(), sources(), inventaire(), fr);
  egal([p.nomListe, p.contenu], ['Défense GW', 'guilde'], 'la liste prend le nom de l’équipe et le contenu de son onglet');
  egal(p.membres.map((m) => m.selector), [{ source: 'box', unitKey: '11' }, { source: 'unowned', monsterId: '2' }],
    'l’exemplaire de la Box, et un monstre non possédé pour celui qui n’y est pas');
  egal(p.ignores.map((i) => i.raison), [fr.equipes.export.memeExemplaire], 'le même exemplaire deux fois : le second est écarté');
  egal(correspondance.map((c) => c.uid), ['a', 'b'], 'chaque membre retient son monstre enregistré');
  egal(p.equipes[0].leader, { source: 'box', unitKey: '11' }, 'le leader suit');
  egal(p.buildsAValider?.map((b) => [b.runeIds, b.runesManquantes, b.artifactIds, b.reliqueId]),
    [[[1, 2, 3, 4, 5, 6], [], [10, 11], 100], [[20, 21, 22, 23, 24, 25], [20, 21, 22, 23, 24, 25], [200, 201], 2000]],
    'un build à valider par monstre aux 6 runes, les pièces absentes de l’inventaire dites manquantes');
  ok(p.messages.includes(fr.equipes.export.piecesModifiees('Monstre 1', 1)), 'une pièce changée depuis l’enregistrement est dite');
  ok(p.messages.includes(fr.equipes.export.nonPossede('Monstre 2')), 'un monstre non possédé est dit');
  const incomplet = { ...equipe(), monstres: [monstreEx('a', 1001, 11, { ...equipementEx(1), runes: equipementEx(1).runes.slice(0, 5) })] };
  egal(preparerExportEquipeOptimizer(incomplet, sources(), inventaire(), fr).proposition.buildsAValider, [], 'moins de 6 runes : aucun build proposé');
}

function exporter(e: EquipeEnregistree, data = sources()) {
  const prep = preparerExportEquipeOptimizer(e, data, inventaire(), fr);
  const r = consommerImportOptimizer(vide(), null, prep.proposition, data, 'liste', fr);
  const lie: EquipeEnregistree = { ...e, lienOptimizer: lienApresExportOptimizer(prep, r.rapport)! };
  return { r, lie };
}

function testEquipesOptimizerBuilds() {
  titre('Mes équipes — builds validés à l’import');
  const { r } = exporter(equipe());
  egal(r.rapport.buildsValides, 2, 'les deux builds proposés sont validés');
  egal(r.stockage.validated.map((v) => [v.listId, v.runesManquantes ?? []]), [['liste', []], ['liste', [20, 21, 22, 23, 24, 25]]],
    'dans la liste créée, les manquantes gardées');
  egal(r.rapport.equipesCreeesIds?.length, 1, 'l’équipe créée est nommée au rapport');
  egal(lienApresExportOptimizer(preparerExportEquipeOptimizer(equipe(), sources(), inventaire(), fr), { ...r.rapport, listeCreee: null }), null, 'export refusé : aucun lien');
  egal(exporter(equipe()).lie.lienOptimizer, { listId: 'liste', equipeId: r.rapport.equipesCreeesIds![0],
    correspondance: preparerExportEquipeOptimizer(equipe(), sources(), inventaire(), fr).correspondance }, 'le lien : la liste, son équipe, la correspondance');
  // Deux monstres sur les mêmes runes présentes : le second n'est pas validé.
  const conflit = { ...equipe(), monstres: [monstreEx('a', 1001, 11), monstreEx('b', 1002, null, equipementEx(1))] };
  const r2 = exporter(conflit).r;
  egal(r2.rapport.buildsValides, 1, 'une rune déjà réservée par un build précédent refuse le suivant');
  ok(r2.rapport.messages.includes(fr.optimizer.importsEquipe.buildNonValide('Monstre 2', 'Monstre 1')), 'et le rapport le dit');
}

function testEquipesOptimizerRetour() {
  titre('Mes équipes — mise à jour depuis l’Optimizer');
  egal(disponibiliteRetourOptimizer(equipe(), vide(), sources()), 'sansLien', 'sans lien, rien à reprendre');
  const { r, lie } = exporter(equipe());
  const st = r.stockage;
  egal(disponibiliteRetourOptimizer(lie, { ...st, lists: [] }, sources()), 'listeAbsente', 'liste supprimée : refus');
  egal(disponibiliteRetourOptimizer(lie, { ...st, teams: [] }, sources()), 'equipeAbsente', 'équipe supprimée : refus, rien deviné');
  // Le build du monstre 1 change : la rune 25 (emplacement 6) vient du monstre 2, la 999 n'existe nulle part.
  const validated = st.validated.map((v) => (v.selector.source === 'box'
    ? { listId: v.listId, selector: v.selector, runeIds: [1, 2, 3, 4, 5, 25, 999], artifactIds: [10, 11] } : v));
  let n = 0;
  const retour = preparerRetourOptimizer(lie, { ...st, validated }, sources(), inventaire(), () => `neuf${++n}`, T1);
  if (typeof retour === 'string') return ok(false, `retour refusé : ${retour}`);
  egal(retour.equipe.monstres.map((m) => m.uid), ['a', 'b'], 'chaque membre retrouve son monstre et son uid');
  egal(retour.equipe.monstres[0].equipement?.runes.map((r) => r.id), [1, 2, 3, 4, 5, 25], 'la rune absente de l’inventaire vient de la copie enregistrée');
  egal(retour.equipe.monstres[0].equipement?.runes[2].subs[0].value, 99, 'une rune présente se relit dans l’inventaire actuel');
  egal(retour.manquantes, [{ libelle: 'Monstre 1', type: 'rune', id: 999 }], 'une pièce introuvable est nommée');
  egal(retour.reliquesGardees, ['Monstre 1'], 'build sans relique : la relique enregistrée est gardée et dite');
  egal(retour.retires, ['Monstre 1'], 'le doublon écarté à l’export quitte l’équipe');
  egal(retour.equipe.leader, 'a', 'le leader de l’équipe de l’Optimizer');
  egal([retour.equipe.nom, retour.equipe.creeLe, retour.equipe.modifieLe], ['Défense GW', T0.toISOString(), T1.toISOString()], 'nom et création gardés, modification datée');
  egal(retour.equipe.lienOptimizer?.correspondance.map((c) => c.uid), ['a', 'b'], 'la correspondance est réécrite');
  // a : la 3 (relue modifiée), la 6 partie, la 25 arrivée ; b inchangé ; c retiré : ses 9 pièces.
  egal([retour.monstresChanges, retour.piecesChangees], [2, 12], 'la confirmation compte ce qui change, pièces du monstre retiré comprises');
  const sansBox = { ...sources(), box: [] };
  egal(disponibiliteRetourOptimizer(lie, st, sansBox), 'membresIntrouvables', 'un membre Box introuvable (compte pas relu) : refus, aucun monstre retiré');
  // L'équipe de l'Optimizer dissoute : rien n'est repris, l'équipe enregistrée garde ses monstres.
  egal(preparerRetourOptimizer(lie, { ...st, teams: [] }, sources(), inventaire(), () => 'x', T1), 'equipeAbsente', 'équipe de l’Optimizer dissoute : refus, rien n’est vidé');
  // Un membre ajouté dans l'Optimizer devient un nouveau monstre.
  const ajout = { ...st, validated, teams: st.teams.map((t) => ({ ...t, members: [...t.members, { source: 'unowned' as const, monsterId: '3' }] })) };
  const r2 = preparerRetourOptimizer(lie, ajout, sources(), inventaire(), () => 'neuf', T1);
  egal(typeof r2 !== 'string' && r2.equipe.monstres.map((m) => [m.uid, m.com2usId]), [['a', 1001], ['b', 1002], ['neuf', 1003]], 'un membre ajouté devient un nouveau monstre');
}

function testEquipesOptimizerImport() {
  titre('Mes équipes — importer une équipe de l’Optimizer');
  const { r } = exporter(equipe());
  const data = sources();
  const ctx = { box: data.box, siegeDefenseTeams: [], siegeOffenseTeams: [], arenaDecks: [], compte: true,
    monsterById: data.monsterById, monsterByCom2us: new Map([...data.monsterById.values()].map((m) => [m.com2usId as number, m])) };
  const src = sourcesImportEquipes(ctx, { stockage: r.stockage, data }, inventaire(), 'pve', fr).filter((x) => x.groupe === fr.equipes.imports.optimizer);
  egal(src.map((x) => [x.libelle, x.raison]), [['Défense GW — équipe 1', null]], 'une source par équipe de liste');
  let n = 0;
  const cree = src[0].creer('neuve', () => `u${++n}`, T1);
  ok(cree !== null, 'l’équipe se crée');
  if (!cree) return;
  egal([cree.equipe.onglet, cree.equipe.monstres.map((m) => [m.com2usId, m.unitId, m.provenance])],
    ['pve', [[1001, 11, 'optimizer'], [1002, null, 'optimizer']]], 'dans l’onglet ouvert, chaque membre et son build validé');
  egal(cree.equipe.monstres[0].equipement?.runes.map((x) => x.id), [1, 2, 3, 4, 5, 6], 'les runes du build validé');
  egal(cree.equipe.leader, 'u1', 'le leader de l’équipe de l’Optimizer');
  ok(cree.equipe.lienOptimizer === undefined, 'une équipe importée n’est pas liée');
  egal(cree.ignores, 0, 'tous les membres repris');
  // Un membre que les sources ne résolvent plus rend la source indisponible.
  const sansDeux = { ...data, monsterById: new Map([...data.monsterById].filter(([k]) => k !== '2')) };
  const src2 = sourcesImportEquipes(ctx, { stockage: r.stockage, data: sansDeux }, inventaire(), 'pve', fr).find((x) => x.groupe === fr.equipes.imports.optimizer)!;
  egal(src2.raison, fr.equipes.retour.refus.membresIntrouvables, 'un membre introuvable désactive la source, avec sa raison');
  // Jamais une liste entière : une liste sans équipe n'est pas une source.
  const sansEquipe = sourcesImportEquipes(ctx, { stockage: { ...r.stockage, teams: [] }, data }, inventaire(), 'pve', fr).filter((x) => x.groupe === fr.equipes.imports.optimizer);
  egal(sansEquipe.map((x) => [x.libelle, x.raison]), [['Optimizer', fr.equipes.imports.aucuneEquipe]], 'une liste sans équipe : aucune source, la raison le dit');
}

// « Enregistrer dans Mes équipes » sur une équipe de l'Optimizer.
function testEquipesOptimizerEnregistrer() {
  titre('Mes équipes — enregistrer une équipe de l’Optimizer');
  const { r, lie } = exporter(equipe());
  const equipeId = r.rapport.equipesCreeesIds![0];
  egal(equipeLieeA([equipe(), lie], 'liste', equipeId)?.id, 'e1', 'l’équipe liée est retrouvée : la mettre à jour');
  egal(equipeLieeA([equipe()], 'liste', equipeId), undefined, 'aucune ne suit l’équipe : en créer une');
  let n = 0;
  const cree = creerDepuisEquipeOptimizer({ listId: 'liste', equipeId, nom: 'Défense GW — équipe 1', onglet: 'guerre-guilde' },
    r.stockage, sources(), inventaire(), 'neuve', () => `u${++n}`, T1);
  if (typeof cree === 'string') return ok(false, `création refusée : ${cree}`);
  egal([cree.equipe.id, cree.equipe.onglet, cree.equipe.nom, cree.equipe.monstres.map((m) => m.com2usId)],
    ['neuve', 'guerre-guilde', 'Défense GW — équipe 1', [1001, 1002]], 'une nouvelle équipe, dans l’onglet choisi, avec les membres de l’équipe');
  egal([cree.equipe.lienOptimizer?.listId, cree.equipe.lienOptimizer?.equipeId, cree.equipe.lienOptimizer?.correspondance.map((c) => c.uid)],
    ['liste', equipeId, ['u1', 'u2']], 'déjà liée : l’enregistrer à nouveau la mettra à jour');
  egal(equipeLieeA([cree.equipe], 'liste', equipeId)?.id, 'neuve', 'et elle est retrouvée comme telle');
  egal(creerDepuisEquipeOptimizer({ listId: 'liste', equipeId: 'disparue', nom: 'x', onglet: 'pve' }, r.stockage, sources(), inventaire(), 'y', () => 'z', T1),
    'equipeAbsente', 'une équipe disparue : refus, rien créé');
}

export const verificationsEquipesOptimizer: [string, () => void][] = [
  ['testEquipesOptimizerEnregistrer', testEquipesOptimizerEnregistrer],
  ['testEquipesOptimizerExport', testEquipesOptimizerExport],
  ['testEquipesOptimizerBuilds', testEquipesOptimizerBuilds],
  ['testEquipesOptimizerRetour', testEquipesOptimizerRetour],
  ['testEquipesOptimizerImport', testEquipesOptimizerImport],
];
